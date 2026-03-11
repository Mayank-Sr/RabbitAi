const Papa = require('papaparse');
const XLSX = require('xlsx');

const parseCSV = (buffer) => {
  const text = buffer.toString('utf-8');
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: true,
  });

  if (result.errors.length > 0) {
    const fatal = result.errors.filter(e => e.type === 'Delimiter' || e.type === 'Quotes');
    if (fatal.length > 0) throw new Error('CSV parsing failed: ' + fatal[0].message);
  }

  return result.data;
};

const parseXLSX = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('No sheets found in Excel file.');
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: null });
};

const parseFile = (buffer, mimetype, originalname) => {
  const ext = originalname.split('.').pop().toLowerCase();

  if (ext === 'csv' || mimetype === 'text/csv') {
    return parseCSV(buffer);
  }

  if (['xlsx', 'xls'].includes(ext) || mimetype.includes('spreadsheet') || mimetype.includes('excel')) {
    return parseXLSX(buffer);
  }

  throw new Error('Unsupported file type. Please upload a .csv or .xlsx file.');
};

const sanitizeData = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('File contains no data rows.');
  }
  if (rows.length > 10000) {
    throw new Error('File too large. Maximum 10,000 rows allowed.');
  }
  // Return summary stats + sample rows to avoid huge prompts
  const sample = rows.slice(0, 50);
  return { totalRows: rows.length, sample, allRows: rows };
};

module.exports = { parseFile, sanitizeData };
