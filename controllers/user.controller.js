import client from '../config/db.js'
import { addressInsertQuery, userInsertQuery } from '../query/user.query.js'
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

            res.status(201).send({
                success: true,
                data: user
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