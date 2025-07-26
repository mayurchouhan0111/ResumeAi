// File: middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/* ────────── JWT auth ────────── */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Token required',
            requestId: req.requestId 
        });
    }

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid or expired token',
            requestId: req.requestId 
        });
    }
};

/* ────────── API limit per month ────────── */
const checkApiLimit = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found',
                requestId: req.requestId 
            });
        }

        const now = new Date();
        const reset = new Date(user.apiUsage.lastReset);
        
        if (now.getMonth() !== reset.getMonth() || now.getFullYear() !== reset.getFullYear()) {
            user.apiUsage.monthly = 0;
            user.apiUsage.lastReset = now;
        }
        
        const limit = { free: 5, premium: 100, enterprise: 1000 }[user.subscriptionType] || 5;
        
        if (user.apiUsage.monthly >= limit) {
            return res.status(429).json({ 
                success: false, 
                message: 'Monthly API limit exceeded',
                requestId: req.requestId 
            });
        }
        
        user.apiUsage.monthly += 1;
        await user.save();
        next();
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: 'API limit check failed', 
            error: error.message,
            requestId: req.requestId 
        });
    }
};

module.exports = { authenticateToken, checkApiLimit };
