const express = require('express');
const router = express.Router();
const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

// ============================================
// AUTH MIDDLEWARE
// ============================================
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token' });
    }
    const decoded = jwt.verify(token, 'mysecretkey');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
};

// ============================================
// ADMIN LOGIN
// ============================================
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    
    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE email = ? AND role = "admin"',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    await promisePool.query(
      'UPDATE users SET last_login = NOW(), last_login_ip = ? WHERE id = ?',
      [clientIp, user.id]
    );
    
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      'mysecretkey',
      { expiresIn: '7d' }
    );
    
    const [updatedUser] = await promisePool.query(
      'SELECT id, name, email, role, created_at, last_login, last_login_ip FROM users WHERE id = ?',
      [user.id]
    );
    
    res.json({
      success: true,
      token,
      admin: {
        id: updatedUser[0].id,
        username: updatedUser[0].email,
        name: updatedUser[0].name,
        role: updatedUser[0].role,
        last_login: updatedUser[0].last_login,
        last_login_ip: updatedUser[0].last_login_ip,
        created_at: updatedUser[0].created_at
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PUBLIC ROUTES
// ============================================

// Get all properties
router.get('/properties', async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM properties WHERE status = "active" ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get single property
router.get('/properties/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await promisePool.query('SELECT * FROM properties WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    await promisePool.query('UPDATE properties SET views = views + 1 WHERE id = ?', [id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SELLER SUBMISSION (Public - Sell Property Form)
// ============================================
router.post('/sellers', async (req, res) => {
  try {
    const { 
      name, 
      email,
      phone,
      propertyType,
      size, 
      price, 
      location, 
      description, 
      photos, 
      videos 
    } = req.body;
    
    console.log('📝 New seller submission:', { name, email, phone, propertyType, price, location });
    
    // Validate required fields
    if (!name || !propertyType || !size || !price || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please fill all required fields: Name, Property Type, Size, Price, Location' 
      });
    }
    
    // Handle optional fields
    const sellerEmail = email || null;
    const sellerPhone = phone || null;
    const sellerDescription = description || null;
    
    // Insert into sellers table
    const [result] = await promisePool.query(
      `INSERT INTO sellers (name, email, phone, property_type, size, price, location, description, photos, videos, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, sellerEmail, sellerPhone, propertyType, size, price, location, sellerDescription, 
       JSON.stringify(photos || []), JSON.stringify(videos || []), 'pending']
    );
    
    console.log(`✅ Seller request submitted: ${name} (ID: ${result.insertId})`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Property submitted for approval successfully!',
      data: { id: result.insertId }
    });
    
  } catch (error) {
    console.error('Error submitting seller:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN DASHBOARD
// ============================================
router.get('/dashboard', auth, isAdmin, async (req, res) => {
  try {
    const [properties] = await promisePool.query('SELECT COUNT(*) as count FROM properties');
    const [buyers] = await promisePool.query('SELECT COUNT(*) as count FROM buyers');
    const [sellers] = await promisePool.query("SELECT COUNT(*) as count FROM sellers WHERE status = 'pending'");
    
    res.json({
      success: true,
      data: {
        totalProperties: properties[0]?.count || 0,
        totalBuyers: buyers[0]?.count || 0,
        pendingSellers: sellers[0]?.count || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// ADMIN PROFILE
// ============================================
router.get('/profile', auth, isAdmin, async (req, res) => {
  try {
    const [users] = await promisePool.query(
      'SELECT id, name, email, role, created_at, last_login, last_login_ip FROM users WHERE id = ?',
      [req.user.id]
    );
    res.json({ success: true, data: users[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Password
router.put('/update-password', auth, isAdmin, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const adminId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    const [users] = await promisePool.query('SELECT * FROM users WHERE id = ?', [adminId]);
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const user = users[0];
    if (user.password !== currentPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    await promisePool.query('UPDATE users SET password = ? WHERE id = ?', [newPassword, adminId]);
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// BUYERS MANAGEMENT (Admin)
// ============================================

// Get all buyers
router.get('/buyers', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM buyers ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete buyer
router.delete('/buyers/:id', auth, isAdmin, async (req, res) => {
  try {
    await promisePool.query('DELETE FROM buyers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Buyer deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update buyer status
router.put('/buyers/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await promisePool.query('UPDATE buyers SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Buyer status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// SELLERS MANAGEMENT (Admin)
// ============================================

// Get all sellers
router.get('/sellers', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM sellers ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get pending sellers
router.get('/sellers/pending', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query("SELECT * FROM sellers WHERE status = 'pending' ORDER BY created_at DESC");
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Approve seller
router.put('/sellers/:id/approve', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await promisePool.query('UPDATE sellers SET status = ? WHERE id = ?', ['approved', id]);
    res.json({ success: true, message: 'Seller approved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Reject seller
router.put('/sellers/:id/reject', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await promisePool.query('UPDATE sellers SET status = ? WHERE id = ?', ['rejected', id]);
    res.json({ success: true, message: 'Seller rejected' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete seller
router.delete('/sellers/:id', auth, isAdmin, async (req, res) => {
  try {
    await promisePool.query('DELETE FROM sellers WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Seller deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// PROPERTIES MANAGEMENT (Admin)
// ============================================

// Get all properties for admin
router.get('/admin-properties', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM properties ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new property
router.post('/admin-properties', auth, isAdmin, async (req, res) => {
  try {
    const { 
      id, title, price, location, size, type, purpose, 
      bedrooms, bathrooms, description, images, status 
    } = req.body;
    
    console.log('📝 Adding new property:', { id, title, price, location });
    
    if (!title || !price || !location || !size || !type) {
      return res.status(400).json({ 
        success: false, 
        message: 'Required fields missing: title, price, location, size, type' 
      });
    }
    
    let propertyId = id;
    if (!propertyId) {
      const prefix = '4PGR';
      const randomNum = Math.floor(10000 + Math.random() * 90000);
      propertyId = `${prefix}${randomNum}`;
    }
    
    const [existing] = await promisePool.query('SELECT id FROM properties WHERE id = ?', [propertyId]);
    if (existing.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Property ID already exists. Please use a different ID.' 
      });
    }
    
    await promisePool.query(
      `INSERT INTO properties 
       (id, title, price, location, size, type, purpose, bedrooms, bathrooms, description, images, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, title, price, location, size, type, purpose, bedrooms || 0, bathrooms || 0, description || '', 
       JSON.stringify(images || []), status || 'active']
    );
    
    console.log(`✅ New property added: ${title} (${propertyId})`);
    
    res.status(201).json({ 
      success: true, 
      message: 'Property added successfully!',
      data: { id: propertyId }
    });
    
  } catch (error) {
    console.error('Error adding property:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete property
router.delete('/admin-properties/:id', auth, isAdmin, async (req, res) => {
  try {
    await promisePool.query('DELETE FROM properties WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Property deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update property status
router.put('/admin-properties/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await promisePool.query('UPDATE properties SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Property status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// INQUIRIES MANAGEMENT (Admin)
// ============================================

// Get all inquiries
router.get('/inquiries', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM inquiries ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update inquiry status
router.put('/inquiries/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await promisePool.query('UPDATE inquiries SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true, message: 'Inquiry status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete inquiry
router.delete('/inquiries/:id', auth, isAdmin, async (req, res) => {
  try {
    await promisePool.query('DELETE FROM inquiries WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Inquiry deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ============================================
// AGENTS MANAGEMENT (Admin)
// ============================================

// Get all agents
router.get('/agents', auth, isAdmin, async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT id, name, email, phone, experience, specialization, rating, is_active FROM agents ORDER BY rating DESC');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Add new agent
router.post('/agents', auth, isAdmin, async (req, res) => {
  try {
    const { name, email, password, phone, experience, specialization } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password required' });
    }
    
    await promisePool.query(
      `INSERT INTO agents (name, email, password, phone, experience, specialization) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, password, phone, experience || 0, specialization || null]
    );
    
    res.status(201).json({ success: true, message: 'Agent added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update agent status
router.put('/agents/:id/status', auth, isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    await promisePool.query('UPDATE agents SET is_active = ? WHERE id = ?', [is_active, id]);
    res.json({ success: true, message: 'Agent status updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete agent
router.delete('/agents/:id', auth, isAdmin, async (req, res) => {
  try {
    await promisePool.query('DELETE FROM agents WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;