-- Migration to add password and password reset fields to users table
ALTER TABLE users 
ADD COLUMN password_hash VARCHAR(255),
ADD COLUMN password_reset_token VARCHAR(255),
ADD COLUMN password_reset_expires TIMESTAMP,
ADD COLUMN last_login TIMESTAMP;

-- Create indexes for performance
CREATE INDEX idx_users_password_reset_token ON users (password_reset_token);
CREATE INDEX idx_users_password_reset_expires ON users (password_reset_expires);
