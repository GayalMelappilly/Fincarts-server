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

export const searchFishes = async (req, res) => {
    // Get keyword from URL params or query params
    const keyword = req.params.name;

    // Input validation
    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({
            success: false,
            error: 'Valid search keyword is required',
            data: [],
            metadata: {
                totalCount: 0,
                searchTerm: keyword,
                executionTime: 0
            }
        });
    }

    const startTime = Date.now();
    
    // Get options from query parameters
    const {
        limit = 8,
        offset = 0,
        page = 1,
        sortBy = 'created_at',
        sortOrder = 'desc',
        minPrice,
        maxPrice,
        categoryId,
        includeCategory = 'true',
        includeSeller = 'false',
        featuredOnly = 'false',
        colors,
        sizes,
        minQuantity = 1
    } = req.query;

    // Parse boolean values from query strings
    const parsedIncludeCategory = includeCategory === 'true';
    const parsedIncludeSeller = includeSeller === 'true';
    const parsedFeaturedOnly = featuredOnly === 'true';

    // Parse arrays from comma-separated strings
    const parsedColors = colors ? colors.split(',').map(c => c.trim()).filter(c => c) : [];
    const parsedSizes = sizes ? sizes.split(',').map(s => s.trim()).filter(s => s) : [];

    // Handle pagination - if page is provided, calculate offset
    let calculatedOffset = parseInt(offset) || 0;
    if (page && page > 1) {
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit) || 8;
        calculatedOffset = (pageNum - 1) * limitNum;
    }

    // Validate numeric inputs
    const validatedLimit = Math.min(Math.max(parseInt(limit) || 8, 1), 100);
    const validatedOffset = Math.max(calculatedOffset, 0);
    const validatedMinQuantity = Math.max(parseInt(minQuantity) || 1, 0);

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'updated_at', 'name', 'price', 'view_count'];
    const validatedSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const validatedSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

    try {
        // Sanitize and prepare search term
        const sanitizedKeyword = keyword.trim().toLowerCase();
        const searchTerms = sanitizedKeyword.split(/\s+/).filter(term => term.length > 0);

        // Build comprehensive where clause
        const whereClause = {
            AND: [
                // Basic availability filters
                {
                    listing_status: 'active',
                    quantity_available: {
                        gte: validatedMinQuantity
                    }
                },
                // Main search conditions
                {
                    OR: [
                        // Exact name match (highest priority)
                        {
                            name: {
                                equals: keyword,
                                mode: 'insensitive'
                            }
                        },
                        // Name contains search term
                        {
                            name: {
                                contains: sanitizedKeyword,
                                mode: 'insensitive'
                            }
                        },
                        // Description contains search term
                        {
                            description: {
                                contains: sanitizedKeyword,
                                mode: 'insensitive'
                            }
                        },
                        // Breed matches
                        {
                            breed: {
                                contains: sanitizedKeyword,
                                mode: 'insensitive'
                            }
                        },
                        // Color matches
                        {
                            color: {
                                contains: sanitizedKeyword,
                                mode: 'insensitive'
                            }
                        },
                        // Category name matches (if including category)
                        ...(parsedIncludeCategory ? [{
                            fish_categories: {
                                name: {
                                    contains: sanitizedKeyword,
                                    mode: 'insensitive'
                                }
                            }
                        }] : []),
                        // Multiple term search - name contains any of the terms
                        ...(searchTerms.length > 1 ? searchTerms.map(term => ({
                            name: {
                                contains: term,
                                mode: 'insensitive'
                            }
                        })) : [])
                    ]
                }
            ]
        };

        // Apply additional filters
        const additionalFilters = [];

        // Price range filter
        if (minPrice !== undefined || maxPrice !== undefined) {
            const priceFilter = {};
            if (minPrice !== undefined && !isNaN(parseFloat(minPrice))) {
                priceFilter.gte = parseFloat(minPrice);
            }
            if (maxPrice !== undefined && !isNaN(parseFloat(maxPrice))) {
                priceFilter.lte = parseFloat(maxPrice);
            }
            if (Object.keys(priceFilter).length > 0) {
                additionalFilters.push({ price: priceFilter });
            }
        }

        // Category filter
        if (categoryId) {
            additionalFilters.push({ category_id: categoryId });
        }

        // Featured filter
        if (parsedFeaturedOnly) {
            additionalFilters.push({ is_featured: true });
        }

        // Color filter
        if (parsedColors.length > 0) {
            additionalFilters.push({
                color: {
                    in: parsedColors,
                    mode: 'insensitive'
                }
            });
        }

        // Size filter
        if (parsedSizes.length > 0) {
            additionalFilters.push({
                size: {
                    in: parsedSizes,
                    mode: 'insensitive'
                }
            });
        }

        // Add additional filters to main where clause
        if (additionalFilters.length > 0) {
            whereClause.AND.push(...additionalFilters);
        }

        // Build include clause
        const includeClause = {};
        
        if (parsedIncludeCategory) {
            includeClause.fish_categories = {
                select: {
                    id: true,
                    name: true,
                    description: true,
                    image_url: true,
                    feature: true
                }
            };
        }

        if (parsedIncludeSeller) {
            includeClause.users = {
                select: {
                    id: true,
                    business_name: true,
                    display_name: true,
                    seller_rating: true,
                    logo_url: true,
                    status: true,
                    created_at: true
                }
            };
        }

        // Execute search query
        const [fishListings, totalCount] = await Promise.all([
            prisma.fish_listings.findMany({
                where: whereClause,
                include: includeClause,
                orderBy: {
                    [validatedSortBy]: validatedSortOrder
                },
                take: validatedLimit,
                skip: validatedOffset
            }),
            prisma.fish_listings.count({
                where: whereClause
            })
        ]);

        // Calculate execution time
        const executionTime = Date.now() - startTime;

        // Prepare pagination metadata
        const hasNextPage = validatedOffset + fishListings.length < totalCount;
        const hasPreviousPage = validatedOffset > 0;
        const totalPages = Math.ceil(totalCount / validatedLimit);
        const currentPage = Math.floor(validatedOffset / validatedLimit) + 1;

        // Sort results by relevance (optional enhancement)
        const sortedResults = fishListings.sort((a, b) => {
            const aNameMatch = a.name.toLowerCase().includes(sanitizedKeyword);
            const bNameMatch = b.name.toLowerCase().includes(sanitizedKeyword);
            
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            
            // If both match in name, prioritize exact matches
            const aExactMatch = a.name.toLowerCase() === sanitizedKeyword;
            const bExactMatch = b.name.toLowerCase() === sanitizedKeyword;
            
            if (aExactMatch && !bExactMatch) return -1;
            if (!aExactMatch && bExactMatch) return 1;
            
            return 0;
        });

        // Build pagination URLs for convenience
        const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0]}`;
        const currentParams = new URLSearchParams(req.query);
        
        const buildPageUrl = (pageNum) => {
            currentParams.set('page', pageNum.toString());
            return `${baseUrl}?${currentParams.toString()}`;
        };

        // Return successful response
        return res.status(200).json({
            success: true,
            data: sortedResults,
            metadata: {
                count: fishListings.length,
                totalCount,
                searchTerm: keyword,
                sanitizedSearchTerm: sanitizedKeyword,
                executionTime,
                filters: {
                    minPrice: minPrice ? parseFloat(minPrice) : undefined,
                    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
                    categoryId,
                    featuredOnly: parsedFeaturedOnly,
                    colors: parsedColors,
                    sizes: parsedSizes,
                    minQuantity: validatedMinQuantity
                },
                pagination: {
                    limit: validatedLimit,
                    offset: validatedOffset,
                    currentPage,
                    totalPages,
                    hasNextPage,
                    hasPreviousPage
                },
                sorting: {
                    sortBy: validatedSortBy,
                    sortOrder: validatedSortOrder
                }
            },
            _links: {
                self: req.originalUrl,
                ...(hasNextPage && {
                    next: buildPageUrl(currentPage + 1)
                }),
                ...(hasPreviousPage && {
                    prev: buildPageUrl(currentPage - 1)
                }),
                ...(currentPage !== 1 && {
                    first: buildPageUrl(1)
                }),
                ...(currentPage !== totalPages && totalPages > 0 && {
                    last: buildPageUrl(totalPages)
                })
            }
        });

    } catch (error) {
        const executionTime = Date.now() - startTime;
        
        console.error('Error in searchFishes function:', {
            error: error.message,
            stack: error.stack,
            keyword,
            query: req.query,
            params: req.params,
            timestamp: new Date().toISOString()
        });

        return res.status(500).json({
            success: false,
            error: 'An error occurred while searching fish listings',
            errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined,
            data: [],
            metadata: {
                totalCount: 0,
                searchTerm: keyword,
                executionTime,
                errorOccurred: true
            }
        });
    }
};

export const getMatchingFishListings = async (searchString = '', options = {}) => {
  const { includeCategory = false, includeCount = false, limit = 10 } = options;
  
  try {
    const listings = await prisma.fish_listings.findMany({
      where: {
        listing_status: 'active',
        quantity_available: {
          gt: 0
        },
        ...(searchString.trim() && {
          OR: [
            { name: { contains: searchString, mode: 'insensitive' } },
            { breed: { contains: searchString, mode: 'insensitive' } },
            { color: { contains: searchString, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        fish_categories: includeCategory ? {
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
          }
        } : false
      },
      orderBy: {
        name: 'asc'
      },
      take: limit
    });

    return {
      success: true,
      data: listings,
      count: listings.length
    };
  } catch (error) {
    console.error('Error fetching matching fish listings:', error);
    return {
      success: false,
      error: error.message,
      data: []
    };
  }
};


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