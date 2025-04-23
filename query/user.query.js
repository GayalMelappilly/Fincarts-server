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