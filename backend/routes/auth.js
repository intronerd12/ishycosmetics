// backend/routes/auth.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In a real application, this would come from your database connection
// For now, we'll assume db is passed or required
let db;

// Initialize database connection (you'll need to pass this from your main server)
const initDB = (database) => {
    db = database;
};

// Register user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, firstName, lastName, phone, address } = req.body;

        // Validation
        if (!username || !email || !password || !firstName || !lastName) {
            return res.status(400).json({ 
                error: 'Username, email, password, first name, and last name are required' 
            });
        }

        // Check if user exists
        const checkUserQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
        db.query(checkUserQuery, [email, username], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
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
                    console.error('Insert error:', err);
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
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Login user
router.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const query = 'SELECT * FROM users WHERE email = ?';
        db.query(query, [email], async (err, results) => {
            if (err) {
                console.error('Database error:', err);
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
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Verify token
router.get('/verify', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'ishycosmetics_secret', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        res.json({ user });
    });
});

module.exports = { router, initDB };