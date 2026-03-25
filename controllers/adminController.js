const { promisePool } = require('../config/database');
const jwt = require('jsonwebtoken');

// Admin Login with Last Login Tracking
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || req.connection.remoteAddress;
    
    console.log('Login attempt:', username);
    console.log('IP Address:', clientIp);
    
    // Check in users table
    const [users] = await promisePool.query(
      'SELECT * FROM users WHERE email = ?',
      [username]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    
    // Check password
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Update last login
    await promisePool.query(
      'UPDATE users SET last_login = NOW(), last_login_ip = ? WHERE id = ?',
      [clientIp, user.id]
    );
    
    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'mysecretkey',
      { expiresIn: '7d' }
    );
    
    // Get updated user with last login
    const [updatedUser] = await promisePool.query(
      'SELECT id, name, email, role, created_at, last_login, last_login_ip FROM users WHERE id = ?',
      [user.id]
    );
    
    console.log('✅ Login successful for:', user.email);
    
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
};

// Dashboard Stats
const getDashboardStats = async (req, res) => {
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
};

// Get Admin Profile with Last Login
const getAdminProfile = async (req, res) => {
  try {
    const adminId = req.user.id;
    
    const [users] = await promisePool.query(
      'SELECT id, name, email, role, created_at, last_login, last_login_ip FROM users WHERE id = ?',
      [adminId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    
    res.json({
      success: true,
      data: users[0]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { login, getDashboardStats, getAdminProfile };