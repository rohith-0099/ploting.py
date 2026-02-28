const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Routes setup
const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// Database connection
const PORT = process.env.PORT || 4000;
// Note: for hackathon we might just use in-memory arrays if MongoDB local isn't setup
// but we'll try Mongo first. If not, api.js will handle failover.
mongoose.connect('mongodb://localhost:27017/mecon_db')
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
             console.log(`Server running on port ${PORT}`);
        });
    })
    .catch(err => {
        console.log('MongoDB connection failed. Starting server anyway in memory mode...');
        app.listen(PORT, () => {
             console.log(`Server running in memory mode on port ${PORT}`);
        });
    });
