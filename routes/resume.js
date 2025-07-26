// ==============================
// File: routes/resume.js
// ==============================
const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, DOCX, and TXT files are allowed.'));
        }
    },
});

// Custom validation middleware
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

// Handle multer errors
const handleMulterError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 10MB.',
                requestId: req.requestId
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: error.message,
            requestId: req.requestId
        });
    }
    if (error.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            message: error.message,
            requestId: req.requestId
        });
    }
    next(error);
};

// Test route to verify routes are working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Resume routes are working correctly',
        timestamp: new Date().toISOString(),
        requestId: req.requestId
    });
});

// Upload resume
router.post('/upload',
    authenticateToken,
    upload.single('resume'),
    handleMulterError,
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded',
                    requestId: req.requestId
                });
            }

            let extractedText = '';
            let fileType = '';

            try {
                // Extract text based on file type
                if (req.file.mimetype === 'application/pdf') {
                    const pdfData = await pdfParse(req.file.buffer);
                    extractedText = pdfData.text;
                    fileType = 'pdf';
                } else if (
                    req.file.mimetype ===
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                ) {
                    const result = await mammoth.extractRawText({ buffer: req.file.buffer });
                    extractedText = result.value;
                    fileType = 'docx';
                } else if (req.file.mimetype === 'text/plain') {
                    extractedText = req.file.buffer.toString('utf-8');
                    fileType = 'txt';
                }
            } catch (parseError) {
                console.error('Error parsing file:', parseError);
                return res.status(400).json({
                    success: false,
                    message: 'Error parsing file content. Please ensure the file is not corrupted.',
                    error: process.env.NODE_ENV === 'development' ? parseError.message : 'File parsing failed',
                    requestId: req.requestId
                });
            }

            // Validate extracted text
            if (!extractedText || extractedText.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No text content found in the uploaded file',
                    requestId: req.requestId
                });
            }

            // Check for duplicate resumes (optional)
            const existingResume = await Resume.findOne({
                userId: req.user.userId,
                fileName: req.file.originalname,
            });

            if (existingResume) {
                return res.status(409).json({
                    success: false,
                    message: 'A resume with this filename already exists',
                    requestId: req.requestId
                });
            }

            // Create resume record
            const resume = new Resume({
                userId: req.user.userId,
                title: req.body.title || req.file.originalname.split('.')[0], // Remove extension
                originalText: extractedText.trim(),
                fileName: req.file.originalname,
                fileType: fileType,
                status: 'uploaded'
            });

            await resume.save();

            res.json({
                success: true,
                message: 'Resume uploaded successfully',
                data: {
                    resumeId: resume._id,
                    title: resume.title,
                    extractedText: extractedText.substring(0, 500) + (extractedText.length > 500 ? '...' : ''), // Truncate for response
                    fileName: resume.fileName,
                    fileType: resume.fileType,
                    status: resume.status,
                    createdAt: resume.createdAt,
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error uploading resume:', error);
            res.status(500).json({
                success: false,
                message: 'Error uploading resume',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    },
);

// Get all resumes for user
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const resumes = await Resume.find({ userId: req.user.userId })
            .select('title fileName fileType status analysisResults targetRole targetIndustry createdAt updatedAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalResumes = await Resume.countDocuments({ userId: req.user.userId });

        res.json({
            success: true,
            message: 'Resumes retrieved successfully',
            data: {
                resumes,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(totalResumes / limit),
                    totalResumes,
                    hasNext: skip + resumes.length < totalResumes,
                    hasPrev: page > 1,
                },
            },
            requestId: req.requestId
        });
    } catch (error) {
        console.error('Error fetching resumes:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching resumes',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            requestId: req.requestId
        });
    }
});

// Get specific resume
router.get('/:resumeId',
    validateResumeId,
    authenticateToken,
    async (req, res) => {
        try {
            const resume = await Resume.findOne({
                _id: req.params.resumeId,
                userId: req.user.userId,
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            res.json({
                success: true,
                message: 'Resume retrieved successfully',
                data: { resume },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error fetching resume:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching resume',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    },
);

// Update resume title
router.put('/:resumeId/title',
    validateResumeId,
    authenticateToken,
    async (req, res) => {
        try {
            const { title } = req.body;

            if (!title || title.trim().length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Title is required',
                    requestId: req.requestId
                });
            }

            const resume = await Resume.findOneAndUpdate(
                {
                    _id: req.params.resumeId,
                    userId: req.user.userId,
                },
                {
                    title: title.trim(),
                },
                { new: true },
            );

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            res.json({
                success: true,
                message: 'Resume title updated successfully',
                data: {
                    resumeId: resume._id,
                    title: resume.title,
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error updating resume title:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating resume title',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    },
);

// Delete resume
router.delete('/:resumeId',
    validateResumeId,
    authenticateToken,
    async (req, res) => {
        try {
            const resume = await Resume.findOneAndDelete({
                _id: req.params.resumeId,
                userId: req.user.userId,
            });

            if (!resume) {
                return res.status(404).json({
                    success: false,
                    message: 'Resume not found',
                    requestId: req.requestId
                });
            }

            res.json({
                success: true,
                message: 'Resume deleted successfully',
                data: {
                    resumeId: resume._id,
                    title: resume.title,
                },
                requestId: req.requestId
            });
        } catch (error) {
            console.error('Error deleting resume:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting resume',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
                requestId: req.requestId
            });
        }
    },
);

module.exports = router;
