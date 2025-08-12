import { hashPassword, matchPassword } from "../../utils/bcrypt.js";
import prisma from "../../utils/prisma.js";
import { createAccessToken, createEmailVerificationToken, createRefreshToken, verifyEmailVerificationToken } from "../../services/token.services.js";
import { generateVerificationToken } from "../../utils/generateVerificationCode.js";
import { sendVerificationEmail } from "../../utils/sendVerificationMails.js";

// Create profile
export const sellerCreateProfile = async (req, res) => {
    const sellerData = req.body;
    console.log("DATA: ", sellerData);

    try {
        // Hash the password first (outside transaction)
        const hashedPassword = await hashPassword(sellerData.password);
        console.log(hashedPassword);

        // Use a transaction with explicit timeout
        const result = await prisma.$transaction(async (prisma) => {
            // 1. Create location
            const location = await prisma.seller_locations.create({
                data: {
                    latitude: 0,
                    longitude: 0,
                    pin_code: sellerData.address.pin_code,
                    city: sellerData.address.city,
                    state: sellerData.address.state,
                    country: sellerData.address.country
                }
            });

            // 2. Create address
            const address = await prisma.seller_addresses.create({
                data: {
                    location_id: location.id, // FIXED: Changed from location.location_id to location.id
                    address_line1: sellerData.address.address_line1,
                    address_line2: sellerData.address.address_line2,
                    landmark: sellerData.address.landmark,
                    is_default: true,
                    address_type: 'BUSINESS'
                }
            });

            // 3. Create seller with all relations
            const seller = await prisma.sellers.create({
                data: {
                    business_name: sellerData.business_name,
                    business_type: sellerData.business_type,
                    email: sellerData.email,
                    phone: sellerData.phone,
                    alternate_phone: sellerData.alternate_phone,
                    gstin: sellerData.gstin,
                    pan_card: sellerData.pan_card,
                    legal_business_name: sellerData.legal_business_name,
                    display_name: sellerData.display_name,
                    store_description: sellerData.store_description,
                    logo_url: sellerData.logo_url,
                    website_url: sellerData.website_url,
                    primary_address_id: address.id, // FIXED: Changed from address.address_id to address.id
                    bank_account_number: sellerData.bank_details.account_number,
                    bank_ifsc_code: sellerData.bank_details.ifsc_code,
                    bank_account_holder_name: sellerData.bank_details.account_holder_name,
                    password_hash: hashedPassword,
                    seller_settings: {
                        create: {
                            auto_accept_orders: true,
                            default_warranty_period: 0,
                            return_window: 7,
                            min_order_value: 0
                        }
                    },
                    seller_payment_settings: {
                        create: {
                            payment_cycle: 'WEEKLY',
                            min_payout_amount: 100.0
                        }
                    },
                    seller_metrics: {
                        create: {
                            total_sales: 0,
                            total_orders: 0,
                            avg_rating: 0,
                            total_listings: 0,
                            active_listings: 0
                        }
                    }
                },
                include: {
                    seller_addresses: true,
                    seller_settings: true,
                    seller_payment_settings: true,
                    seller_metrics: true
                }
            });
        }, {
            maxWait: 5000, // Maximum time to wait for the transaction
            timeout: 10000 // Maximum time for the transaction to complete
        });

        res.status(201).send({
            success: true,
            data: {
                name: sellerData.business_name,
                email: sellerData.email,
                phone: sellerData.phone,
                displayName: sellerData.display_name
            }
        });

    } catch (error) {
        console.error('Error creating seller:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to create seller'
        });
    }
};

