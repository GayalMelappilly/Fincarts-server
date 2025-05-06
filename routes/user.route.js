import express from 'express'
import { signUpUser, createProfile, refresh, getCurrentUser, getFishList, getSellerProfile, logoutUser } from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const userRouter = express.Router()

userRouter.post('/sign-up', signUpUser)
userRouter.post('/create-profile', createProfile)
userRouter.post('/refresh', refresh)
userRouter.get('/get-current-user', authenticate, getCurrentUser)
userRouter.get('/logout', logoutUser)

userRouter.get('/fish-list', getFishList);
userRouter.get('/get-seller/:id', getSellerProfile)

export default userRouter