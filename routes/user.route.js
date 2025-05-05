import express from 'express'
import { signUpUser, createProfile, refresh, logout, getCurrentUser, getFishList, getSellerProfile } from '../controllers/user.controller.js'
import { authenticate } from '../middlewares/auth.middleware.js'

const userRouter = express.Router()

userRouter.post('/sign-up', signUpUser)
userRouter.post('/create-profile', createProfile)
userRouter.post('/refresh', refresh)
userRouter.get('/get-current-user', authenticate, getCurrentUser)
userRouter.post('/logout', logout)

userRouter.get('/fish-list', getFishList);
userRouter.get('/get-seller/:id', getSellerProfile)

export default userRouter