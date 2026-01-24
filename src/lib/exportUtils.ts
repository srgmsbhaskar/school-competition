import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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

export const exportToExcel = (
  data: ExportData[],
  columns: ExportColumn[],
  sheetName: string,
  filename: string
) => {
  // Transform data to use column headers
  const exportData = data.map((item) => {
    const row: Record<string, string | number | null | undefined> = {};
    columns.forEach((col) => {
      row[col.header] = item[col.key];
    });
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};
