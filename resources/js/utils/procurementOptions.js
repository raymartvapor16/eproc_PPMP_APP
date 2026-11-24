
export const BASE_DELIVERY_PERIODS = [
    'Date of Activity',
    'As Per Demand by the End-User',
    'Staggered Delivery based on the latest fuel pump price /At Gasoline Station',
    "1st Delivery 10 calendar days upon receipt of P.O\n-Succeeding deliveries: upon request of the end-user or as per empty gallon",
    'On the Schedule date',
    '30 Calendar Days upon receipt of PO',
    '15 Calendar Days upon receipt of PO',
    '7 Calendar Days upon receipt of PO',
    'As scheduled',
];

export const BASE_PLACES_OF_DELIVERY = [
    'PGSO Warehouse/On-site',
    'At Gasoline Station',
];

export const BASE_PAYMENT_METHODS = [
    'Staggered Delivery/Credit-basis',
    'Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.',
    'Staggered Payment/Credit-basis',
    'One-time Payment/cash-basis',
    'One-time Payment/Credit-basis',
];

const normalizeBasic = (str) => {
    if (!str || typeof str !== 'string') return '';
    return str
        .toLowerCase()
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[\-–—]/g, '-')
        .replace(/\s*\/\s*/g, '/')
        .replace(/\s*-\s*/g, '-')
        .trim();
};

export const canonicalizeDeliveryPeriod = (val) => {
    return normalizeBasic(val);
};

export const canonicalizePlaceOfDelivery = (val) => {
    const norm = normalizeBasic(val);

    if (norm.includes('pgso') && norm.includes('warehouse') && (norm.includes('site') || norm.includes('on-site'))) {
        return 'pgso warehouse/on-site';
    }
    return norm;
};

export const canonicalizePaymentMethod = (val) => {
    const norm = normalizeBasic(val);
    if (norm.includes('one-time') && norm.includes('credit')) {
        return 'one-time payment/credit-basis';
    }
    return norm;
};

export const deduplicateOptions = (pool = [], canonicalizeFn = normalizeBasic) => {
    const seen = new Set();
    const result = [];

    (pool || []).forEach(item => {
        if (!item || typeof item !== 'string' || !item.trim()) return;
        const trimmed = item.trim();
        const canon = canonicalizeFn(trimmed);
        if (!canon) return;
        if (!seen.has(canon)) {
            seen.add(canon);
            result.push(trimmed);
        }
    });

    return result;
};

export const findMatchingOption = (val, optionsList = [], canonicalizeFn = normalizeBasic) => {
    if (!val || typeof val !== 'string' || !val.trim()) return null;
    const canonTarget = canonicalizeFn(val.trim());
    const match = optionsList.find(opt => canonicalizeFn(opt) === canonTarget);
    return match || null;
};

export const isDateScheduleString = (val) => {
    if (!val || typeof val !== 'string') return false;
    const trimmed = val.trim();
    return /^\d{1,2}\/\d{4}(\s*-\s*\d{1,2}\/\d{4})?$/.test(trimmed) || /^\d{4}-\d{2}(\s*-\s*\d{4}-\d{2})?$/.test(trimmed);
};
