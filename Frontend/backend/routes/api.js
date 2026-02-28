const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

// In-memory storage for hackathon simplicity (ideal: MongoDB)
let machinesData = [];
let jobsData = [];

// Python ML Service URL
const ML_SERVICE_URL = 'http://localhost:5000';

// 1. Upload endpoints
router.post('/upload-machines', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        // Convert numeric fields
        machinesData = results.map(m => ({
            ...m,
            TotalRunHours: parseFloat(m.TotalRunHours),
            VibrationLevel: parseFloat(m.VibrationLevel),
            TempLevel: parseFloat(m.TempLevel),
            LastMaintenanceDays: parseInt(m.LastMaintenanceDays),
            CapacityPerHour: parseInt(m.CapacityPerHour)
        }));
        res.json({ message: 'Machines uploaded successfully', count: machinesData.length, data: machinesData });
      });
});

router.post('/upload-jobs', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');
    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        jobsData = results.map(j => ({
            ...j,
            ProcessingTimeHours: parseFloat(j.ProcessingTimeHours),
            DeadlineHours: parseFloat(j.DeadlineHours)
        }));
        res.json({ message: 'Jobs uploaded successfully', count: jobsData.length, data: jobsData });
      });
});

// 2. Predict Endpoint (Proxies to Python)
router.post('/predict', async (req, res) => {
    try {
        const response = await axios.post(`${ML_SERVICE_URL}/predict`, machinesData);
        // Merge predictions back into machinesData
        const predictions = response.data;
        machinesData = machinesData.map(m => {
            const pred = predictions.find(p => p.MachineID === m.MachineID);
            if (pred) {
                return { ...m, ...pred };
            }
            return m;
        });
        res.json(machinesData);
    } catch (error) {
         console.error(error.message);
         res.status(500).json({ error: 'Failed to connect to ML service' });
    }
});

// 3. Simulate Maintenance Endpoint
router.post('/simulate-maintenance', async (req, res) => {
     try {
         const response = await axios.post(`${ML_SERVICE_URL}/simulate`, req.body);
         res.json(response.data);
     } catch (error) {
         res.status(500).json({ error: 'Simulation failed' });
     }
});

// 4. Optimize Scheduling Endpoint
router.post('/optimize', async (req, res) => {
     try {
         // Pass both jobs and machines with their predictions
         const payload = {
             jobs: jobsData,
             machines: machinesData,
             weights: req.body.weights || { throughput: 0.5, failure_risk: 0.3, cost: 0.2 }
         };
         const response = await axios.post(`${ML_SERVICE_URL}/optimize`, payload);
         res.json(response.data);
     } catch (error) {
         res.status(500).json({ error: 'Optimization failed' });
     }
});

module.exports = router;
