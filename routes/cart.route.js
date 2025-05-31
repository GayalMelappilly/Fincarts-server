import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { addToCart, addToCartGuest, deleteCartItem, editCartItem } from '../controllers/cart.controller.js'

const cartRouter = express.Router()

cartRouter.get('/cart/get-items', authenticate)
cartRouter.post('/cart/add-item', authenticate, addToCart)
cartRouter.post('/guest/cart/add-item', addToCartGuest)
cartRouter.put('/cart/edit-item', authenticate, editCartItem)
cartRouter.delete('/cart/remove-item/:id', authenticate, deleteCartItem)

export default cartRouter