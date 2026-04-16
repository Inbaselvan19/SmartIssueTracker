// ============================================================
//  SmartIssueTracker — server.js
//  Run with:  node server.js
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDB } = require('./db');

const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static assets out of the public directory
app.use(express.static('public')); 

// Serve the uploads directory for the multer images
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// ── ROUTES ───────────────────────────────────────
// Render Health Check Route
app.get('/api/health', (req, res) => {
    res.send('Server running 🚀');
});

app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);
app.use('/api/users', userRoutes);

// ── Kick off ─────────────────────────────────────────────────
async function startServer() {
    await initDB();

    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

startServer().catch(err => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
});