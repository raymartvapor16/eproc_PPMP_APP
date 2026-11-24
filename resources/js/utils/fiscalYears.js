
export const getStandardFiscalYears = (extraYears = []) => {
    const yearsSet = new Set();
    const curYear = new Date().getFullYear();

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

export const sanitizeFiscalYear = (val) => {
    if (!val) return '';
    const str = String(val).trim();
    const match = str.match(/\b(20\d{2}|\d{4})\b/);
    return match ? match[1] : str.replace(/^CY\s*/i, '').trim();
};
