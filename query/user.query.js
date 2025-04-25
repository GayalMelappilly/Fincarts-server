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

// Find current user
export const findCurrentUserQuery = `
  SELECT
    users.id AS user_id,
    users.email,
    users.full_name,
    users.phone_number,
    users.user_type,
    users.created_at AS user_created_at,
    users.updated_at AS user_updated_at,
    users.email_verified,
    users.phone_verified,
    users.points_balance,
    users.profile_picture_url,

    user_addresses.id AS address_id,
    user_addresses.address_line1,
    user_addresses.address_line2,
    user_addresses.city,
    user_addresses.state,
    user_addresses.postal_code,
    user_addresses.country,
    user_addresses.is_default,
    user_addresses.latitude,
    user_addresses.longitude,
    user_addresses.created_at AS address_created_at,
    user_addresses.updated_at AS address_updated_at

  FROM users
  INNER JOIN user_addresses ON users.id = user_addresses.user_id
  WHERE users.id = $1;
`;
