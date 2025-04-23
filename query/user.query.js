// Insert user data 
export const userInsertQuery = `
    INSERT INTO users (
    email, 
    password_hash, 
    full_name, 
    phone_number,
    user_type,
    email_verified,
    phone_verified,
    profile_picture_url
  ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  RETURNING *;
`

// Insert address details
export const addressInsertQuery = `
    INSERT INTO user_addresses (
      user_id,
      address_line1,
      address_line2,
      city,
      state,
      postal_code,
      country,
      is_default
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
`

// Insert refresh token
export const refreshTokenInsertQuery = `
    INSERT INTO refresh_tokens (
      user_id,
      token,
      expires_at
    ) VALUES ($1, $2, $3)
     RETURNING *;
`

// Find refresh token
export const findRefreshTokenQuery = `
    SELECT * FROM refresh_tokens
    WHERE token = $1;
`

// Delete refresh token
export const deleteRefreshToken = `
    DELETE FROM refresh_tokens
    WHERE token = $1
`