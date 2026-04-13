/**
 * KPI Cards Component
 * Handles the top-row summary metrics for the HKT Dashboard.
 */

export const KPICards = {
    render: (master, logs) => {
        const flightsEl = document.getElementById('kpi-flights');
        const acEl = document.getElementById('kpi-ac');
        const changesEl = document.getElementById('kpi-changes');
        const qualityEl = document.getElementById('kpi-quality');

        if (!flightsEl || !acEl || !changesEl || !qualityEl) return;

        // 1. Calculate Metrics
        const flights = master.length;
        const aircraft = new Set(master.map(r => r['A/C']).filter(Boolean)).size;
        
        // Changes count (assuming based on logs total for the period)
        const changes = logs.length;

        // 2. Data Quality Logic
        // Calculate percentage of records with complete timestamp data
        const required = ['SIBT', 'AIBT', 'SOBT', 'AOBT'];
        const valid = master.filter(r => required.every(f => r[f] && r[f].trim() !== '')).length;
        const quality = flights > 0 ? Math.round((valid / flights) * 100) : 0;

        // 3. Update UI
        flightsEl.textContent = flights;
        acEl.textContent = aircraft;
        changesEl.textContent = changes;
        qualityEl.textContent = `${quality}%`;
    }
};
