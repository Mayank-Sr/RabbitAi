const { GoogleGenerativeAI } = require('@google/generative-ai');

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured.');
  return new GoogleGenerativeAI(apiKey);
};

const computeStats = (rows) => {
  const stats = {
    totalRows: rows.length,
    columns: rows.length > 0 ? Object.keys(rows[0]) : [],
    numericSummary: {},
  };

  if (rows.length === 0) return stats;

  const numericCols = stats.columns.filter(col =>
    rows.some(r => typeof r[col] === 'number')
  );

  numericCols.forEach(col => {
    const vals = rows.map(r => r[col]).filter(v => typeof v === 'number');
    if (vals.length === 0) return;
    stats.numericSummary[col] = {
      sum: vals.reduce((a, b) => a + b, 0).toFixed(2),
      avg: (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2),
      min: Math.min(...vals),
      max: Math.max(...vals),
      count: vals.length,
    };
  });

  // Categorical summaries
  const catCols = stats.columns.filter(col => !numericCols.includes(col));
  stats.categoricalSummary = {};
  catCols.forEach(col => {
    const counts = {};
    rows.forEach(r => {
      const val = String(r[col] ?? 'N/A');
      counts[val] = (counts[val] || 0) + 1;
    });
    stats.categoricalSummary[col] = counts;
  });

  return stats;
};

const generateSummary = async (rows, filename) => {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const stats = computeStats(rows);
  const sampleRows = rows.slice(0, 20);

  const prompt = `You are a senior business analyst preparing an executive briefing. Analyze the following sales data and produce a professional, insightful narrative summary.

**File:** ${filename}
**Total Records:** ${stats.totalRows}
**Columns:** ${stats.columns.join(', ')}

**Statistical Summary:**
${JSON.stringify(stats.numericSummary, null, 2)}

**Category Breakdown:**
${JSON.stringify(stats.categoricalSummary, null, 2)}

**Sample Records (first 20):**
${JSON.stringify(sampleRows, null, 2)}

**Instructions:**
- Write a polished executive summary (300-500 words)
- Use HTML formatting with headings, bullet points, and bold key figures
- Include: Key Performance Highlights, Regional/Category Breakdown, Trends & Anomalies, and Strategic Recommendations
- Present revenue figures with proper formatting (e.g., $180,000)
- Be specific and data-driven, not generic
- Start with an <h2> tag for "Sales Performance Summary"`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
};

module.exports = { generateSummary };