// Get current seller
export const getCurrentSeller = async (req, res) => {
    const sellerId = req.userId; // Assuming you have the seller ID from authentication middleware
    console.log("SELLER ID:", sellerId);

    try {
        // Fetch seller data with all necessary nested relationships
        const seller = await prisma.sellers.findUnique({
            where: { id: sellerId },
            include: {
                seller_metrics: true,
                seller_settings: {
                    select: {
                        auto_accept_orders: true,
                        default_warranty_period: true,
                        return_window: true,
                        shipping_provider: true,
                        min_order_value: true
                    }
                },
                seller_payment_settings: {
                    select: {
                        payment_cycle: true,
                        min_payout_amount: true
                    }
                },
                // Get all seller addresses - we'll filter in code
                seller_addresses: true,
                seller_sales_history: {
                    orderBy: { date: 'desc' },
                    take: 7,
                    select: {
                        date: true,
                        daily_sales: true,
                        order_count: true,
                        new_customers: true,
                        cancellations: true
                    }
                }
            }
        });

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }

        // Get fish listings statistics
        const [activeFishListings, topSellingFish, topFishListings, recentOrders] = await Promise.all([
            // Count of active fish listings
            prisma.fish_listings.count({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                }
            }),

            // Top selling fish products
            prisma.fish_listings.findMany({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    quantity_available: true,
                    images: true,
                    _count: {
                        select: {
                            order_items: true
                        }
                    }
                },
                orderBy: {
                    order_items: {
                        _count: 'desc'
                    }
                },
                take: 4
            }),

            // Top five fish listings (could be sorted by price, newest, featured, etc.)
            prisma.fish_listings.findMany({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    quantity_available: true,
                    images: true,
                    is_featured: true,
                    view_count: true,
                    created_at: true,
                    fish_categories: {
                        select: {
                            name: true
                        }
                    },
                    _count: {
                        select: {
                            reviews: true
                        }
                    }
                },
                orderBy: [
                    { is_featured: 'desc' },
                    { view_count: 'desc' }
                ],
                take: 5
            }),

            // Recent orders
            prisma.orders.findMany({
                where: {
                    order_items: {
                        some: {
                            fish_listings: {
                                seller_id: sellerId
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    total_amount: true,
                    status: true,
                    created_at: true,
                    users: {
                        select: {
                            full_name: true
                        }
                    },
                    order_items: {
                        select: {
                            quantity: true,
                            unit_price: true,
                            total_price: true,
                            fish_listings: {
                                select: {
                                    name: true,
                                    seller_id: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    created_at: 'desc'
                },
                take: 5
            })
        ]);

        // Calculate total revenue for the current month
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const currentMonthRevenue = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.daily_sales), 0);

        // Calculate previous month revenue for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Query for previous month revenue
        const previousMonthSales = await prisma.seller_sales_history.findMany({
            where: {
                seller_id: sellerId,
                date: {
                    gte: new Date(previousYear, previousMonth, 1),
                    lt: new Date(currentYear, currentMonth, 1)
                }
            },
            select: {
                daily_sales: true
            }
        });

        const previousMonthRevenue = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.daily_sales), 0);

        // Calculate percentage change
        const revenuePercentChange = previousMonthRevenue === 0
            ? 100
            : ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;

        // Calculate total orders this month
        const currentMonthOrders = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.order_count), 0);

        // Calculate previous month's orders
        const previousMonthOrders = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.order_count || 0), 0);

        // Calculate order percentage change
        const orderPercentChange = previousMonthOrders === 0
            ? 100
            : ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) * 100;

        // Calculate total customers this month
        const currentMonthCustomers = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.new_customers || 0), 0);

        // Calculate previous month's customers
        const previousMonthCustomers = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.new_customers || 0), 0);

        // Calculate customer percentage change
        const customerPercentChange = previousMonthCustomers === 0
            ? 100
            : ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100;

        // Calculate average order value
        const avgOrderValue = currentMonthOrders === 0
            ? 0
            : currentMonthRevenue / currentMonthOrders;

        // Calculate previous month's average order value
        const prevAvgOrderValue = previousMonthOrders === 0
            ? 0
            : previousMonthRevenue / previousMonthOrders;

        // Calculate average order value percentage change
        const avgOrderValuePercentChange = prevAvgOrderValue === 0
            ? 100
            : ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100;

        // Find the primary address based on what's available
        let primaryAddress = null;

        if (seller.seller_addresses) {
            if (Array.isArray(seller.seller_addresses)) {
                // If it's an array, find the default address or use the first one
                primaryAddress = seller.seller_addresses.find(addr => addr.is_default === true) ||
                    (seller.seller_addresses.length > 0 ? seller.seller_addresses[0] : null);
            } else if (typeof seller.seller_addresses === 'object') {
                // If it's an object (single address)
                primaryAddress = seller.seller_addresses;
            }
        }

        // Format sales history for chart display
        const formattedSalesHistory = seller.seller_sales_history.map(sale => ({
            month: new Date(sale.date).toLocaleString('default', { month: 'short' }),
            sales: Number(sale.daily_sales)
        })).reverse();

        // Format top selling fish products
        const formattedTopSellingFish = topSellingFish.map(fish => ({
            id: fish.id,
            name: fish.name,
            stock: fish.quantity_available,
            sold: fish._count.order_items,
            image: fish.images && fish.images.length > 0 ? fish.images[0] : null
        }));

        // Format top fish listings
        const formattedTopFishListings = topFishListings.map(fish => ({
            id: fish.id,
            name: fish.name,
            description: fish.description,
            price: Number(fish.price),
            stock: fish.quantity_available,
            images: fish.images,
            category: fish.fish_categories?.name || 'Uncategorized',
            isFeatured: fish.is_featured,
            viewCount: fish.view_count,
            reviewCount: fish._count.reviews,
            createdAt: fish.created_at
        }));

        // Format recent orders
        const formattedRecentOrders = recentOrders
            .filter(order => {
                // Filter orders that have at least one item from this seller
                return order.order_items.some(item =>
                    item.fish_listings && item.fish_listings.seller_id === sellerId
                );
            })
            .map(order => ({
                id: order.id,
                orderId: `#ORD-${order.id.substring(0, 4)}`,
                customer: order.users.full_name,
                date: new Date(order.created_at).toLocaleDateString('en-US', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                amount: Number(order.total_amount),
                status: order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()
            }));

        // Format the response with all the data needed for frontend
        const formattedSellerData = {
            id: seller.id,
            businessInfo: {
                businessName: seller.business_name,
                businessType: seller.business_type,
                legalBusinessName: seller.legal_business_name,
                displayName: seller.display_name,
                storeDescription: seller.store_description,
                logoUrl: seller.logo_url,
                websiteUrl: seller.website_url,
                gstin: seller.gstin,
                status: seller.status
            },
            contactInfo: {
                email: seller.email,
                phone: seller.phone,
                alternatePhone: seller.alternate_phone
            },
            address: primaryAddress ? {
                addressLine1: primaryAddress.address_line1,
                addressLine2: primaryAddress.address_line2,
                landmark: primaryAddress.landmark,
                addressType: primaryAddress.address_type,
                location: primaryAddress.seller_locations || {
                    city: primaryAddress.city,
                    state: primaryAddress.state,
                    country: primaryAddress.country,
                    pinCode: primaryAddress.pin_code
                }
            } : null,
            metrics: {
                // Static metrics
                totalSales: seller.seller_metrics ? seller.seller_metrics.total_sales : 0,
                totalOrders: seller.seller_metrics ? seller.seller_metrics.total_orders : 0,
                avgRating: seller.seller_metrics ? seller.seller_metrics.avg_rating : 0,
                totalListings: seller.seller_metrics ? seller.seller_metrics.total_listings : 0,
                activeListings: activeFishListings,
                lastCalculatedAt: seller.seller_metrics ? seller.seller_metrics.last_calculated_at : null,

                // Dashboard metrics for cards
                dashboard: {
                    revenue: {
                        total: currentMonthRevenue.toFixed(2),
                        percentChange: revenuePercentChange.toFixed(1),
                        trend: revenuePercentChange >= 0 ? 'up' : 'down'
                    },
                    orders: {
                        total: currentMonthOrders,
                        percentChange: orderPercentChange.toFixed(1),
                        trend: orderPercentChange >= 0 ? 'up' : 'down'
                    },
                    customers: {
                        total: currentMonthCustomers,
                        percentChange: customerPercentChange.toFixed(1),
                        trend: customerPercentChange >= 0 ? 'up' : 'down'
                    },
                    avgOrderValue: {
                        total: avgOrderValue.toFixed(2),
                        percentChange: avgOrderValuePercentChange.toFixed(1),
                        trend: avgOrderValuePercentChange >= 0 ? 'up' : 'down'
                    }
                }
            },
            settings: seller.seller_settings ? {
                autoAcceptOrders: seller.seller_settings.auto_accept_orders,
                defaultWarrantyPeriod: seller.seller_settings.default_warranty_period,
                returnWindow: seller.seller_settings.return_window,
                shippingProvider: seller.seller_settings.shipping_provider,
                minOrderValue: seller.seller_settings.min_order_value
            } : null,
            paymentSettings: seller.seller_payment_settings ? {
                paymentCycle: seller.seller_payment_settings.payment_cycle,
                minPayoutAmount: seller.seller_payment_settings.min_payout_amount
            } : null,
            recentSales: seller.seller_sales_history.map(sale => ({
                date: sale.date,
                dailySales: sale.daily_sales,
                orderCount: sale.order_count,
                newCustomers: sale.new_customers,
                cancellations: sale.cancellations
            })),
            salesChartData: formattedSalesHistory,
            topSellingProducts: formattedTopSellingFish,
            topFishListings: formattedTopFishListings,
            recentOrders: formattedRecentOrders,
            commissionRate: seller.commission_rate,
            createdAt: seller.created_at,
            updatedAt: seller.updated_at
        };

        return res.status(200).json({
            success: true,
            data: formattedSellerData,
            message: 'Seller data retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching seller profile:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve seller data'
        });
    }
};

