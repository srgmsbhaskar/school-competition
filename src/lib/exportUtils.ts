import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
}

export type ExportData = Record<string, string | number | null | undefined>;

export const exportToPDF = (
  data: ExportData[],
  columns: ExportColumn[],
  title: string,
  filename: string
) => {
  const doc = new jsPDF();
  
  // Handle multi-line titles
  const titleLines = title.split('\n');
  let yPosition = 15;
  
  // Main title
  doc.setFontSize(16);
  doc.text(titleLines[0], 14, yPosition);
  yPosition += 7;
  
  // Additional title lines (competition details)
  if (titleLines.length > 1) {
    doc.setFontSize(12);
    for (let i = 1; i < titleLines.length; i++) {
      doc.text(titleLines[i], 14, yPosition);
      yPosition += 6;
    }
  }
  
  // Generated date
  doc.setFontSize(10);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, yPosition);
  yPosition += 6;

  // Prepare table data
  const headers = columns.map((col) => col.header);
  const rows = data.map((item) =>
    columns.map((col) => {
      const value = item[col.key];
      return value !== null && value !== undefined ? String(value) : '—';
    })
  );

  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: yPosition + 2,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save(`${filename}.pdf`);
};

/**
 * Escape a CSV field value to prevent CSV injection and handle special characters
 */
const escapeCSVField = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  // Check if the value needs quoting (contains comma, newline, quote, or starts with dangerous chars)
  const needsQuoting = /[,"\n\r]/.test(stringValue) || 
    /^[=+\-@\t\r]/.test(stringValue);
  
  if (needsQuoting) {
    // Escape quotes by doubling them and wrap in quotes
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
};

/**
 * Export data to CSV format (safer alternative to xlsx library)
 */
export const exportToCSV = (
  data: ExportData[],
  columns: ExportColumn[],
  filename: string
) => {
  // Create header row
  const headers = columns.map((col) => escapeCSVField(col.header));
  const headerRow = headers.join(',');
  
  // Create data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => escapeCSVField(item[col.key]))
      .join(',');
  });
  
  // Combine all rows
  const csvContent = [headerRow, ...rows].join('\n');
  
  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Legacy export function for backwards compatibility
 * Now exports to CSV instead of XLSX for security
 */
export const exportToExcel = (
  data: ExportData[],
  columns: ExportColumn[],
  _sheetName: string,
  filename: string
) => {
  // Export to CSV instead of XLSX to avoid security vulnerabilities
  exportToCSV(data, columns, filename);
};
