// token-refresh-service.js
import { google } from 'googleapis';
import { configDotenv } from 'dotenv';
import cron from 'node-cron';

configDotenv();

class TokenRefreshService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });
  }

  // Refresh token and get new access token
  async refreshToken() {
    try {
      console.log('🔄 Refreshing OAuth token...');
      
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      console.log('✅ Token refreshed successfully');
      console.log('📅 New expiry:', new Date(credentials.expiry_date));
      
      // Update credentials
      this.oauth2Client.setCredentials(credentials);
      
      // Store new access token if needed (optional)
      // You might want to cache this in Redis or database
      
      return credentials;
    } catch (error) {
      console.error('❌ Token refresh failed:', error.message);
      
      if (error.message.includes('invalid_grant')) {
        console.error('🚨 CRITICAL: Refresh token has expired!');
        console.error('🔧 Action required: Generate new refresh token');
        
        // Optionally, trigger alert/notification system
        await this.handleExpiredRefreshToken();
      }
      
      throw error;
    }
  }

  // Handle expired refresh token
  async handleExpiredRefreshToken() {
    // Implement your logic here:
    // 1. Send alert to admin
    // 2. Disable email features temporarily
    // 3. Log critical error
    // 4. Update application status
    
    console.error('🚨 ALERT: Manual intervention required for OAuth refresh token');
  }

  // Start automatic refresh schedule
  startAutoRefresh() {
    // Refresh every 5 days (tokens expire in 7 days for testing apps)
    // For production apps, you can make this monthly or bi-monthly
    const schedule = '0 0 */5 * *'; // Every 5 days at midnight
    
    // console.log('🕐 Starting automatic token refresh service...');
    // console.log('📅 Schedule: Every 5 days at midnight');
    
    cron.schedule(schedule, async () => {
      try {
        await this.refreshToken();
        console.log('✅ Scheduled token refresh completed');
      } catch (error) {
        console.error('❌ Scheduled token refresh failed:', error.message);
      }
    });
  }

  // Get current valid access token
  async getValidAccessToken() {
    try {
      // Check if current token is still valid
      const currentToken = this.oauth2Client.credentials.access_token;
      const expiry = this.oauth2Client.credentials.expiry_date;
      
      // If token expires in less than 5 minutes, refresh it
      if (!currentToken || !expiry || expiry < Date.now() + 5 * 60 * 1000) {
        console.log('🔄 Access token expired or expiring soon, refreshing...');
        const credentials = await this.refreshToken();
        return credentials.access_token;
      }
      
      return currentToken;
    } catch (error) {
      console.error('❌ Failed to get valid access token:', error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const tokenService = new TokenRefreshService();

// Auto-start the refresh service
tokenService.startAutoRefresh();

// Usage example in your email service:
export const getTokenService = () => tokenService;