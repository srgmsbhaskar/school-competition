import { describe, expect, it } from 'vitest';
import { isCertificatePrizeWinner } from '@/lib/certificatePdf';

describe('certificate prize eligibility', () => {
  it('includes recorded prize winners and excludes participation entries', () => {
    expect(isCertificatePrizeWinner('first')).toBe(true);
    expect(isCertificatePrizeWinner('second')).toBe(true);
    expect(isCertificatePrizeWinner('participation')).toBe(false);
    expect(isCertificatePrizeWinner(null)).toBe(false);
  });
});