import client from '../config/db.js'
import { addressInsertQuery, deleteRefreshToken, findCurrentUserQuery, findRefreshTokenQuery, refreshTokenInsertQuery, userInsertQuery } from '../query/user.query.js'
import { createAccessToken, createEmailVerificationToken, createRefreshToken, verifyEmailVerificationToken } from '../services/token.services.js'
import { hashPassword, matchPassword } from '../utils/bcrypt.js'
import { generateVerificationToken } from '../utils/generateVerificationCode.js'
import prisma from '../utils/prisma.js'
import { sendVerificationEmail } from '../utils/sendMails.js'
import { transformToCamelCase } from '../utils/toCamelCase.js'

// Signup user
export const signUpUser = async (req, res) => {
    const user = req.body
    console.log('phone number : ', user)
    res.status(201).json({
        success: true,
        data: user
    })
    return;
}

// Verify email
export const verifyEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await prisma.users.findUnique({
            where: {
                email: email
            }
        });

        if (user){
            return res.status(500).json({success: false, message: 'User already exists. Please login.'})
        } 

        // Generate a verification code for the email display
        const verificationCode = generateVerificationToken();

        // Create JWT token with user info and verification code
        const verificationToken = createEmailVerificationToken(email, verificationCode)

        // Send verification email
        await sendVerificationEmail(email, verificationCode, verificationToken, 'User', 'auth');

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

        res.status(200).json({ success: true, message: 'User signup successfully' })

    } catch (error) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
};

// Create user profile
export const createProfile = async (req, res) => {
    const user = req.body.formData
    console.log('profile data : ', user)

    const hashedPassword = await hashPassword(user.password)

    try {
        // Using Prisma transaction to ensure all operations succeed or fail together
        const result = await prisma.$transaction(async (prisma) => {
            // Create user
            const createdUser = await prisma.users.create({
                data: {
                    email: user.email,
                    password_hash: hashedPassword,
                    full_name: user.fullName,
                    phone_number: user.phone,
                    user_type: 'customer',
                    email_verified: false,
                    phone_verified: true,
                    profile_picture_url: user.profileImage,
                }
            });

            // Create user address
            const userAddress = await prisma.user_addresses.create({
                data: {
                    user_id: createdUser.id,
                    address_line1: user.address.addressLine1,
                    address_line2: user.address.addressLine2,
                    city: user.address.city,
                    state: user.address.state,
                    postal_code: user.address.pincode,
                    country: user.address.country,
                    is_default: true
                }
            });

            // Create access and refresh tokens
            const accessToken = createAccessToken(createdUser.id);
            const refreshToken = createRefreshToken(createdUser.id);

            // Store refresh token
            const refreshTokenRecord = await prisma.refresh_tokens.create({
                data: {
                    user_id: createdUser.id,
                    token: refreshToken,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });

            return {
                user: createdUser,
                address: userAddress,
                accessToken,
                refreshToken
            };
        });

        // Set cookie and send response
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).send({
            success: true,
            data: {
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });

    } catch (err) {
        console.log('Error creating profile: ', err);
        res.status(500).json({
            success: false,
            message: 'Error creating user profile'
        });
    }
};

// Refresh token
export const refresh = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;
        console.log("REFRESH TOKEN : ", refreshToken)

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        const response = await client.query(findRefreshTokenQuery, [
            refreshToken
        ])

        const storedToken = response.rows[0]

        console.log(storedToken)

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const accessToken = createAccessToken(storedToken.user_id);

        res.status(201).json({
            success: true,
            accessToken: accessToken
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Logout user
export const logoutUser = async (req, res) => {

    try {
        const refreshToken = req.cookies.refreshToken;

        console.log('logout refresh token : ',refreshToken)

        if (refreshToken) {
            // Delete the refresh token using Prisma
            await prisma.refresh_tokens.deleteMany({
                where: {
                    token: refreshToken
                }
            });

            // Clear the cookie
            res.clearCookie('refreshToken');
            res.clearCookie('accessToken')

            return res.status(200).json({
                success: true,
                message: 'Logged out successfully'
            });
        } else {
            return res.status(401).json({
                success: false,
                message: 'No refresh token found'
            });
        }
    } catch (error) {
        console.error('Error during logout:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during logout',
            error: error.message
        });
    }
};

// Login user
export const loginUser = async (req, res) => {
    const { identifier, password } = req.body;

    console.log("LOGIN USER", identifier, password);

    if (!identifier || !password) {
        return res.status(400).json({
            success: false,
            message: 'Identifier and password are required'
        });
    }

    try {
        // Find the user by email or phone number
        const user = await prisma.users.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { phone_number: identifier }
                ]
            }
        });

        console.log('user : ', user);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Verify password
        const isPasswordValid = await matchPassword(password, user.password_hash);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate tokens
        const accessToken = createAccessToken(user.id);
        const refreshToken = createRefreshToken(user.id);

        // Store refresh token in database
        await prisma.refresh_tokens.create({
            data: {
                user_id: user.id,
                token: refreshToken,
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            }
        });

        // Set refresh token as HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Send response with access token and basic user info
        res.status(200).json({
            success: true,
            data: {
                name: user.full_name,
                email: user.email,
                phone: user.phone_number,
                userType: user.user_type,
                accessToken,
                refreshToken
            }
        });

    } catch (error) {
        console.error('Error during user login:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            message: 'Login failed due to server error'
        });
    }
};

