import express from 'express'
import { sellerCreateProfile, getCurrentSeller, loginSeller, logoutSeller, verifyEmail, confirmVerificationCode } from '../../controllers/seller/profile.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'

const sellerProfileRouter = express.Router()

sellerProfileRouter.post('/create-profile', sellerCreateProfile)
sellerProfileRouter.get('/get-current-seller', authenticate, getCurrentSeller)
sellerProfileRouter.post('/verify-email', verifyEmail)
sellerProfileRouter.post('/confirm-verification-code',confirmVerificationCode)
sellerProfileRouter.post('/login', loginSeller)
sellerProfileRouter.get('/logout', authenticate, logoutSeller)

export default sellerProfileRouter