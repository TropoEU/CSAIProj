-- Migration: Create admins table for dashboard authentication
-- UP

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    role VARCHAR(50) DEFAULT 'admin',
    status VARCHAR(50) DEFAULT 'active',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on username for fast authentication lookups
CREATE INDEX idx_admins_username ON admins(username);

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt, rounds=10
INSERT INTO admins (username, password_hash, email, role) VALUES (
    'admin',
    '$2b$10$rQZ7.yVnHJ9NJQH9YhVKyOPbP.3OYHLrRPv.Ub0JLHFuV7pL.u6Ey',
    'admin@csai.local',
    'super_admin'
) ON CONFLICT (username) DO NOTHING;

-- DOWN
-- DROP INDEX idx_admins_username;
-- DELETE FROM admins WHERE username = 'admin';
-- DROP TABLE admins;
