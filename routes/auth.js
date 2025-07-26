// ==============================
// File: routes/auth.js
// ==============================
const express = require('express');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation schemas
const regSchema = Joi.object({
    name: Joi.string().min(2).max(50).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required()
});

const logSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Auth routes are working correctly',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { error } = regSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message,
                requestId: req.requestId
            });
        }

        const { name, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already exists',
                requestId: req.requestId
            });
        }

        // Create new user
        const user = new User({ name, email, password });
        await user.save();

        // Generate token
        const token = jwt.sign(
            { userId: user._id, email: user.email }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    subscriptionType: user.subscriptionType
                }
            },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { error } = logSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ 
                success: false, 
                message: error.details[0].message,
                requestId: req.requestId
            });
        }

        const { email, password } = req.body;
        
        // Find user and include password for comparison
        const user = await User.findOne({ email }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ 
                success: false, 
                message: 'Invalid credentials',
                requestId: req.requestId
            });
        }

        // Generate token
        const token = jwt.sign(
            { userId: user._id, email: user.email }, 
            process.env.JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                token,
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    subscriptionType: user.subscriptionType
                }
            },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
                requestId: req.requestId
            });
        }

        res.json({ 
            success: true, 
            data: { user },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

module.exports = router;
