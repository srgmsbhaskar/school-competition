/**
 * Academic year helpers (April 1 → March 31 cycle).
 * Non-admin users only see data from the current (unfrozen) academic year.
 */

export function getAcademicYearRange(academicYear: string): { start: string; end: string } {
  const [startYear] = academicYear.split('-').map(Number);
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

/**
 * Apply academic-year date range to a Supabase query on competitions.competition_date
 * for all non-admin roles. Admins see every year (including frozen ones).
 */
export function scopeToAcademicYear<T>(
  query: T,
  role: string | null,
  academicYear: string,
  column = 'competition_date',
): T {
  if (role === 'admin') return query;
  const { start, end } = getAcademicYearRange(academicYear);
  // @ts-expect-error - Supabase query builder methods are chainable
  return query.gte(column, start).lte(column, end);
}

/**
 * Always restrict a Supabase query to the current academic year regardless of role.
 * Use for dropdown selectors where only the active year is relevant (creation,
 * student selection, prize award, teacher assignment, etc.).
 */
export function forceAcademicYear<T>(
  query: T,
  academicYear: string,
  column = 'competition_date',
): T {
  const { start, end } = getAcademicYearRange(academicYear);
  // @ts-expect-error - Supabase query builder methods are chainable
  return query.gte(column, start).lte(column, end);
}