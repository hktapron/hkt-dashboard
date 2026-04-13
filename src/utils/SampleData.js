/**
 * Emergency Sample Data Utility
 * Provides a fallback dataset to keep the UI functional when Google Sheet sync fails.
 */

export const SampleData = {
    /**
     * Minimal Sample Master Data
     */
    getMaster: () => {
        const d = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        return [{ 
            Date: d, 
            Callsign: 'AIQ3160', 
            FLIGHT: '650', 
            FLIGHT_2: '651', 
            'A/C': 'HS-BBC', 
            'SIBT': '08:00',
            'SOBT': '09:00',
            'AIBT': '08:05',
            'AOBT': '09:05',
            'ALDT': '07:55',
            'ATOT': '09:15',
            _otp_arr_points: 3,
            _otp_dep_points: 2,
            _raw: [d, 'AIQ3160', '08:00', '650', 'HS-BBC', '651', '09:00', '', '', '1'] 
        }];
    },

    /**
     * Minimal Sample Movement Logs
     */
    getLogs: () => {
        const d = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
        return [{ 
            Date: d, 
            'Flight In': 'AIQ650', 
            'Flight Out': 'AIQ651', 
            'A/C Type': 'A320', 
            'SIBT': '08:00', 
            'SOBT': '09:00', 
            'Original Bay': '10', 
            'Final Bay': '12', 
            'Bay Reason 1': 'Stand Occ, KS (Sample Data)', 
            _raw: [] 
        }];
    }
};