// Login seller
export const loginSeller = async (req, res) => {

    const { identifier, password } = req.body;

    console.log("LOGIN SELLER", identifier, password)

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            message: 'Identifier and password are required'
        });
    }

    try {
        // Find the seller by email or phone
        const seller = await prisma.sellers.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier }
                ]
            }
        });

        console.log('seller : ', seller)

        if (!seller) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }


        // Verify password
        const isPasswordValid = await matchPassword(password, seller.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = createAccessToken(seller.id);
        const refreshToken = createRefreshToken(seller.id);

        // Store refresh token in database
        await prisma.refresh_tokens.create({
            data: {
                user_id: seller.id,
                token: refreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // Set refresh token as HTTP-only cookie
        res.cookie('sellerRefreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Send response with access token and basic seller info
        res.status(200).json({
            success: true,
            data: {
                name: seller.business_name,
                email: seller.email,
                phone: seller.phone,
                displayName: seller.display_name,
                profileUrl: seller.logo_url,
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Error during seller login:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Login failed due to server error'
        });
    }
};

// Verify email
export const verifyEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await prisma.sellers.findUnique({
            where: {
                email: email
            }
        });

        if (user) {
            return res.status(500).json({ success: false, message: 'Seller already exists. Please login.' })
        }

        // Generate a verification code for the email display
        const verificationCode = generateVerificationToken();

        // Create JWT token with user info and verification code
        const verificationToken = createEmailVerificationToken(email, verificationCode)

        // Send verification email
        await sendVerificationEmail(email, verificationCode, verificationToken, 'Seller', 'auth');

        return res.status(200).json({
            success: true,
            token: verificationToken,
            message: 'Verification email sent successfully'
        });

    } catch (error) {
        console.error('Email verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error sending verification email',
            error: error.message
        });
    }
}

// Confirm verification code
export const confirmVerificationCode = async (req, res) => {

    console.log('Reached here!')

    const { token, code } = req.body;
    console.log(token, code)

    if (!token && !code) {
        return res.status(400).json({ success: false, message: 'Verification token or code is required' });
    }

    // If token provided (from email link click)
    try {
        const decodedToken = verifyEmailVerificationToken(token);

        console.log(decodedToken.code, code)

        if (decodedToken.code !== code) {
            console.log('invalid code')
            res.status(400).json({ success: false, message: 'Invalid verification code' })
            return
        }

        res.status(200).json({ success: true, message: 'Seller signup successfully' })

    } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
};

// Logout seller
export const logoutSeller = async (req, res) => {
    try {
        // Get the refresh token from cookies
        const userId = req.userId;

        // If no refresh token in cookies, user is already logged out
        if (!userId) {
            return res.status(200).json({
                success: true,
                message: 'Already logged out'
            });
        }

        // Delete the refresh token from database
        await prisma.refresh_tokens.deleteMany({
            where: {
                user_id: userId
            }
        });

        // Clear the refresh token cookie
        res.clearCookie('sellerRefreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Error during seller logout:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Logout failed due to server error'
        });
    }
}

