import express from 'express'
import { checkoutAuthenticate } from '../middlewares/auth.middleware.js'
import { cartCheckout, createRazorpayOrder, placeOrder } from '../controllers/order.controller.js'

const orderRouter = express.Router()

orderRouter.post('/order/place-order', checkoutAuthenticate, placeOrder)
orderRouter.post('/order/create-razorpay-order', checkoutAuthenticate, createRazorpayOrder)
orderRouter.post('/order/cart-checkout', checkoutAuthenticate, cartCheckout)

export default orderRouter