// Get current user
export const getCurrentUser = async (req, res) => {

    try {

        const userId = req.userId

        console.log("USER ID : ", userId)

        const data = await prisma.users.findUnique({
            where: {
                id: userId,
            },
            select: {
                id: true,
                email: true,
                full_name: true,
                phone_number: true,
                user_type: true,
                created_at: true,
                updated_at: true,
                email_verified: true,
                phone_verified: true,
                points_balance: true,
                profile_picture_url: true,
                // Related entities
                user_addresses: {
                    select: {
                        id: true,
                        address_line1: true,
                        address_line2: true,
                        city: true,
                        state: true,
                        postal_code: true,
                        country: true,
                        is_default: true,
                        latitude: true,
                        longitude: true,
                    },
                },
                shopping_carts: {
                    where: {
                        is_active: true,
                    },
                    select: {
                        id: true,
                        created_at: true,
                        updated_at: true,
                        cart_items: {
                            select: {
                                id: true,
                                quantity: true,
                                added_at: true,
                                fish_listing_id: true,
                                fish_listings: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        price: true,
                                        images: true,
                                        size: true,
                                        color: true,
                                        breed: true,
                                    },
                                },
                            },
                        },
                    },
                },
                orders: {
                    select: {
                        id: true,
                        total_amount: true,
                        status: true,
                        created_at: true,
                        updated_at: true,
                        points_earned: true,
                        points_used: true,
                        discount_amount: true,
                        coupon_code: true,
                        order_notes: true,
                        shipping_details: {
                            select: {
                                carrier: true,
                                tracking_number: true,
                                shipping_cost: true,
                                estimated_delivery: true,
                                actual_delivery: true,
                                shipping_method: true,
                            },
                        },
                        order_items: {
                            select: {
                                id: true,
                                quantity: true,
                                unit_price: true,
                                total_price: true,
                                fish_listing_id: true,
                                fish_listings: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        images: true,
                                    },
                                },
                            },
                        },
                    },
                },
                wishlists: {
                    select: {
                        id: true,
                        name: true,
                        is_public: true,
                        created_at: true,
                        updated_at: true,
                        wishlist_items: {
                            select: {
                                id: true,
                                added_at: true,
                                notes: true,
                                fish_listing_id: true,
                                fish_listings: {
                                    select: {
                                        id: true,
                                        name: true,
                                        description: true,
                                        price: true,
                                        images: true,
                                        size: true,
                                        color: true,
                                        breed: true,
                                    },
                                },
                            },
                        },
                    },
                },
                reviews: {
                    select: {
                        id: true,
                        rating: true,
                        review_text: true,
                        review_images: true,
                        created_at: true,
                        is_verified_purchase: true,
                        fish_listing_id: true,
                        fish_listings: {
                            select: {
                                id: true,
                                name: true,
                                images: true,
                            },
                        },
                    },
                },
            },
        });

        console.log("DATA : ",data)

        if (!data) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const user = transformToCamelCase(data)
        
        // console.log('user data :',user.shoppingCarts[0].cartItems[0])

        res.status(201).json(user);
        return;
    } catch (error) {
        console.log("REACHED")
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' })
        return;
    }
}