// Update seller profile
export const updateProfile = async (req, res) => {
    try {
        const sellerId = req.params.sellerId || req.body.id;

        if (!sellerId) {
            return res.status(400).json({
                success: false,
                message: 'Seller ID is required'
            });
        }

        const {
            businessInfo,
            contactInfo,
            address,
            paymentSettings
        } = req.body;

        // Validate required fields
        if (!businessInfo || !contactInfo) {
            return res.status(400).json({
                success: false,
                message: 'Business info and contact info are required'
            });
        }

        // Perform update in a transaction to ensure data consistency
        const updatedSeller = await prisma.$transaction(async (tx) => {
            // 1. Update main seller record
            const updatedSellerData = await tx.sellers.update({
                where: { id: sellerId },
                data: {
                    business_name: businessInfo.businessName,
                    legal_business_name: businessInfo.legalBusinessName,
                    display_name: businessInfo.displayName,
                    business_type: businessInfo.businessType,
                    store_description: businessInfo.storeDescription,
                    logo_url: businessInfo.logoUrl,
                    website_url: businessInfo.websiteUrl,
                    gstin: businessInfo.gstin,
                    status: businessInfo.status,
                    // Contact info
                    email: contactInfo.email,
                    phone: contactInfo.phone,
                    alternate_phone: contactInfo.alternatePhone,
                    // Update commission rate if provided
                    commission_rate: req.body.commissionRate ?
                        parseFloat(req.body.commissionRate) : undefined,
                    updated_at: new Date()
                }
            });

            // 2. Update or create address if provided
            if (address) {
                // Get the seller record with address information
                const sellerWithAddress = await tx.sellers.findUnique({
                    where: { id: sellerId },
                    select: { primary_address_id: true }
                });

                let existingAddress = null;
                if (sellerWithAddress?.primary_address_id) {
                    existingAddress = await tx.seller_addresses.findUnique({
                        where: { id: sellerWithAddress.primary_address_id }
                    });
                }

                // Check if we need to handle location data
                let locationId = null;
                if (address.location && Object.keys(address.location).length > 0) {
                    const locationData = {
                        city: address.location.city || '',
                        state: address.location.state || '',
                        country: address.location.country || '',
                        pin_code: address.location.pinCode || '',
                        latitude: address.location.latitude ?
                            parseFloat(address.location.latitude) : 0,
                        longitude: address.location.longitude ?
                            parseFloat(address.location.longitude) : 0,
                    };

                    if (existingAddress?.location_id) {
                        // Update existing location
                        const location = await tx.seller_locations.update({
                            where: { id: existingAddress.location_id },
                            data: locationData
                        });
                        locationId = location.id;
                    } else {
                        // Create new location
                        const location = await tx.seller_locations.create({
                            data: locationData
                        });
                        locationId = location.id;
                    }
                }

                // Update or create address
                if (existingAddress) {
                    await tx.seller_addresses.update({
                        where: { id: existingAddress.id },
                        data: {
                            address_line1: address.addressLine1,
                            address_line2: address.addressLine2,
                            landmark: address.landmark,
                            address_type: address.addressType,
                            location_id: locationId || existingAddress.location_id,
                            updated_at: new Date()
                        }
                    });
                } else {
                    // Create new address
                    const newAddress = await tx.seller_addresses.create({
                        data: {
                            address_line1: address.addressLine1,
                            address_line2: address.addressLine2,
                            landmark: address.landmark,
                            address_type: address.addressType || 'BUSINESS',
                            is_default: true,
                            location_id: locationId
                        }
                    });

                    // Update seller with primary address
                    await tx.sellers.update({
                        where: { id: sellerId },
                        data: { primary_address_id: newAddress.id }
                    });
                }
            }

            // 3. Update payment settings if provided
            if (paymentSettings && Object.keys(paymentSettings).length > 0) {
                // Check if there are existing payment settings
                const existingSettings = await tx.seller_payment_settings.findFirst({
                    where: { seller_id: sellerId }
                });

                if (existingSettings) {
                    await tx.seller_payment_settings.update({
                        where: { id: existingSettings.id },
                        data: {
                            payment_cycle: paymentSettings.paymentCycle,
                            min_payout_amount: paymentSettings.minPayoutAmount ?
                                parseFloat(paymentSettings.minPayoutAmount) : undefined,
                            updated_at: new Date()
                        }
                    });
                } else {
                    await tx.seller_payment_settings.create({
                        data: {
                            seller_id: sellerId,
                            payment_cycle: paymentSettings.paymentCycle || 'MONTHLY',
                            min_payout_amount: paymentSettings.minPayoutAmount ?
                                parseFloat(paymentSettings.minPayoutAmount) : 100.0
                        }
                    });
                }
            }

            // Return the updated seller
            return updatedSellerData;
        });

        // Fetch the complete updated seller with relations for response
        const completeSeller = await prisma.sellers.findUnique({
            where: { id: sellerId },
            include: {
                seller_addresses: {
                    where: { id: updatedSeller.primary_address_id || undefined }
                },
                seller_payment_settings: true,
                seller_metrics: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Seller details updated successfully',
            data: completeSeller
        });
    } catch (error) {
        console.error('Error updating seller details:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update seller details',
            error: error.message
        });
    }
}

