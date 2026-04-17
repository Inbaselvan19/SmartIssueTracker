const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Problem, Citizen } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { sendTicketSubmittedEmail, sendStatusUpdateEmail, sendAdminActionEmail } = require('../services/emailService');

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

// Only allow real image MIME types — blocks disguised file uploads
const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPEG, PNG, GIF, WEBP) are allowed.'), false);
    }
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB max

router.post('/', authenticateToken, upload.single('image'), async (req, res) => {
    const { department, priority, description, location } = req.body;
    const lat = parseFloat(req.body.lat) || null;
    const lng = parseFloat(req.body.lng) || null;
    let imageUrl = null;

    if (req.file) {
        imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.imageData) {
        imageUrl = req.body.imageData;
    }

    const id = 'PRB-' + Math.floor(100000 + Math.random() * 900000);

    try {
        await Problem.create({
            id, citizen_id: req.user.id, department, priority, description, location, lat, lng, image_data: imageUrl
        });
        res.status(201).json({ message: 'Ticket created successfully', id });

        // Rich HTML email + optional SMS
        const citizen = await Citizen.findOne({ id: req.user.id });
        if (citizen) {
            sendTicketSubmittedEmail(citizen.email, citizen, { id, department, priority, description, location });
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
        // 🔒 Officials can only update tickets belonging to their own department
        if (req.user.type === 'official') {
            const problem = await Problem.findOne({ id: req.params.id });
            if (!problem) return res.status(404).json({ error: 'Ticket not found' });
            if (problem.department !== req.user.department) {
                return res.status(403).json({ error: 'You can only update tickets in your department' });
            }
        }

        await Problem.updateOne(
            { id: req.params.id },
            { status, assigned_to: req.user.id, proof_image: proofUrl, updated_at: new Date() }
        );
        res.json({ message: 'Status updated' });

        // Rich HTML email + optional SMS to citizen
        const updatedProblem = await Problem.findOne({ id: req.params.id });
        if (updatedProblem) {
            const citizen = await Citizen.findOne({ id: updatedProblem.citizen_id });
            if (citizen) {
                sendStatusUpdateEmail(citizen.email, citizen, updatedProblem, status);
            }
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.put('/:id/feedback', authenticateToken, async (req, res) => {
    const { feedback, rating } = req.body;
    if (!feedback || typeof feedback !== 'string' || feedback.trim().length === 0) {
        return res.status(400).json({ error: 'Feedback text is required' });
    }
    if (rating !== undefined && (typeof rating !== 'number' || rating < 1 || rating > 5)) {
        return res.status(400).json({ error: 'Rating must be a number between 1 and 5' });
    }
    try {
        // 🔒 Only the citizen who owns this ticket can submit feedback
        const problem = await Problem.findOne({ id: req.params.id });
        if (!problem) return res.status(404).json({ error: 'Ticket not found' });
        if (req.user.type === 'citizen' && problem.citizen_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only submit feedback on your own tickets' });
        }
        const updates = { feedback: feedback.trim(), updated_at: new Date() };
        if (rating) updates.rating = rating;
        await Problem.updateOne({ id: req.params.id }, updates);
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
            let updateData = { status, feedback: updatedFeedback, updated_at: new Date() };
            if (clearProof) updateData.proof_image = null;
            await Problem.updateOne({ id: req.params.id }, updateData);

            const citizen = await Citizen.findOne({ id: problem.citizen_id });
            if (citizen) {
                sendAdminActionEmail(citizen.email, citizen, problem, status, feedbackAppend);
            }
        }
        res.json({ message: 'Admin action applied' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
