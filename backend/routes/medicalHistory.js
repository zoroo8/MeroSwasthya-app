import express from 'express';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';
import {
  addMedicalDocument,
  addMedicalNote,
  getMedicalHistoryDocuments,
  getMedicalHistorySummary,
  getMyMedicalHistory,
  getPatientMedicalHistory,
  getPatientMedicalHistoryDocuments,
} from '../controllers/medicalHistoryController.js';

const router = express.Router();

router.get('/me', authMiddleware, roleMiddleware('patient'), getMyMedicalHistory);
router.get('/me/documents', authMiddleware, roleMiddleware('patient'), getMedicalHistoryDocuments);
router.get('/me/summary', authMiddleware, roleMiddleware('patient'), getMedicalHistorySummary);
router.get('/patients/:patientId', authMiddleware, roleMiddleware('doctor', 'admin', 'patient'), getPatientMedicalHistory);
router.get('/patients/:patientId/documents', authMiddleware, roleMiddleware('doctor', 'admin', 'patient'), getPatientMedicalHistoryDocuments);
router.post('/documents', authMiddleware, roleMiddleware('patient'), addMedicalDocument);
router.post('/notes', authMiddleware, roleMiddleware('doctor', 'admin'), addMedicalNote);

export default router;
