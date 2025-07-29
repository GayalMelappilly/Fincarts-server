import express from 'express'
import { getFishCategoriesWithCount, setFeaturedCategories } from '../../controllers/admin/admin.controller.js'

const adminRouter = express.Router()

adminRouter.get('/get-categories', getFishCategoriesWithCount)
adminRouter.post('/set-featured', setFeaturedCategories)

export default adminRouter