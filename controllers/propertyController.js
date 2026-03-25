const { promisePool } = require('../config/database');

const generatePropertyId = () => {
  const prefix = '4PGR';
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `${prefix}${randomNum}`;
};

// Get all properties
const getAllProperties = async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM properties WHERE status = ? ORDER BY created_at DESC',
      ['active']
    );
    res.json({ success: true, count: rows.length, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single property
const getPropertyById = async (req, res) => {
  try {
    const [rows] = await promisePool.query('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Property not found' });
    }
    
    await promisePool.query('UPDATE properties SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create property
const createProperty = async (req, res) => {
  try {
    const propertyId = generatePropertyId();
    const { title, price, location, size, type, purpose, bedrooms, bathrooms, description, images } = req.body;
    
    await promisePool.query(
      `INSERT INTO properties (id, title, price, location, size, type, purpose, bedrooms, bathrooms, description, images, status, agent_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [propertyId, title, price, location, size, type, purpose, bedrooms, bathrooms, description, JSON.stringify(images || []), 'active', req.user.id]
    );
    
    res.status(201).json({ success: true, message: 'Property created', data: { id: propertyId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllProperties, getPropertyById, createProperty };