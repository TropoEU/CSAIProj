import express from 'express';
import { getOrderStatus, bookAppointment } from '../controllers/toolsController.js';

const router = express.Router();

router.post('/get_order_status', getOrderStatus);
router.post('/book_appointment', bookAppointment);

export default router;
