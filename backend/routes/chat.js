const express = require('express');
const auth = require('../middleware/authMiddleware');
const role = require('../middleware/roleMiddleware');
const {
  getMyConversations,
  getMessages,
  sendMessage,
} = require('../controllers/chatController');

const router = express.Router();

router.get('/conversations', auth, role('patient', 'doctor'), getMyConversations);
router.get('/messages', auth, role('patient', 'doctor'), getMessages);
router.post('/messages', auth, role('patient', 'doctor'), sendMessage);

module.exports = router;
