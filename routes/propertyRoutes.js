const express = require('express');
const router = express.Router();
const { getAllProperties, getPropertyById, createProperty } = require('../controllers/propertyController');
const { auth, isAgent } = require('../middleware/auth');

router.get('/', getAllProperties);
router.get('/:id', getPropertyById);
router.post('/', auth, isAgent, createProperty);

module.exports = router;