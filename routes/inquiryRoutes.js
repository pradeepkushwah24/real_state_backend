const express = require('express');
const router = express.Router();
const { submitInquiry, getAgentInquiries } = require('../controllers/inquiryController');
const { auth, isAgent } = require('../middleware/auth');

router.post('/', submitInquiry);
router.get('/agent', auth, isAgent, getAgentInquiries);

module.exports = router;