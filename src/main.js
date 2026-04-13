/**
 * HKT DASHBOARD - Main Entry Point (Orchestrator)
 * Adheres to Modular Architecture and Security Principles.
 */

import { CONFIG } from './core/Config.js';
import { DataEngine } from './core/DataEngine.js';
import { Helpers } from './utils/Helpers.js';
import { KPICards } from './components/KPICards.js';
import { OTPScorecard } from './components/OTPScorecard.js';
import { MovementLogs } from './components/MovementLogs.js';
import { ChartComponent } from './components/AnalyticsCharts.js';

import { SampleData } from './utils/SampleData.js';

let appState = {
    logs: [],
    master: [],
    currentMode: 'daily',
    currentFilter: '',
    searchTerm: ''
};

const engine = new DataEngine();

document.addEventListener('DOMContentLoaded', () => {
    console.log('--- Baylink Dashboard v5.1 (Instant Boot) ---');
    
    // 1. Instant Boot: Load Sample Data first so UI is immediately usable
    appState.logs = SampleData.getLogs();
    appState.master = SampleData.getMaster();

    // 2. Setup UI Instantly
    setupEventListeners();
    setupDefaultView();
    hideLoader();

    // 3. Background Sync: Fetch real data without blocking the user
    requestCloudSync();
});

async function requestCloudSync() {
    console.log('☁️ Background Sync Started...');
    try {
        const data = await engine.init();
        if (data && data.master.length > 0) {
            console.log('✅ Cloud data received. Updating UI...');
            appState.logs = data.logs;
            appState.master = data.master;
            
            // Re-setup view if needed (to pick the latest real date)
            setupDefaultView();
        }
    } catch (error) {
        console.warn('Background Sync Failed:', error.message);
    }
}

function setupEventListeners() {
    // Theme Switch
    const themeToggle = document.getElementById('checkbox');
    if (themeToggle) {
        const current = localStorage.getItem(CONFIG.THEME_STORAGE_KEY) || 'dark';
        document.documentElement.setAttribute('data-theme', current);
        themeToggle.checked = current === 'light';
        
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem(CONFIG.THEME_STORAGE_KEY, theme);
            refreshUI(); // Re-render charts with correct theme colors
        });
    }

    // Filter Mode Switch
    const modeSwitch = document.getElementById('filter-mode');
    if (modeSwitch) {
        modeSwitch.addEventListener('change', (e) => {
            appState.currentMode = e.target.value;
            togglePickerVisibility();
            refreshUI();
        });
    }

    // Date/Month Pickers
    ['daily-picker', 'monthly-picker'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', (e) => {
            appState.currentFilter = e.target.value;
            refreshUI();
        });
    });

    // Search
    const searchInput = document.getElementById('flight-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            appState.searchTerm = e.target.value.toLowerCase();
            refreshUI();
        });
    }
}

function setupDefaultView() {
    const dailyPicker = document.getElementById('daily-picker');
    if (dailyPicker && appState.master.length > 0) {
        // Find latest date in master
        const latest = appState.master.map(r => Helpers.getRecordDate(r.Date))
            .filter(Boolean)
            .sort((a,b) => b.iso.localeCompare(a.iso))[0];
        
        if (latest) {
            dailyPicker.value = latest.iso;
            appState.currentFilter = latest.iso;
        }
    }
    refreshUI();
}

function refreshUI() {
    const mode = appState.currentMode;
    let filterVal = appState.currentFilter;
    
    if (mode === 'monthly' && filterVal.includes('-')) {
        const [y, m] = filterVal.split('-');
        filterVal = `${m}-${y}`; // Format back to MM-YYYY for data matching
    }

    // 1. Filter Data
    const fMaster = appState.master.filter(r => {
        const d = Helpers.getRecordDate(r.Date);
        if (!d) return false;
        return mode === 'daily' ? d.iso === filterVal : d.monthKey === filterVal;
    });

    const fLogs = appState.logs.filter(r => {
        const d = Helpers.getRecordDate(r.Date);
        if (!d) return false;
        return mode === 'daily' ? d.iso === filterVal : d.monthKey === filterVal;
    });

    const searchedLogs = fLogs.filter(r => 
        (r['Flight In'] || '').toLowerCase().includes(appState.searchTerm) || 
        (r['Flight Out'] || '').toLowerCase().includes(appState.searchTerm)
    );

    // 2. Render Components
    KPICards.render(fMaster, fLogs);
    OTPScorecard.render(fMaster, mode, filterVal);
    MovementLogs.render(searchedLogs);

    // Visibility Management
    const logsSection = document.querySelector('.logs-section');
    if (logsSection) logsSection.style.display = mode === 'monthly' ? 'none' : 'block';
}

function togglePickerVisibility() {
    const dailyC = document.getElementById('daily-picker-container');
    const monthlyC = document.getElementById('monthly-picker-container');
    if (dailyC && monthlyC) {
        dailyC.style.display = appState.currentMode === 'daily' ? 'block' : 'none';
        monthlyC.style.display = appState.currentMode === 'monthly' ? 'block' : 'none';
    }
}

function hideLoader() {
    const l = document.getElementById('loader');
    if (l) { l.style.opacity = '0'; setTimeout(() => l.style.display = 'none', 600); }
}

function displayError(msg) {
    const dashboard = document.querySelector('.main-content');
    if (dashboard) {
        dashboard.innerHTML = `<div style="padding: 4rem; text-align: center; color: var(--danger);">
            <h2 style="margin-bottom: 1rem;">System Error</h2>
            <p>${msg}</p>
        </div>`;
    }
}
