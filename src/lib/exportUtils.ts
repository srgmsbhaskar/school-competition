import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface ExportColumn {
  header: string;
  key: string;
}

export type ExportData = Record<string, string | number | null | undefined>;

export type PageSize = 'a4' | 'legal';

const SCHOOL_NAME = 'SRI VAGEESHA VIDHYASHARAM SENIOR SECONDARY SCHOOL - SRIRANGAM';

export const exportToPDF = (
  data: ExportData[],
  columns: ExportColumn[],
  title: string,
  filename: string,
  pageSize: PageSize = 'a4'
) => {
  const format = pageSize === 'legal' ? [216, 356] : 'a4';
  const doc = new jsPDF({ format: format as any });
  
  // School header
  let yPosition = 12;
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(SCHOOL_NAME, doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
  yPosition += 8;

  // Handle multi-line titles
  const titleLines = title.split('\n');
  
  // Main title
  doc.setFontSize(14);
  doc.text(titleLines[0], doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
  yPosition += 7;
  
  // Additional title lines (competition details)
  if (titleLines.length > 1) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    for (let i = 1; i < titleLines.length; i++) {
      doc.text(titleLines[i], doc.internal.pageSize.getWidth() / 2, yPosition, { align: 'center' });
      yPosition += 6;
    }
  }
  
  // Generated date
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
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
  
  const needsQuoting = /[,"\n\r]/.test(stringValue) || 
    /^[=+\-@\t\r]/.test(stringValue);
  
  if (needsQuoting) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
};

/**
 * Export data to CSV format with school header
 */
export const exportToCSV = (
  data: ExportData[],
  columns: ExportColumn[],
  filename: string,
  title?: string
) => {
  const rows: string[] = [];

  // Add school header and title
  rows.push(escapeCSVField(SCHOOL_NAME));
  if (title) {
    const titleLines = title.split('\n');
    titleLines.forEach((line) => rows.push(escapeCSVField(line)));
  }
  rows.push(`Generated on: ${new Date().toLocaleDateString()}`);
  rows.push(''); // blank row

  // Create header row
  const headers = columns.map((col) => escapeCSVField(col.header));
  rows.push(headers.join(','));
  
  // Create data rows
  data.forEach((item) => {
    rows.push(columns.map((col) => escapeCSVField(item[col.key])).join(','));
  });
  
  const csvContent = rows.join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Legacy export function for backwards compatibility
 */
export const exportToExcel = (
  data: ExportData[],
  columns: ExportColumn[],
  _sheetName: string,
  filename: string,
  title?: string
) => {
  exportToCSV(data, columns, filename, title);
};
