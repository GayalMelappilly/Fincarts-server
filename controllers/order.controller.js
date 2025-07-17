import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Place order user
export const placeOrder = async (req, res) => {

  console.log("Reached place order.")

  try {
    const {
      // Order items - array of {fishId, quantity}
      orderItems,
      // Guest user information (required if not authenticated)
      guestInfo, // {email, fullName, phoneNumber}
      shippingDetails, // {address_line1, address_line2, city, state, postal_code, country, shipping_method, shipping_cost}
      // paymentDetails, // {payment_method, transaction_id}
      couponCode,
      pointsToUse = 0,
      orderNotes
    } = req.body;

    console.log(orderItems, guestInfo, shippingDetails, couponCode, pointsToUse, orderNotes)

    // Check if user is authenticated (userId will be set by auth middleware)
    const userId = req.userId;
    const isGuest = !userId;

    console.log("user id : ", userId)

    // Delete this after implementing payment gateway
    const paymentDetails = {
      paymentMethod: 'card',
      transactionId: '106700001340'
    }

    // Validate required fields
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      console.log('Order items are required and must be a non-empty array')
      return res.status(400).json({
        success: false,
        message: 'Order items are required and must be a non-empty array'
      });
    }

    if (!shippingDetails) {
      console.log('Shipping details are required')
      return res.status(400).json({
        success: false,
        message: 'Shipping details are required'
      });
    }

    if (!paymentDetails || !paymentDetails.paymentMethod) {
      console.log('Payment details are required')
      return res.status(400).json({
        success: false,
        message: 'Payment details are required'
      });
    }

    // For guest users, validate guest information
    if (isGuest) {
      if (!guestInfo || !guestInfo.email || !guestInfo.fullName) {
        console.log('Guest information (email, full_name) is required for guest orders')
        return res.status(400).json({
          success: false,
          message: 'Guest information (email, full_name) is required for guest orders'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestInfo.email)) {
        console.log('Invalid email format')
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    }

    // Validate shipping details
    const requiredShippingFields = ['address', 'city', 'state', 'zip'];
    for (const field of requiredShippingFields) {
      if (!shippingDetails[field]) {
        console.log(`Shipping ${field} is required`)
        return res.status(400).json({
          success: false,
          message: `Shipping ${field} is required`
        });
      }
    }

    // Validate order items format
    for (const item of orderItems) {
      if (!item.fishId || !item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        console.log('Each order item must have a valid fishId and positive integer quantity')
        return res.status(400).json({
          success: false,
          message: 'Each order item must have a valid fishId and positive integer quantity'
        });
      }
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      let orderUserId = userId;

      // If guest user, create a temporary user record or handle guest order
      if (isGuest) {
        // Check if a user with this email already exists
        const existingUser = await tx.users.findUnique({
          where: { email: guestInfo.email }
        });

        if (existingUser) {
          // Use existing user ID
          orderUserId = existingUser.id;
        } else {
          // Create a new user for the guest
          const newUser = await tx.users.create({
            data: {
              email: guestInfo.email,
              full_name: guestInfo.fullName,
              phone_number: guestInfo.phoneNumber || null,
              password_hash: 'GUEST_USER', // Mark as guest user
              user_type: 'guest',
              email_verified: false,
              phone_verified: false
            }
          });
          orderUserId = newUser.id;
        }
      }

      // Validate fish listings and calculate total
      let totalAmount = 0;
      const validatedItems = [];

      for (const item of orderItems) {
        const fishListing = await tx.fish_listings.findUnique({
          where: { id: item.fishId }
        });

        if (!fishListing) {
          throw new Error(`Fish listing with ID ${item.fishId} not found`);
        }

        if (fishListing.listing_status !== 'active') {
          throw new Error(`Fish listing "${fishListing.name}" is not available for purchase`);
        }

        if (fishListing.quantity_available < item.quantity) {
          throw new Error(`Not enough stock for "${fishListing.name}". Only ${fishListing.quantity_available} units available.`);
        }

        const itemTotal = fishListing.price * item.quantity;
        totalAmount += Number(itemTotal);

        validatedItems.push({
          fishId: item.fishId,
          quantity: item.quantity,
          unitPrice: fishListing.price,
          totalPrice: itemTotal,
          fishListing
        });
      }

      // Apply coupon discount if provided
      let discountAmount = 0;
      if (couponCode) {
        // Add your coupon validation logic here
        // For now, we'll just set discount to 0
        discountAmount = 0;
      }

      // Calculate points to use (only for authenticated users)
      let pointsUsed = 0;
      if (!isGuest && pointsToUse > 0) {
        const user = await tx.users.findUnique({
          where: { id: orderUserId }
        });

        if (user && user.points_balance >= pointsToUse) {
          pointsUsed = pointsToUse;
          // Assuming 1 point = 1 unit of currency
          discountAmount += pointsUsed;
        }
      }

      // Add shipping cost to total
      const shippingCost = shippingDetails.shipping_cost || 0;
      const finalTotal = totalAmount + Number(shippingCost) - discountAmount;

      // Create shipping details record
      const shippingRecord = await tx.shipping_details.create({
        data: {
          carrier: shippingDetails.carrier || null,
          shipping_cost: shippingCost,
          shipping_method: shippingDetails.shipping_method || 'standard',
          estimated_delivery: shippingDetails.estimated_delivery || null,
          shipping_notes: shippingDetails.shipping_notes || {}
        }
      });

      // Create payment details record
      const paymentRecord = await tx.payment_details.create({
        data: {
          payment_method: paymentDetails.paymentMethod,
          transaction_id: paymentDetails.transactionId || null,
          status: 'pending',
          payment_date: new Date(),
          payment_metadata: paymentDetails.metadata || {}
        }
      });

      // Calculate points to be earned (2% of total amount)
      const pointsEarned = Math.floor(finalTotal * 0.02);

      // Create order
      const order = await tx.orders.create({
        data: {
          user_id: orderUserId,
          total_amount: finalTotal,
          status: 'pending',
          shipping_details_id: shippingRecord.id,
          payment_details_id: paymentRecord.id,
          points_earned: pointsEarned,
          points_used: pointsUsed,
          discount_amount: discountAmount,
          coupon_code: couponCode || null,
          order_notes: orderNotes || null
        }
      });

      // Create order items and update fish listing quantities
      const orderItemsData = [];
      for (const item of validatedItems) {
        // Create order item
        const orderItem = await tx.order_items.create({
          data: {
            order_id: order.id,
            fish_listing_id: item.fishId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            total_price: item.totalPrice
          }
        });

        orderItemsData.push(orderItem);

        // Update fish listing quantity
        await tx.fish_listings.update({
          where: { id: item.fishId },
          data: {
            quantity_available: {
              decrement: item.quantity
            }
          }
        });
      }

      // Update user points balance if points were used or earned
      if (!isGuest && (pointsUsed > 0 || pointsEarned > 0)) {
        await tx.users.update({
          where: { id: orderUserId },
          data: {
            points_balance: {
              increment: pointsEarned - pointsUsed
            }
          }
        });
      }

      // If user had items in cart, clear them (only for authenticated users)
      if (!isGuest) {
        const cart = await tx.shopping_carts.findFirst({
          where: {
            user_id: orderUserId,
            is_active: true
          }
        });

        if (cart) {
          // Remove ordered items from cart
          const fishIds = orderItems.map(item => item.fishId);
          await tx.cart_items.deleteMany({
            where: {
              cart_id: cart.id,
              fish_listing_id: {
                in: fishIds
              }
            }
          });
        }
      }

      return {
        order,
        orderItems: orderItemsData,
        shippingDetails: shippingRecord,
        paymentDetails: paymentRecord
      };
    });

    // Send success response
    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: result.order.id,
        orderStatus: result.order.status,
        totalAmount: result.order.total_amount,
        estimatedDelivery: result.shippingDetails.estimated_delivery,
        pointsEarned: result.order.points_earned,
        isGuestOrder: isGuest
      }
    });

  } catch (error) {
    console.error('Error placing order:', error);
    
    // Handle specific error types
    if (error.message.includes('not found') || error.message.includes('not available') || error.message.includes('Not enough stock')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred while placing the order',
      error: error.message
    });
  }
};

