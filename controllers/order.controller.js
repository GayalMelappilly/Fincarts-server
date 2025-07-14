import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const placeOrder = async (req, res) => {

  console.log("Reached place order.")

  try {
    const {
      // Order items - array of {fishId, quantity}
      orderItems,
      // Guest user information (required if not authenticated)
      guestInfo, // {email, full_name, phone_number}
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
              user_type: 'customer',
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