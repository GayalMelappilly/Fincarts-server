import express from 'express'
import { getAllCategories, getFeaturedFishes, getFishesByCategory, getFishesByCategoryName, searchFishes } from '../controllers/product.controller.js'

const productRouter = express.Router()

productRouter.get('/product/get-featured-fishes', getFeaturedFishes)
productRouter.get('/product/get-fishes-by-category/:id', getFishesByCategory)
productRouter.get('/product/get-fishes-by-name/:name', getFishesByCategoryName)
productRouter.get('/product/get-all-categories', getAllCategories)
productRouter.get('/product/search-fishes/:name', searchFishes)
// productRouter.post('/product/')

export default productRouter