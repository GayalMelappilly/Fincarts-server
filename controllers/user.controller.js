import client from '../config/db.js'
import { addressInsertQuery, deleteRefreshToken, findCurrentUserQuery, findRefreshTokenQuery, refreshTokenInsertQuery, userInsertQuery } from '../query/user.query.js'
import { createAccessToken, createRefreshToken } from '../services/token.services.js'
import { hashPassword } from '../utils/bcrypt.js'
import prisma from '../utils/prisma.js'

// Signup user
export const signUpUser = async (req, res) => {
    const user = req.body
    console.log('phone number : ', user)
    res.status(201).json({
        success: true,
        data: user
    })
    return;
}

// Create user profile
export const createProfile = async (req, res) => {
    const user = req.body.formData
    console.log('profile data : ', user)

    const hashedPassword = await hashPassword(user.password)

    try {
        // Using Prisma transaction to ensure all operations succeed or fail together
        const result = await prisma.$transaction(async (prisma) => {
            // Create user
            const createdUser = await prisma.users.create({
                data: {
                    email: user.email,
                    password_hash: hashedPassword,
                    full_name: user.fullName,
                    phone_number: user.phone,
                    user_type: 'customer',
                    email_verified: false,
                    phone_verified: true,
                    profile_picture_url: user.profileImage,
                }
            });

            // Create user address
            const userAddress = await prisma.user_addresses.create({
                data: {
                    user_id: createdUser.id,
                    address_line1: user.address.addressLine1,
                    address_line2: user.address.addressLine2,
                    city: user.address.city,
                    state: user.address.state,
                    postal_code: user.address.pincode,
                    country: user.address.country,
                    is_default: true
                }
            });

            // Create access and refresh tokens
            const accessToken = createAccessToken(createdUser.id);
            const refreshToken = createRefreshToken(createdUser.id);

            // Store refresh token
            const refreshTokenRecord = await prisma.refresh_tokens.create({
                data: {
                    user_id: createdUser.id,
                    token: refreshToken,
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            });

            return {
                user: createdUser,
                address: userAddress,
                accessToken,
                refreshToken
            };
        });

        // Set cookie and send response
        res.cookie('refreshToken', result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.status(201).send({
            success: true,
            data: {
                name: user.fullName,
                email: user.email,
                phone: user.phone,
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });

    } catch (err) {
        console.log('Error creating profile: ', err);
        res.status(500).json({
            success: false,
            message: 'Error creating user profile'
        });
    }
};

// Refresh token
export const refresh = async (req, res) => {
    try {
        const refreshToken = req.body.refreshToken;
        console.log("REFRESH TOKEN : ", refreshToken)

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        const response = await client.query(findRefreshTokenQuery, [
            refreshToken
        ])

        const storedToken = response.rows[0]

        console.log(storedToken)

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const accessToken = createAccessToken(storedToken.user_id);

        res.status(201).json({
            success: true,
            accessToken: accessToken
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
};

// Logout user
export const logout = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken) {
            const result = await client.query(deleteRefreshToken, [
                refreshToken
            ])
        }

        res.clearCookie('refreshToken');
        res.status(201).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            sucess: false,
            message: 'Server error'
        });
    }
};

// Get current user
export const getCurrentUser = async (req, res) => {
    try {

        const userId = req.userId

        console.log("USER ID : ", userId)

        const result = await client.query(findCurrentUserQuery, [
            userId
        ])

        if (!result) {
            return res.status(404).json({ message: 'User not found' });
        }

        const row = result.rows[0]

        const user = {
            id: row.user_id,
            fullName: row.full_name,
            email: row.email,
            phoneNumber: row.phone_number,
            userType: row.user_type,
            emailVerified: row.email_verified,
            phoneVerified: row.phone_verified,
            pointsBalance: row.points_balance,
            profileImage: row.profile_picture_url,
            createdAt: row.user_created_at,
            updatedAt: row.user_updated_at,
            address: {
                id: row.address_id,
                line1: row.address_line1,
                line2: row.address_line2,
                city: row.city,
                state: row.state,
                postalCode: row.postal_code,
                country: row.country,
                isDefault: row.is_default,
                latitude: row.latitude,
                longitude: row.longitude,
                createdAt: row.address_created_at,
                updatedAt: row.address_updated_at,
            }
        };

        res.status(201).json({user});
        return;
    } catch (error) {
        console.log("REACHED")
        console.error('Error fetching user:', error);
        res.status(500).json({ message: 'Server error' })
        return;
    }
}