import express from 'express'
import { signUpUser } from '../controllers/user.controller.js'

const userRouter = express.Router()

userRouter.post('/sign-up', signUpUser)

export default userRouter