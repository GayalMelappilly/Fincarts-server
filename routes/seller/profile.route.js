import express from 'express'
import { sellerCreateProfile } from '../../controllers/seller/profile.controller.js'

const sellerProfileRouter = express.Router()

sellerProfileRouter.post('/create-profile', sellerCreateProfile)

export default sellerProfileRouter