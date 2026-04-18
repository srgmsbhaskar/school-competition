import { z } from 'zod';

// Constants
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_ROWS = 10000;

// Schema for student row validation
export const studentRowSchema = z.object({
  s_no: z.number().int().positive('Serial number must be a positive integer'),
  admission_no: z
    .string()
    .min(1, 'Admission number is required')
    .max(50, 'Admission number too long')
    .regex(/^[A-Za-z0-9\-_]+$/, 'Admission number can only contain letters, numbers, hyphens, and underscores'),
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name too long')
    .regex(/^[A-Za-z\s.\-']+$/, 'Name contains invalid characters'),
  dob: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .refine((date) => {
      const parsed = new Date(date);
      const minDate = new Date('1990-01-01');
      const maxDate = new Date();
      return parsed >= minDate && parsed <= maxDate;
    }, 'Date of birth must be between 1990 and today'),
  class: z.number().int().min(1).max(12, 'Class must be between 1 and 12'),
  section: z
    .string()
    .min(1, 'Section is required')
    .max(5, 'Section too long')
    .regex(/^[A-Za-z0-9]+$/, 'Section can only contain letters and numbers'),
});

export type ValidatedStudentRow = z.infer<typeof studentRowSchema>;

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ParseResult {
  validRows: ValidatedStudentRow[];
  errors: ValidationError[];
  totalRows: number;
}

/**
 * Sanitize CSV field to prevent CSV injection attacks
 * Removes leading characters that could be interpreted as formulas
 */
export function sanitizeCSVField(value: string): string {
  if (!value) return '';
  
  // Trim whitespace
  let sanitized = value.trim();
  
  // Remove leading characters that could trigger formula execution
  // These include: =, +, -, @, |, %, and tab/carriage return
  const dangerousChars = ['=', '+', '-', '@', '|', '%', '\t', '\r', '\n'];
  
  while (sanitized.length > 0 && dangerousChars.includes(sanitized[0])) {
    sanitized = sanitized.substring(1).trim();
  }
  
  // Remove any embedded dangerous sequences
  sanitized = sanitized.replace(/[\x00-\x1F]/g, ''); // Remove control characters
  
  return sanitized;
}

/**
 * Parse and validate CSV content
 */
export function parseAndValidateCSV(
  text: string,
  selectedClass: number
): ParseResult {
  const lines = text.trim().split('\n');
  
  if (lines.length < 2) {
    return {
      validRows: [],
      errors: [{ row: 0, field: 'file', message: 'CSV file must have a header row and at least one data row' }],
      totalRows: 0,
    };
  }
  
  // Check row count
  if (lines.length - 1 > MAX_ROWS) {
    return {
      validRows: [],
      errors: [{ row: 0, field: 'file', message: `CSV file exceeds maximum of ${MAX_ROWS} rows` }],
      totalRows: lines.length - 1,
    };
  }
  
  const headers = lines[0].toLowerCase().split(',').map(h => sanitizeCSVField(h));
  const validRows: ValidatedStudentRow[] = [];
  const errors: ValidationError[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines
    
    const values = line.split(',').map(v => sanitizeCSVField(v));
    
    if (values.length < 5) {
      errors.push({
        row: i + 1,
        field: 'row',
        message: 'Row has insufficient columns (need at least 5)',
      });
      continue;
    }
    
    // Extract values based on headers or position
    const sNoStr = values[headers.indexOf('s no')] || values[headers.indexOf('sno')] || values[0];
    const admissionNo = values[headers.indexOf('admission no')] || values[headers.indexOf('admission_no')] || values[1];
    const name = values[headers.indexOf('name')] || values[2];
    const dob = values[headers.indexOf('dob')] || values[headers.indexOf('date of birth')] || values[3];
    const section = values[headers.indexOf('sec')] || values[headers.indexOf('section')] || values[4];
    
    // Parse s_no with fallback to row index
    const s_no = parseInt(sNoStr) || i;
    
    // Validate the row
    const rowData = {
      s_no,
      admission_no: admissionNo,
      name,
      dob,
      class: selectedClass,
      section,
    };
    
    const result = studentRowSchema.safeParse(rowData);
    
    if (result.success) {
      validRows.push(result.data);
    } else {
      result.error.errors.forEach((err) => {
        errors.push({
          row: i + 1,
          field: err.path.join('.') || 'unknown',
          message: err.message,
        });
      });
    }
  }
  
  return {
    validRows,
    errors,
    totalRows: lines.length - 1,
  };
}

/**
 * Parse and validate rows already extracted from a spreadsheet (XLSX/XLS)
 * Each row is an array of cell values in column order: S No, Admission No, Name, DOB, Section
 */
export function parseAndValidateRows(
  rows: (string | number | null | undefined)[][],
  selectedClass: number
): ParseResult {
  if (!rows || rows.length < 2) {
    return {
      validRows: [],
      errors: [{ row: 0, field: 'file', message: 'File must have a header row and at least one data row' }],
      totalRows: 0,
    };
  }

  if (rows.length - 1 > MAX_ROWS) {
    return {
      validRows: [],
      errors: [{ row: 0, field: 'file', message: `File exceeds maximum of ${MAX_ROWS} rows` }],
      totalRows: rows.length - 1,
    };
  }

  const headers = (rows[0] || []).map((h) => sanitizeCSVField(String(h ?? '')).toLowerCase());
  const idx = (names: string[]) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const sNoIdx = idx(['s no', 'sno', 's.no', 's_no']);
  const admIdx = idx(['admission no', 'admission_no', 'admission']);
  const nameIdx = idx(['name']);
  const dobIdx = idx(['dob', 'date of birth']);
  const secIdx = idx(['sec', 'section']);

  const validRows: ValidatedStudentRow[] = [];
  const errors: ValidationError[] = [];

  // Helper to convert Excel serial date or string to YYYY-MM-DD
  const normalizeDate = (val: unknown): string => {
    if (val == null || val === '') return '';
    if (typeof val === 'number') {
      // Excel serial date: days since 1899-12-30
      const ms = Math.round((val - 25569) * 86400 * 1000);
      const d = new Date(ms);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    const s = String(val).trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD/MM/YYYY or DD-MM-YYYY
    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (m) {
      const dd = m[1].padStart(2, '0');
      const mm = m[2].padStart(2, '0');
      let yyyy = m[3];
      if (yyyy.length === 2) yyyy = (parseInt(yyyy) > 50 ? '19' : '20') + yyyy;
      return `${yyyy}-${mm}-${dd}`;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return s;
  };

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;

    const get = (i2: number, fallback: number) => {
      const raw = i2 !== -1 ? row[i2] : row[fallback];
      return sanitizeCSVField(String(raw ?? ''));
    };

    const sNoStr = get(sNoIdx, 0);
    const admission_no = get(admIdx, 1);
    const name = get(nameIdx, 2);
    const dobRaw = dobIdx !== -1 ? row[dobIdx] : row[3];
    const dob = normalizeDate(dobRaw);
    const section = get(secIdx, 4);

    const s_no = parseInt(sNoStr) || i;

    const result = studentRowSchema.safeParse({
      s_no,
      admission_no,
      name,
      dob,
      class: selectedClass,
      section,
    });

    if (result.success) {
      validRows.push(result.data);
    } else {
      result.error.errors.forEach((err) => {
        errors.push({
          row: i + 1,
          field: err.path.join('.') || 'unknown',
          message: err.message,
        });
      });
    }
  }

  return { validRows, errors, totalRows: rows.length - 1 };
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected' };
  }
  
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
    return { valid: false, error: 'File must be an Excel file (.xlsx or .xls)' };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
    };
  }
  
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }
  
  return { valid: true };
}
