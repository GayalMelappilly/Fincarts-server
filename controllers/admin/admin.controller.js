import prisma from "../../utils/prisma.js";
import { transformToCamelCase } from "../../utils/toCamelCase.js";

// Get all categories with product count
export const getFishCategoriesWithCount = async (req, res) => {
    try {
        const categories = await prisma.fish_categories.findMany({
            include: {
                fish_listings: {
                    where: {
                        listing_status: 'active',
                        quantity_available: {
                            gt: 0
                        }
                    },
                    select: {
                        id: true
                    }
                },
                fish_categories: { // Parent category
                    select: {
                        id: true,
                        name: true
                    }
                },
                other_fish_categories: { // Child categories
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: {
                                fish_listings: {
                                    where: {
                                        listing_status: 'active',
                                        quantity_available: {
                                            gt: 0
                                        }
                                    }
                                }
                            }
                        },
                        feature: true
                    }
                }
            },
            orderBy: [
                { feature: 'desc' },
                { name: 'asc' }
            ]
        });

        // Transform data to include product count
        const categoriesWithCount = categories.map(category => ({
            id: category.id,
            name: category.name,
            description: category.description,
            image_url: category.image_url,
            parent_category_id: category.parent_category_id,
            feature: category.feature,
            created_at: category.created_at,
            updated_at: category.updated_at,
            product_count: category.fish_listings.length,
            parent_category: category.fish_categories,
            child_categories: category.other_fish_categories.map(child => ({
                id: child.id,
                name: child.name,
                product_count: child._count.fish_listings,
                feature: child.feature
            }))
        }));

        const data = transformToCamelCase(categoriesWithCount);

        console.log("Fish categories with product count fetched successfully");

        res.status(200).json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Error fetching fish categories with count:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    }
};

export const setFeaturedCategories = async (req, res) => {
    try {
        const { categoryId, feature } = req.body.category;

        console.log('Reached set featured : ', req.body.category)

        // Validate required fields
        if (!categoryId) {
            return res.status(400).json({
                success: false,
                error: 'Category ID is required',
                data: null
            });
        }

        // Validate feature field (should be boolean)
        if (typeof feature !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'Feature field must be a boolean value (true or false)',
                data: null
            });
        }

        // Check if category exists
        const existingCategory = await prisma.fish_categories.findUnique({
            where: {
                id: categoryId
            },
            select: {
                id: true,
                name: true,
                feature: true
            }
        });

        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                error: 'Fish category not found',
                data: null
            });
        }

        // Update the category feature status
        const updatedCategory = await prisma.fish_categories.update({
            where: {
                id: categoryId
            },
            data: {
                feature: feature,
                updated_at: new Date()
            },
            select: {
                id: true,
                name: true,
                description: true,
                image_url: true,
                parent_category_id: true,
                feature: true,
                created_at: true,
                updated_at: true
            }
        });

        // Transform to camelCase if you have the utility function
        const data = transformToCamelCase(updatedCategory);

        console.log(`Fish category feature status updated successfully: ${existingCategory.name} - Feature: ${feature}`);

        res.status(200).json({
            success: true,
            message: `Category "${existingCategory.name}" feature status updated to ${feature}`,
            data: data
        });

    } catch (error) {
        console.error('Error updating fish category feature status:', error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2025') {
            return res.status(404).json({
                success: false,
                error: 'Fish category not found',
                data: null
            });
        }

        res.status(500).json({
            success: false,
            error: 'Internal server error while updating category feature status',
            data: null
        });
    }
};