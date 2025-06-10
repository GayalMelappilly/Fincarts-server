import prisma from '../utils/prisma.js'
import { transformToCamelCase } from '../utils/toCamelCase.js';

export const getFeaturedFishes = async (req, res) => {
    try {
        const featuredFishes = await prisma.fish_listings.findMany({
            where: {
                is_featured: true,
                listing_status: 'active',
                quantity_available: {
                    gt: 0
                }
            },
            include: {
                fish_categories: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        image_url: true
                    }
                },
                users: { // This is the seller relation
                    select: {
                        id: true,
                        business_name: true,
                        display_name: true,
                        logo_url: true,
                        seller_rating: true,
                        status: true,
                        seller_addresses: {
                            select: {
                                id: true,
                                address_line1: true,
                                address_line2: true,
                                landmark: true,
                                is_default: true,
                                seller_locations: {
                                    select: {
                                        city: true,
                                        state: true,
                                        country: true,
                                        pin_code: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: [
                { created_at: 'desc' },
                { view_count: 'desc' }
            ],
            take: 10,
            skip: 0
        });

        const data = transformToCamelCase(featuredFishes);

        console.log("Featured fishes with seller details fetched successfully");

        res.status(200).json({
            success: true,
            data: data,
            count: data.length
        });
    } catch (error) {
        console.error('Error fetching featured fishes:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    }
}

export const getFishesByCategory = async (req, res) => {
    const options = {
        limit: 20,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'desc',
        minPrice: 0,
        maxPrice: 99999999,
        includeCategory: true,
        includeSeller: true
    }

    const categoryId = req.params.id

    console.log('category id : ', categoryId)

    // Validate categoryId
    if (!categoryId) {
        return res.status(400).json({
            success: false,
            error: 'Category ID is required',
            data: []
        });
    }

    try {
        // Build price filter
        const priceFilter = {};
        if (options.minPrice !== undefined) priceFilter.gte = options.minPrice;
        if (options.maxPrice !== undefined) priceFilter.lte = options.maxPrice;

        // Build where clause
        const whereClause = {
            category_id: categoryId,
            listing_status: 'active',
            quantity_available: {
                gt: 0
            }
        };

        // Add price filter if specified
        if (Object.keys(priceFilter).length > 0) {
            whereClause.price = priceFilter;
        }

        // Build order by clause
        const orderByClause = {};
        orderByClause[options.sortBy] = options.sortOrder;

        const totalCount = await prisma.fish_listings.count({
            where: whereClause
        });

        const fishListings = await prisma.fish_listings.findMany({
            where: whereClause,
            include: {
                fish_categories: options.includeCategory ? {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        image_url: true
                    }
                } : false,
                users: options.includeSeller ? {
                    select: {
                        id: true,
                        business_name: true,
                        display_name: true,
                        logo_url: true,
                        seller_rating: true,
                        status: true,
                        seller_addresses: {
                            select: {
                                id: true,
                                address_line1: true,
                                address_line2: true,
                                landmark: true,
                                is_default: true,
                                seller_locations: {
                                    select: {
                                        city: true,
                                        state: true,
                                        country: true,
                                        pin_code: true
                                    }
                                }
                            }
                        }
                    }
                } : false
            },
            orderBy: orderByClause,
            take: options.limit,
            skip: options.offset
        });

        const data = transformToCamelCase(fishListings)

        res.status(200).json({
            success: true,
            data: data,
            count: data.length,
            totalCount,
            pagination: {
                limit: options.limit,
                offset: options.offset,
                hasMore: options.offset + fishListings.length < totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching fishes by category:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    }
}


export const getFishesByCategoryName = async (req, res) => {

    const categoryName = req.params.name
    console.log('category name : ', categoryName)

    if (!categoryName) {
        res.status(500).json({
            success: false,
            error: 'Category name is required',
            data: []
        });
    }


    try {
        // First find the category by name
        const category = await prisma.fish_categories.findFirst({
            where: {
                name: {
                    equals: categoryName,
                    mode: 'insensitive' // Case-insensitive search
                }
            }
        });

        if (!category) {
            res.status(500).json({
                success: false,
                error: `Category '${categoryName}' not found`,
                data: []
            });
        }

        const options = {
            limit: 20,
            offset: 0,
            sortBy: 'created_at',
            sortOrder: 'desc',
            minPrice: 0,
            maxPrice: 99999999,
            includeCategory: true,
            includeSeller: false
        }

        const orderByClause = {};
        orderByClause[options.sortBy] = options.sortOrder;

        // Use the found category ID to get fish listings

        const fishListings = await prisma.fish_listings.findMany({
            where: {
                category_id: category.id,
                listing_status: 'active',
                quantity_available: {
                    gt: 0
                }
            },
            include: {
                fish_categories: options.includeCategory ? {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        image_url: true
                    }
                } : false,
                users: { // This is the seller relation
                    select: {
                        id: true,
                        business_name: true,
                        display_name: true,
                        logo_url: true,
                        seller_rating: true,
                        status: true,
                        seller_addresses: {
                            select: {
                                id: true,
                                address_line1: true,
                                address_line2: true,
                                landmark: true,
                                is_default: true,
                                seller_locations: {
                                    select: {
                                        city: true,
                                        state: true,
                                        country: true,
                                        pin_code: true
                                    }
                                }
                            }
                        }
                    }
                }
            },
            orderBy: orderByClause,
            take: options.limit,
            skip: options.offset
        });

        // Get total count for pagination
        const totalCount = await prisma.fish_listings.count({
            where: {
                category_id: category.id,
                listing_status: 'active',
                quantity_available: {
                    gt: 0
                }
            }
        });

        console.log('categorized : ', fishListings)
        const data = transformToCamelCase(fishListings)


        res.status(201).json({
            success: true,
            data: data,
            count: data.length,
            totalCount,
            pagination: {
                limit: options.limit,
                offset: options.offset,
                hasMore: options.offset + fishListings.length < totalCount
            }
        });
    } catch (error) {
        console.error('Error fetching fishes by category name:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            data: []
        });
    }
}


export const getAllCategories = async (options = {}) => {
    const { includeCount = false } = options;

    try {
        const categories = await prisma.fish_categories.findMany({
            include: {
                _count: includeCount ? {
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
                } : false
            },
            orderBy: {
                name: 'asc'
            }
        });

        return {
            success: true,
            data: categories,
            count: categories.length
        };
    } catch (error) {
        console.error('Error fetching categories:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}


export const searchFishes = async (searchTerm, options = {}) => {
    const {
        limit = 20,
        offset = 0,
        sortBy = 'created_at',
        sortOrder = 'desc',
        minPrice,
        maxPrice,
        includeCategory = true,
        includeSeller = false
    } = options;

    if (!searchTerm) {
        return {
            success: false,
            error: 'Search term is required',
            data: []
        };
    }

    try {
        // Build price filter
        const priceFilter = {};
        if (minPrice !== undefined) priceFilter.gte = minPrice;
        if (maxPrice !== undefined) priceFilter.lte = maxPrice;

        // Build where clause
        const whereClause = {
            OR: [
                {
                    name: {
                        contains: searchTerm,
                        mode: 'insensitive'
                    }
                },
                {
                    description: {
                        contains: searchTerm,
                        mode: 'insensitive'
                    }
                },
                {
                    breed: {
                        contains: searchTerm,
                        mode: 'insensitive'
                    }
                }
            ],
            listing_status: 'active',
            quantity_available: {
                gt: 0
            }
        };

        if (Object.keys(priceFilter).length > 0) {
            whereClause.price = priceFilter;
        }

        // Build order by clause
        const orderByClause = {};
        orderByClause[sortBy] = sortOrder;

        const fishListings = await prisma.fish_listings.findMany({
            where: whereClause,
            include: {
                fish_categories: includeCategory,
                users: includeSeller ? {
                    select: {
                        id: true,
                        business_name: true,
                        display_name: true,
                        seller_rating: true,
                        logo_url: true
                    }
                } : false
            },
            orderBy: orderByClause,
            take: limit,
            skip: offset
        });

        // Get total count for pagination
        const totalCount = await prisma.fish_listings.count({
            where: whereClause
        });

        return {
            success: true,
            data: fishListings,
            count: fishListings.length,
            totalCount,
            pagination: {
                limit,
                offset,
                hasMore: offset + fishListings.length < totalCount
            }
        };
    } catch (error) {
        console.error('Error searching fishes:', error);
        return {
            success: false,
            error: error.message,
            data: []
        };
    }
}


// Example usage:
/*
// Get featured fishes
const featuredFishes = await getFeaturedFishes({ limit: 5 });
console.log(featuredFishes);

// Get fishes by category ID
const categoryFishes = await getFishesByCategory('category-uuid-here', {
  limit: 10,
  sortBy: 'price',
  sortOrder: 'asc',
  minPrice: 100,
  maxPrice: 1000
});
console.log(categoryFishes);

// Get fishes by category name
const goldFishes = await getFishesByCategoryName('Goldfish', { limit: 5 });
console.log(goldFishes);

// Get all categories
const categories = await getAllCategories({ includeCount: true });
console.log(categories);

// Search fishes
const searchResults = await searchFishes('tropical', { limit: 10 });
console.log(searchResults);
*/