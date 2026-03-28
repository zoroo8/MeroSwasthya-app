const express = require('express');
const connectDB = require('./db');
const cors = require('cors');
require('dotenv').config();

const app = express();
connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/doctor', require('./routes/doctor'));
app.use('/api/patient', require('./routes/patient'));
app.use('/api/appointment', require('./routes/appointment'));
app.use('/api/hospital', require('./routes/hospital'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
