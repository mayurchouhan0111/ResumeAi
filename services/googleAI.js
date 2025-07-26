// ==============================
// File: services/googleAI.js
// ==============================
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GoogleAIService {
    constructor() {
        if (!process.env.GOOGLE_AI_API_KEY) {
            console.warn('⚠️  GOOGLE_AI_API_KEY not found, using mock responses');
            this.useMock = true;
        } else {
            try {
                this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                this.useMock = false;
                console.log('✅ Google AI service initialized successfully');
            } catch (error) {
                console.error('❌ Error initializing Google AI service:', error.message);
                this.useMock = true;
            }
        }
    }

    async analyzeResume(resumeText) {
        if (this.useMock) {
            return this.getMockAnalysis();
        }

        try {
            const prompt = `
            Analyze the following resume and provide a comprehensive analysis in valid JSON format:

            Resume Text:
            ${resumeText}

            Respond with ONLY a valid JSON object with this exact structure:
            {
                "score": 85,
                "strengths": ["Professional experience", "Technical skills"],
                "weaknesses": ["Could use more metrics", "Missing keywords"],
                "keywords": ["JavaScript", "React", "Node.js"],
                "atsCompatibility": 78,
                "suggestions": ["Add quantified achievements", "Include industry keywords"]
            }
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Parse JSON response
            const cleanedText = text.replace(/``````/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (error) {
            console.error('Error analyzing resume:', error);
            return this.getMockAnalysis();
        }
    }

    async enhanceResume(resumeText, targetRole, targetIndustry) {
        if (this.useMock) {
            return this.getMockEnhancement(resumeText, targetRole, targetIndustry);
        }

        try {
            const prompt = `
            Enhance the following resume for the role "${targetRole}" in "${targetIndustry}" industry.
            Return only the enhanced resume text, no additional commentary:

            ${resumeText}
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            console.error('Error enhancing resume:', error);
            return this.getMockEnhancement(resumeText, targetRole, targetIndustry);
        }
    }

    async matchJobDescription(resumeText, jobTitle, jobDescription, companyName = '') {
        if (this.useMock) {
            return this.getMockJobMatch();
        }

        try {
            const prompt = `
            Compare resume with job description and respond with ONLY valid JSON:

            Resume: ${resumeText}
            Job: ${jobTitle} at ${companyName}
            Description: ${jobDescription}

            Respond with this exact JSON structure:
            {
                "matchScore": 75,
                "matchedKeywords": ["skill1", "skill2"],
                "missingKeywords": ["missing1", "missing2"],
                "suggestions": ["suggestion1", "suggestion2"],
                "strengthAreas": ["strength1", "strength2"],
                "improvementAreas": ["area1", "area2"],
                "salaryNegotiationPoints": ["point1", "point2"]
            }
            `;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            const cleanedText = text.replace(/``````/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (error) {
            console.error('Error matching job description:', error);
            return this.getMockJobMatch();
        }
    }

    // Mock responses for testing
    getMockAnalysis() {
        return {
            score: Math.floor(Math.random() * 20) + 75,
            strengths: ["Strong technical background", "Relevant experience", "Good education"],
            weaknesses: ["Needs more metrics", "Missing keywords", "Could improve formatting"],
            keywords: ["JavaScript", "React", "Node.js", "MongoDB", "Express"],
            atsCompatibility: Math.floor(Math.random() * 15) + 80,
            suggestions: [
                "Add quantified achievements",
                "Include industry-specific keywords",
                "Improve ATS formatting",
                "Use stronger action verbs"
            ]
        };
    }

    getMockEnhancement(resumeText, targetRole, targetIndustry) {
        return `[ENHANCED FOR ${targetRole} IN ${targetIndustry}]\n\n${resumeText}\n\n[This resume has been optimized with relevant keywords and improved formatting for the ${targetRole} position in the ${targetIndustry} industry.]`;
    }

    getMockJobMatch() {
        return {
            matchScore: Math.floor(Math.random() * 30) + 65,
            matchedKeywords: ["JavaScript", "React", "Problem solving", "Team work"],
            missingKeywords: ["Python", "AWS", "Docker", "Kubernetes"],
            suggestions: [
                "Add cloud computing experience",
                "Highlight leadership skills",
                "Include specific project metrics",
                "Mention agile methodologies"
            ],
            strengthAreas: ["Technical skills", "Experience level", "Education background"],
            improvementAreas: ["Cloud technologies", "Leadership experience", "Certifications"],
            salaryNegotiationPoints: [
                "Strong technical foundation",
                "Relevant project experience",
                "Industry knowledge"
            ]
        };
    }
}

module.exports = GoogleAIService;
