import client from '../config/db.js'
import { addressInsertQuery, deleteRefreshToken, findCurrentUserQuery, findRefreshTokenQuery, refreshTokenInsertQuery, userInsertQuery } from '../query/user.query.js'
import { createAccessToken, createRefreshToken } from '../services/token.services.js'
import { hashPassword } from '../utils/bcrypt.js'
import prisma from '../utils/prisma.js'

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
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            const result = await client.query(deleteRefreshToken, [
                refreshToken
            ])
        }

        res.clearCookie('refreshToken');
        res.status(201).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            sucess: false,
            message: 'Server error'
        });
    }
};

// Get current user
export const getCurrentUser = async (req, res) => {
    try {

        const userId = req.userId

        console.log("USER ID : ", userId)

        const result = await client.query(findCurrentUserQuery, [
            userId
        ])

        if (!result) {
            return res.status(404).json({ message: 'User not found' });
        }

        const row = result.rows[0]

        const user = {
            id: row.user_id,
            fullName: row.full_name,
            email: row.email,
            phoneNumber: row.phone_number,
            userType: row.user_type,
            emailVerified: row.email_verified,
            phoneVerified: row.phone_verified,
            pointsBalance: row.points_balance,
            profileImage: row.profile_picture_url,
            createdAt: row.user_created_at,
            updatedAt: row.user_updated_at,
            address: {
                id: row.address_id,
                line1: row.address_line1,
                line2: row.address_line2,
                city: row.city,
                state: row.state,
                postalCode: row.postal_code,
                country: row.country,
                isDefault: row.is_default,
                latitude: row.latitude,
                longitude: row.longitude,
                createdAt: row.address_created_at,
                updatedAt: row.address_updated_at,
            }
        };

        res.status(201).json({ user });
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