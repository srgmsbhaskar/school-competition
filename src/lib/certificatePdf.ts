import jsPDF from 'jspdf';
import certificateTemplate from '@/assets/internal_competition_certificate_template.jpg.asset.json';

export interface WinnerCertificate {
  studentName: string;
  className: string;
  eventName: string;
  prizeName: string;
  competitionName: string;
}

const PAGE_WIDTH = 297;
const PAGE_HEIGHT = PAGE_WIDTH * (1682 / 2380);
const CERTIFICATE_BLUE = [26, 57, 131] as const;

const getTemplateUrl = () => new URL(certificateTemplate.url, window.location.origin).toString();

let templateDataPromise: Promise<string> | null = null;

const loadTemplateData = () => {
  if (!templateDataPromise) {
    templateDataPromise = (async () => {
      const response = await fetch(getTemplateUrl());
      if (!response.ok) throw new Error('The certificate template could not be loaded.');

      const imageBlob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Unable to read certificate template.'));
        reader.onerror = () => reject(new Error('Unable to read certificate template.'));
        reader.readAsDataURL(imageBlob);
      });
    })();
  }
  return templateDataPromise.catch((error: unknown) => {
    templateDataPromise = null;
    throw error;
  });
};

export async function prepareWinnerCertificateDownloads() {
  await loadTemplateData();
}

export const isCertificatePrizeWinner = (prize: string | null): prize is string =>
  prize !== null && prize !== 'participation';

const textWidthFitted = (
  doc: jsPDF,
  text: string,
  maxWidth: number,
  startSize: number,
) => {
  let size = startSize;
  doc.setFont('times', 'bolditalic');
  while (size > 11) {
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxWidth) break;
    size -= 1;
  }
  return size;
};

const createWinnerCertificatePdf = (certificate: WinnerCertificate, imageData: string) => {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [PAGE_WIDTH, PAGE_HEIGHT] });
  doc.addImage(imageData, 'JPEG', 0, 0, PAGE_WIDTH, PAGE_HEIGHT);
  doc.setTextColor(...CERTIFICATE_BLUE);

  const fields = [
    { text: certificate.studentName, x: 148.5, y: 105.6, width: 78, size: 26 },
    { text: certificate.className, x: 94, y: 119.8, width: 45, size: 19 },
    { text: certificate.prizeName, x: 207.8, y: 119.8, width: 47, size: 19 },
    { text: certificate.eventName, x: 144.7, y: 133.7, width: 88, size: 22 },
  ];

  fields.forEach(({ text, x, y, width, size }) => {
    const fittedSize = textWidthFitted(doc, text, width, size);
    doc.setFontSize(fittedSize);
    doc.text(text, x, y, { align: 'center' });
  });

  const safeName = certificate.studentName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'winner';
  const safeEvent = certificate.eventName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'event';
  const safeClass = certificate.className.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'class';
  return { doc, filename: `${safeName}-${safeClass}-${safeEvent}-certificate` };
};

export async function downloadWinnerCertificate(certificate: WinnerCertificate) {
  const imageData = await loadTemplateData();
  const { doc, filename } = createWinnerCertificatePdf(certificate, imageData);
  doc.save(`${filename}.pdf`);
}

export async function downloadWinnerCertificates(certificateList: WinnerCertificate[]) {
  if (certificateList.length === 0) return 0;

  const imageData = await loadTemplateData();
  certificateList.forEach((certificate, index) => {
    const { doc, filename } = createWinnerCertificatePdf(certificate, imageData);
    doc.save(`${filename}-${String(index + 1).padStart(3, '0')}.pdf`);
  });
  return certificateList.length;
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character] ?? character));

export function printWinnerCertificates(certificates: WinnerCertificate[]) {
  if (certificates.length === 0) return false;

  const templateUrl = getTemplateUrl();
  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) return false;

  const pages = certificates.map((certificate) => `
    <main class="page"><section class="certificate">
      <img class="template" src="${escapeHtml(templateUrl)}" alt="Certificate template">
      <div class="field student">${escapeHtml(certificate.studentName)}</div>
      <div class="field class">${escapeHtml(certificate.className)}</div>
      <div class="field prize">${escapeHtml(certificate.prizeName)}</div>
      <div class="field event">${escapeHtml(certificate.eventName)}</div>
    </section></main>`).join('');

  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html><head><title>Winner Certificates</title>
    <style>
      @page { size: A4 landscape; margin: 0; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      .page { width: 297mm; height: 210mm; display: flex; align-items: center; justify-content: center; page-break-after: always; }
      .page:last-child { page-break-after: auto; }
      .certificate { width: 297mm; height: 209.82mm; position: relative; overflow: hidden; color: #1a3983; font-family: Georgia, 'Times New Roman', serif; font-weight: 700; font-style: italic; text-align: center; }
      .template { position: absolute; inset: 0; width: 100%; height: 100%; }
      .field { position: absolute; transform: translate(-50%, -50%); line-height: 1.1; overflow-wrap: anywhere; }
      .student { left: 50%; top: calc(52.7% - 5mm); width: 27%; font-size: 5.2mm; }
      .class { left: 31.65%; top: calc(59.5% - 5mm); width: 15.2%; font-size: 4.2mm; }
      .prize { left: 69.97%; top: calc(59.5% - 5mm); width: 15.8%; font-size: 4.2mm; }
      .event { left: 48.72%; top: calc(65.3% - 5mm); width: 29.7%; font-size: 4.8mm; }
      @media screen { body { background: #f2f2f2; } .page { margin: 12px auto; background: white; box-shadow: 0 1px 5px #777; } }
      @media print { .page { box-shadow: none; } }
    </style></head><body>${pages}
    <script>window.onload = () => { window.focus(); setTimeout(() => window.print(), 350); };</script>
    </body></html>`);
  printWindow.document.close();
  return true;
}