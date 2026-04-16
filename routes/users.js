const express = require('express');
const router = express.Router();
const { Citizen, Official } = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

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
