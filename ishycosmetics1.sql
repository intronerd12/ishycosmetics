CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20),
    address TEXT,
    role ENUM('customer', 'admin') DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    discount_price DECIMAL(10,2),
    category_id INT,
    brand VARCHAR(100),
    stock_quantity INT DEFAULT 0,
    sku VARCHAR(100) UNIQUE,
    images JSON,
    status ENUM('active', 'inactive', 'out_of_stock') DEFAULT 'active',
    featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    payment_status ENUM('pending', 'paid', 'failed', 'refunded') DEFAULT 'pending',
    payment_method VARCHAR(50),
    shipping_address TEXT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert sample categories
INSERT INTO categories (name, description, status) VALUES 
('Face', 'Face makeup products including foundations, powders, and highlighters', 'active'),
('Eyes', 'Eye makeup products including eyeliners, mascaras, and eyeshadows', 'active'),
('Lips', 'Lip makeup products including lipsticks, glosses, and balms', 'active'),
('Skincare', 'Skincare and fragrance products for daily care', 'active');

-- Insert sample products (with correct category associations)
INSERT INTO products (name, description, price, discount_price, category_id, brand, stock_quantity, sku, images, status, featured) VALUES 
-- Skincare/Fragrance products (category_id = 4)
('Scent of Possibility', 'A luxurious fragrance that embodies endless possibilities and dreams', 1499.00, NULL, 4, 'ISHY', 50, 'ISHY-492', '[]', 'active', 1),
('Scent of Intensity', 'Bold and captivating fragrance for those who dare to stand out', 1499.00, NULL, 4, 'ISHY', 45, 'ISHY-030', '[]', 'active', 1),
('Scent of Familiarity', 'Comforting and warm fragrance that feels like home', 1499.00, NULL, 4, 'ISHY', 40, 'ISHY-551', '[]', 'active', 1),
('Moisturizing Cleanser', 'Gentle cleanser for all skin types', 580.00, 520.00, 4, 'ISHY', 40, 'ISHY-SKN-001', '[]', 'active', 0),

-- Face products (category_id = 1)
('Radiant Foundation', 'Full coverage liquid foundation for a flawless finish', 899.00, 799.00, 1, 'ISHY', 35, 'ISHY-FND-001', '[]', 'active', 1),
('Perfect Setting Powder', 'Lightweight setting powder for all-day wear', 750.00, 650.00, 1, 'ISHY', 30, 'ISHY-PWD-001', '[]', 'active', 1),
('Glow Highlighter', 'Shimmering highlighter for a natural glow', 850.00, NULL, 1, 'ISHY', 25, 'ISHY-HGL-001', '[]', 'active', 0),

-- Eye products (category_id = 2)
('Dramatic Eyeliner', 'Waterproof liquid eyeliner for precise application', 450.00, NULL, 2, 'ISHY', 55, 'ISHY-EYE-001', '[]', 'active', 0),

-- Lip products (category_id = 3)
('Velvet Matte Lipstick', 'Long-lasting matte lipstick with intense color payoff', 650.00, NULL, 3, 'ISHY', 60, 'ISHY-LIP-001', '[]', 'active', 1);

-- Optional: Insert sample users
INSERT INTO users (username, email, password, first_name, last_name, phone, address, role) VALUES 
('admin', 'admin@ishy.com', '$2b$10$example_hashed_password', 'Admin', 'User', '+1234567890', '123 Admin Street, City, Country', 'admin'),
('john_doe', 'john@example.com', '$2b$10$example_hashed_password', 'John', 'Doe', '+1234567891', '456 Customer Ave, City, Country', 'customer'),
('jane_smith', 'jane@example.com', '$2b$10$example_hashed_password', 'Jane', 'Smith', '+1234567892', '789 Buyer Blvd, City, Country', 'customer');

-- Optional: Insert sample orders
INSERT INTO orders (user_id, order_number, total_amount, status, payment_status, payment_method, shipping_address, notes) VALUES 
(2, 'ORD-2025-001', 2149.00, 'delivered', 'paid', 'credit_card', '456 Customer Ave, City, Country', 'First order - welcome discount applied'),
(3, 'ORD-2025-002', 1499.00, 'shipped', 'paid', 'paypal', '789 Buyer Blvd, City, Country', 'Gift wrapping requested');

-- Optional: Insert sample order items
INSERT INTO order_items (order_id, product_id, quantity, price, total) VALUES 
-- Order 1 items
(1, 1, 1, 1499.00, 1499.00), -- Scent of Possibility
(1, 9, 1, 650.00, 650.00),   -- Velvet Matte Lipstick
-- Order 2 items  
(2, 2, 1, 1499.00, 1499.00); -- Scent of Intensity