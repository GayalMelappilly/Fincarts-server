import client from '../config/db.js'
import { addressInsertQuery, deleteRefreshToken, findRefreshTokenQuery, refreshTokenInsertQuery, userInsertQuery } from '../query/user.query.js'
import { createAccessToken, createRefreshToken } from '../services/token.services.js'
import { hashPassword } from '../utils/bcrypt.js'

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
        const userResult = await client.query(userInsertQuery, [
            user.email,
            hashedPassword,
            user.fullName,
            user.phone,
            'customer',
            false,
            true,
            user.profileImage
        ])

        const userId = userResult.rows[0].id

        try {
            const addressResult = await client.query(addressInsertQuery, [
                userId,
                user.address.addressLine1,
                user.address.addressLine2,
                user.address.city,
                user.address.state,
                user.address.pincode,
                user.address.country,
                true
            ])

            const accessToken = createAccessToken(userId)
            const refreshToken = createRefreshToken(userId)

            const refreshTokenResult = await client.query(refreshTokenInsertQuery, [
                userId,
                refreshToken,
                new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            ])

            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000
            })

            res.status(201).send({
                success: true,
                data: {
                    name: user.FullName,
                    email: user.email,
                    phone: user.phone
                }
            })

        } catch (err) {
            console.log('Error inserting user address : ', err)
            res.status(500).json({
                success: false,
                message: 'Error inserting user address'
            })
        }

    } catch (err) {
        console.log('Error inserting user : ', err)
        res.status(500).json({
            success: false,
            message: 'Error inserting user'
        })
        return;
    }
}

// Refresh token
export const refresh = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (!refreshToken) {
            return res.status(401).json({ message: 'Refresh token not found' });
        }

        const storedToken = await client.query(findRefreshTokenQuery, [
            refreshToken
        ])

        if (!storedToken || storedToken.expiresAt < new Date()) {
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
        }

        const accessToken = createAccessToken(storedToken.userId);

        res.status(201).json({
            success: true,
            accessToken
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