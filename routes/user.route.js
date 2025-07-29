import express from 'express'
import { signUpUser, createProfile, refresh, getCurrentUser, getFishList, getSellerProfile, logoutUser, loginUser, verifyEmail, confirmVerificationCode, ForgotPasswordVerifyEmail, ChangePassword, getFeaturedCategories } from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const userRouter = express.Router()

userRouter.post('/sign-up', signUpUser)
userRouter.post('/verify-email', verifyEmail)
userRouter.post('/confirm-verification-code', confirmVerificationCode)
userRouter.post('/create-profile', createProfile)
userRouter.post('/refresh', refresh)
userRouter.get('/get-current-user', authenticate, getCurrentUser)
userRouter.delete('/logout', authenticate, logoutUser)
userRouter.post('/login', loginUser)

userRouter.get('/fish-list', getFishList);
userRouter.get('/get-featured-categories', getFeaturedCategories)
userRouter.get('/get-seller/:id', getSellerProfile)

userRouter.post('/forgot-password/verify-email', ForgotPasswordVerifyEmail)
userRouter.post('/change-password', ChangePassword)



export default userRouter