// Get fish list
export const getFishList = async (req, res) => {
    console.log('reached fish list');

    try {
        const {
            page = 1,
            limit = 10,
            sort = "created_at",
            order = "desc",
            category,
            minPrice,
            maxPrice,
            search,
            featured,
            inStock,
            color,
            size,
            breed,
        } = req.query;

        // Parse pagination parameters
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Build filter conditions
        const where = {};

        // Text search in name and description
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }

        // Category filter - validate UUID format
        // if (category) {
        //     // UUID validation regex pattern
        //     const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        //     if (uuidPattern.test(category)) {
        //         where.category_id = category;
        //     } else {
        //         console.warn(`Invalid UUID format for category: ${category}, skipping filter`);
        //         // Option 1: Skip this filter
        //         // Option 2: Return error
        //         // return res.status(400).json({ message: "Invalid category ID format" });
        //     }
        // }

        // Price range filter
        if (minPrice || maxPrice) {
            where.price = {};
            if (minPrice) where.price.gte = parseFloat(minPrice);
            if (maxPrice) where.price.lte = parseFloat(maxPrice);
        }

        // Featured filter
        if (featured === 'true') {
            where.is_featured = true;
        }

        // In Stock filter
        if (inStock === 'true') {
            where.quantity_available = { gt: 0 };
        }

        // Color filter
        if (color) {
            where.color = color;
        }

        // Size filter
        if (size) {
            where.size = size;
        }

        // Breed filter
        if (breed) {
            where.breed = breed;
        }

        // Status filter - only return active listings by default
        where.listing_status = "active";

        // Fetch fish listings with pagination and filtering
        const [fishListings, totalCount] = await Promise.all([
            prisma.fish_listings.findMany({
                where,
                skip,
                take: limitNum,
                orderBy: { [sort]: order.toLowerCase() },
                include: {
                    fish_categories: {
                        select: {
                            id: true,
                            name: true,
                            description: true,
                            image_url: true,
                        },
                    },
                    reviews: {
                        select: {
                            rating: true,
                        },
                    },
                    users: {
                        select: {
                            id: true,
                            display_name: true,
                            logo_url: true,
                            seller_addresses: {
                                select: {
                                    seller_locations: {
                                        select: {
                                            city: true,
                                            state: true,
                                        }
                                    }
                                }
                            }
                        },
                    },
                },
            }),
            prisma.fish_listings.count({ where }),
        ]);

        // Calculate average rating for each listing
        const enhancedListings = fishListings.map((listing) => {
            const avgRating = listing.reviews.length > 0
                ? listing.reviews.reduce((sum, review) => sum + review.rating, 0) / listing.reviews.length
                : null;

            return {
                id: listing.id,
                name: listing.name,
                description: listing.description,
                price: listing.price,
                quantityAvailable: listing.quantity_available,
                images: listing.images,
                age: listing.age,
                size: listing.size,
                color: listing.color,
                breed: listing.breed,
                isFeatured: listing.is_featured,
                createdAt: listing.created_at,
                updatedAt: listing.updated_at,
                listingStatus: listing.listing_status,
                careInstructions: listing.care_instructions,
                dietaryRequirements: listing.dietary_requirements,
                viewCount: listing.view_count,
                category: listing.fish_categories,
                avgRating,
                reviewCount: listing.reviews.length,
                seller: listing.users,
            };
        });

        // Pagination metadata
        const totalPages = Math.ceil(totalCount / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;

        res.status(200).json({
            fishListings: enhancedListings,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalItems: totalCount,
                totalPages,
                hasNextPage,
                hasPrevPage,
            },
        });
    } catch (error) {
        console.error("Error fetching fish listings:", error);
        res.status(500).json({ message: "Server error while fetching fish listings" });
    }
};

