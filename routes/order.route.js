import express from 'express'
import { checkoutAuthenticate } from '../middlewares/auth.middleware.js'
import { placeOrder } from '../controllers/order.controller.js'

const orderRouter = express.Router()

orderRouter.post('/order/place-order', checkoutAuthenticate, placeOrder)
// orderRouter.post('/guest/order/place-order', placeOrderGuest)

export default orderRouter