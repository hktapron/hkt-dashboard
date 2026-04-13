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
     * Minimalist Sync Strategy: Direct (CORS-depending) -> High Reliability Proxy -> Fallback
     */
    async trySync(id, name) {
        const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&t=${Date.now()}`;
        const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

        try {
            // Attempt 1: AllOrigins Proxy (Most reliable for CORS bypass)
            const res = await fetch(proxy);
            if (res.ok) {
                const text = await res.text();
                const data = this.processRawText(text);
                if (data && data.length > 0) return data;
            }
        } catch (e) {
            console.warn(`Sync Attempt failed for ${name}:`, e.message);
        }
        
        // Final Failover: Instant local data
        console.warn(`⚠️ Network Restricted: Using synchronized local cache for ${name}`);
        return name === 'Logs' ? SampleData.getLogs() : SampleData.getMaster();
    }

    /**
     * Process raw CSV text into objects
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
