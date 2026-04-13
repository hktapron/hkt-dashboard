/**
 * Global Utility Helpers
 * Dedicated to time/date manipulation and mathematical offsets.
 */

export const Helpers = {
    /**
     * Accurate Date/Time parsing for M/D/Y vs D/M/Y
     */
    getRecordDate: (rawDate) => {
        if (!rawDate) return null;
        const p = rawDate.split(/[/-]/).map(s => s.trim());
        if (p.length < 3) return null;
        
        let m, d, y;
        const p0 = parseInt(p[0]);
        const p1 = parseInt(p[1]);
        const p2 = p[2];

        if (p0 > 12) {
            d = p0; m = p1;
        } else if (p1 > 12) {
            m = p0; d = p1;
        } else {
            m = p0; d = p1; // Default fallback
        }
        
        const mStr = String(m).padStart(2, '0');
        const dStr = String(d).padStart(2, '0');
        const yStr = p2.length === 2 ? `20${p2}` : p2;
        
        return { 
            iso: `${yStr}-${mStr}-${dStr}`, 
            monthKey: `${mStr}-${yStr}`, 
            day: d, 
            month: m, 
            year: parseInt(yStr) 
        };
    },

    /**
     * Parses HH:MM with optional Day Offset (+1, -1)
     */
    parseTimeWithDay: (timeStr) => {
        if (!timeStr) return null;
        const [time, offset] = timeStr.trim().split(/\s+/);
        const [h, m] = time.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return null;
        
        let dayOffset = 0;
        if (offset === '+1') dayOffset = 1;
        else if (offset === '-1') dayOffset = -1;
        
        return { hours: h, minutes: m, offset: dayOffset };
    },

    /**
     * Calculates absolute difference in minutes between two time strings
     */
    getDelayMinutes: (actual, scheduled) => {
        const a = Helpers.parseTimeWithDay(actual);
        const s = Helpers.parseTimeWithDay(scheduled);
        if (!a || !s) return null;
        
        let aTotal = (a.hours * 60) + a.minutes + (a.offset * 1440);
        let sTotal = (s.hours * 60) + s.minutes + (s.offset * 1440);
        
        return aTotal - sTotal;
    }
};
