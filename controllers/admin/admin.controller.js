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