// Update seller password
export const updatePassword = async (req, res) => {
    try {
        const sellerId = req.userId;
        const formData = req.body;
        console.log('formdata : ',formData)
        const { currentPassword, newPassword, confirmPassword } = formData;

        console.log('update password : ',currentPassword, newPassword)

        // Validation checks
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All password fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirm password do not match'
            });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 8 characters long'
            });
        }

        // Find the seller
        const seller = await prisma.sellers.findUnique({
            where: {
                id: sellerId
            }
        });

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }

        // Verify current password
        const isCurrentPasswordValid = await matchPassword(currentPassword, seller.password_hash);
        
        if (!isCurrentPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is same as current password
        const isSamePassword = await matchPassword(newPassword, seller.password_hash);
        
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        // Hash the new password
        const hashedNewPassword = await hashPassword(newPassword);

        // Update the password in database
        await prisma.sellers.update({
            where: {
                id: sellerId
            },
            data: {
                password_hash: hashedNewPassword,
                updated_at: new Date()
            }
        });

        // Log successful password update (without sensitive data)
        console.log(`Password updated successfully for seller: ${sellerId}`);

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Error updating password:', error);
        
        return res.status(500).json({
            success: false,
            message: 'Internal server error. Please try again later.'
        });
    }
}

// Change seller password (forgot password)
export const ChangeSellerPassword = async (req, res) => {
    try {
        const { newPassword, verificationToken } = req.body;

        // Validate required fields
        if (!newPassword || !verificationToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, new password, and verification token are required' 
            });
        }

        // Validate password strength
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Verify the token
        let decodedToken;
        try {
            decodedToken = verifyEmailVerificationToken(verificationToken);
            
            // Check if the email in token matches the provided email
            if (!decodedToken.email) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid verification token'
                });
            }
        } catch (tokenError) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification token'
            });
        }

        // Find the seller
        const seller = await prisma.sellers.findUnique({
            where: {
                email: decodedToken.email
            }
        });

        if (!seller) {
            return res.status(404).json({
                success: false, 
                message: "Seller doesn't exist. Please re-check the email address."
            });
        }

        // Hash the new password
        const hashedPassword = await hashPassword(newPassword)

        // Update the seller's password
        const updatedSeller = await prisma.sellers.update({
            where: {
                email: decodedToken.email
            },
            data: {
                password_hash: hashedPassword,
                updated_at: new Date()
            },
            select: {
                id: true,
                email: true,
                business_name: true,
                display_name: true,
                updated_at: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Seller password updated successfully',
            seller: {
                id: updatedSeller.id,
                email: updatedSeller.email,
                business_name: updatedSeller.business_name,
                display_name: updatedSeller.display_name
            }
        });

    } catch (error) {
        console.error('Seller password change error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating seller password',
            error: error.message
        });
    }
};


