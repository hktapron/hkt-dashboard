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
     * Fastest response wins; if all fail or timeout (4s), returns null (to trigger fallback in caller).
     */
    async trySync(id, name) {
        const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&t=${Date.now()}`;
        const proxies = [
            base,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(base)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`
        ];

        // Abort controller for the whole race
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s absolute limit

        try {
            // Attempt all proxies in parallel
            const promises = proxies.map(url => 
                fetch(url, { signal: controller.signal })
                    .then(async res => {
                        if (!res.ok) throw new Error('Proxy fail');
                        const text = await res.text();
                        const data = this.processRawText(text);
                        if (!data || data.length === 0) throw new Error('Empty data');
                        return data;
                    })
            );

            // Promise.any: Return as soon as ANY promise fulfills
            // Using a loop-based race fallback for environments without Promise.any
            const winner = await (Promise.any ? Promise.any(promises) : Promise.race(promises));
            return winner;

        } catch (e) {
            console.warn(`Parallel sync failed for ${name}: Using emergency fallback.`);
            return name === 'Logs' ? SampleData.getLogs() : SampleData.getMaster();
        } finally {
            clearTimeout(timeout);
            controller.abort(); // Cancel remaining requests
        }
    }

    /**
     * Helper to process raw CSV text from proxies
     */
    processRawText(text) {
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
            return Validator.sanitizeRecord(obj);
        }).filter(Boolean);
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
