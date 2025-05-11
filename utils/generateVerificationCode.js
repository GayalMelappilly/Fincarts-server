import crypto from 'crypto'

export const generateVerificationToken = () => {
    return crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-character code
};