import { afterEach, describe, expect, it, vi } from 'vitest';

const savedFilenames = vi.hoisted((): string[] => []);

vi.mock('jspdf', () => ({
  default: class {
    addImage() {}
    setTextColor() {}
    setFont() {}
    setFontSize() {}
    getTextWidth(text: string) { return text.length; }
    text() {}
    save(filename: string) { savedFilenames.push(filename); }
  },
}));

import { downloadWinnerCertificates, filterWinnerRows, isCertificatePrizeWinner, type WinnerCertificate } from '@/lib/certificatePdf';

afterEach(() => {
  savedFilenames.length = 0;
  vi.unstubAllGlobals();
});

describe('certificate prize eligibility', () => {
  it('includes recorded prize winners and excludes participation entries', () => {
    expect(isCertificatePrizeWinner('first')).toBe(true);
    expect(isCertificatePrizeWinner('second')).toBe(true);
    expect(isCertificatePrizeWinner('participation')).toBe(false);
    expect(isCertificatePrizeWinner(null)).toBe(false);
  });
});

describe('winner certificate filters and bulk downloads', () => {
  it('keeps only winners matching the selected competition and class', () => {
    const rows = [
      { id: 'one', competition_id: 'competition-a', student: { class: 5 } },
      { id: 'two', competition_id: 'competition-a', student: { class: 6 } },
      { id: 'three', competition_id: 'competition-b', student: { class: 5 } },
    ];

    expect(filterWinnerRows(rows, 'competition-a', '5').map((row) => row.id)).toEqual(['one']);
    expect(filterWinnerRows(rows, 'competition-a', 'all').map((row) => row.id)).toEqual(['one', 'two']);
    expect(filterWinnerRows(rows, '', 'all')).toEqual([]);
  });

  it('saves one separately named PDF for every matching winner', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['certificate template'], { type: 'image/jpeg' }),
    }));
    const progress: Array<[number, number]> = [];
    const winners: WinnerCertificate[] = [
      { studentName: 'Asha Rao', className: '5-A', eventName: 'Chess', prizeName: 'FIRST', competitionName: 'Annual Meet' },
      { studentName: 'Ravi Kumar', className: '5-B', eventName: 'Chess', prizeName: 'SECOND', competitionName: 'Annual Meet' },
    ];

    const count = await downloadWinnerCertificates(winners, (completed, total) => progress.push([completed, total]));

    expect(count).toBe(2);
    expect(savedFilenames).toEqual([
      'Asha-Rao-5-A-Chess-certificate-001.pdf',
      'Ravi-Kumar-5-B-Chess-certificate-002.pdf',
    ]);
    expect(progress).toEqual([[1, 2], [2, 2]]);
  });
});