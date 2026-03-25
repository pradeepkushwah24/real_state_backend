const bcrypt = require('bcryptjs');
const { promisePool } = require('../config/database');
const { generateToken } = require('../utils/generateToken');

// Register
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    
    const [existing] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await promisePool.query(
      'INSERT INTO users (name, email, password, phone, is_verified) VALUES (?, ?, ?, ?, ?)',
      [name, email, hashedPassword, phone, true]
    );
    
    const user = { id: result.insertId, name, email, phone, role: 'user' };
    const token = generateToken(user);
    
    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await promisePool.query('SELECT * FROM users WHERE email = ?', [email]);
    
    if (users.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get Profile
const getProfile = async (req, res) => {
  try {
    const [users] = await promisePool.query(
      'SELECT id, name, email, phone, role FROM users WHERE id = ?',
      [req.user.id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user: users[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { register, login, getProfile };