// Cart Checkout
export const cartCheckout = async (req, res) => {
  console.log("Reached cart checkout.");

  try {
    const {
      cartId,
      cartItems,
      guestInfo,
      shippingDetails,
      couponCode,
      pointsToUse = 0,
      orderNotes,
      selectedItems
    } = req.body;

    console.log("Cart checkout data:", { cartId, cartItems, guestInfo, shippingDetails, couponCode, pointsToUse, orderNotes, selectedItems });

    const userId = req.userId;
    const isGuest = !userId;

    // Delete this after implementing payment gateway
    const paymentDetails = {
      paymentMethod: 'card',
      transactionId: `CART_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Validate required fields (same as before)
    if (!shippingDetails) {
      return res.status(400).json({
        success: false,
        message: 'Shipping details are required'
      });
    }

    if (!paymentDetails || !paymentDetails.paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'Payment details are required'
      });
    }

    // Validate cart data based on user type (same as before)
    if (isGuest) {
      if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart items are required for guest checkout'
        });
      }

      if (!guestInfo || !guestInfo.email || !guestInfo.fullName) {
        return res.status(400).json({
          success: false,
          message: 'Guest information (email, fullName) is required for guest orders'
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestInfo.email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }
    } else {
      if (!cartId) {
        return res.status(400).json({
          success: false,
          message: 'Cart ID is required for authenticated users'
        });
      }
    }

    // Validate shipping details (same as before)
    const requiredShippingFields = ['address', 'city', 'state', 'zip'];
    for (const field of requiredShippingFields) {
      if (!shippingDetails[field]) {
        return res.status(400).json({
          success: false,
          message: `Shipping ${field} is required`
        });
      }
    }

    // STEP 1: Pre-process data outside transaction
    let orderUserId = userId;
    let itemsToCheckout = [];
    let userPointsBalance = 0;

    // Handle guest user creation/lookup outside transaction
    if (isGuest) {
      const existingUser = await prisma.users.findUnique({
        where: { email: guestInfo.email }
      });

      if (existingUser) {
        orderUserId = existingUser.id;
        userPointsBalance = existingUser.points_balance || 0;
      } else {
        const newUser = await prisma.users.create({
          data: {
            email: guestInfo.email,
            full_name: guestInfo.fullName,
            phone_number: guestInfo.phoneNumber || null,
            password_hash: 'GUEST_USER',
            user_type: 'customer',
            email_verified: false,
            phone_verified: false
          }
        });
        orderUserId = newUser.id;
        userPointsBalance = 0;
      }

      // Fetch fish listings for cart items
      const fishListingIds = cartItems.map(item => item.fishListingId);
      const fishListings = await prisma.fish_listings.findMany({
        where: { id: { in: fishListingIds } },
        include: { users: true }
      });

      const fishListingsMap = {};
      fishListings.forEach(listing => {
        fishListingsMap[listing.id] = listing;
      });

      itemsToCheckout = cartItems.map(cartItem => {
        const fishListing = fishListingsMap[cartItem.fishListingId];
        if (!fishListing) {
          throw new Error(`Fish listing not found for ID: ${cartItem.fishListingId}`);
        }
        return {
          id: cartItem.id,
          quantity: cartItem.quantity,
          fish_listings: fishListing
        };
      });
    } else {
      // Fetch user data and cart data
      const [user, userCart] = await Promise.all([
        prisma.users.findUnique({
          where: { id: orderUserId },
          select: { points_balance: true }
        }),
        prisma.shopping_carts.findFirst({
          where: {
            id: cartId,
            user_id: orderUserId,
            is_active: true
          },
          include: {
            cart_items: {
              include: {
                fish_listings: {
                  include: { users: true }
                }
              }
            }
          }
        })
      ]);

      if (!userCart || !userCart.cart_items.length) {
        throw new Error('No active cart found or cart is empty');
      }

      userPointsBalance = user?.points_balance || 0;
      itemsToCheckout = userCart.cart_items;
    }

    // Filter and validate items
    if (selectedItems && selectedItems.length > 0) {
      const selectedItemIds = selectedItems.map(item => item.cartItemId);
      itemsToCheckout = itemsToCheckout.filter(item => 
        selectedItemIds.includes(item.id)
      );

      itemsToCheckout = itemsToCheckout.map(item => {
        const selectedItem = selectedItems.find(si => si.cartItemId === item.id);
        if (selectedItem && selectedItem.quantity) {
          return { ...item, quantity: selectedItem.quantity };
        }
        return item;
      });
    }

    if (itemsToCheckout.length === 0) {
      throw new Error('No items selected for checkout');
    }

    // STEP 2: Process order calculations
    const itemsBySeller = {};
    let totalCartAmount = 0;

    for (const cartItem of itemsToCheckout) {
      const fishListing = cartItem.fish_listings;
      const sellerId = fishListing.seller_id || 'platform';

      if (fishListing.listing_status !== 'active') {
        throw new Error(`Fish listing "${fishListing.name}" is not available for purchase`);
      }

      if (fishListing.quantity_available < cartItem.quantity) {
        throw new Error(`Not enough stock for "${fishListing.name}". Only ${fishListing.quantity_available} units available.`);
      }

      const itemTotal = Number(fishListing.price) * cartItem.quantity;
      totalCartAmount += itemTotal;

      if (!itemsBySeller[sellerId]) {
        itemsBySeller[sellerId] = {
          seller: fishListing.users,
          items: [],
          totalAmount: 0
        };
      }

      itemsBySeller[sellerId].items.push({
        cartItemId: cartItem.id,
        fishId: fishListing.id,
        quantity: cartItem.quantity,
        unitPrice: fishListing.price,
        totalPrice: itemTotal,
        fishListing: fishListing
      });

      itemsBySeller[sellerId].totalAmount += itemTotal;
    }

    // Calculate discounts and points
    let totalDiscountAmount = 0;
    let pointsUsed = 0;

    if (couponCode) {
      // Add coupon validation logic here
      totalDiscountAmount = 0;
    }

    if (!isGuest && pointsToUse > 0 && userPointsBalance >= pointsToUse) {
      pointsUsed = pointsToUse;
      totalDiscountAmount += pointsUsed;
    }

    const shippingCost = Number(shippingDetails.shipping_cost) || 0;
    const finalTotalAmount = totalCartAmount + shippingCost - totalDiscountAmount;

    // STEP 3: Execute optimized transaction
    const result = await prisma.$transaction(async (tx) => {
      const createdOrders = [];
      const updatePromises = [];

      // Batch create shipping and payment details
      const sellerIds = Object.keys(itemsBySeller);
      const shippingDetailsPromises = sellerIds.map(sellerId => {
        const sellerShippingCost = shippingCost / sellerIds.length;
        return tx.shipping_details.create({
          data: {
            carrier: shippingDetails.carrier || null,
            shipping_cost: sellerShippingCost,
            shipping_method: shippingDetails.shipping_method || 'standard',
            estimated_delivery: shippingDetails.estimated_delivery || null,
            shipping_notes: {
              ...shippingDetails.shipping_notes,
              seller_id: sellerId,
              original_shipping_cost: shippingCost
            }
          }
        });
      });

      const paymentDetailsPromises = sellerIds.map(sellerId => {
        return tx.payment_details.create({
          data: {
            payment_method: paymentDetails.paymentMethod,
            transaction_id: `${paymentDetails.transactionId}_${sellerId}`,
            status: 'pending',
            payment_date: new Date(),
            payment_metadata: {
              ...paymentDetails.metadata,
              seller_id: sellerId,
              original_transaction_id: paymentDetails.transactionId
            }
          }
        });
      });

      // Execute all shipping and payment details creation in parallel
      const [shippingRecords, paymentRecords] = await Promise.all([
        Promise.all(shippingDetailsPromises),
        Promise.all(paymentDetailsPromises)
      ]);

      // Create orders and order items
      let orderIndex = 0;
      for (const [sellerId, sellerData] of Object.entries(itemsBySeller)) {
        const sellerAmountRatio = sellerData.totalAmount / totalCartAmount;
        const sellerDiscountAmount = totalDiscountAmount * sellerAmountRatio;
        const sellerPointsUsed = Math.floor(pointsUsed * sellerAmountRatio);
        const sellerShippingCost = shippingCost / sellerIds.length;
        const sellerFinalAmount = sellerData.totalAmount + sellerShippingCost - sellerDiscountAmount;
        const pointsEarned = Math.floor(sellerFinalAmount * 0.02);

        // Create order
        const order = await tx.orders.create({
          data: {
            user_id: orderUserId,
            total_amount: sellerFinalAmount,
            status: 'pending',
            shipping_details_id: shippingRecords[orderIndex].id,
            payment_details_id: paymentRecords[orderIndex].id,
            points_earned: pointsEarned,
            points_used: sellerPointsUsed,
            discount_amount: sellerDiscountAmount,
            coupon_code: couponCode || null,
            order_notes: orderNotes ? `${orderNotes} | Seller: ${sellerId}` : `Seller: ${sellerId}`
          }
        });

        // Batch create order items
        const orderItemsData = sellerData.items.map(item => ({
          order_id: order.id,
          fish_listing_id: item.fishId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          total_price: item.totalPrice
        }));

        const orderItems = await tx.order_items.createMany({
          data: orderItemsData
        });

        // Batch update fish listing quantities
        for (const item of sellerData.items) {
          updatePromises.push(
            tx.fish_listings.update({
              where: { id: item.fishId },
              data: {
                quantity_available: {
                  decrement: item.quantity
                }
              }
            })
          );
        }

        createdOrders.push({
          order,
          orderItems,
          shippingDetails: shippingRecords[orderIndex],
          paymentDetails: paymentRecords[orderIndex],
          seller: sellerData.seller,
          pointsEarned
        });

        orderIndex++;
      }

      // Execute all fish listing updates in parallel
      await Promise.all(updatePromises);

      // Update user points balance
      if (!isGuest) {
        const totalPointsEarned = createdOrders.reduce((sum, order) => sum + order.pointsEarned, 0);
        
        if (pointsUsed > 0 || totalPointsEarned > 0) {
          await tx.users.update({
            where: { id: orderUserId },
            data: {
              points_balance: {
                increment: totalPointsEarned - pointsUsed
              }
            }
          });
        }
      }

      // Clean up cart
      if (!isGuest && cartId) {
        const cartItemIds = itemsToCheckout.map(item => item.id);
        await tx.cart_items.deleteMany({
          where: { id: { in: cartItemIds } }
        });

        const remainingCartItems = await tx.cart_items.count({
          where: { cart_id: cartId }
        });

        if (remainingCartItems === 0) {
          await tx.shopping_carts.update({
            where: { id: cartId },
            data: { is_active: false }
          });
        }
      }

      return {
        orders: createdOrders,
        totalAmount: finalTotalAmount,
        totalPointsEarned: createdOrders.reduce((sum, order) => sum + order.pointsEarned, 0),
        pointsUsed,
        totalDiscountAmount,
        itemsCheckedOut: itemsToCheckout.length,
        sellersCount: sellerIds.length
      };
    }, {
      timeout: 15000, // 15 seconds timeout
      maxWait: 5000
    });

    // Send success response
    return res.status(201).json({
      success: true,
      message: 'Cart checkout completed successfully',
      data: {
        orderIds: result.orders.map(order => order.order.id),
        orders: result.orders.map(order => ({
          orderId: order.order.id,
          orderStatus: order.order.status,
          totalAmount: order.order.total_amount,
          estimatedDelivery: order.shippingDetails.estimated_delivery,
          pointsEarned: order.pointsEarned,
          seller: order.seller ? {
            id: order.seller.id,
            businessName: order.seller.business_name,
            displayName: order.seller.display_name
          } : null,
          itemCount: order.orderItems.length || 0
        })),
        summary: {
          totalAmount: result.totalAmount,
          totalPointsEarned: result.totalPointsEarned,
          pointsUsed: result.pointsUsed,
          totalDiscount: result.totalDiscountAmount,
          itemsCheckedOut: result.itemsCheckedOut,
          sellersCount: result.sellersCount,
          isGuestOrder: isGuest
        }
      }
    });

  } catch (error) {
    console.error('Error during cart checkout:', error);
    
    if (error.message.includes('not found') || 
        error.message.includes('not available') || 
        error.message.includes('Not enough stock') ||
        error.message.includes('cart') ||
        error.message.includes('empty')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred during cart checkout',
      error: error.message
    });
  }
};