// Get seller profile for buyer
export const getSellerProfile = async (req, res) => {

    const sellerId = req.params.id;

    try {
        // Fetch seller with related data
        const seller = await prisma.sellers.findUnique({
            where: {
                id: sellerId
            },
            select: {
                id: true,
                business_name: true,
                business_type: true,
                // email: true,
                // phone: true,
                // alternate_phone: true,
                display_name: true,
                store_description: true,
                logo_url: true,
                website_url: true,
                status: true,
                seller_rating: true,
                created_at: true,

                // Include seller metrics
                seller_metrics: {
                    select: {
                        total_sales: true,
                        total_orders: true,
                        avg_rating: true,
                        total_listings: true,
                        active_listings: true,
                        last_calculated_at: true
                    }
                },

                // Include seller settings
                seller_settings: {
                    select: {
                        auto_accept_orders: true,
                        default_warranty_period: true,
                        return_window: true,
                        shipping_provider: true,
                        min_order_value: true
                    }
                },

                // Include seller address information
                seller_addresses: {
                    select: {
                        address_line1: true,
                        address_line2: true,
                        landmark: true,
                        is_default: true,
                        address_type: true,
                        seller_locations: {
                            select: {
                                city: true,
                                state: true,
                                country: true,
                                pin_code: true
                            }
                        }
                    }
                },

                // Include fish listings
                fish_listings: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        price: true,
                        quantity_available: true,
                        images: true,
                        age: true,
                        size: true,
                        color: true,
                        breed: true,
                        is_featured: true,
                        created_at: true,
                        updated_at: true,
                        listing_status: true,
                        care_instructions: true,
                        dietary_requirements: true,
                        view_count: true,

                        // Include category information
                        fish_categories: {
                            select: {
                                name: true,
                                description: true,
                                image_url: true
                            }
                        },

                        // Include review summary
                        reviews: {
                            select: {
                                rating: true
                            }
                        }
                    },
                    where: {
                        listing_status: "active" // Only active listings
                    }
                }
            }
        });

        if (!seller) {
            console.log('Get seller profile : seller not found')
            res.status(500).json({
                success: false,
                message: 'Seller not found'
            })
        }

        // Calculate average rating for each fish listing
        const enhancedListings = seller.fish_listings.map(listing => {
            // Calculate average rating if reviews exist
            const reviewCount = listing.reviews.length;
            let avgRating = 0;

            if (reviewCount > 0) {
                const totalRating = listing.reviews.reduce((sum, review) => sum + review.rating, 0);
                avgRating = totalRating / reviewCount;
            }

            // Remove raw reviews and add calculated metrics
            const { reviews, ...listingData } = listing;

            return {
                ...listingData,
                review_count: reviewCount,
                average_rating: avgRating
            };
        });

        // Format the response
        const formattedResponse = {
            seller: {
                id: seller.id,
                business_name: seller.business_name,
                business_type: seller.business_type,
                display_name: seller.display_name,
                store_description: seller.store_description,
                logo_url: seller.logo_url,
                website_url: seller.website_url,
                status: seller.status,
                seller_rating: seller.seller_rating,
                joined_date: seller.created_at,

                // Location information
                location: seller.seller_addresses ? {
                    city: seller.seller_addresses.seller_locations?.city,
                    state: seller.seller_addresses.seller_locations?.state,
                    country: seller.seller_addresses.seller_locations?.country
                } : null,

                // Business metrics
                metrics: seller.seller_metrics || {
                    total_sales: 0,
                    total_orders: 0,
                    avg_rating: 0,
                    total_listings: 0,
                    active_listings: 0
                },

                // Shop policies
                policies: {
                    auto_accept_orders: seller.seller_settings?.[0]?.auto_accept_orders || true,
                    warranty_period_days: seller.seller_settings?.[0]?.default_warranty_period || 0,
                    return_window_days: seller.seller_settings?.[0]?.return_window || 7,
                    shipping_provider: seller.seller_settings?.[0]?.shipping_provider || "Standard",
                    min_order_value: seller.seller_settings?.[0]?.min_order_value || 0
                }
            },
            listings: enhancedListings
        };

        res.status(200).json({
            success: true,
            data: formattedResponse
        })

        return;

    } catch (error) {
        console.error("Error fetching seller profile:", error);
        res.status(500).json({
            success: false,
            message: 'Error fetching seller profile'
        })
    }
}

// Forgot password verification 
export const ForgotPasswordVerifyEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const user = await prisma.users.findUnique({
            where: {
                email: email
            }
        });

        if (!user){
            return res.status(500).json({success: false, message: "User doesn't exist. Please re-check the email address."})
        } 

        // Generate a verification code for the email display
        const verificationCode = generateVerificationToken();

        // Create JWT token with user info and verification code
        const verificationToken = createEmailVerificationToken(email, verificationCode)

        // Send verification email
        await sendVerificationEmail(email, verificationCode, verificationToken, 'User', 'forgotPassword');

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

// Change password 
export const ChangePassword = async (req, res) => {
    try {
        const { newPassword, verificationToken } = req.body;

        // Validate required fields
        if (!newPassword || !verificationToken) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email, new password, and verification token are required' 
            });
        }

        // Validate password strength (optional but recommended)
        if (newPassword.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Verify the token (you'll need to implement this based on your JWT verification logic)
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

        // Find the user
        const user = await prisma.users.findUnique({
            where: {
                email: decodedToken.email
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false, 
                message: "User doesn't exist. Please re-check the email address."
            });
        }

        // Hash the new password
        const hashedPassword = await hashPassword(newPassword)

        // Update the user's password
        const updatedUser = await prisma.users.update({
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
                full_name: true,
                updated_at: true
            }
        });

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully',
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                full_name: updatedUser.full_name
            }
        });

    } catch (error) {
        console.error('Password change error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error updating password',
            error: error.message
        });
    }
};