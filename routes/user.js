// ==============================
// File: routes/user.js
// ==============================
const express = require('express');
const User = require('../models/User');
const Resume = require('../models/Resume');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'User routes are working correctly',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                requestId: req.requestId
            });
        }

        const totalResumes = await Resume.countDocuments({ userId: req.user.userId });
        const analyzedResumes = await Resume.countDocuments({ 
            userId: req.user.userId, 
            status: { $in: ['analyzed', 'enhanced'] } 
        });

        res.json({
            success: true,
            message: 'Profile retrieved successfully',
            data: {
                user: {
                    ...user.toObject(),
                    stats: {
                        totalResumes,
                        analyzedResumes,
                        apiUsage: user.apiUsage
                    }
                }
            },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
    try {
        const { name, preferences } = req.body;
        const updateData = {};

        if (name && name.trim().length > 0) {
            updateData.name = name.trim();
        }

        if (preferences && typeof preferences === 'object') {
            if (preferences.theme && ['light', 'dark'].includes(preferences.theme)) {
                updateData['preferences.theme'] = preferences.theme;
            }
            if (preferences.language) {
                updateData['preferences.language'] = preferences.language;
            }
            if (typeof preferences.notifications === 'boolean') {
                updateData['preferences.notifications'] = preferences.notifications;
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.userId,
            updateData,
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                requestId: req.requestId
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

module.exports = router;
