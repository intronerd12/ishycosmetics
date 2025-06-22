// backend/index.js
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ishycosmetics'
});

// Test database connection
db.connect((err) => {
    if (err) {
        console.error('❌ Database connection failed:', err.message);
        process.exit(1);
    }
    console.log('✅ Connected to MySQL database: ishycosmetics');
});

// File upload configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/products/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'product-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// JWT middleware for authentication
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'ishycosmetics_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Admin middleware
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// ==================== AUTH ROUTES ====================

// Register user
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, phone, address } = req.body;

        // Check if user exists
        const checkUserQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
        db.query(checkUserQuery, [email, username], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (results.length > 0) {
                return res.status(400).json({ error: 'User already exists' });
            }

            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Insert user
            const insertQuery = `
                INSERT INTO users (username, email, password, first_name, last_name, phone, address) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.query(insertQuery, [username, email, hashedPassword, firstName, lastName, phone || null, address || null], 
            (err, result) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create user' });
                }

                const token = jwt.sign(
                    { id: result.insertId, username, email, role: 'customer' },
                    process.env.JWT_SECRET || 'ishycosmetics_secret',
                    { expiresIn: '24h' }
                );

                res.status(201).json({
                    message: 'User registered successfully',
                    token,
                    user: {
                        id: result.insertId,
                        username,
                        email,
                        firstName,
                        lastName,
                        role: 'customer'
                    }
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login user
app.post('/api/auth/login', (req, res) => {
    try {
        const { email, password } = req.body;

        const query = 'SELECT * FROM users WHERE email = ?';
        db.query(query, [email], async (err, results) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const user = results[0];
            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const token = jwt.sign(
                { id: user.id, username: user.username, email: user.email, role: user.role },
                process.env.JWT_SECRET || 'ishycosmetics_secret',
                { expiresIn: '24h' }
            );

            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    firstName: user.first_name,
                    lastName: user.last_name,
                    role: user.role
                }
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== PRODUCT ROUTES ====================

// Get all products
app.get('/api/products', (req, res) => {
    const { category, featured, limit, search } = req.query;
    
    let query = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.status = 'active'
    `;
    const params = [];

    if (category) {
        query += ' AND p.category_id = ?';
        params.push(category);
    }

    if (featured === 'true') {
        query += ' AND p.featured = true';
    }

    if (search) {
        query += ' AND (p.name LIKE ? OR p.description LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY p.created_at DESC';

    if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
    }

    db.query(query, params, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Parse images JSON for each product
        const products = results.map(product => ({
            ...product,
            images: product.images ? JSON.parse(product.images) : []
        }));

        res.json(products);
    });
});

// Get single product
app.get('/api/products/:id', (req, res) => {
    const query = `
        SELECT p.*, c.name as category_name 
        FROM products p 
        LEFT JOIN categories c ON p.category_id = c.id 
        WHERE p.id = ? AND p.status = 'active'
    `;

    db.query(query, [req.params.id], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (results.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const product = {
            ...results[0],
            images: results[0].images ? JSON.parse(results[0].images) : []
        };

        res.json(product);
    });
});

// Add product (Admin only)
app.post('/api/products', authenticateToken, requireAdmin, upload.array('images', 5), (req, res) => {
    try {
        const { name, description, price, discountPrice, categoryId, brand, stockQuantity, sku, featured } = req.body;
        
        const images = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : [];

        const query = `
            INSERT INTO products (name, description, price, discount_price, category_id, brand, stock_quantity, sku, images, featured) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(query, [
            name, 
            description, 
            price, 
            discountPrice || null, 
            categoryId || null, 
            brand || null, 
            stockQuantity || 0, 
            sku || null, 
            JSON.stringify(images), 
            featured === 'true'
        ], (err, result) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to add product' });
            }

            res.status(201).json({
                message: 'Product added successfully',
                productId: result.insertId
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== CATEGORY ROUTES ====================

// Get all categories
app.get('/api/categories', (req, res) => {
    const query = 'SELECT * FROM categories WHERE status = "active" ORDER BY name';
    
    db.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Add category (Admin only)
app.post('/api/categories', authenticateToken, requireAdmin, (req, res) => {
    const { name, description } = req.body;
    
    const query = 'INSERT INTO categories (name, description) VALUES (?, ?)';
    
    db.query(query, [name, description || null], (err, result) => {
        if (err) {
            return res.status(500).json({ error: 'Failed to add category' });
        }
        
        res.status(201).json({
            message: 'Category added successfully',
            categoryId: result.insertId
        });
    });
});

// ==================== ORDER ROUTES ====================

// Create order
app.post('/api/orders', authenticateToken, (req, res) => {
    try {
        const { items, shippingAddress, paymentMethod, notes } = req.body;
        const userId = req.user.id;
        
        // Calculate total
        let totalAmount = 0;
        items.forEach(item => {
            totalAmount += item.price * item.quantity;
        });

        // Generate order number
        const orderNumber = 'ISY' + Date.now();

        // Insert order
        const orderQuery = `
            INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method, notes) 
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(orderQuery, [userId, orderNumber, totalAmount, shippingAddress, paymentMethod, notes || null], 
        (err, orderResult) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to create order' });
            }

            const orderId = orderResult.insertId;

            // Insert order items
            const itemsQuery = 'INSERT INTO order_items (order_id, product_id, quantity, price, total) VALUES ?';
            const itemsData = items.map(item => [
                orderId,
                item.productId,
                item.quantity,
                item.price,
                item.price * item.quantity
            ]);

            db.query(itemsQuery, [itemsData], (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to add order items' });
                }

                res.status(201).json({
                    message: 'Order created successfully',
                    orderNumber,
                    orderId,
                    totalAmount
                });
            });
        });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get user orders
app.get('/api/orders', authenticateToken, (req, res) => {
    const userId = req.user.id;
    
    const query = `
        SELECT o.*, 
               GROUP_CONCAT(CONCAT(p.name, ' x', oi.quantity) SEPARATOR ', ') as items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE o.user_id = ?
        GROUP BY o.id
        ORDER BY o.created_at DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// ==================== TEST ROUTES ====================

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        message: '🎉 IshyCosmetics API is working!', 
        timestamp: new Date().toISOString(),
        database: 'Connected to MySQL'
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'IshyCosmetics Backend' });
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Error:', error);
    res.status(500).json({ error: 'Internal server error' });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
    console.log(`🚀 IshyCosmetics server running on port ${PORT}`);
    console.log(`📱 API URL: http://localhost:${PORT}/api`);
    console.log(`🔗 Test URL: http://localhost:${PORT}/api/test`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down server...');
    db.end();
    process.exit(0);
});