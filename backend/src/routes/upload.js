const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const geminiService = require('../services/geminiService');
const emailService = require('../services/emailService');
const fileParser = require('../services/fileParser');
const apiKeyMiddleware = require('../middleware/apiKey');
const logger = require('../utils/logger');

const router = express.Router();

// ─── Multer Config ─────────────────────────────────────────────────────────
const storage = multer.memoryStorage(); // Never persist to disk in prod

const fileFilter = (_req, file, cb) => {
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];
  const allowedExts = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only .csv and .xlsx files are accepted'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
    files: 1,
  },
});

// ─── Validation Rules ──────────────────────────────────────────────────────
const uploadValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('A valid recipient email is required'),
  body('senderName')
    .optional()
    .isLength({ max: 100 })
    .trim()
    .escape(),
];

/**
 * @swagger
 * /api/upload:
 *   post:
 *     summary: Upload a sales data file and generate an AI summary
 *     description: |
 *       Accepts a CSV or XLSX sales data file. Parses the data, generates
 *       a professional narrative summary via Gemini AI, then emails the report
 *       to the specified recipient.
 *     tags:
 *       - Upload
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *               - email
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or XLSX sales data file (max 5MB)
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Recipient email address for the summary
 *               senderName:
 *                 type: string
 *                 description: Optional sender/team name displayed in the email
 *     responses:
 *       200:
 *         description: Summary generated and email sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error or bad file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid API key
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  apiKeyMiddleware,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: `File upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  uploadValidation,
  async (req, res) => {
    const requestId = uuidv4();
    logger.info('Upload request received', { requestId });

    // Validate form fields
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { email, senderName = 'The Sales Team' } = req.body;

    try {
      // 1. Parse file
      logger.info('Parsing file', { requestId, filename: req.file.originalname });
      const parsedData = await fileParser.parse(req.file);

      if (!parsedData || parsedData.rows.length === 0) {
        return res.status(400).json({ error: 'File appears empty or could not be parsed.' });
      }

      // 2. Generate AI summary
      logger.info('Generating AI summary', { requestId, rows: parsedData.rows.length });
      const summary = await geminiService.generateSummary(parsedData);

      // 3. Send email
      logger.info('Sending email', { requestId, to: email });
      await emailService.sendSummary({
        to: email,
        summary,
        filename: req.file.originalname,
        senderName,
        stats: parsedData.stats,
      });

      logger.info('Request completed successfully', { requestId });
      res.json({
        success: true,
        message: `Sales insight summary sent to ${email}`,
        requestId,
        stats: parsedData.stats,
      });
    } catch (err) {
      logger.error('Upload pipeline error', { requestId, error: err.message });
      res.status(500).json({ error: 'Failed to process file. Please try again.' });
    }
  }
);

module.exports = router;
