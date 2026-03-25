const { promisePool } = require('../config/database');

// Submit inquiry
const submitInquiry = async (req, res) => {
  try {
    const { name, email, phone, message, property_id } = req.body;
    
    if (!name || !email || !phone) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    let agent_id = null;
    if (property_id) {
      const [property] = await promisePool.query('SELECT agent_id FROM properties WHERE id = ?', [property_id]);
      if (property.length > 0) agent_id = property[0].agent_id;
    }
    
    await promisePool.query(
      'INSERT INTO inquiries (name, email, phone, message, property_id, agent_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, phone, message, property_id, agent_id]
    );
    
    res.status(201).json({ success: true, message: 'Inquiry submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get inquiries for agent
const getAgentInquiries = async (req, res) => {
  try {
    const [rows] = await promisePool.query(
      'SELECT * FROM inquiries WHERE agent_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { submitInquiry, getAgentInquiries };