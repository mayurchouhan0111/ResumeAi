// ==============================
// File: routes/ai.js
// ==============================
const express = require('express');
const mongoose = require('mongoose');
const GoogleAIService = require('../services/googleAI');
const Resume = require('../models/Resume');
const { authenticateToken, checkApiLimit } = require('../middleware/auth');

const router = express.Router();
const googleAI = new GoogleAIService();

// Custom validation functions
const validateResumeId = (req, res, next) => {
    const { resumeId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(resumeId)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid resume ID format',
            requestId: req.requestId
        });
    }
    next();
};

const validateEnhanceRequest = (req, res, next) => {
    const { targetRole, targetIndustry } = req.body;
    
    if (!targetRole || typeof targetRole !== 'string' || targetRole.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Target role is required and must be a valid string',
            requestId: req.requestId
        });
    }
    
    if (!targetIndustry || typeof targetIndustry !== 'string' || targetIndustry.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Target industry is required and must be a valid string',
            requestId: req.requestId
        });
    }
    
    // Sanitize inputs
    req.body.targetRole = targetRole.trim();
    req.body.targetIndustry = targetIndustry.trim();
    
    next();
};

const validateMatchRequest = (req, res, next) => {
    const { jobTitle, jobDescription, companyName } = req.body;
    
    if (!jobTitle || typeof jobTitle !== 'string' || jobTitle.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Job title is required and must be a valid string',
            requestId: req.requestId
        });
    }
    
    if (!jobDescription || typeof jobDescription !== 'string' || jobDescription.trim().length === 0) {
        return res.status(400).json({
            success: false,
            message: 'Job description is required and must be a valid string',
            requestId: req.requestId
        });
    }
    
    // Sanitize inputs
    req.body.jobTitle = jobTitle.trim();
    req.body.jobDescription = jobDescription.trim();
    if (companyName) {
        req.body.companyName = companyName.trim();
    }
    
    next();
};

// Test route to verify routes are working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'AI routes are working correctly',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});

// Analyze resume with Google Generative AI
router.post('/analyze/:resumeId',
    validateResumeId,
    authenticateToken,
    checkApiLimit,
    async (req, res) => {
        try {
            const resume = await Resume.findOne({
                _id: req.params.resumeId,
                userId: req.user.userId
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            if (!resume.originalText) {
                return res.status(400).json({
                    success: false,
                    message: 'Resume has no content to analyze',
                    requestId: req.requestId
                });
            }

            // Set status to analyzing
            resume.status = 'analyzing';
            await resume.save();

            const analysisResults = await googleAI.analyzeResume(resume.originalText);

            // Update resume with analysis results
            resume.analysisResults = analysisResults;
            resume.status = 'analyzed';
            await resume.save();

            res.json({
                success: true,
                message: 'Resume analyzed successfully',
                data: {
                    resumeId: resume._id,
                    analysisResults
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error analyzing resume:', error);
            
            // Update resume status to indicate error
            try {
                await Resume.findByIdAndUpdate(req.params.resumeId, { status: 'uploaded' });
            } catch (updateError) {
                console.error('Error updating resume status:', updateError);
            }

            res.status(500).json({
                success: false,
                message: 'Error analyzing resume',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    }
);

// Enhance resume content
router.post('/enhance/:resumeId',
    validateResumeId,
    validateEnhanceRequest,
    authenticateToken,
    checkApiLimit,
    async (req, res) => {
        try {
            const { targetRole, targetIndustry } = req.body;

            const resume = await Resume.findOne({
                _id: req.params.resumeId,
                userId: req.user.userId
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            if (!resume.originalText) {
                return res.status(400).json({
                    success: false,
                    message: 'Resume has no content to enhance',
                    requestId: req.requestId
                });
            }

            const enhancedText = await googleAI.enhanceResume(
                resume.originalText,
                targetRole,
                targetIndustry
            );

            // Update resume with enhanced content
            resume.enhancedText = enhancedText;
            resume.status = 'enhanced';
            resume.targetRole = targetRole;
            resume.targetIndustry = targetIndustry;
            await resume.save();

            res.json({
                success: true,
                message: 'Resume enhanced successfully',
                data: {
                    resumeId: resume._id,
                    enhancedText,
                    targetRole,
                    targetIndustry
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error enhancing resume:', error);
            res.status(500).json({
                success: false,
                message: 'Error enhancing resume',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    }
);

// Match resume with job description
router.post('/match/:resumeId',
    validateResumeId,
    validateMatchRequest,
    authenticateToken,
    checkApiLimit,
    async (req, res) => {
        try {
            const { jobTitle, jobDescription, companyName } = req.body;

            const resume = await Resume.findOne({
                _id: req.params.resumeId,
                userId: req.user.userId
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            if (!resume.originalText) {
                return res.status(400).json({
                    success: false,
                    message: 'Resume has no content to match',
                    requestId: req.requestId
                });
            }

            const matchResults = await googleAI.matchJobDescription(
                resume.originalText,
                jobTitle,
                jobDescription,
                companyName
            );

            // Add job matching result to resume
            const jobMatch = {
                jobTitle,
                companyName: companyName || 'Not specified',
                matchScore: matchResults.matchScore || 0,
                matchedKeywords: matchResults.matchedKeywords || [],
                suggestions: matchResults.suggestions || [],
                strengthAreas: matchResults.strengthAreas || [],
                improvementAreas: matchResults.improvementAreas || [],
                salaryNegotiationPoints: matchResults.salaryNegotiationPoints || [],
                createdAt: new Date()
            };

            // Initialize jobMatching array if it doesn't exist
            if (!resume.jobMatching) {
                resume.jobMatching = [];
            }

            resume.jobMatching.push(jobMatch);
            await resume.save();

            res.json({
                success: true,
                message: 'Job matching completed',
                data: {
                    resumeId: resume._id,
                    ...matchResults
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error matching resume with job:', error);
            res.status(500).json({
                success: false,
                message: 'Error matching resume with job',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    }
);

// Get resume analysis history
router.get('/history/:resumeId',
    validateResumeId,
    authenticateToken,
    async (req, res) => {
        try {
            const resume = await Resume.findOne({
                _id: req.params.resumeId,
                userId: req.user.userId
            }).select('analysisResults jobMatching status targetRole targetIndustry updatedAt');

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            res.json({
                success: true,
                message: 'Resume history retrieved successfully',
                data: {
                    resumeId: resume._id,
                    status: resume.status,
                    targetRole: resume.targetRole,
                    targetIndustry: resume.targetIndustry,
                    analysisResults: resume.analysisResults,
                    jobMatching: resume.jobMatching || [],
                    updatedAt: resume.updatedAt
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error retrieving resume history:', error);
            res.status(500).json({
                success: false,
                message: 'Error retrieving resume history',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    }
);

module.exports = router;
