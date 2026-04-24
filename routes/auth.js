const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { Citizen, Official, Otp } = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const generateId = (prefix) => prefix + Date.now() + Math.floor(Math.random() * 1000);

router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    try {
        const existingCitizen = await Citizen.findOne({ email });
        if (existingCitizen) return res.status(400).json({ error: 'Email already registered' });
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        await Otp.findOneAndUpdate(
            { email }, 
            { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000) }, 
            { upsert: true, new: true }
        );
        
        const { sendOTPEmail } = require('../services/emailService');
        await sendOTPEmail(email, otp);
        res.json({ message: 'OTP sent successfully to email' });
    } catch (err) {
        console.error('Send OTP error:', err.message);
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

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

    const { type, name, mobile, address, email, password, department, departmentId, username, otp } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        if (type === 'citizen') {
            if (!email) return res.status(400).json({ error: 'Email is required for citizens' });
            if (!otp) return res.status(400).json({ error: 'OTP is required' });
            
            const record = await Otp.findOne({ email, otp });
            if (!record) return res.status(400).json({ error: 'Invalid or expired OTP' });

            const id = generateId('cit');
            await Citizen.create({
                id, name, email, mobile, address, password_hash: hash
            });
            await Otp.deleteOne({ email }); // cleanup
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
            const payload = { id: user.id, type };
            if (type === 'official') payload.department = user.department;
            const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
            return res.json({ token, user });
        }
        res.status(401).json({ error: 'Invalid credentials' });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
