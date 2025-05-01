import { hashPassword, matchPassword } from "../../utils/bcrypt.js";
import prisma from "../../utils/prisma.js";
import { createAccessToken, createRefreshToken } from "../../services/token.services.js";

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
                        new_customers: true
                    }
                }
            }
        });
        
        // Add debug logging to understand the structure
        console.log("Seller addresses type:", typeof seller.seller_addresses);
        console.log("Is seller addresses an array:", Array.isArray(seller.seller_addresses));

        if (!seller) {
            return res.status(404).json({
                success: false,
                message: 'Seller not found'
            });
        }

        // Get the active fish listings count separately
        const fishListingsCount = await prisma.fish_listings.count({
            where: {
                seller_id: sellerId,
                listing_status: 'active'
            }
        });

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
            console.log("Selected primary address:", primaryAddress);
        }

        // Format the response
        const formattedSellerData = {
            id: seller.id,
            businessInfo: {
                business_name: seller.business_name,
                business_type: seller.business_type,
                legal_business_name: seller.legal_business_name,
                display_name: seller.display_name,
                store_description: seller.store_description,
                logo_url: seller.logo_url,
                website_url: seller.website_url,
                gstin: seller.gstin,
                status: seller.status
            },
            contactInfo: {
                email: seller.email,
                phone: seller.phone,
                alternate_phone: seller.alternate_phone
            },
            address: primaryAddress ? {
                address_line1: primaryAddress.address_line1,
                address_line2: primaryAddress.address_line2,
                landmark: primaryAddress.landmark,
                address_type: primaryAddress.address_type,
                location: primaryAddress.seller_locations || {
                    city: primaryAddress.city,
                    state: primaryAddress.state,
                    country: primaryAddress.country,
                    pin_code: primaryAddress.pin_code
                } 
            } : null,
            metrics: seller.seller_metrics ? {
                total_sales: seller.seller_metrics.total_sales,
                total_orders: seller.seller_metrics.total_orders,
                avg_rating: seller.seller_metrics.avg_rating,
                total_listings: seller.seller_metrics.total_listings,
                active_listings: fishListingsCount,
                last_calculated_at: seller.seller_metrics.last_calculated_at
            } : null,
            settings: seller.seller_settings || null,
            paymentSettings: seller.seller_payment_settings || null,
            recentSales: seller.seller_sales_history,
            commission_rate: seller.commission_rate,
            created_at: seller.created_at,
            updated_at: seller.updated_at
        };

        console.log(formattedSellerData)

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

    const { emailOrMobile, password } = req.body;
    
    console.log("LOGIN SELLER", emailOrMobile, password)

    if (!emailOrMobile || !password) {
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
                    { email: emailOrMobile },
                    { phone: emailOrMobile }
                ]
            }
        });

        console.log('seller : ',seller)
        
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