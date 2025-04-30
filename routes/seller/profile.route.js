import express from 'express'
import { sellerCreateProfile, getCurrentSeller } from '../../controllers/seller/profile.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'

const sellerProfileRouter = express.Router()

sellerProfileRouter.post('/create-profile', sellerCreateProfile)
sellerProfileRouter.get('/get-current-seller', authenticate, getCurrentSeller)

export default sellerProfileRouter