import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// List product
export const listProducts = async (req, res) => {
    try {
        const sellerId = req.userId;
        const { status, category, sort, page = 1, limit = 10 } = req.query;

        // Build the query filters
        const filters = {
            seller_id: sellerId
        };

        // Add status filter if provided
        if (status && ['active', 'inactive', 'sold_out', 'deleted'].includes(status)) {
            filters.listing_status = status;
        }

        // Add category filter if provided
        if (category) {
            filters.category_id = category;
        }

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build sort options
        let orderBy = {};
        if (sort === 'price_asc') {
            orderBy = { price: 'asc' };
        } else if (sort === 'price_desc') {
            orderBy = { price: 'desc' };
        } else if (sort === 'newest') {
            orderBy = { created_at: 'desc' };
        } else if (sort === 'oldest') {
            orderBy = { created_at: 'asc' };
        } else {
            // Default sort by newest
            orderBy = { created_at: 'desc' };
        }

        // Get products with pagination
        const products = await prisma.fish_listings.findMany({
            where: filters,
            include: {
                fish_categories: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            },
            orderBy,
            skip,
            take: parseInt(limit)
        });

        // Get total count for pagination
        const totalCount = await prisma.fish_listings.count({
            where: filters
        });

        // Calculate total pages
        const totalPages = Math.ceil(totalCount / parseInt(limit));

        return res.status(200).json({
            success: true,
            message: 'Fish listings retrieved successfully',
            data: {
                products,
                pagination: {
                    total: totalCount,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: totalPages
                }
            }
        });
    } catch (error) {
        console.error('Error listing products:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Add product
export const addProduct = async (req, res) => {
    try {
        const sellerId = req.userId;

        console.log('REQ.BODY : ', req.body);

        const seller = await prisma.sellers.findUnique({
            where: { id: sellerId }
        });

        if (!seller) {
            return res.status(403).json({
                success: false,
                message: 'Only verified sellers can add products'
            });
        }

        const {
            category,
            name,
            description,
            price,
            quantity_available,
            images,
            age,
            size,
            color,
            breed,
            is_featured,
            care_instructions,
            dietary_requirements
        } = req.body;

        // Find the category by name
        const categoryData = await prisma.fish_categories.findFirst({
            where: { name: category }
        });

        if (!categoryData) {
            return res.status(400).json({
                success: false,
                message: `Category '${category}' not found`
            });
        }

        const category_id = categoryData.id;

        // Transaction to ensure both operations succeed or fail together
        const result = await prisma.$transaction(async (tx) => {
            // Create new fish listing
            const newFishListing = await tx.fish_listings.create({
                data: {
                    seller_id: sellerId,
                    category_id,
                    name,
                    description,
                    price: parseFloat(price),
                    quantity_available: parseInt(quantity_available),
                    images: Array.isArray(images) ? images : [images],
                    age,
                    size,
                    color,
                    breed,
                    is_featured: is_featured === true || is_featured === 'true',
                    care_instructions: care_instructions ?
                        (typeof care_instructions === 'string' ? JSON.parse(care_instructions) : care_instructions) :
                        {},
                    dietary_requirements: dietary_requirements ?
                        (typeof dietary_requirements === 'string' ? JSON.parse(dietary_requirements) : dietary_requirements) :
                        {},
                    listing_status: 'active'
                },
                include: {
                    fish_categories: true
                }
            });

            // Check if seller metrics exists
            const existingMetrics = await tx.seller_metrics.findUnique({
                where: { seller_id: sellerId }
            });

            if (existingMetrics) {
                // Update existing metrics
                await tx.seller_metrics.update({
                    where: { seller_id: sellerId },
                    data: {
                        total_listings: { increment: 1 },
                        active_listings: { increment: 1 },
                        last_calculated_at: new Date()
                    }
                });
            } else {
                // Create new metrics
                await tx.seller_metrics.create({
                    data: {
                        seller_id: sellerId,
                        total_listings: 1,
                        active_listings: 1,
                        last_calculated_at: new Date()
                    }
                });
            }

            return {
                newFishListing,
                categoryData
            };
        });

        // Format the response for better readability
        const formattedResponse = {
            ...result.newFishListing,
            category: result.newFishListing.fish_categories,
            categoryName: result.categoryData.name
        };

        return res.status(201).json({
            success: true,
            message: 'Fish listing created successfully',
            data: formattedResponse
        });
    } catch (error) {
        console.error('Error adding product:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Edit product
export const editProduct = async (req, res) => {

    console.log('reached edit products')

    try {
        const sellerId = req.userId;
        const { id } = req.params;
        console.log("Params id : ",req.body)

        // Verify product exists and belongs to seller
        const existingProduct = await prisma.fish_listings.findUnique({
            where: { id }
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Fish listing not found'
            });
        }

        if (existingProduct.seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to edit this product'
            });
        }

        const {
            category_id,
            name,
            description,
            price,
            quantity_available,
            images,
            age,
            size,
            color,
            breed,
            is_featured,
            care_instructions,
            dietary_requirements,
            listing_status
        } = req.body

        // Status change tracking for metrics update
        const statusChanged = listing_status && existingProduct.listing_status !== listing_status;
        const wasActive = existingProduct.listing_status === 'active';
        const willBeActive = listing_status === 'active';

        // Update fish listing
        const updatedFishListing = await prisma.fish_listings.update({
            where: { id },
            data: {
                category_id,
                name,
                description,
                price,
                quantity_available,
                images,
                age,
                size,
                color,
                breed,
                is_featured,
                care_instructions: care_instructions || {},
                dietary_requirements: dietary_requirements || {},
                listing_status,
                updated_at: new Date()
            }
        });

        // Update seller metrics if status changed
        if (statusChanged) {
            await prisma.seller_metrics.update({
                where: { seller_id: sellerId },
                data: {
                    active_listings: {
                        increment: wasActive ? -1 : (willBeActive ? 1 : 0)
                    },
                    last_calculated_at: new Date()
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Fish listing updated successfully',
            data: updatedFishListing
        });
    } catch (error) {
        console.error('Error updating product:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// View product
export const viewProduct = async (req, res) => {
    try {
        const sellerId = req.user.id;
        const { id } = req.params;

        // Fetch product with category details
        const fishListing = await prisma.fish_listings.findUnique({
            where: { id },
            include: {
                fish_categories: true
            }
        });

        if (!fishListing) {
            return res.status(404).json({
                success: false,
                message: 'Fish listing not found'
            });
        }

        // Verify the product belongs to the authenticated seller
        if (fishListing.seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to access this product'
            });
        }

        // Get product statistics
        const orderCount = await prisma.order_items.count({
            where: { fish_listing_id: id }
        });

        const reviewStats = await prisma.reviews.aggregate({
            where: { fish_listing_id: id },
            _count: { id: true },
            _avg: { rating: true }
        });

        // Format response
        const productDetails = {
            ...fishListing,
            statistics: {
                order_count: orderCount,
                review_count: reviewStats._count.id,
                average_rating: reviewStats._avg.rating || 0
            }
        };

        return res.status(200).json({
            success: true,
            message: 'Fish listing retrieved successfully',
            data: productDetails
        });
    } catch (error) {
        console.error('Error retrieving product:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Delete product
export const deleteProduct = async (req, res) => {
    try {
        const sellerId = req.userId;
        const { id } = req.params;

        console.log(sellerId, id)

        // Verify product exists and belongs to seller
        const existingProduct = await prisma.fish_listings.findUnique({
            where: { id }
        });

        if (!existingProduct) {
            return res.status(404).json({
                success: false,
                message: 'Fish listing not found'
            });
        }

        if (existingProduct.seller_id !== sellerId) {
            return res.status(403).json({
                success: false,
                message: 'Not authorized to delete this product'
            });
        }

        // Check if the product has associated orders
        const hasOrders = await prisma.order_items.findFirst({
            where: { fish_listing_id: id }
        });

        if (hasOrders) {
            // Soft delete - just update status
            await prisma.fish_listings.update({
                where: { id },
                data: {
                    listing_status: 'deleted',
                    updated_at: new Date()
                }
            });
        } else {
            // Hard delete if no orders
            await prisma.fish_listings.delete({
                where: { id }
            });
        }

        // Update seller metrics
        if (existingProduct.listing_status === 'active') {
            await prisma.seller_metrics.update({
                where: { seller_id: sellerId },
                data: {
                    total_listings: { decrement: 1 },
                    active_listings: { decrement: 1 },
                    last_calculated_at: new Date()
                }
            });
        } else {
            await prisma.seller_metrics.update({
                where: { seller_id: sellerId },
                data: {
                    total_listings: { decrement: 1 },
                    last_calculated_at: new Date()
                }
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Fish listing deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting product:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};