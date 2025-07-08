import express from 'express'
import { authenticate } from '../middlewares/auth.middleware.js'
import { placeOrder } from '../controllers/order.controller.js'

const orderRouter = express.Router()

orderRouter.post('/order/place-order', authenticate, placeOrder)

export default orderRouter