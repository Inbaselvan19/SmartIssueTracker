const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Problem, Citizen } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { sendNotification } = require('../services/emailService');

// Multer Setup for handling file uploads (Local storage instead of LONGTEXT in DB)
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    const { department, priority, description, location } = req.body;
    let imageUrl = null;
    
    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    }
    
    // Fallback: If map picker is updating but still sending base64 in imageData
    if (!req.file && req.body.imageData) {
        imageUrl = req.body.imageData; 
    }

    // Since we generate id at frontend or we can do it here, let's allow frontend to pass it
    // Wait, the new app.js doesn't send "id", so let's generate it here
    const id = 'PRB-' + Math.floor(100000 + Math.random() * 900000);

    try {
        await Problem.create({
            id, citizen_id: req.user.id, department, priority, description, location, image_data: imageUrl
        });
        res.status(201).json({ message: 'Ticket created successfully', id });
        
        // Trigger email notification for new ticket submission
        const citizen = await Citizen.findOne({ id: req.user.id });
        if (citizen && citizen.email) {
            sendNotification(citizen.email, 'Ticket Submitted Successfully', `Hello! We've received your issue report (ID: ${id}) for the ${department} department. Priority set to ${priority}. You will be notified when an official begins working on it.`);
        }
    } catch (err) {
        console.error('POST /api/problems error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const rows = await Problem.find().sort({ date_reported: -1 }).lean();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id/status', authenticateToken, upload.single('proofImage'), async (req, res) => {
    const { status } = req.body;
    let proofUrl = null;
    
    if (req.file) {
        proofUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.proofImage) {
        proofUrl = req.body.proofImage;
    }

    try {
        await Problem.updateOne(
            { id: req.params.id },
            { status, assigned_to: req.user.id, proof_image: proofUrl }
        );
        res.json({ message: 'Status updated' });

        // Trigger email notification to citizen
        const problem = await Problem.findOne({ id: req.params.id });
        if (problem) {
            const citizen = await Citizen.findOne({ id: problem.citizen_id });
            if (citizen && citizen.email) {
                sendNotification(citizen.email, 'Issue Status Update', `Your ticket ${problem.id} status was updated to: ${status}`);
            }
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id/feedback', authenticateToken, async (req, res) => {
    const { feedback } = req.body;
    try {
        await Problem.updateOne({ id: req.params.id }, { feedback });
        res.json({ message: 'Feedback submitted' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id/admin-action', authenticateToken, async (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { status, feedbackAppend, clearProof } = req.body;
    try {
        const problem = await Problem.findOne({ id: req.params.id });
        if (problem) {
            const updatedFeedback = (problem.feedback || '') + feedbackAppend;
            let updateData = { status, feedback: updatedFeedback };
            if (clearProof) updateData.proof_image = null;
            await Problem.updateOne({ id: req.params.id }, updateData);

            const citizen = await Citizen.findOne({ id: problem.citizen_id });
            if (citizen && citizen.email) {
                sendNotification(citizen.email, 'Admin Action on Ticket', `Your ticket ${problem.id} was reviewed by the Super Admin. Its status is now: ${status}.`);
            }
        }
        res.json({ message: 'Admin action applied' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
