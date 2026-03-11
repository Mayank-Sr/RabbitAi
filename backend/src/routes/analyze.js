const express = require('express');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const { parseFile, sanitizeData } = require('../services/fileParser');
const { generateSummary } = require('../services/geminiService');
const { sendSummaryEmail } = require('../services/emailService');

const router = express.Router();

// ── Multer config: memory storage, 5MB limit, strict file filter ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ['csv', 'xlsx', 'xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(Object.assign(new Error('Only .csv and .xlsx files are allowed.'), { status: 400 }));
    }
  },
});

// ── Validation ──
const validateAnalyze = [
  body('email')
    .isEmail().withMessage('A valid email address is required.')
    .normalizeEmail()
    .isLength({ max: 254 }),
];

// ── POST /api/analyze ──
router.post('/', upload.single('file'), validateAnalyze, async (req, res, next) => {
  try {
    // Validate inputs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const { email } = req.body;
    const { buffer, mimetype, originalname } = req.file;

    // Parse & sanitize
    const rows = parseFile(buffer, mimetype, originalname);
    const { totalRows, allRows } = sanitizeData(rows);

    // AI Summary
    console.log(`[ANALYZE] Generating summary for ${originalname} (${totalRows} rows) → ${email}`);
    const summary = await generateSummary(allRows, originalname);

    // Send email
    const emailResult = await sendSummaryEmail(email, summary, originalname);

    return res.status(200).json({
      success: true,
      message: `Summary generated and sent to ${email}`,
      meta: {
        filename: originalname,
        rowsProcessed: totalRows,
        messageId: emailResult.messageId,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
