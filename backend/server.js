import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './db.js';
import authRoutes from './routes/auth.js';
import doctorRoutes from './routes/doctor.js';

dotenv.config();

const app = express();
connectDB();

app.use(cors({
	origin: true,
	credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/doctor', doctorRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));