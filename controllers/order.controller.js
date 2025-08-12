import { PrismaClient } from '@prisma/client';
import Razorpay from 'razorpay'
import crypto from 'crypto';
import { configDotenv } from "dotenv";
import { sendNotificationEmail } from '../utils/sendNotificationMails.js';
configDotenv();

const prisma = new PrismaClient();

const razorpay = new Razorpay({
  key_id: process.env.RZP_KEY_ID,
  key_secret: process.env.RZP_KEY_SECRET
})

// Create Razorpay order (called before placeOrder from frontend)
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, currency = 'INR', receipt } = req.body;

    // Validate amount (minimum ₹1 = 100 paise)
    if (!amount || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be at least ₹1'
      });
    }

    const options = {
      amount: Math.round(amount * 100), // Convert rupees to paise
      currency,
      receipt: receipt || `order_${Date.now()}`,
      notes: {
        created_at: new Date().toISOString(),
        user_id: req.userId || 'guest'
      }
    };

    const order = await razorpay.orders.create(options);

    console.log('Razorpay order created:', order.id);

    res.json({
      success: true,
      data: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      }
    });

  } catch (error) {
    console.error('Razorpay order creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify Razorpay payment
export const verifyRazorpayPayment = (razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
  try {
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RZP_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    return razorpay_signature === expectedSign;
  } catch (error) {
    console.error('Payment verification error:', error);
    return false;
  }
};



export const placeOrder = async (req, res) => {
  console.log("Reached place order with Razorpay integration.");

  try {
    const {
      // Order items - array of {fishId, quantity}
      orderItems,
      // Guest user information (required if not authenticated)
      guestInfo, // {email, fullName, phoneNumber}
      shippingDetails, // {address, city, state, zip, shipping_method, shipping_cost}
      // Razorpay payment details
      paymentDetails: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_method = 'razorpay'
      },
      couponCode,
      pointsToUse = 0,
      orderNotes
    } = req.body;

    console.log('Order data:', { orderItems, guestInfo, shippingDetails, razorpay_order_id, couponCode, pointsToUse, orderNotes });

    // Check if user is authenticated
    const userId = req.userId;
    const isGuest = !userId;

    console.log("User ID:", userId);

    // Validate required fields
    if (!orderItems || !Array.isArray(orderItems) || orderItems.length === 0) {
      console.log('Order items are required and must be a non-empty array');
      return res.status(400).json({
        success: false,
        message: 'Order items are required and must be a non-empty array'
      });
    }

    if (!shippingDetails) {
      console.log('Shipping details are required');
      return res.status(400).json({
        success: false,
        message: 'Shipping details are required'
      });
    }

    // Validate Razorpay payment details
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('Complete Razorpay payment details are required');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Missing payment details.'
      });
    }

    // Verify Razorpay payment signature
    const isPaymentValid = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isPaymentValid) {
      console.log('Razorpay payment verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid payment signature.'
      });
    }

    console.log('Payment verified successfully');

    // For guest users, validate guest information
    if (isGuest) {
      if (!guestInfo || !guestInfo.email || !guestInfo.fullName) {
        console.log('Guest information (email, fullName) is required for guest orders');
        return res.status(400).json({
          success: false,
          message: 'Guest information (email, fullName) is required for guest orders'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(guestInfo.email)) {
        console.log('Invalid email format');
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
        console.log(`Shipping ${field} is required`);
        return res.status(400).json({
          success: false,
          message: `Shipping ${field} is required`
        });
      }
    }

    // Validate order items format
    for (const item of orderItems) {
      if (!item.fishId || !item.quantity || !Number.isInteger(item.quantity) || item.quantity <= 0) {
        console.log('Each order item must have a valid fishId and positive integer quantity');
        return res.status(400).json({
          success: false,
          message: 'Each order item must have a valid fishId and positive integer quantity'
        });
      }
    }

    // Fetch Razorpay order details to get the paid amount
    let razorpayOrderDetails;
    try {
      razorpayOrderDetails = await razorpay.orders.fetch(razorpay_order_id);
      console.log('Razorpay order details fetched:', razorpayOrderDetails.id);
    } catch (error) {
      console.error('Error fetching Razorpay order:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment order ID'
      });
    }

    // Start transaction with increased timeout for order processing
    const result = await prisma.$transaction(async (tx) => {
      let orderUserId = userId;

      // Handle guest user
      if (isGuest) {
        const existingUser = await tx.users.findUnique({
          where: { email: guestInfo.email }
        });

        if (existingUser) {
          orderUserId = existingUser.id;
        } else {
          const newUser = await tx.users.create({
            data: {
              email: guestInfo.email,
              full_name: guestInfo.fullName,
              phone_number: guestInfo.phoneNumber || null,
              password_hash: 'GUEST_USER',
              user_type: 'guest',
              email_verified: false,
              phone_verified: false
            }
          });
          orderUserId = newUser.id;
        }
      }

      const customerDetails = await tx.users.findUnique({
        where: { id: orderUserId }
      });

      // Validate fish listings and calculate total
      let totalAmount = 0;
      const validatedItems = [];
      const sellerIds = new Set(); // Track unique sellers

      // Validate all order items
      for (const item of orderItems) {
        const fishListing = await tx.fish_listings.findUnique({
          where: { id: item.fishId },
          include: {
            users: true // Include seller details
          }
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
          fishListing,
          sellerId: fishListing.seller_id
        });

        // Track unique sellers
        if (fishListing.seller_id) {
          sellerIds.add(fishListing.seller_id);
        }
      }

      // Get seller details for notifications
      const sellerDetails = await tx.sellers.findUnique({
        where: { id: validatedItems[0].sellerId }
      });

      // Apply coupon discount if provided
      let discountAmount = 0;
      if (couponCode) {
        // TODO: Implement coupon validation logic
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
          discountAmount += pointsUsed;
        }
      }

      // Add shipping cost to total
      const shippingCost = shippingDetails.shipping_cost || 0;
      const calculatedTotal = totalAmount + Number(shippingCost) - discountAmount;

      // Verify the paid amount matches calculated total (convert paise to rupees)
      const paidAmount = razorpayOrderDetails.amount / 100;
      if (Math.abs(paidAmount - calculatedTotal) > 0.01) { // Allow 1 paisa difference for rounding
        throw new Error(`Payment amount mismatch. Expected: ₹${calculatedTotal}, Paid: ₹${paidAmount}`);
      }

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

      // Create payment details record with Razorpay info
      const paymentRecord = await tx.payment_details.create({
        data: {
          payment_method: payment_method,
          transaction_id: razorpay_payment_id,
          status: 'completed', // Payment is already verified
          payment_date: new Date(),
          payment_metadata: {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            amount_paid: paidAmount,
            currency: razorpayOrderDetails.currency || 'INR',
            payment_method: 'razorpay'
          }
        }
      });

      // Calculate points to be earned (2% of total amount)
      const pointsEarned = Math.floor(calculatedTotal * 0.02);

      // Create order
      const order = await tx.orders.create({
        data: {
          user_id: orderUserId,
          total_amount: calculatedTotal,
          status: 'pending', // Order is confirmed since payment is verified
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

      // Clear cart items for authenticated users
      if (!isGuest) {
        const cart = await tx.shopping_carts.findFirst({
          where: {
            user_id: orderUserId,
            is_active: true
          }
        });

        if (cart) {
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
        paymentDetails: paymentRecord,
        itemDetails: validatedItems[0].fishListing,
        sellerEmail: sellerDetails?.email,
        customerDetails: customerDetails,
        validatedItems,
        calculatedTotal,
        sellerIds: Array.from(sellerIds),
        orderUserId
      };
    }, {
      timeout: 10000, // 10 second timeout for main transaction
    });

    // Update seller metrics and sales history after successful order creation
    // This is done outside the main transaction to prevent timeouts
    try {
      await updateSellerMetricsAndSalesHistoryAsync(
        result.orderUserId, 
        result.sellerIds, 
        result.validatedItems, 
        result.calculatedTotal
      );
    } catch (metricsError) {
      console.error('Error updating seller metrics (order still successful):', metricsError);
      // Don't fail the entire order if metrics update fails
    }

    console.log('Order placed successfully:', result);

    // Send notification emails
    if (result.sellerEmail) {
      await sendNotificationEmail(result.sellerEmail, result, 'customer', 'seller');
    }
    await sendNotificationEmail(result.customerDetails.email, result, result.customerDetails.full_name, 'customer');

    // Send success response
    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: {
        orderId: result.order.id,
        orderStatus: result.order.status,
        totalAmount: result.order.total_amount,
        paymentId: razorpay_payment_id,
        estimatedDelivery: result.shippingDetails.estimated_delivery,
        pointsEarned: result.order.points_earned,
        isGuestOrder: isGuest
      }
    });

  } catch (error) {
    console.error('Error placing order:', error);

    // Handle specific error types
    if (error.message.includes('not found') ||
      error.message.includes('not available') ||
      error.message.includes('Not enough stock') ||
      error.message.includes('Payment amount mismatch')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred while placing the order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const updateSellerMetricsAndSalesHistoryAsync = async (userId, sellerIds, validatedItems, totalAmount) => {
  try {
    // Check if this is a new customer for each seller
    const isNewCustomerMap = await checkIfNewCustomerAsync(userId, sellerIds);
    
    // Update seller metrics and sales history
    await updateSellerMetricsAndSalesHistory(validatedItems, totalAmount, isNewCustomerMap);
    
    console.log('Seller metrics updated successfully');
  } catch (error) {
    console.error('Failed to update seller metrics:', error);
    throw error;
  }
};

const checkIfNewCustomerAsync = async (userId, sellerIds) => {
  const newCustomerMap = {};

  // Use Promise.all for parallel processing
  const customerChecks = sellerIds.map(async (sellerId) => {
    // Check if this customer has previously ordered from this seller
    const previousOrders = await prisma.orders.findFirst({
      where: {
        user_id: userId,
        order_items: {
          some: {
            fish_listings: {
              seller_id: sellerId
            }
          }
        },
        status: {
          in: ['completed', 'delivered', 'pending', 'processing']
        }
      }
    });

    return { sellerId, isNew: !previousOrders };
  });

  const results = await Promise.all(customerChecks);
  
  results.forEach(({ sellerId, isNew }) => {
    newCustomerMap[sellerId] = isNew;
  });

  return newCustomerMap;
};

const updateSellerMetricsAndSalesHistory = async (validatedItems, totalAmount, isNewCustomerMap) => {
  // Group items by seller
  const sellerItemsMap = validatedItems.reduce((acc, item) => {
    const sellerId = item.sellerId;
    if (!sellerId) return acc;

    if (!acc[sellerId]) {
      acc[sellerId] = {
        items: [],
        totalSales: 0,
        totalQuantity: 0
      };
    }

    acc[sellerId].items.push(item);
    acc[sellerId].totalSales += Number(item.totalPrice);
    acc[sellerId].totalQuantity += item.quantity;

    return acc;
  }, {});

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  // Process each seller in parallel for better performance
  const sellerUpdates = Object.entries(sellerItemsMap).map(async ([sellerId, sellerData]) => {
    const { totalSales } = sellerData;
    const isNewCustomer = isNewCustomerMap[sellerId] || false;

    try {
      // Use a separate transaction for each seller to avoid conflicts
      await prisma.$transaction(async (tx) => {
        // Update or create seller_metrics
        await tx.seller_metrics.upsert({
          where: { seller_id: sellerId },
          update: {
            total_sales: {
              increment: totalSales
            },
            total_orders: {
              increment: 1
            },
            last_calculated_at: new Date()
          },
          create: {
            seller_id: sellerId,
            total_sales: totalSales,
            total_orders: 1,
            avg_rating: 0,
            total_listings: 0,
            active_listings: 0,
            last_calculated_at: new Date()
          }
        });

        // Update or create daily sales history
        // First try to find existing record
        const existingSalesHistory = await tx.seller_sales_history.findFirst({
          where: {
            seller_id: sellerId,
            date: today
          }
        });

        if (existingSalesHistory) {
          // Update existing record
          await tx.seller_sales_history.update({
            where: {
              uuid_id: existingSalesHistory.uuid_id
            },
            data: {
              daily_sales: {
                increment: totalSales
              },
              order_count: {
                increment: 1
              },
              new_customers: {
                increment: isNewCustomer ? 1 : 0
              }
            }
          });
        } else {
          // Create new record
          await tx.seller_sales_history.create({
            data: {
              seller_id: sellerId,
              date: today,
              daily_sales: totalSales,
              order_count: 1,
              new_customers: isNewCustomer ? 1 : 0,
              cancellations: 0
            }
          });
        }
      }, {
        timeout: 8000 // 8 second timeout for metrics updates
      });

      // Update listing counts and average rating outside transaction for performance
      await updateSellerListingStats(sellerId);

      console.log(`Updated metrics for seller ${sellerId}: Sales +${totalSales}, Orders +1, New Customer: ${isNewCustomer}`);

    } catch (error) {
      console.error(`Error updating seller metrics for seller ${sellerId}:`, error);
      // Continue with other sellers even if one fails
    }
  });

  // Wait for all seller updates to complete
  await Promise.allSettled(sellerUpdates);
};

const updateSellerListingStats = async (sellerId) => {
  try {
    // Update listing counts
    const listingCounts = await prisma.fish_listings.groupBy({
      by: ['listing_status'],
      where: { seller_id: sellerId },
      _count: {
        id: true
      }
    });

    const totalListings = listingCounts.reduce((sum, group) => sum + group._count.id, 0);
    const activeListings = listingCounts.find(group => group.listing_status === 'active')?._count.id || 0;

    // Calculate average rating
    const avgRatingResult = await prisma.reviews.aggregate({
      where: {
        fish_listings: {
          seller_id: sellerId
        }
      },
      _avg: {
        rating: true
      }
    });

    // Update seller metrics with listing stats and rating
    await prisma.seller_metrics.update({
      where: { seller_id: sellerId },
      data: {
        total_listings: totalListings,
        active_listings: activeListings,
        avg_rating: avgRatingResult._avg.rating ? Number(avgRatingResult._avg.rating.toFixed(2)) : 0
      }
    });

  } catch (error) {
    console.error(`Error updating listing stats for seller ${sellerId}:`, error);
  }
};



// Webhook handler for Razorpay events
export const handleRazorpayWebhook = async (req, res) => {
  try {
    const webhookSignature = req.get('x-razorpay-signature');
    const webhookBody = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RZP_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const event = JSON.parse(webhookBody.toString());
    console.log('Webhook event received:', event.event);

    // Handle different webhook events
    switch (event.event) {
      case 'payment.captured':
        console.log('Payment captured:', event.payload.payment.entity.id);
        // Additional logic for successful payment if needed
        break;

      case 'payment.failed':
        console.log('Payment failed:', event.payload.payment.entity.id);
        // Handle failed payment - maybe update order status
        const failedPaymentId = event.payload.payment.entity.id;
        await handleFailedPayment(failedPaymentId);
        break;

      case 'order.paid':
        console.log('Order paid:', event.payload.order.entity.id);
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.json({ status: 'success' });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

// Helper function to handle failed payments
export const handleFailedPayment = async (paymentId) => {
  try {
    // Find the order with this payment ID and update status
    const paymentRecord = await prisma.payment_details.findFirst({
      where: { transaction_id: paymentId }
    });

    if (paymentRecord) {
      await prisma.$transaction(async (tx) => {
        // Update payment status
        await tx.payment_details.update({
          where: { id: paymentRecord.id },
          data: { status: 'failed' }
        });

        // Update order status
        const order = await tx.orders.findFirst({
          where: { payment_details_id: paymentRecord.id }
        });

        if (order) {
          await tx.orders.update({
            where: { id: order.id },
            data: { status: 'payment_failed' }
          });

          // Restore fish listing quantities
          const orderItems = await tx.order_items.findMany({
            where: { order_id: order.id }
          });

          for (const item of orderItems) {
            await tx.fish_listings.update({
              where: { id: item.fish_listing_id },
              data: {
                quantity_available: {
                  increment: item.quantity
                }
              }
            });
          }
        }
      });
    }
  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
};



// Cart Checkout
export const cartCheckout = async (req, res) => {
  console.log("Reached cart checkout with Razorpay integration.");

  try {
    const {
      cartId,
      cartItems,
      guestInfo,
      shippingDetails,
      // Razorpay payment details
      paymentDetails: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        payment_method = 'razorpay'
      },
      couponCode,
      pointsToUse = 0,
      orderNotes,
      selectedItems
    } = req.body;

    console.log("Cart checkout data:", {
      cartId,
      cartItems,
      guestInfo,
      shippingDetails,
      razorpay_order_id,
      couponCode,
      pointsToUse,
      orderNotes,
      selectedItems
    });

    const userId = req.userId;
    const isGuest = !userId;

    // Validate required fields
    if (!shippingDetails) {
      return res.status(400).json({
        success: false,
        message: 'Shipping details are required'
      });
    }

    // Validate Razorpay payment details
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      console.log('Complete Razorpay payment details are required');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Missing payment details.'
      });
    }

    // Verify Razorpay payment signature
    const isPaymentValid = verifyRazorpayPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isPaymentValid) {
      console.log('Razorpay payment verification failed');
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed. Invalid payment signature.'
      });
    }

    console.log('Payment verified successfully');

    // Validate cart data based on user type
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
          message: 'Guest information (email, fullName) is required for cart guest orders'
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

    // Validate shipping details
    const requiredShippingFields = ['address', 'city', 'state', 'zip'];
    for (const field of requiredShippingFields) {
      if (!shippingDetails[field]) {
        return res.status(400).json({
          success: false,
          message: `Shipping ${field} is required`
        });
      }
    }

    // Fetch Razorpay order details to get the paid amount
    let razorpayOrderDetails;
    try {
      razorpayOrderDetails = await razorpay.orders.fetch(razorpay_order_id);
      console.log('Razorpay order details fetched:', razorpayOrderDetails.id);
    } catch (error) {
      console.error('Error fetching Razorpay order:', error);
      return res.status(400).json({
        success: false,
        message: 'Invalid payment order ID'
      });
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
    const sellerIds = new Set(); // Track unique sellers for metrics

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

      // Track seller for metrics
      if (sellerId && sellerId !== 'platform') {
        sellerIds.add(sellerId);
      }

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
        fishListing: fishListing,
        sellerId: sellerId
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

    // Verify the paid amount matches calculated total (convert paise to rupees)
    const paidAmount = razorpayOrderDetails.amount / 100;
    if (Math.abs(paidAmount - finalTotalAmount) > 0.01) { // Allow 1 paisa difference for rounding
      throw new Error(`Payment amount mismatch. Expected: ₹${finalTotalAmount}, Paid: ₹${paidAmount}`);
    }

    // STEP 3: Execute optimized transaction with Razorpay integration
    const result = await prisma.$transaction(async (tx) => {
      const createdOrders = [];
      const updatePromises = [];
      const validatedItemsForMetrics = []; // Collect items for metrics update

      // Batch create shipping and payment details
      const sellerIdsList = Object.keys(itemsBySeller);
      const shippingDetailsPromises = sellerIdsList.map(sellerId => {
        const sellerShippingCost = shippingCost / sellerIdsList.length;
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

      const paymentDetailsPromises = sellerIdsList.map(sellerId => {
        return tx.payment_details.create({
          data: {
            payment_method: payment_method,
            transaction_id: `${razorpay_payment_id}_${sellerId}`,
            status: 'completed', // Payment is already verified
            payment_date: new Date(),
            payment_metadata: {
              razorpay_order_id,
              razorpay_payment_id,
              razorpay_signature,
              amount_paid: paidAmount,
              currency: razorpayOrderDetails.currency || 'INR',
              payment_method: 'razorpay',
              seller_id: sellerId,
              original_transaction_id: razorpay_payment_id
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
        const sellerShippingCost = shippingCost / sellerIdsList.length;
        const sellerFinalAmount = sellerData.totalAmount + sellerShippingCost - sellerDiscountAmount;
        const pointsEarned = Math.floor(sellerFinalAmount * 0.02);

        // Create order with confirmed status since payment is verified
        const order = await tx.orders.create({
          data: {
            user_id: orderUserId,
            total_amount: sellerFinalAmount,
            status: 'pending', // Order is confirmed since payment is verified
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

        // Collect validated items for metrics update
        sellerData.items.forEach(item => {
          validatedItemsForMetrics.push({
            fishId: item.fishId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice,
            fishListing: item.fishListing,
            sellerId: item.sellerId
          });
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
          pointsEarned,
          sellerId: sellerId
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
        sellersCount: sellerIdsList.length,
        validatedItemsForMetrics,
        sellerIds: Array.from(sellerIds),
        orderUserId
      };
    }, {
      timeout: 15000, // 15 seconds timeout
      maxWait: 5000
    });

    // Update seller metrics and sales history after successful order creation
    // This is done outside the main transaction to prevent timeouts
    try {
      await updateCartCheckoutSellerMetricsAsync(
        result.orderUserId,
        result.sellerIds,
        result.validatedItemsForMetrics,
        result.totalAmount,
        result.orders
      );
    } catch (metricsError) {
      console.error('Error updating seller metrics (orders still successful):', metricsError);
      // Don't fail the entire checkout if metrics update fails
    }

    console.log('Cart checkout completed successfully. Orders created:', result.orders.length);

    // Send notification emails to all sellers and customer
    try {
      const customerDetails = await prisma.users.findUnique({
        where: { id: result.orderUserId }
      });

      console.log("Cart checkout result orders : ",result)
      console.log("Result orders on same shit : ", result.orders)

      // Send emails to all sellers
      for (const order of result.orders) {
        console.log("Order inside the fking loop : ", order)
        if (order.order.seller?.email) {
          await sendNotificationEmail(
            order.order.seller.email,
            {
              order: order.order.order,
              orderItems: [order.order.orderItems],
              shippingDetails: order.order.shippingDetails,
              paymentDetails: order.order.paymentDetails,
              itemDetails: order.order.seller,
              customerDetails: customerDetails
            },
            'customer',
            'seller'
          );
        }
      }

      // Send single consolidated email to customer
      if (customerDetails?.email) {
        await sendNotificationEmail(
          customerDetails.email,
          {
            orders: result.orders,
            totalAmount: result.totalAmount,
            customerDetails: customerDetails
          },
          customerDetails.full_name,
          'customer_cart_checkout'
        );
      }
    } catch (emailError) {
      console.error('Error sending notification emails:', emailError);
      // Don't fail the checkout if email sending fails
    }

    // Send success response
    return res.status(201).json({
      success: true,
      message: 'Cart checkout completed successfully',
      data: {
        orderIds: result.orders.map(order => order.order.id),
        paymentId: razorpay_payment_id,
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
          itemCount: order.orderItems.count || 0
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

    // Handle specific error types
    if (error.message.includes('not found') ||
      error.message.includes('not available') ||
      error.message.includes('Not enough stock') ||
      error.message.includes('Payment amount mismatch') ||
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
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

const updateCartCheckoutSellerMetricsAsync = async (userId, sellerIds, validatedItems, totalAmount, orders) => {
  try {
    // Check if this is a new customer for each seller
    const isNewCustomerMap = await checkIfNewCustomerForMultipleSellersAsync(userId, sellerIds);
    
    // Group items and orders by seller for metrics calculation
    const sellerMetricsData = groupSellerDataForMetrics(validatedItems, orders, isNewCustomerMap);
    
    // Update seller metrics and sales history for all sellers
    await updateMultipleSellerMetricsAndSalesHistory(sellerMetricsData);
    
    console.log('Cart checkout seller metrics updated successfully for sellers:', sellerIds);
  } catch (error) {
    console.error('Failed to update cart checkout seller metrics:', error);
    throw error;
  }
};

const checkIfNewCustomerForMultipleSellersAsync = async (userId, sellerIds) => {
  const newCustomerMap = {};

  if (!sellerIds || sellerIds.length === 0) {
    return newCustomerMap;
  }

  try {
    // Use a single query to check all sellers at once for better performance
    const existingOrders = await prisma.orders.findMany({
      where: {
        user_id: userId,
        order_items: {
          some: {
            fish_listings: {
              seller_id: {
                in: sellerIds
              }
            }
          }
        },
        status: {
          in: ['completed', 'delivered', 'pending', 'processing']
        }
      },
      include: {
        order_items: {
          include: {
            fish_listings: {
              select: {
                seller_id: true
              }
            }
          }
        }
      }
    });

    // Create a set of sellers who already have orders from this customer
    const existingSellers = new Set();
    existingOrders.forEach(order => {
      order.order_items.forEach(item => {
        if (item.fish_listings?.seller_id) {
          existingSellers.add(item.fish_listings.seller_id);
        }
      });
    });

    // Map each seller to whether they're a new customer or not
    sellerIds.forEach(sellerId => {
      newCustomerMap[sellerId] = !existingSellers.has(sellerId);
    });

    return newCustomerMap;
  } catch (error) {
    console.error('Error checking new customers for multiple sellers:', error);
    // Default to all as new customers if there's an error
    sellerIds.forEach(sellerId => {
      newCustomerMap[sellerId] = true;
    });
    return newCustomerMap;
  }
};

const groupSellerDataForMetrics = (validatedItems, orders, isNewCustomerMap) => {
  const sellerMetricsData = {};

  // Group items by seller
  validatedItems.forEach(item => {
    const sellerId = item.sellerId;
    if (!sellerId || sellerId === 'platform') return;

    if (!sellerMetricsData[sellerId]) {
      sellerMetricsData[sellerId] = {
        items: [],
        totalSales: 0,
        totalQuantity: 0,
        orderCount: 0,
        isNewCustomer: isNewCustomerMap[sellerId] || false
      };
    }

    sellerMetricsData[sellerId].items.push(item);
    sellerMetricsData[sellerId].totalSales += Number(item.totalPrice);
    sellerMetricsData[sellerId].totalQuantity += item.quantity;
  });

  // Add order count for each seller
  orders.forEach(orderData => {
    const sellerId = orderData.sellerId;
    if (sellerId && sellerId !== 'platform' && sellerMetricsData[sellerId]) {
      sellerMetricsData[sellerId].orderCount += 1;
    }
  });

  return sellerMetricsData;
};

const updateMultipleSellerMetricsAndSalesHistory = async (sellerMetricsData) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  // Process each seller in parallel for better performance
  const sellerUpdates = Object.entries(sellerMetricsData).map(async ([sellerId, sellerData]) => {
    const { totalSales, orderCount, isNewCustomer } = sellerData;

    try {
      // Use a separate transaction for each seller to avoid conflicts and improve performance
      await prisma.$transaction(async (tx) => {
        // Update or create seller_metrics
        await tx.seller_metrics.upsert({
          where: { seller_id: sellerId },
          update: {
            total_sales: {
              increment: totalSales
            },
            total_orders: {
              increment: orderCount
            },
            last_calculated_at: new Date()
          },
          create: {
            seller_id: sellerId,
            total_sales: totalSales,
            total_orders: orderCount,
            avg_rating: 0,
            total_listings: 0,
            active_listings: 0,
            last_calculated_at: new Date()
          }
        });

        // Update or create daily sales history
        // First try to find existing record
        const existingSalesHistory = await tx.seller_sales_history.findFirst({
          where: {
            seller_id: sellerId,
            date: today
          }
        });

        if (existingSalesHistory) {
          // Update existing record
          await tx.seller_sales_history.update({
            where: {
              uuid_id: existingSalesHistory.uuid_id
            },
            data: {
              daily_sales: {
                increment: totalSales
              },
              order_count: {
                increment: orderCount
              },
              new_customers: {
                increment: isNewCustomer ? 1 : 0
              }
            }
          });
        } else {
          // Create new record
          await tx.seller_sales_history.create({
            data: {
              seller_id: sellerId,
              date: today,
              daily_sales: totalSales,
              order_count: orderCount,
              new_customers: isNewCustomer ? 1 : 0,
              cancellations: 0
            }
          });
        }
      }, {
        timeout: 8000 // 8 second timeout for metrics updates
      });

      // Update listing counts and average rating outside transaction for performance
      await updateMultipleSellerListingStats(sellerId);

      console.log(`Updated metrics for seller ${sellerId}: Sales +${totalSales}, Orders +${orderCount}, New Customer: ${isNewCustomer}`);

    } catch (error) {
      console.error(`Error updating seller metrics for seller ${sellerId}:`, error);
      // Continue with other sellers even if one fails
    }
  });

  // Wait for all seller updates to complete
  await Promise.allSettled(sellerUpdates);
};

const updateMultipleSellerListingStats = async (sellerId) => {
  try {
    // Update listing counts
    const listingCounts = await prisma.fish_listings.groupBy({
      by: ['listing_status'],
      where: { seller_id: sellerId },
      _count: {
        id: true
      }
    });

    const totalListings = listingCounts.reduce((sum, group) => sum + group._count.id, 0);
    const activeListings = listingCounts.find(group => group.listing_status === 'active')?._count.id || 0;

    // Calculate average rating
    const avgRatingResult = await prisma.reviews.aggregate({
      where: {
        fish_listings: {
          seller_id: sellerId
        }
      },
      _avg: {
        rating: true
      }
    });

    // Update seller metrics with listing stats and rating
    await prisma.seller_metrics.update({
      where: { seller_id: sellerId },
      data: {
        total_listings: totalListings,
        active_listings: activeListings,
        avg_rating: avgRatingResult._avg.rating ? Number(avgRatingResult._avg.rating.toFixed(2)) : 0
      }
    });

  } catch (error) {
    console.error(`Error updating listing stats for seller ${sellerId}:`, error);
  }
};