/**
 * Global Configuration & Sensitive Identifiers
 * Keep this file separate to manage security and public hosting.
 */

// Placeholder for obfuscation or environment-based proxying
export const CONFIG = {
    SHEET_1_ID: '1WJK93iDvj96QcZX2z_R7rDbRo1Fn3_NdQfjSl9v6vFA', 
    SHEET_2_ID: '1TF8Oy8tPfw-O_J4WZB2eveekNUEbu2w5U0Wc36THVEI',
    MIN_OTP_FLIGHTS: 3,
    THEME_STORAGE_KEY: 'theme',
    CHART_COLORS: {
        INDIGO: '#4f46e5',
        INDIGO_SOFT: '#4f46e566',
        INDIGO_LIGHT: '#6366f1',
        GOLD_START: '#fde68a',
        GOLD_END: '#d97706',
        DANGER: '#f43f5e',
        MUTED: '#71717a'
    }
};

export const getCsvUrl = (id) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`)}`;
