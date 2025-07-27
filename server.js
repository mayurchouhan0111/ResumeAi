// File: server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ───────────────── Security ─────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: [
        'http://127.0.0.1:55297',                    // Your Flutter dev server
        'http://localhost:8080',                     // Alternative local dev
        'https://resumeai-o7sj.onrender.com'         // Your production frontend
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));


// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again later.'
    },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: (req) => req.path === '/health' || req.path === '/'
});
app.use(limiter);

// Request ID middleware
app.use((req, res, next) => {
    req.requestId = uuidv4();
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// ───────────────── Parsers ──────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ───────────────── Database ────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-resume', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    console.log('✅ MongoDB connected successfully');
})
.catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
});

// ───────────────── Health Check ──────────────
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'AI Resume Backend is running!',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        endpoints: {
            auth: '/api/auth',
            resume: '/api/resume',
            ai: '/api/ai',
            user: '/api/user'
        },
        requestId: req.requestId
    });
});

app.get('/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        requestId: req.requestId
    });
});

// ───────────────── Routes - Load Individually ───────────────────
// Load routes one by one to identify which one causes the error

console.log('🔄 Loading routes...');

try {
    // Load auth routes first
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');

    // Load user routes
    const userRoutes = require('./routes/user');
    app.use('/api/user', userRoutes);
    console.log('✅ User routes loaded');

    // Load resume routes
    const resumeRoutes = require('./routes/resume');
    app.use('/api/resume', resumeRoutes);
    console.log('✅ Resume routes loaded');

    // Load AI routes last (most likely to cause issues)
    const aiRoutes = require('./routes/ai');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI routes loaded');

    console.log('✅ All routes loaded successfully');
    console.log('📝 Available endpoints:');
    console.log('   🔐 Auth: /api/auth/*');
    console.log('   📄 Resume: /api/resume/*');
    console.log('   🤖 AI: /api/ai/*');
    console.log('   👤 User: /api/user/*');

} catch (error) {
    console.error('❌ Error loading routes:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
}

// ───────────────── Error Handling ───────────────────
app.use((err, req, res, next) => {
    const requestId = req.requestId || uuidv4();
    console.error(`[${requestId}] Error:`, err);

    let statusCode = err.status || err.statusCode || 500;
    let message = err.message || 'Internal server error';

    if (err.name === 'MulterError') {
        statusCode = 400;
        message = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'File upload error';
    }

    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        requestId
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route not found: ${req.method} ${req.originalUrl}`,
        requestId: req.requestId || uuidv4()
    });
});

// ───────────────── Server Start ───────────────────
const server = app.listen(PORT, () => {
    console.log('\n🎉 ================================');
    console.log('🚀 AI Resume Backend Started!');
    console.log('🎉 ================================');
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🌐 Server URL: http://localhost:${PORT}`);
    console.log(`🕒 Started at: ${new Date().toISOString()}`);
    console.log('================================\n');
});

module.exports = app;