// ____NATIVE SPECIFIC APIS____


// Native login seller
export const nativeLoginSeller = async (req, res) => {

    const { identifier, password } = req.body;

    console.log("LOGIN SELLER", identifier, password)

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            message: 'Identifier and password are required'
        });
    }

    try {
        // Find the seller by email or phone
        const seller = await prisma.sellers.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone: identifier }
                ]
            }
        });

        console.log('seller : ', seller)

        if (!seller) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }


        // Verify password
        const isPasswordValid = await matchPassword(password, seller.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = createAccessToken(seller.id);
        const refreshToken = createRefreshToken(seller.id);

        // Store refresh token in database
        await prisma.refresh_tokens.create({
            data: {
                user_id: seller.id,
                token: refreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // Set refresh token as HTTP-only cookie
        res.cookie('sellerRefreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Send response with access token and basic seller info
        res.status(200).json({
            success: true,
            data: {
                id: seller.id,
                name: seller.business_name,
                email: seller.email,
                phone: seller.phone,
                displayName: seller.display_name,
                profileUrl: seller.logo_url,
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Error during seller login:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Login failed due to server error'
        });
    }
};

// Native seller logout 
export const nativeLogoutSeller = async (req, res) => {
    try {
        // Get the refresh token from cookies
        const token = req.body.token

        console.log("token: ", token)

        // Delete the refresh token from database
        await prisma.refresh_tokens.deleteMany({
            where: {
                token: token
            }
        });

        // Clear the refresh token cookie
        res.clearCookie('sellerRefreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
        });

        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        console.error('Error during seller logout:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Logout failed due to server error'
        });
    }
}

// Native get current seller
export const nativeGetCurrentSeller = async (req, res) => {
    const sellerId = req.params.id; // Assuming you have the seller ID from authentication middleware
    console.log("SELLER ID:", sellerId);

    try {
        // Fetch seller data with all necessary nested relationships
        const seller = await prisma.sellers.findUnique({
            where: { id: sellerId },
            include: {
                seller_metrics: true,
                seller_settings: {
                    select: {
                        auto_accept_orders: true,
                        default_warranty_period: true,
                        return_window: true,
                        shipping_provider: true,
                        min_order_value: true
                    }
                },
                seller_payment_settings: {
                    select: {
                        payment_cycle: true,
                        min_payout_amount: true
                    }
                },
                // Get all seller addresses - we'll filter in code
                seller_addresses: true,
                seller_sales_history: {
                    orderBy: { date: 'desc' },
                    take: 7,
                    select: {
                        date: true,
                        daily_sales: true,
                        order_count: true,
                        new_customers: true,
                        cancellations: true
                    }
                }
            }
        });

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }

        // Get fish listings statistics
        const [activeFishListings, topSellingFish, topFishListings, recentOrders] = await Promise.all([
            // Count of active fish listings
            prisma.fish_listings.count({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                }
            }),

            // Top selling fish products
            prisma.fish_listings.findMany({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                },
                select: {
                    id: true,
                    name: true,
                    price: true,
                    quantity_available: true,
                    images: true,
                    _count: {
                        select: {
                            order_items: true
                        }
                    }
                },
                orderBy: {
                    order_items: {
                        _count: 'desc'
                    }
                },
                take: 4
            }),

            // Top five fish listings (could be sorted by price, newest, featured, etc.)
            prisma.fish_listings.findMany({
                where: {
                    seller_id: sellerId,
                    listing_status: 'active'
                },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    price: true,
                    quantity_available: true,
                    images: true,
                    is_featured: true,
                    view_count: true,
                    created_at: true,
                    fish_categories: {
                        select: {
                            name: true
                        }
                    },
                    _count: {
                        select: {
                            reviews: true
                        }
                    }
                },
                orderBy: [
                    { is_featured: 'desc' },
                    { view_count: 'desc' }
                ]
            }),

            // Recent orders
            prisma.orders.findMany({
                where: {
                    order_items: {
                        some: {
                            fish_listings: {
                                seller_id: sellerId
                            }
                        }
                    }
                },
                select: {
                    id: true,
                    total_amount: true,
                    status: true,
                    created_at: true,
                    users: {
                        select: {
                            full_name: true
                        }
                    },
                    order_items: {
                        select: {
                            quantity: true,
                            unit_price: true,
                            total_price: true,
                            fish_listings: {
                                select: {
                                    name: true,
                                    seller_id: true
                                }
                            }
                        }
                    }
                },
                orderBy: {
                    created_at: 'desc'
                }
            })
        ]);

        // Calculate total revenue for the current month
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        const currentMonthRevenue = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.daily_sales), 0);

        // Calculate previous month revenue for comparison
        const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        // Query for previous month revenue
        const previousMonthSales = await prisma.seller_sales_history.findMany({
            where: {
                seller_id: sellerId,
                date: {
                    gte: new Date(previousYear, previousMonth, 1),
                    lt: new Date(currentYear, currentMonth, 1)
                }
            },
            select: {
                daily_sales: true
            }
        });

        const previousMonthRevenue = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.daily_sales), 0);

        // Calculate percentage change
        const revenuePercentChange = previousMonthRevenue === 0
            ? 100
            : ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100;

        // Calculate total orders this month
        const currentMonthOrders = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.order_count), 0);

        // Calculate previous month's orders
        const previousMonthOrders = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.order_count || 0), 0);

        // Calculate order percentage change
        const orderPercentChange = previousMonthOrders === 0
            ? 100
            : ((currentMonthOrders - previousMonthOrders) / previousMonthOrders) * 100;

        // Calculate total customers this month
        const currentMonthCustomers = seller.seller_sales_history
            .filter(sale => {
                const saleDate = new Date(sale.date);
                return saleDate.getMonth() === currentMonth &&
                    saleDate.getFullYear() === currentYear;
            })
            .reduce((sum, sale) => sum + Number(sale.new_customers || 0), 0);

        // Calculate previous month's customers
        const previousMonthCustomers = previousMonthSales
            .reduce((sum, sale) => sum + Number(sale.new_customers || 0), 0);

        // Calculate customer percentage change
        const customerPercentChange = previousMonthCustomers === 0
            ? 100
            : ((currentMonthCustomers - previousMonthCustomers) / previousMonthCustomers) * 100;

        // Calculate average order value
        const avgOrderValue = currentMonthOrders === 0
            ? 0
            : currentMonthRevenue / currentMonthOrders;

        // Calculate previous month's average order value
        const prevAvgOrderValue = previousMonthOrders === 0
            ? 0
            : previousMonthRevenue / previousMonthOrders;

        // Calculate average order value percentage change
        const avgOrderValuePercentChange = prevAvgOrderValue === 0
            ? 100
            : ((avgOrderValue - prevAvgOrderValue) / prevAvgOrderValue) * 100;

        // Find the primary address based on what's available
        let primaryAddress = null;

        if (seller.seller_addresses) {
            if (Array.isArray(seller.seller_addresses)) {
                // If it's an array, find the default address or use the first one
                primaryAddress = seller.seller_addresses.find(addr => addr.is_default === true) ||
                    (seller.seller_addresses.length > 0 ? seller.seller_addresses[0] : null);
            } else if (typeof seller.seller_addresses === 'object') {
                // If it's an object (single address)
                primaryAddress = seller.seller_addresses;
            }
        }

        // Format sales history for chart display
        const formattedSalesHistory = seller.seller_sales_history.map(sale => ({
            month: new Date(sale.date).toLocaleString('default', { month: 'short' }),
            sales: Number(sale.daily_sales)
        })).reverse();

        // Format top selling fish products
        const formattedTopSellingFish = topSellingFish.map(fish => ({
            id: fish.id,
            name: fish.name,
            stock: fish.quantity_available,
            sold: fish._count.order_items,
            image: fish.images && fish.images.length > 0 ? fish.images[0] : null
        }));

        // Format top fish listings
        const formattedTopFishListings = topFishListings.map(fish => ({
            id: fish.id,
            name: fish.name,
            description: fish.description,
            price: Number(fish.price),
            stock: fish.quantity_available,
            images: fish.images,
            category: fish.fish_categories?.name || 'Uncategorized',
            isFeatured: fish.is_featured,
            viewCount: fish.view_count,
            reviewCount: fish._count.reviews,
            createdAt: fish.created_at
        }));

        // Format recent orders
        const formattedRecentOrders = recentOrders
            .filter(order => {
                // Filter orders that have at least one item from this seller
                return order.order_items.some(item =>
                    item.fish_listings && item.fish_listings.seller_id === sellerId
                );
            })
            .map(order => ({
                id: order.id,
                orderId: `#ORD-${order.id.substring(0, 4)}`,
                customer: order.users.full_name,
                date: new Date(order.created_at).toLocaleDateString('en-US', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                amount: Number(order.total_amount),
                status: order.status.charAt(0).toUpperCase() + order.status.slice(1).toLowerCase()
            }));

        // Format the response with all the data needed for frontend
        const formattedSellerData = {
            id: seller.id,
            businessInfo: {
                businessName: seller.business_name,
                businessType: seller.business_type,
                legalBusinessName: seller.legal_business_name,
                displayName: seller.display_name,
                storeDescription: seller.store_description,
                logoUrl: seller.logo_url,
                websiteUrl: seller.website_url,
                gstin: seller.gstin,
                status: seller.status
            },
            contactInfo: {
                email: seller.email,
                phone: seller.phone,
                alternatePhone: seller.alternate_phone
            },
            address: primaryAddress ? {
                addressLine1: primaryAddress.address_line1,
                addressLine2: primaryAddress.address_line2,
                landmark: primaryAddress.landmark,
                addressType: primaryAddress.address_type,
                location: primaryAddress.seller_locations || {
                    city: primaryAddress.city,
                    state: primaryAddress.state,
                    country: primaryAddress.country,
                    pinCode: primaryAddress.pin_code
                }
            } : null,
            metrics: {
                // Static metrics
                totalSales: seller.seller_metrics ? seller.seller_metrics.total_sales : 0,
                totalOrders: seller.seller_metrics ? seller.seller_metrics.total_orders : 0,
                avgRating: seller.seller_metrics ? seller.seller_metrics.avg_rating : 0,
                totalListings: seller.seller_metrics ? seller.seller_metrics.total_listings : 0,
                activeListings: activeFishListings,
                lastCalculatedAt: seller.seller_metrics ? seller.seller_metrics.last_calculated_at : null,

                // Dashboard metrics for cards
                dashboard: {
                    revenue: {
                        total: currentMonthRevenue.toFixed(2),
                        percentChange: revenuePercentChange.toFixed(1),
                        trend: revenuePercentChange >= 0 ? 'up' : 'down'
                    },
                    orders: {
                        total: currentMonthOrders,
                        percentChange: orderPercentChange.toFixed(1),
                        trend: orderPercentChange >= 0 ? 'up' : 'down'
                    },
                    customers: {
                        total: currentMonthCustomers,
                        percentChange: customerPercentChange.toFixed(1),
                        trend: customerPercentChange >= 0 ? 'up' : 'down'
                    },
                    avgOrderValue: {
                        total: avgOrderValue.toFixed(2),
                        percentChange: avgOrderValuePercentChange.toFixed(1),
                        trend: avgOrderValuePercentChange >= 0 ? 'up' : 'down'
                    }
                }
            },
            settings: seller.seller_settings ? {
                autoAcceptOrders: seller.seller_settings.auto_accept_orders,
                defaultWarrantyPeriod: seller.seller_settings.default_warranty_period,
                returnWindow: seller.seller_settings.return_window,
                shippingProvider: seller.seller_settings.shipping_provider,
                minOrderValue: seller.seller_settings.min_order_value
            } : null,
            paymentSettings: seller.seller_payment_settings ? {
                paymentCycle: seller.seller_payment_settings.payment_cycle,
                minPayoutAmount: seller.seller_payment_settings.min_payout_amount
            } : null,
            recentSales: seller.seller_sales_history.map(sale => ({
                date: sale.date,
                dailySales: sale.daily_sales,
                orderCount: sale.order_count,
                newCustomers: sale.new_customers,
                cancellations: sale.cancellations
            })),
            salesChartData: formattedSalesHistory,
            topSellingProducts: formattedTopSellingFish,
            topFishListings: formattedTopFishListings,
            recentOrders: formattedRecentOrders,
            commissionRate: seller.commission_rate,
            createdAt: seller.created_at,
            updatedAt: seller.updated_at
        };

        return res.status(200).json({
            success: true,
            data: formattedSellerData,
            message: 'Seller data retrieved successfully'
        });

    } catch (error) {
        console.error('Error fetching seller profile:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to retrieve seller data'
        });
    }
};