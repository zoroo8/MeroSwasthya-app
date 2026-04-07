import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import { createSlot } from '../controllers/slotController.js';

const router = express.Router();

router.post('/', authMiddleware, roleMiddleware('doctor'), createSlot);

export default router;
