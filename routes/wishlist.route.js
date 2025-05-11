import express from 'express'
import { addToWishlist, deleteFromWishlist } from '../controllers/wishlist.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const wishlistRouter = express.Router()

wishlistRouter.post('/wishlist/add-item', authenticate, addToWishlist)
wishlistRouter.delete('/wishlist/remove-item/:id', authenticate, deleteFromWishlist)

export default wishlistRouter