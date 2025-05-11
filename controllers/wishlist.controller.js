import prisma from "../utils/prisma.js";

// Function to add a fish to wishlist
export const addToWishlist = async (req, res) => {
    try {
      const fishId = req.body.id
      const userId = req.userId;

  
      // Validate required fields
      if (!userId || !fishId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId or fishId'
        });
      }
  
      // Check if fish listing exists
      const fishListing = await prisma.fish_listings.findUnique({
        where: { id: fishId }
      });

      const notes = fishListing.name
  
      if (!fishListing) {
        return res.status(404).json({
          success: false,
          message: 'Fish listing not found'
        });
      }
  
      // Find user's wishlist or create a new one
      let wishlist = await prisma.wishlists.findFirst({
        where: {
          user_id: userId
        }
      });
  
      if (!wishlist) {
        wishlist = await prisma.wishlists.create({
          data: {
            user_id: userId,
            name: "My Wishlist"
          }
        });
      }
  
      // Check if item already exists in wishlist
      const existingWishlistItem = await prisma.wishlist_items.findFirst({
        where: {
          wishlist_id: wishlist.id,
          fish_listing_id: fishId
        }
      });
  
      if (existingWishlistItem) {
        return res.status(400).json({
          success: false,
          message: 'Item already exists in wishlist'
        });
      }
  
      // Create new wishlist item
      const wishlistItem = await prisma.wishlist_items.create({
        data: {
          wishlist_id: wishlist.id,
          fish_listing_id: fishId,
          notes: notes || null
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
        message: 'Item added to wishlist successfully',
        data: wishlistItem
      });
  
    } catch (error) {
      console.error('Error adding fish to wishlist:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while adding the item to wishlist',
        error: error.message
      });
    }
  };
  
  // Function to delete a fish from wishlist
  export const deleteFromWishlist = async (req, res) => {
    try {
      // Extract fishId from request parameters
      const fishId = req.params.id;
      const userId = req.userId;
  
      // Validate required fields
      if (!userId || !fishId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId or fishId'
        });
      }
  
      // Find user's wishlist
      const wishlist = await prisma.wishlists.findFirst({
        where: {
          user_id: userId
        }
      });
  
      if (!wishlist) {
        return res.status(404).json({
          success: false,
          message: 'Wishlist not found'
        });
      }
  
      // Find the wishlist item
      const wishlistItem = await prisma.wishlist_items.findFirst({
        where: {
          wishlist_id: wishlist.id,
          fish_listing_id: fishId
        }
      });
  
      if (!wishlistItem) {
        return res.status(404).json({
          success: false,
          message: 'Item not found in wishlist'
        });
      }
  
      // Delete the wishlist item
      await prisma.wishlist_items.delete({
        where: {
          id: wishlistItem.id
        }
      });
  
      return res.status(200).json({
        success: true,
        message: 'Item removed from wishlist successfully'
      });
  
    } catch (error) {
      console.error('Error deleting fish from wishlist:', error);
      return res.status(500).json({
        success: false,
        message: 'An error occurred while removing the item from wishlist',
        error: error.message
      });
    }
  };