const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Problem, Citizen, Official } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const { sendTicketSubmittedEmail, sendStatusUpdateEmail, sendAdminActionEmail } = require('../services/emailService');

// Multer Setup for handling file uploads
// Using memory storage to save images as Base64 in MongoDB instead of local files (fixes broken images on Render)
const storage = multer.memoryStorage();

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
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        imageUrl = `data:${req.file.mimetype};base64,${b64}`;
    } else if (req.body.imageData) {
        imageUrl = req.body.imageData;
    }

    const id = 'PRB-' + Math.floor(100000 + Math.random() * 900000);

    try {
        // Load balancing: assign to the official with the least active problems in the department
        const officialsInDept = await Official.find({ department }).lean();
        let assignedTo = null;

        if (officialsInDept.length > 0) {
            const activeProblems = await Problem.find({ 
                department, 
                status: { $nin: ['completed', 'closed'] } 
            }).lean();

            const loadCount = {};
            officialsInDept.forEach(o => loadCount[o.id] = 0);
            activeProblems.forEach(p => {
                if (p.assigned_to && loadCount[p.assigned_to] !== undefined) {
                    loadCount[p.assigned_to]++;
                }
            });

            let minOfficialId = officialsInDept[0].id;
            let minLoad = loadCount[minOfficialId];

            for (let i = 1; i < officialsInDept.length; i++) {
                const offId = officialsInDept[i].id;
                if (loadCount[offId] < minLoad) {
                    minLoad = loadCount[offId];
                    minOfficialId = offId;
                }
            }

            // Only auto-assign if the least-burdened official has fewer than 5 active problems
            if (minLoad < 5) {
                assignedTo = minOfficialId;
            } else {
                assignedTo = null; // Stays unassigned if all officials in the department are at capacity
            }
        }

        await Problem.create({
            id, citizen_id: req.user.id, department, priority, description, location, lat, lng, image_data: imageUrl, assigned_to: assignedTo
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
        const b64 = Buffer.from(req.file.buffer).toString('base64');
        proofUrl = `data:${req.file.mimetype};base64,${b64}`;
    } else if (req.body.proofImage) {
        proofUrl = req.body.proofImage;
    }

    try {
        // 🔒 Officials can only update tickets belonging to their own department
        if (req.user.type === 'official') {
            const problem = await Problem.findOne({ id: req.params.id });
            if (!problem) return res.status(404).json({ error: 'Ticket not found' });
            
            let userDept = req.user.department;
            if (!userDept) {
                const off = await Official.findOne({ id: req.user.id });
                if (off) userDept = off.department;
            }

            if (problem.department !== userDept) {
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
    try {
        // 🔒 Only the citizen who owns this ticket can submit feedback
        const problem = await Problem.findOne({ id: req.params.id });
        if (!problem) return res.status(404).json({ error: 'Ticket not found' });
        if (req.user.type === 'citizen' && problem.citizen_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only submit feedback on your own tickets' });
        }
        
        const updates = { updated_at: new Date() };
        if (feedback && typeof feedback === 'string' && feedback.trim().length > 0) {
            const prefix = problem.feedback ? problem.feedback + '\n[Citizen]: ' : '[Citizen]: ';
            updates.feedback = prefix + feedback.trim();
        }
        if (rating !== undefined && rating >= 1 && rating <= 5) {
            updates.rating = rating;
        }
        
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

router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const problem = await Problem.findOne({ id: req.params.id });
        if (!problem) return res.status(404).json({ error: 'Ticket not found' });
        
        if (req.user.type === 'citizen' && problem.citizen_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own tickets' });
        }
        if (req.user.type === 'official') {
            return res.status(403).json({ error: 'Officials cannot delete tickets' });
        }

        await Problem.deleteOne({ id: req.params.id });
        res.json({ message: 'Ticket deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
