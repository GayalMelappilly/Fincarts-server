import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'access-token-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret';
const EMAIL_VERIFICATION_SECRET = process.env.EMAIL_VERIFICATION_SECRET || 'email-verification-secret'

export const createAccessToken = (userId) => {
  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn: '15m' // Short-lived token
  });
};

export const createRefreshToken = (userId, verificationCode) => {
  return jwt.sign({ userId, verificationCode }, REFRESH_TOKEN_SECRET, {
    expiresIn: '7d' // Long-lived token
  });
};

export const createEmailVerificationToken = (email, code) => {
  return jwt.sign({ email, code }, EMAIL_VERIFICATION_SECRET, {
    expiresIn: '1h'
  })
}

export const verifyAccessToken = (token) => {
  try {
    const decoded = jwt.verify(token, ACCESS_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid access token');
  }
};

export const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Invalid refresh token');
  }
};

export const verifyEmailVerificationToken = (token) => {
  try {
    const decoded = jwt.verify(token, EMAIL_VERIFICATION_SECRET)
    return decoded
  } catch (error) {
    throw new Error('Invlid email verification token');
  } 
}