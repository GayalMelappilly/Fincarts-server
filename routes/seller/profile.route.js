import express from 'express'
import { sellerCreateProfile, getCurrentSeller, loginSeller, logoutSeller, verifyEmail, confirmVerificationCode, updateProfile, updatePassword } from '../../controllers/seller/profile.controller.js'
import { authenticate } from '../../middlewares/auth.middleware.js'
import { sellerOnly } from '../../middlewares/role.middleware.js'

const sellerProfileRouter = express.Router()

sellerProfileRouter.post('/create-profile', sellerCreateProfile)
sellerProfileRouter.get('/get-current-seller', authenticate, getCurrentSeller)
sellerProfileRouter.post('/verify-email', verifyEmail)
sellerProfileRouter.post('/confirm-verification-code',confirmVerificationCode)
sellerProfileRouter.post('/login', loginSeller)
sellerProfileRouter.get('/logout', authenticate, logoutSeller)
sellerProfileRouter.put('/update-profile', authenticate, sellerOnly, updateProfile)
sellerProfileRouter.put('/update-password', authenticate, sellerOnly, updatePassword)

export default sellerProfileRouter