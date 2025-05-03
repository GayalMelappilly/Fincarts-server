import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Seller
export const sellerOnly = async (req, res, next) => {

    console.log("seller only reached")
    console.log(req.userId)

    try {
        // Check if user ID exists in request (set by authenticate middleware)
        if (!req.userId) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is a seller
        const seller = await prisma.sellers.findUnique({
            where: { id: req.userId }
        });

        if (!seller) {
            return res.status(403).json({
                success: false,
                message: 'Seller access required'
            });
        }

        // // Check if seller is active
        // if (seller.status !== 'ACTIVE') {
        //     return res.status(403).json({
        //         success: false,
        //         message: 'Seller account is not active',
        //         status: seller.status
        //     });
        // }

        // If all checks pass, continue to the next middleware/route handler
        next();
    } catch (error) {
        console.error('Error in seller verification middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Admin
export const adminOnly = async (req, res, next) => {
    try {
        // Check if user ID exists in request (set by authenticate middleware)
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is an admin
        const user = await prisma.users.findUnique({
            where: { id: req.user.id }
        });

        if (!user || user.user_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        // If all checks pass, continue to the next middleware/route handler
        next();
    } catch (error) {
        console.error('Error in admin verification middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

// Customer
export const customerOnly = async (req, res, next) => {
    try {
        // Check if user ID exists in request (set by authenticate middleware)
        if (!req.user || !req.user.id) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Check if user is a regular customer
        const user = await prisma.users.findUnique({
            where: { id: req.user.id }
        });

        if (!user || user.user_type !== 'customer') {
            return res.status(403).json({
                success: false,
                message: 'Customer access required'
            });
        }

        // If all checks pass, continue to the next middleware/route handler
        next();
    } catch (error) {
        console.error('Error in customer verification middleware:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};