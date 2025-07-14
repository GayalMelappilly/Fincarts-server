import express from 'express'
import { getFishCategoriesWithCount } from '../../controllers/admin/admin.controller.js'

const adminRouter = express.Router()

adminRouter.get('/get-categories', getFishCategoriesWithCount)

export default adminRouter