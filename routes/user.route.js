import express from 'express'
import { signUpUser, createProfile } from '../controllers/user.controller.js'

const userRouter = express.Router()

userRouter.post('/sign-up', signUpUser)
userRouter.post('/create-profile', createProfile)

export default userRouter