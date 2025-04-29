import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { addToCart } from '../controllers/cart.controller.js'

const cartRouter = express.Router()

cartRouter.get('/cart/get-items', authenticate)
cartRouter.post('/cart/add-item/:id', authenticate, addToCart)
cartRouter.delete('/cart/remove-item', authenticate)

export default cartRouter