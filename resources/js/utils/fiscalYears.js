/**
 * Utility to generate and provide a dynamic, complete set of fiscal years for filters and options.
 * Combines a rolling dynamic window around current year (e.g. current year - 3 to current year + 4)
 * with any custom/existing years present in the dataset, sorted descending.
 */
export const getStandardFiscalYears = (extraYears = []) => {
    const yearsSet = new Set();
    const curYear = new Date().getFullYear();

    // Standard rolling window: 4 years into future, 3 years into past
    // e.g. for 2026: 2030, 2029, 2028, 2027, 2026, 2025, 2024, 2023
    for (let y = curYear + 4; y >= curYear - 3; y--) {
        yearsSet.add(String(y));
    }

    if (Array.isArray(extraYears)) {
        extraYears.forEach((y) => {
            if (y !== null && y !== undefined && String(y).trim() !== '') {
                const str = String(y).trim();
                const match = str.match(/\b(20\d{2}|\d{4})\b/);
                if (match) {
                    yearsSet.add(match[1]);
                } else {
                    const clean = str.replace(/^CY\s*/i, '').trim();
                    if (clean) yearsSet.add(clean);
                }
            }
        });
    }

    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
};

/**
 * Clean and extract a 4-digit fiscal year from arbitrary user input.
 * e.g. "CY 2028" -> "2028", "2028" -> "2028"
 */
export const sanitizeFiscalYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    const match = str.match(/\b(20\d{2}|\d{4})\b/);
    return match ? match[1] : str.replace(/^CY\s*/i, '').trim();
};
