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

// ── Security headers ──────────────────────────────────────────
app.disable('x-powered-by'); // Don't expose Express in response headers

app.use(cors());
// Reduce body size limit — images go via multipart/form-data (multer), not JSON base64
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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

// ── Global error handler (catches multer / unexpected errors) ──
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.message);
    res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Kick off ─────────────────────────────────────────────────
async function startServer() {
    await initDB();
    app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
}

startServer().catch(err => {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
});