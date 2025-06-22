// backend/routes/products.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/products/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// GET all products
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.status = 'active'
            ORDER BY p.created_at DESC
        `);
        
        // Parse images JSON for each product
        const products = rows.map(product => ({
            ...product,
            images: product.images ? JSON.parse(product.images) : []
        }));
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

// GET single product by ID
router.get('/:id', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.id = ? AND p.status = 'active'
        `, [req.params.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        
        const product = {
            ...rows[0],
            images: rows[0].images ? JSON.parse(rows[0].images) : []
        };
        
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});

// POST create new product (Admin only)
router.post('/', upload.array('images', 5), async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            discount_price,
            category_id,
            brand,
            stock_quantity,
            sku
        } = req.body;

        // Process uploaded images
        const images = req.files ? req.files.map(file => `/uploads/products/${file.filename}`) : [];

        const [result] = await db.execute(`
            INSERT INTO products (name, description, price, discount_price, category_id, brand, stock_quantity, sku, images, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            name,
            description,
            parseFloat(price),
            discount_price ? parseFloat(discount_price) : null,
            category_id || null,
            brand || null,
            parseInt(stock_quantity) || 0,
            sku,
            JSON.stringify(images)
        ]);

        res.status(201).json({
            message: 'Product created successfully',
            product_id: result.insertId
        });
    } catch (error) {
        console.error('Error creating product:', error);
        res.status(500).json({ error: 'Failed to create product' });
    }
});

// PUT update product
router.put('/:id', upload.array('images', 5), async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            name,
            description,
            price,
            discount_price,
            category_id,
            brand,
            stock_quantity,
            sku,
            status
        } = req.body;

        // Check if product exists
        const [existing] = await db.execute('SELECT * FROM products WHERE id = ?', [productId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Process new images if uploaded
        let images = existing[0].images ? JSON.parse(existing[0].images) : [];
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => `/uploads/products/${file.filename}`);
            images = [...images, ...newImages];
        }

        await db.execute(`
            UPDATE products 
            SET name = ?, description = ?, price = ?, discount_price = ?, 
                category_id = ?, brand = ?, stock_quantity = ?, sku = ?, 
                images = ?, status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            name,
            description,
            parseFloat(price),
            discount_price ? parseFloat(discount_price) : null,
            category_id || null,
            brand || null,
            parseInt(stock_quantity) || 0,
            sku,
            JSON.stringify(images),
            status || 'active',
            productId
        ]);

        res.json({ message: 'Product updated successfully' });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: 'Failed to update product' });
    }
});

// DELETE product (soft delete)
router.delete('/:id', async (req, res) => {
    try {
        const [result] = await db.execute(
            'UPDATE products SET status = "inactive" WHERE id = ?',
            [req.params.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        res.json({ message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// GET featured products
router.get('/featured/list', async (req, res) => {
    try {
        const [rows] = await db.execute(`
            SELECT p.*, c.name as category_name 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id 
            WHERE p.featured = 1 AND p.status = 'active'
            ORDER BY p.created_at DESC
            LIMIT 6
        `);
        
        const products = rows.map(product => ({
            ...product,
            images: product.images ? JSON.parse(product.images) : []
        }));
        
        res.json(products);
    } catch (error) {
        console.error('Error fetching featured products:', error);
        res.status(500).json({ error: 'Failed to fetch featured products' });
    }
});

module.exports = router;