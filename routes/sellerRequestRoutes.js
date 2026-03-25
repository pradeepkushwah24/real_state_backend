const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');

// Submit seller property
router.post('/', async (req, res) => {
  try {
    const { name, propertyType, size, price, location, description, photos, videos } = req.body;
    
    if (!name || !propertyType || !size || !price || !location) {
      return res.status(400).json({ success: false, message: 'Required fields missing' });
    }
    
    await promisePool.query(
      `INSERT INTO seller_requests (name, property_type, size, price, location, description, photos, videos) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, propertyType, size, price, location, description, 
       JSON.stringify(photos || []), JSON.stringify(videos || [])]
    );
    
    res.status(201).json({ success: true, message: 'Property submitted for approval' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all seller requests (admin)
router.get('/', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM seller_requests ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending seller requests
router.get('/pending', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      "SELECT * FROM seller_requests WHERE status = 'pending' ORDER BY created_at DESC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve seller request
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    
    await promisePool.query(
      'UPDATE seller_requests SET status = ? WHERE id = ?',
      ['approved', id]
    );
    
    res.json({ success: true, message: 'Seller request approved' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject seller request
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    
    await promisePool.query(
      'UPDATE seller_requests SET status = ? WHERE id = ?',
      ['rejected', id]
    );
    
    res.json({ success: true, message: 'Seller request rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;