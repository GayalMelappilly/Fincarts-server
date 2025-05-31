import prisma from '../utils/prisma.js'
import crypto from 'crypto'

// Add to cart
export const addToCart = async (req, res) => {
  try {
    // Extract the necessary data from the request body
    const {
      fishId,
      quantity// Default to 1 if not specified
    } = req.body;

    const userId = req.userId

    // Validate required fields
    if (!userId || !fishId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId or fishData'
      });
    }

    // Validate quantity is a positive integer
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Check if fish listing exists
    const fishListing = await prisma.fish_listings.findUnique({
      where: { id: fishId }
    });

    if (!fishListing) {
      return res.status(404).json({
        success: false,
        message: 'Fish listing not found'
      });
    }

    // Check if fish is in stock
    if (fishListing.quantity_available < quantity) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock available. Only ${fishListing.quantity_available} units available.`
      });
    }

    // Find user's active cart or create a new one
    let cart = await prisma.shopping_carts.findFirst({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    if (!cart) {
      cart = await prisma.shopping_carts.create({
        data: {
          user_id: userId,
          is_active: true
        }
      });
    }

    // Check if item already exists in cart
    const existingCartItem = await prisma.cart_items.findFirst({
      where: {
        cart_id: cart.id,
        fish_listing_id: fishId
      }
    });

    let cartItem;

    if (existingCartItem) {
      // Update quantity if item exists
      cartItem = await prisma.cart_items.update({
        where: { id: existingCartItem.id },
        data: {
          quantity: existingCartItem.quantity + quantity
        },
        include: {
          fish_listings: {
            select: {
              name: true,
              price: true,
              images: true
            }
          }
        }
      });
    } else {
      // Create new cart item if it doesn't exist
      cartItem = await prisma.cart_items.create({
        data: {
          cart_id: cart.id,
          fish_listing_id: fishId,
          quantity: quantity
        },
        include: {
          fish_listings: {
            select: {
              name: true,
              price: true,
              images: true
            }
          }
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: cartItem
    });

  } catch (error) {
    console.error('Error adding fish to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while adding the item to cart',
      error: error.message
    });
  }
}

// Add to cart - Guest
export const addToCartGuest = async (req, res) => {
  try {
    // Extract the necessary data from the request body
    const {
      fishId,
      quantity// Default to 1 if not specified
    } = req.body;

    // Validate required fields
    if (!fishId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId or fishData'
      });
    }

    // Validate quantity is a positive integer
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Check if fish listing exists
    const fishListing = await prisma.fish_listings.findUnique({
      where: { id: fishId }
    });

    if (!fishListing) {
      return res.status(404).json({
        success: false,
        message: 'Fish listing not found'
      });
    }

    // Check if fish is in stock
    if (fishListing.quantity_available < quantity) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock available. Only ${fishListing.quantity_available} units available.`
      });
    }

    // Find user's active cart or create a new one
    // let cart = await prisma.shopping_carts.findFirst({
    //   where: {
    //     user_id: userId,
    //     is_active: true
    //   }
    // });

    // if (!cart) {
    //   cart = await prisma.shopping_carts.create({
    //     data: {
    //       user_id: userId,
    //       is_active: true
    //     }
    //   });
    // }

    // Check if item already exists in cart
    // const existingCartItem = await prisma.cart_items.findFirst({
    //   where: {
    //     cart_id: cart.id,
    //     fish_listing_id: fishId
    //   }
    // });

    // let cartItem;

    // if (existingCartItem) {
    //   // Update quantity if item exists
    //   cartItem = await prisma.cart_items.update({
    //     where: { id: existingCartItem.id },
    //     data: {
    //       quantity: existingCartItem.quantity + quantity
    //     },
    //     include: {
    //       fish_listings: {
    //         select: {
    //           name: true,
    //           price: true,
    //           images: true
    //         }
    //       }
    //     }
    //   });
    // } else {
    //   // Create new cart item if it doesn't exist
    //   cartItem = await prisma.cart_items.create({
    //     data: {
    //       cart_id: cart.id,
    //       fish_listing_id: fishId,
    //       quantity: quantity
    //     },
    //     include: {
    //       fish_listings: {
    //         select: {
    //           name: true,
    //           price: true,
    //           images: true
    //         }
    //       }
    //     }
    //   });
    // }

    return res.status(200).json({
      success: true,
      message: 'Item added to cart successfully',
      data: {
        fishListings: {
          breed: fishListing.breed,
          color: fishListing.color,
          description: fishListing.description,
          id: fishListing.id,
          images: fishListing.images,
          name: fishListing.name,
          price: fishListing.price,
          size: fishListing.size
        },
        addedAt: {},
        id: crypto.randomUUID(),
        fishListingId: fishId,
        quantity: quantity
      }
    });

  } catch (error) {
    console.error('Error adding fish to cart:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while adding the item to cart',
      error: error.message
    });
  }
}

// Edit item in cart
export const editCartItem = async (req, res) => {
  try {
    // Extract the necessary data from the request body
    const {
      id,
      quantity
    } = req.body;

    const userId = req.userId;

    // Validate required fields
    if (!userId || !id) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId or id'
      });
    }

    // Validate quantity is a positive integer
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Find user's active cart
    const cart = await prisma.shopping_carts.findFirst({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Active cart not found'
      });
    }

    // Find the cart item
    const cartItem = await prisma.cart_items.findFirst({
      where: {
        id: id,
        cart_id: cart.id
      },
      include: {
        fish_listings: true
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found'
      });
    }

    // Check if fish is in stock
    if (cartItem.fish_listings.quantity_available < quantity) {
      return res.status(400).json({
        success: false,
        message: `Not enough stock available. Only ${cartItem.fish_listings.quantity_available} units available.`
      });
    }

    // Update the cart item quantity
    const updatedCartItem = await prisma.cart_items.update({
      where: { id: id },
      data: {
        quantity: quantity
      },
      include: {
        fish_listings: {
          select: {
            name: true,
            price: true,
            images: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Cart item updated successfully',
    });

  } catch (error) {
    console.error('Error updating cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while updating the cart item',
      error: error.message
    });
  }
};

// Delete cart item
export const deleteCartItem = async (req, res) => {
  console.log('reached delete')
  try {
    // Extract the cart item ID from request parameters
    const itemId = req.params.id;
    const userId = req.userId;

    // Validate required fields
    if (!userId || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId or itemId'
      });
    }

    // Find user's active cart
    const cart = await prisma.shopping_carts.findFirst({
      where: {
        user_id: userId,
        is_active: true
      }
    });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: 'Active cart not found'
      });
    }

    // Check if the cart item exists and belongs to the user's cart
    const cartItem = await prisma.cart_items.findFirst({
      where: {
        id: itemId,
        cart_id: cart.id
      }
    });

    if (!cartItem) {
      return res.status(404).json({
        success: false,
        message: 'Cart item not found or does not belong to your cart'
      });
    }

    // Delete the cart item
    await prisma.cart_items.delete({
      where: { id: itemId }
    });

    return res.status(200).json({
      success: true,
      message: 'Item removed from cart successfully'
    });

  } catch (error) {
    console.error('Error deleting cart item:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while removing the item from cart',
      error: error.message
    });
  }
};


