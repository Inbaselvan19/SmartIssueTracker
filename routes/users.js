const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { Citizen, Official } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

// ── Admin: get all users ──────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        const citizens = await Citizen.find({}, 'id name email mobile address').lean();
        const officials = await Official.find({}, 'id name username department department_id mobile').lean();
        res.json({ citizens, officials });
    } catch (err) {
        console.error('GET /api/users error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Citizen updates own profile ───────────────────────────────
router.put('/citizen/profile', authenticateToken, async (req, res) => {
    if (req.user.type !== 'citizen') return res.status(403).json({ error: 'Forbidden' });
    const { name, mobile, address, password } = req.body;
    try {
        const updates = {};
        if (name && name.trim()) updates.name = name.trim();
        if (mobile && mobile.trim()) updates.mobile = mobile.trim();
        if (address !== undefined) updates.address = address.trim();
        if (password && password.length > 0) {
            if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
            updates.password_hash = await bcrypt.hash(password, 10);
        }
        await Citizen.updateOne({ id: req.user.id }, updates);
        const updated = await Citizen.findOne({ id: req.user.id }, 'id name email mobile address').lean();
        res.json({ message: 'Profile updated successfully', user: updated });
    } catch (err) {
        console.error('PUT /citizen/profile error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Official updates own profile ──────────────────────────────
router.put('/official/profile', authenticateToken, async (req, res) => {
    if (req.user.type !== 'official') return res.status(403).json({ error: 'Forbidden' });
    const { name, mobile, password } = req.body;
    try {
        const updates = {};
        if (name && name.trim()) updates.name = name.trim();
        if (mobile && mobile.trim()) updates.mobile = mobile.trim();
        if (password && password.length > 0) {
            if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
            updates.password_hash = await bcrypt.hash(password, 10);
        }
        await Official.updateOne({ id: req.user.id }, updates);
        const updated = await Official.findOne({ id: req.user.id }, 'id name username department department_id mobile').lean();
        res.json({ message: 'Profile updated successfully', user: updated });
    } catch (err) {
        console.error('PUT /official/profile error:', err.message);
        res.status(500).json({ error: 'Database error' });
    }
});

// ── Admin: delete user ────────────────────────────────────────
router.delete('/:type/:id', authenticateToken, async (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    try {
        if (req.params.type === 'citizen') {
            await Citizen.deleteOne({ id: req.params.id });
        } else {
            await Official.deleteOne({ id: req.params.id });
        }
        res.json({ message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
