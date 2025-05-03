import express from 'express';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { sellerOnly } from '../../middlewares/role.middleware.js';
import { addProduct, deleteProduct, editProduct, listProducts, viewProduct } from '../../controllers/seller/product.controller.js';

const sellerProductRouter = express.Router();

sellerProductRouter.post('/product/add-product', authenticate, sellerOnly, addProduct);
sellerProductRouter.put('/product/edit-product/:id', authenticate, sellerOnly, editProduct);
sellerProductRouter.get('/product/view-product/:id', authenticate, sellerOnly, viewProduct);
sellerProductRouter.delete('/product/delete-product/:id', authenticate, sellerOnly, deleteProduct);
sellerProductRouter.get('/products', authenticate, sellerOnly, listProducts);

export default sellerProductRouter;