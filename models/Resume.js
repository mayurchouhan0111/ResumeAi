const mongoose = require('mongoose');

const analysisSchema = new mongoose.Schema(
  {
    score:            { type: Number, min: 0, max: 100 },
    suggestions:      { type: [String], default: [] },
    keywords:         { type: [String], default: [] },
    strengths:        { type: [String], default: [] },
    weaknesses:       { type: [String], default: [] },
    atsCompatibility: { type: Number, min: 0, max: 100 }
  },
  { _id: false } // embed without its own _id
);

const jobMatchSchema = new mongoose.Schema(
  {
    jobTitle:               { type: String, trim: true },
    companyName:            { type: String, trim: true },
    matchScore:             { type: Number, min: 0, max: 100 },
    matchedKeywords:        { type: [String], default: [] },
    suggestions:            { type: [String], default: [] },
    strengthAreas:          { type: [String], default: [] },
    improvementAreas:       { type: [String], default: [] },
    salaryNegotiationPoints:{ type: [String], default: [] },
    createdAt:              { type: Date,   default: Date.now }
  },
  { _id: false }
);

const versionSchema = new mongoose.Schema(
  {
    versionName: { type: String, trim: true },
    content:     { type: String },
    createdAt:   { type: Date, default: Date.now }
  },
  { _id: false }
);

const resumeSchema = new mongoose.Schema(
  {
    userId:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title:         { type: String, required: true, trim: true, maxlength: 200 },
    originalText:  { type: String, required: true },
    enhancedText:  { type: String },
    fileName:      { type: String, required: true },
    fileType:      { type: String, enum: ['pdf', 'docx', 'txt'], required: true },
    analysisResults: analysisSchema,
    jobMatching:     { type: [jobMatchSchema], default: [] },
    versions:        { type: [versionSchema],  default: [] },
    status:          { type: String, enum: ['uploaded', 'analyzing', 'analyzed', 'enhanced'], default: 'uploaded' }
  },
  { timestamps: true }
);

// Optional: text index for full-text search across resume
resumeSchema.index({ originalText: 'text', enhancedText: 'text', title: 'text' });

module.exports = mongoose.model('Resume', resumeSchema);
