/**
 * Strict Data Validation Logic
 * Ensures HKT Analytics integrity against user-editable Google Sheets data.
 */

export const Validator = {
    /**
     * Checks if a flight number is valid
     */
    isValidFlight: (v) => {
        const flightRegex = /^[A-Z0-9]{2,4}\s?\d{1,4}[A-Z]?$/i;
        return v && v.length > 1 && flightRegex.test(v.trim());
    },

    /**
     * Validates a time string (HH:MM)
     */
    isValidTime: (timeStr) => {
        if (!timeStr) return false;
        const trimmed = timeStr.trim();
        return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(trimmed);
    },

    /**
     * Validates a date object or raw date string
     */
    isValidDate: (dateStr) => {
        if (!dateStr) return false;
        const d = new Date(dateStr);
        return d instanceof Date && !isNaN(d);
    },

    /**
     * Sanitizes movement record
     */
    sanitizeRecord: (r) => {
        // Essential fields check - Support multiple naming conventions
        const flt = r['Flight In'] || r['FLIGHT'] || r['FLT'] || r['Flight'];
        const stand = r['Final Bay'] || r['Stand'] || r['Original Bay'] || r['Bay'];

        // If no identifying flight or stand info, ignore record
        if (!flt && !stand) return null;
        
        // Ensure numeric consistency for duration fields if they exist
        const numericFields = ['GroundTime', 'TaxiIn', 'TaxiOut'];
        numericFields.forEach(f => {
            if (r[f]) r[f] = parseInt(r[f]) || 0;
        });

        // Add standardized helper keys for components
        r._standard_flt = flt || '-';
        r._standard_stand = stand || '-';

        return r;
    }
};
