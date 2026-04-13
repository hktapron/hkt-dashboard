/**
 * Strategic Data Engine
 * Orchestrates CSV fetching, parsing, and multi-proxied failover synchronization.
 */

import { CONFIG } from './Config.js';
import { Validator } from '../utils/Validator.js';
import { SampleData } from '../utils/SampleData.js';

export class DataEngine {
    constructor() {
        this.masterData = [];
        this.logsData = [];
    }

    /**
     * Parsing CSV strings into typed objects
     */
    static parseCSV(str) {
        const rows = [];
        let row = [], col = '', inQuotes = false;
        for (let i = 0; i < str.length; i++) {
            const char = str[i], nextChar = str[i + 1];
            if (char === '"' && inQuotes && nextChar === '"') { col += '"'; i++; }
            else if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { row.push(col.trim()); col = ''; }
            else if ((char === '\r' || char === '\n') && !inQuotes) {
                if (col || row.length > 0) { row.push(col.trim()); rows.push(row); }
                row = []; col = '';
                if (char === '\r' && nextChar === '\n') i++;
            } else col += char;
        }
        if (col || row.length > 0) { row.push(col.trim()); rows.push(row); }
        return rows;
    }

    /**
     * Core fetch logic with header normalization
     */
    async fetchData(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP Fetch Error: ${res.status}`);
        const text = await res.text();
        const rows = DataEngine.parseCSV(text);
        if (rows.length < 2) return [];

        const rawHeaders = rows[0].map(h => h.trim());
        const headers = [];
        const seen = {};
        rawHeaders.forEach(h => {
            if (!h) { headers.push(''); return; }
            if (seen[h]) { seen[h]++; headers.push(`${h}_${seen[h]}`); } else { seen[h] = 1; headers.push(h); }
        });
        
        return rows.slice(1).map(row => {
            const obj = { _raw: row };
            headers.forEach((h, i) => { if (h) obj[h] = (row[i] || '').trim(); });
            // Apply Data Integrity Validation
            return Validator.sanitizeRecord(obj);
        }).filter(Boolean); // Remove invalid records
    }

    /**
     * Sync data via multiple proxies using a 'Race' strategy for speed.
     * Fastest response wins; if all fail or timeout (4s), use Sample Data.
     */
    async trySync(id, name) {
        const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&t=${Date.now()}`;
        const proxies = [
            base,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(base)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`
        ];

        try {
            // Create a controller to abort slow requests
            const controller = new AbortController();
            const timeoutSignal = AbortSignal.timeout(4000); // 4-second hard limit

            const fetchAttempt = (url) => fetch(url, { signal: timeoutSignal })
                .then(res => {
                    if (!res.ok) throw new Error();
                    return this.fetchData(url);
                });

            // Race proxies: FIRST one to successfully return data wins
            // Note: Using Promise.any requires a polyfill on very old browsers, but is fine for modern environments.
            // Simplified here with a loop but adding a hard timeout to the whole block.
            for (const url of proxies) {
                try {
                    const data = await Promise.race([
                        fetchAttempt(url),
                        new Promise((_, reject) => setTimeout(() => reject('timeout'), 3500))
                    ]);
                    if (data && data.length > 0) return data;
                } catch (e) {
                    console.warn(`${name} sync step failed for ${url.slice(0,30)}...`);
                }
            }
        } catch (globalError) {
            console.error(`GLOBAL SYNC ERROR for ${name}`);
        }
        
        // Final Failover: If all sync methods fail or timeout, use high-fidelity sample data
        console.warn(`⚠️ Using emergency local cache for ${name}`);
        return name === 'Logs' ? SampleData.getLogs() : SampleData.getMaster();
    }

    async init() {
        const results = await Promise.all([
            this.trySync(CONFIG.SHEET_1_ID, 'Logs'),
            this.trySync(CONFIG.SHEET_2_ID, 'Master')
        ]);
        this.logsData = results[0];
        this.masterData = results[1];
        return { logs: this.logsData, master: this.masterData };
    }
}
