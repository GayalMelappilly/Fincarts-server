import express from 'express'
import { checkoutAuthenticate } from '../middlewares/auth.middleware.js'
import { cartCheckout, placeOrder } from '../controllers/order.controller.js'

const orderRouter = express.Router()

orderRouter.post('/order/place-order', checkoutAuthenticate, placeOrder)
orderRouter.post('/order/cart-checkout', checkoutAuthenticate, cartCheckout)

export default orderRouter