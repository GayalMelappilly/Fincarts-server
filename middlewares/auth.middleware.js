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

// Checkout authenticate
export const checkoutAuthenticate = (req, res, next) => {
  console.log("Checkout Authenticate");

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    // If no token provided, treat as guest user
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("No token provided - treating as guest user");
      req.userId = null; // Set to null for guest users
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    
    // If token is empty, treat as guest user
    if (!token) {
      console.log("Empty token - treating as guest user");
      req.userId = null;
      return next();
    }
    
    // Try to verify token
    try {
      const decoded = verifyAccessToken(token);
      console.log("Token verified successfully");
      
      // Add user ID to request for authenticated user
      req.userId = decoded.userId;
      
      next();
    } catch (tokenError) {
      console.log("Token verification failed - treating as guest user");
      // If token is invalid, treat as guest user instead of throwing error
      req.userId = null;
      next();
    }
    
  } catch (error) {
    console.log("Error in checkout authentication:", error);
    // On any error, treat as guest user
    req.userId = null;
    next();
  }
};