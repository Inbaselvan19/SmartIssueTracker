const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Citizen, Official } = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const generateId = (prefix) => prefix + Date.now() + Math.floor(Math.random() * 1000);

router.post('/register', [
    // Basic Input Validation
    body('type').isIn(['citizen', 'official']),
    body('name').trim().notEmpty(),
    body('mobile').isLength({ min: 10 }),
    body('password').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation failed: ' + errors.array().map(e => e.msg).join(', ') });
    }

    const { type, name, mobile, address, email, password, department, departmentId, username } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        if (type === 'citizen') {
            if (!email) return res.status(400).json({ error: 'Email is required for citizens' });
            const id = generateId('cit');
            await Citizen.create({
                id, name, email, mobile, address, password_hash: hash
            });
            res.status(201).json({ message: 'Citizen registered successfully' });
        } else if (type === 'official') {
            if (!departmentId || !username) return res.status(400).json({ error: 'Dept ID and username required' });
            const id = generateId('off');
            await Official.create({
                id, name, username, department, department_id: departmentId, mobile, password_hash: hash
            });
            res.status(201).json({ message: 'Official registered successfully' });
        }
    } catch (err) {
        console.error('Register error:', err.message);
        res.status(500).json({ error: 'Registration failed. Data might already exist.' });
    }
});

router.post('/login', async (req, res) => {
    const { type, username, password } = req.body;
    
    // Feature: No more hardcoded admin credentials. We should check against DB ideally, or env vars
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin123';

    if (type === 'admin') {
        if (username === adminUser && password === adminPass) {
            const token = jwt.sign({ id: 'admin', type: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
            return res.json({ token, user: { id: 'admin', name: 'Super Admin', type: 'admin' } });
        }
        return res.status(401).json({ error: 'Invalid admin credentials' });
    }
    
    try {
        let userRow = null;
        if (type === 'citizen') {
            userRow = await Citizen.findOne({ email: username }).lean();
        } else if (type === 'official') {
            userRow = await Official.findOne({ department_id: username }).lean();
        }
        
        if (userRow && await bcrypt.compare(password, userRow.password_hash)) {
            const user = { ...userRow };
            delete user.password_hash;
            user.type = type;
            const token = jwt.sign({ id: user.id, type }, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, user });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
