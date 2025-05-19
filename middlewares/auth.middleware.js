import { verifyAccessToken } from '../services/token.services.js';

export const authenticate = (req, res, next) => {

  console.log("Authenicate")

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Add user ID to request
    req.userId = decoded.userId;
    
    next();
  } catch (error) {
    console.log("Error on refresh token")
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};