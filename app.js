/**
 * HKT SMART APRON - Refined Analytics Logic
 */

const SHEET_1_ID = '1WJK93iDvj96QcZX2z_R7rDbRo1Fn3_NdQfjSl9v6vFA'; 
const SHEET_2_ID = '1TF8Oy8tPfw-O_J4WZB2eveekNUEbu2w5U0Wc36THVEI'; 

const flightRegex = /^[A-Z0-9]{2,4}\s?\d{1,4}[A-Z]?$/i;
const isFlight = (v) => v && v.length > 1 && flightRegex.test(v.trim());

const getCsvUrl = (id) => `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv`)}`;

let logsData = [];
let masterData = [];
let charts = {};

// Theme Logic
document.getElementById('checkbox').addEventListener('change', function() {
    if(this.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
});

const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : null;
if (currentTheme) {
    document.documentElement.setAttribute('data-theme', currentTheme);
    if (currentTheme === 'light') document.getElementById('checkbox').checked = true;
}

// Mobile Toggle Logic
const mobileToggle = document.getElementById('mobile-filter-toggle');
const sidebar = document.querySelector('.sidebar');
const mobileOverlay = document.getElementById('mobile-overlay');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.add('active');
        mobileOverlay.classList.add('active');
    });
}

if (mobileOverlay) {
    mobileOverlay.addEventListener('click', () => {
        closeSidebar();
    });
}

const sidebarCloseBtn = document.getElementById('close-sidebar-btn');
if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', () => {
        closeSidebar();
    });
}

function closeSidebar() {
    sidebar.classList.remove('active');
    if (mobileOverlay) mobileOverlay.classList.remove('active');
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('--- Dashboard Initialization Start ---');
    const loader = document.getElementById('loader');
    
    try {
        await fetchAllData();
        console.log('Data fetch successful:', { logs: logsData.length, master: masterData.length });
        
        const defaultFilter = setupDatePicker();
        setupSearch();
        
    } catch (error) {
        console.error('CRITICAL ERROR:', error.message);
        const tbody = document.querySelector('#flights-table tbody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #ef4444; padding: 2rem;">
                <strong>Sync Error:</strong> ${error.message}<br>
                <small>Possible causes: CSV link restricted, No internet, or Sheet empty.</small>
            </td></tr>`;
        }
        // Force hide loader even on error
        hideLoader();
    } finally {
        console.log('Initialization complete');
        hideLoader();
    }
});

async function fetchAllData() {
    const parseCSV = (str) => {
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
    };

    const fetchData = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const rows = parseCSV(text);
        const rawHeaders = rows[0].map(h => h.trim());
        const headers = [];
        const seen = {};
        rawHeaders.forEach(h => {
            if (!h) { headers.push(''); return; }
            if (seen[h]) { seen[h]++; headers.push(`${h}_${seen[h]}`); } else { seen[h] = 1; headers.push(h); }
        });
        
        const data = rows.slice(1).map(row => {
            const obj = { _raw: row }; // Keep raw row for index access
            headers.forEach((h, i) => { if (h) obj[h] = (row[i] || '').trim(); });
            return obj;
        });
        return data;
    };

    const tryFetch = async (id, name) => {
        const base = `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&t=${Date.now()}`;
        // Priority 1: Direct (No Proxy)
        // Priority 2: CodeTabs (Fast & Simple)
        // Priority 3: AllOrigins
        
        const proxies = [
            base,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(base)}`,
            `https://api.allorigins.win/raw?url=${encodeURIComponent(base)}`
        ];

        for (const url of proxies) {
            try {
                console.log(`Syncing ${name} via ${url.slice(0, 30)}...`);
                const d = await fetchData(url);
                if (d && d.length > 0) return d;
            } catch (e) {
                console.warn(`${name} fetch step failed:`, e.message);
            }
        }
        
        console.error(`All sync methods failed for ${name}. Using emergency local cache.`);
        return name === 'Logs' ? getSampleLogs() : getSampleMaster();
    };

    const results = await Promise.all([
        tryFetch(SHEET_1_ID, 'Logs'),
        tryFetch(SHEET_2_ID, 'Master')
    ]);
    
    logsData = results[0];
    masterData = results[1];
}

function setupDatePicker() {
    const filterMode = document.getElementById('filter-mode');
    const dailyContainer = document.getElementById('daily-picker-container');
    const monthlyContainer = document.getElementById('monthly-picker-container');
    const dailyPicker = document.getElementById('daily-picker');
    const monthlyPicker = document.getElementById('monthly-picker');

    if (!filterMode || !dailyPicker || !monthlyPicker) return;

    // 1. Extract and group data
    let dates = masterData.map(row => row.Date || (row._raw && row._raw[0])).filter(Boolean);
    let uniqueDates = [...new Set(dates)].filter(d => d !== 'Date' && d.toString().trim() !== '');

    console.log('Unique Dates Found:', uniqueDates);

    const monthGroups = {};
    uniqueDates.forEach(d => {
        const sep = d.includes('/') ? '/' : '-';
        const parts = d.split(sep);
        if (parts.length === 3) {
            // M/D/Y Format: parts[0]=month, parts[1]=day, parts[2]=year
            const mIdx = parseInt(parts[0]) - 1; 
            if (mIdx < 0 || mIdx > 11) return;
            const yearStr = parts[2].length === 2 ? parts[2] : parts[2].slice(-2);
            const monthLabel = new Date(2000, mIdx).toLocaleString('en-GB', { month: 'short' }).toUpperCase();
            const label = `${monthLabel} ${yearStr}`;
            const key = `${parts[0].padStart(2, '0')}-${parts[2].length === 2 ? '20'+parts[2] : parts[2]}`; // Key is MM-YYYY
            monthGroups[key] = label;
        }
    });

    console.log('Month Groups:', monthGroups);

    // 2. Populate Monthly Dropdown
    monthlyPicker.innerHTML = '';
    Object.entries(monthGroups).sort().reverse().forEach(([key, label]) => {
        const opt = document.createElement('option');
        opt.value = key;
        opt.textContent = label;
        monthlyPicker.appendChild(opt);
    });

    // 3. Set Defaults
    // Sort M/D/Y: 3/14/2026 -> 2026-03-14
    const latestDate = uniqueDates.sort((a,b) => {
        const pA = a.split(/[/-]/);
        const pB = b.split(/[/-]/);
        const isoA = `${pA[2]}-${pA[0].padStart(2,'0')}-${pA[1].padStart(2,'0')}`;
        const isoB = `${pB[2]}-${pB[0].padStart(2,'0')}-${pB[1].padStart(2,'0')}`;
        return isoB.localeCompare(isoA);
    })[0];

    if (latestDate) {
        const parts = latestDate.split(/[/-]/);
        const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
        const m = parts[0].padStart(2, '0');
        const d = parts[1].padStart(2, '0');
        dailyPicker.value = `${y}-${m}-${d}`;
        console.log('Default Daily Value Set:', dailyPicker.value);
    }

    // 4. Handle Mode Switch
    filterMode.addEventListener('change', (e) => {
        const mode = e.target.value;
        if (mode === 'daily') {
            dailyContainer.style.display = 'block';
            monthlyContainer.style.display = 'none';
            triggerRender();
        } else {
            dailyContainer.style.display = 'none';
            monthlyContainer.style.display = 'block';
            triggerRender();
        }
        closeSidebar();
    });

    // 5. Regular Listeners
    dailyPicker.addEventListener('change', () => { triggerRender(); closeSidebar(); });
    monthlyPicker.addEventListener('change', () => { triggerRender(); closeSidebar(); });

    // Sidebar Reset Logic
    const navOverview = document.getElementById('nav-overview');
    if (navOverview) {
        navOverview.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            navOverview.classList.add('active');
            triggerRender();
            closeSidebar();
        });
    }

    const toggleCompare = document.getElementById('toggle-compare');
    if (toggleCompare) {
        toggleCompare.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            toggleCompare.classList.add('active');
            modal.classList.add('active');
        });
    }

    // 6. Comparative Mode Toggle
    const compareBtn = document.getElementById('toggle-compare');
    const modal = document.getElementById('modal-overlay');
    const closeModal = document.getElementById('close-modal');
    const compareScope = document.getElementById('compare-scope');
    const dateInputs = document.getElementById('compare-date-inputs');
    const monthInputs = document.getElementById('compare-month-inputs');

    if (compareBtn && modal) {
        compareBtn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            
            // Populate month selectors if empty
            const m1 = document.getElementById('compare-m1');
            const m2 = document.getElementById('compare-m2');
            if (m1 && m1.innerHTML === '') {
                const opts = document.getElementById('monthly-picker').innerHTML;
                m1.innerHTML = opts;
                m2.innerHTML = opts;
            }
        });
    }

    if (closeModal) {
        closeModal.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (modal) {
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });
    }

    if (compareScope) {
        compareScope.addEventListener('change', (e) => {
            if (e.target.value === 'daily') {
                dateInputs.style.display = 'block';
                monthInputs.style.display = 'none';
            } else {
                dateInputs.style.display = 'none';
                monthInputs.style.display = 'block';
            }
        });
    }

    const executeBtn = document.getElementById('execute-compare');
    if (executeBtn) {
        executeBtn.addEventListener('click', () => {
            const scope = compareScope.value;
            const v1 = scope === 'daily' ? document.getElementById('compare-d1').value : document.getElementById('compare-m1').value;
            const v2 = scope === 'daily' ? document.getElementById('compare-d2').value : document.getElementById('compare-m2').value;
            
            if (!v1 || !v2) { alert('Please select both targets to compare.'); return; }
            renderCompareDashboard(scope, v1, v2);
        });
    }

    function triggerRender() {
        const mode = filterMode.value;
        const val = mode === 'daily' ? dailyPicker.value : monthlyPicker.value;
        renderDashboard(mode, val);
    }

    // Initial Render
    triggerRender();
}

// Minimal Sample Data for Failover
function getSampleMaster() {
    const d = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    return [{ Date: d, Callsign: 'AIQ3160', FLIGHT: '650', FLIGHT_2: '651', 'A/C': 'HS-BBC', _raw: [d, 'AIQ3160', '08:00', '650', 'HS-BBC', '651', '09:00', '', '', '1'] }];
}

function getSampleLogs() {
    const d = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
    return [{ Date: d, 'Flight In': 'AIQ650', 'Flight Out': 'AIQ651', 'A/C Type': 'A320', 'SIBT': '08:00', 'SOBT': '09:00', 'Original Bay': '10', 'Final Bay': '12', 'Bay Reason 1': 'Stand Occ, KS', _raw: [] }];
}

function setupSearch() {
    const input = document.getElementById('flight-search');
    if (!input) return;
    input.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const mode = document.getElementById('filter-mode').value;
        const val = mode === 'daily' ? 
            document.getElementById('daily-picker').value : 
            document.getElementById('monthly-picker').value;
        renderDashboard(mode, val, term);
    });
}

// Mouse Tracking for Bento Glow
document.addEventListener('mousemove', e => {
    document.querySelectorAll('.card-glass').forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
});

// Robust Date Helper
function getRecordDate(rawDate) {
    if (!rawDate) return null;
    const p = rawDate.split(/[/-]/).map(s => s.trim());
    if (p.length < 3) return null;
    
    // Auto-detect format: Expecting M/D/Y based on sheet audit
    let m = p[0].padStart(2, '0');
    let d = p[1].padStart(2, '0');
    let y = p[2].length === 2 ? `20${p[2]}` : p[2];
    
    return { iso: `${y}-${m}-${d}`, monthKey: `${m}-${y}`, day: parseInt(d), month: parseInt(m), year: parseInt(y) };
}

function renderDashboard(mode, filterValue, searchTerm = '') {
    console.log(`[v4.3] Rendering: Mode=${mode}, Value=${filterValue}`);
    
    const fLogs = logsData.filter(r => {
        const dObj = getRecordDate(r.Date || (r._raw && r._raw[0]));
        if (!dObj) return false;
        return mode === 'daily' ? dObj.iso === filterValue : dObj.monthKey === filterValue;
    });

    const fMaster = masterData.filter(r => {
        const dObj = getRecordDate(r.Date || (r._raw && r._raw[0]));
        if (!dObj) return false;
        return mode === 'daily' ? dObj.iso === filterValue : dObj.monthKey === filterValue;
    });
    
    const searchedLogs = fLogs.filter(r => 
        (r['Flight In'] || '').toLowerCase().includes(searchTerm) || 
        (r['Flight Out'] || '').toLowerCase().includes(searchTerm)
    );

    updateMasterMetrics(fMaster);
    updateFlowStats(fLogs);
    renderCharts(fLogs, fMaster, mode, filterValue);
    updateTable(searchedLogs);
    
    // Visibility Management
    const monthlyTrends = document.getElementById('monthly-trends-container');
    const logsSection = document.querySelector('.logs-section');
    const cardReasons = document.getElementById('card-reasons');
    const cardPeak = document.getElementById('card-peak');
    const cardUtil = document.getElementById('card-util');

    if (mode === 'monthly') {
        if (monthlyTrends) monthlyTrends.style.display = 'contents';
        if (logsSection) logsSection.style.display = 'none';
        
        // Ensure all cards are visible in Monthly mode but with updated titles
        if (cardReasons) cardReasons.style.display = 'block';
        if (cardPeak) {
            cardPeak.style.display = 'block';
            cardPeak.querySelector('.chart-title').textContent = 'Monthly Peak Hour Distribution';
        }
        if (cardUtil) {
            cardUtil.style.display = 'block';
            cardUtil.querySelector('.chart-title').textContent = 'Monthly Contact Bay Utilization';
        }
    } else {
        if (monthlyTrends) monthlyTrends.style.display = 'none';
        if (logsSection) logsSection.style.display = 'block';
        if (cardReasons) cardReasons.style.display = 'block';
        if (cardPeak) {
            cardPeak.style.display = 'block';
            cardPeak.querySelector('.chart-title').textContent = 'Peak Hour Operations';
        }
        if (cardUtil) {
            cardUtil.style.display = 'block';
            cardUtil.querySelector('.chart-title').textContent = 'Contact Bay Utilization (Bays 4-15)';
        }
    }
}

function renderCompareDashboard(scope, val1, val2) {
    console.log(`[v3.3] Rendering Comparison: Scope=${scope}, ${val1} vs ${val2}`);
    const modal = document.getElementById('modal-overlay');
    if (modal) modal.classList.remove('active');

    // Filter Data for both targets
    const filter = (data, val) => data.filter(r => {
        const d = getRecordDate(r.Date || (r._raw && r._raw[0]));
        if (!d) return false;
        return scope === 'daily' ? d.iso === val : d.monthKey === val;
    });

    const master1 = filter(masterData, val1);
    const master2 = filter(masterData, val2);
    const logs1 = filter(logsData, val1);
    const logs2 = filter(logsData, val2);

    // Hide daily/monthly specific elements, show charts only
    document.getElementById('monthly-trends-container').style.display = 'none';
    document.querySelector('.logs-section').style.display = 'none';
    document.getElementById('card-reasons').style.display = 'none';
    document.getElementById('card-peak').style.display = 'block';
    document.getElementById('card-util').style.display = 'block';

    // Update KPI for first target mainly or hide? Let's show Target A for now
    updateMasterMetrics(master1);
    updateFlowStats(logs1);

    // Render Comparative Charts
    renderCompareCharts(scope, master1, master2, logs1, logs2, val1, val2);
}

function renderCompareCharts(scope, m1, m2, l1, l2, v1, v2) {
    const colorA = '#00f2ff';
    const colorB = '#ff70ff';

    if (scope === 'daily') {
        // Compare Peak Hour (Hourly)
        const computeHourly = (m) => {
            const data = Array(24).fill(0);
            m.forEach(r => {
                const arr = parseMasterDateTime(r['SIBT'] || (r._raw && r._raw[2]), r.Date || (r._raw && r._raw[0]));
                if (arr) data[arr.getHours()]++;
            });
            return data;
        };

        initChart('peakHourChart', 'line', {
            labels: Array.from({length:24}, (_,i) => `${String(i).padStart(2,'0')}:00`),
            datasets: [
                { label: v1, data: computeHourly(m1), borderColor: colorA, backgroundColor: colorA+'22', fill: true, tension: 0.4 },
                { label: v2, data: computeHourly(m2), borderColor: colorB, backgroundColor: colorB+'22', fill: true, tension: 0.4 }
            ]
        }, { scales: { y: { beginAtZero: true } } });

        // Compare Util (Bays)
        const computeUtil = (l) => {
            const usage = {};
            for (let i=4; i<=15; i++) if (i!==13) usage[i]=0;
            l.forEach(r => {
                const b = parseInt(r['Final Bay'] || (r._raw && r._raw[8]));
                if (usage[b] !== undefined) usage[b]++;
            });
            return Object.values(usage);
        };

        initChart('utilizationChart', 'bar', {
            labels: Array.from({length:12}, (_,i) => `Bay ${i<9?i+4:i+5}`),
            datasets: [
                { label: v1, data: computeUtil(l1), backgroundColor: colorA+'CC', borderRadius: 4 },
                { label: v2, data: computeUtil(l2), backgroundColor: colorB+'CC', borderRadius: 4 }
            ]
        });
    } else {
        // Compare Months (Monthly Trends)
        const computeMonthly = (m, filterVal) => {
            const [mon, year] = filterVal.split('-').map(Number);
            const trend = {};
            m.forEach(r => {
                const d = getRecordDate(r.Date || (r._raw && r._raw[0]));
                if (!d || d.month !== mon || d.year !== year) return;
                trend[d.day] = (trend[d.day] || 0) + (isFlight(r._raw[3])?1:0) + (isFlight(r._raw[5])?1:0);
            });
            return trend;
        };
        
        const trend1 = computeMonthly(m1, v1);
        const trend2 = computeMonthly(m2, v2);
        const allDays = [...new Set([...Object.keys(trend1), ...Object.keys(trend2)])].sort((a,b)=>Number(a)-Number(b));

        // Redirect these to existing peak/util cards for simplicity in compare mode
        document.getElementById('card-peak').querySelector('.chart-title').textContent = 'Monthly Flight Comparison';
        initChart('peakHourChart', 'line', {
            labels: allDays,
            datasets: [
                { label: v1, data: allDays.map(d => trend1[d]||0), borderColor: colorA, fill: false, tension: 0.4 },
                { label: v2, data: allDays.map(d => trend2[d]||0), borderColor: colorB, fill: false, tension: 0.4 }
            ]
        });
        document.getElementById('card-util').style.display = 'none';
    }
}

function updateMasterMetrics(data) {
    const counts = { aircraft: data.length, flights: 0, changes: 0 };
    data.forEach(r => {
        const raw = r._raw || [];
        if (isFlight(raw[3])) counts.flights++;
        if (isFlight(raw[5])) counts.flights++;
        // Bay changes: use truthy check, NOT flight regex
        [9, 11, 13, 15, 17].forEach(idx => { if ((raw[idx] || '').trim() !== '') counts.changes++; });
    });
    document.getElementById('master-total-ac').textContent = counts.aircraft;
    document.getElementById('master-total-flights').textContent = counts.flights;
    document.getElementById('master-total-change').textContent = counts.changes;
}

function parseMasterDateTime(timeStr, obsDateStr, defaultTimeStr = null) {
    let effectiveTime = timeStr;
    if (!effectiveTime && defaultTimeStr) {
        // Handle missing SOBT: Default to SIBT + 2 hours
        const [baseTime, day] = defaultTimeStr.split('/');
        const [h, m] = baseTime.split(':').map(Number);
        let newH = h + 2; 
        effectiveTime = `${String(newH).padStart(2,'0')}:${String(m).padStart(2,'0')}${day ? '/'+day : ''}`;
    }
    
    if (!effectiveTime || !obsDateStr) return null;
    const [time, dayPart] = effectiveTime.trim().split('/');
    const timeParts = time.split(/[:\.]/); // Support 10:10 and 10.10
    if (timeParts.length < 2) return null;
    const h = parseInt(timeParts[0]);
    const m = parseInt(timeParts[1]);
    
    const sep = obsDateStr.includes('/') ? '/' : '-';
    let parts = obsDateStr.split(sep).map(Number);
    let mObs = parts[0], dObs = parts[1], yObs = parts[2];
    
    let d = dayPart ? parseInt(dayPart) : dObs;
    let month = mObs - 1;
    let year = yObs < 100 ? yObs + 2000 : yObs;
    
    return new Date(year, month, d, h, m);
}

function getFinalBay(r) {
    if (!r || !r._raw) return null;
    const priorityIndices = [17, 15, 13, 11, 9]; // R, P, N, L, J
    for (const idx of priorityIndices) {
        const val = (r._raw[idx] || '').trim();
        if (val && val !== '') return val;
    }
    return (r._raw[7] || '').trim(); // Fallback to H
}

function classifyBay(bay) {
    if (!bay) return 'N/A';
    const s = String(bay).trim().toUpperCase();
    const b = parseInt(s);
    
    // Contact: 4-15
    if (b >= 4 && b <= 15) return 'C';
    
    // Remote: 1-3, 16, 31-40, 32L, 32R, 33L, 33R, 34L, 34R
    const remoteIds = [1, 2, 3, 16, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40];
    const remoteStr = ['32L', '32R', '33L', '33R', '34L', '34R'];
    if (remoteIds.includes(b) || remoteStr.includes(s)) return 'R';
    
    return 'N/A';
}

function updateFlowStats(logs) {
    const flows = { 'R-C': 0, 'C-R': 0, 'C-C': 0, 'R-R': 0 };

    logs.forEach(r => {
        const from = classifyBay(r['Original Bay'] || (r._raw && r._raw[6]));
        const to = classifyBay(r['Final Bay'] || (r._raw && r._raw[8]));
        
        if (from !== 'N/A' && to !== 'N/A') {
            flows[`${from}-${to}`]++;
        }
    });

    if (document.getElementById('flow-r-c')) document.getElementById('flow-r-c').textContent = flows['R-C'];
    if (document.getElementById('flow-c-r')) document.getElementById('flow-c-r').textContent = flows['C-R'];
    if (document.getElementById('flow-c-c')) document.getElementById('flow-c-c').textContent = flows['C-C'];
    if (document.getElementById('flow-r-r')) document.getElementById('flow-r-r').textContent = flows['R-R'];
}



function renderCharts(logs, master, mode, filterValue) {
    // 1. Bay Change Reasons (Doughnut)
    const reasons = {};
    logs.forEach(r => {
        let reason = r['Bay Reason 1'] || r['Reason'] || (r._raw && (r._raw[10] || r._raw[11] || r._raw[9]));
        if (reason && typeof reason === 'string') {
            const clean = reason.trim();
            if (clean && clean !== '-' && clean !== 'Reason' && clean !== 'Bay Reason 1' && clean !== 'Gate Reason 1') {
                const label = clean.split(',')[0].trim();
                const isBay = classifyBay(label) !== 'N/A';
                const isNumeric = !isNaN(label) || /^\d+$/.test(label);
                const isGatePattern = /^(G|GATE|8|9)\s?[\d]+/i.test(label) || /^[0-9A-Z]{1,3}$/.test(label);
                if (label && !isNumeric && !isBay && !isGatePattern && label.length > 2) {
                    reasons[label] = (reasons[label] || 0) + 1;
                }
            }
        }
    });

    const rankList = document.getElementById('top-reasons-list');
    if (rankList) {
        const topN = Object.entries(reasons).sort((a,b) => b[1] - a[1]).slice(0, 10);
        rankList.innerHTML = topN.map(([label, count], i) => `
            <div class="rank-item" style="margin-bottom: 2px; padding: 6px 10px;">
                <div class="rank-number" style="min-width: 15px; font-size: 0.7rem;">${i+1}</div>
                <div class="rank-info">
                    <span class="rank-label" style="font-size: 0.75rem;">${label}</span>
                    <span class="rank-count" style="font-weight: 700; color:var(--primary);">${count}</span>
                </div>
            </div>
        `).join('');
    }

    initChart('reasonsChart', 'doughnut', {
        labels: Object.keys(reasons),
        datasets: [{ data: Object.values(reasons), backgroundColor: ['#00f2ff', '#7000ff', '#00ff9d', '#f59e0b', '#ef4444'], borderWidth: 0 }]
    }, { plugins: { legend: { display: false } }, cutout: '70%', maintainAspectRatio: true, aspectRatio: 2.5 });

    // 2. Contact Bay Utilization
    const usage = {};
    for (let i = 4; i <= 15; i++) { if (i !== 13) usage[i] = 0; }
    logs.forEach(r => {
        const b = parseInt(r['Final Bay'] || (r._raw && r._raw[8]));
        if (usage[b] !== undefined) usage[b]++;
    });

    let domMax = -1, domBay = -1, intMax = -1, intBay = -1;
    Object.entries(usage).forEach(([b, count]) => {
        const bayNum = parseInt(b);
        if (bayNum <= 10) { if (count >= domMax) { domMax = count; domBay = bayNum; } }
        else { if (count >= intMax) { intMax = count; intBay = bayNum; } }
    });

    const utilColors = Object.keys(usage).map(b => {
        const bayNum = parseInt(b);
        if (bayNum === domBay && domMax > 0) return '#00ff9d';
        if (bayNum === intBay && intMax > 0) return '#7000ff';
        return '#00f2ff';
    });

    const utilCounts = Object.values(usage);
    initChart('utilizationChart', 'bar', {
        labels: Object.keys(usage).map(b => `Bay ${b}`),
        datasets: [{ label: 'Usage Count', data: utilCounts, backgroundColor: utilColors, borderRadius: 4 }]
    }, {
        scales: {
            y: {
                beginAtZero: false,
                suggestedMin: Math.floor(Math.min(...utilCounts) * 0.9),
                suggestedMax: Math.ceil(Math.max(...utilCounts) * 1.1)
            }
        }
    });

    // 3. Peak Hour Operations
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, contact: 0, remote: 0, changes: 0 }));
    
    // Occupancy
    master.forEach(r => {
        const obsDateStr = r.Date || (r._raw && r._raw[0]);
        const sibt = r['SIBT'] || (r._raw && r._raw[2]);
        const type = classifyBay(getFinalBay(r));
        if (type === 'N/A') return;
        const arr = parseMasterDateTime(sibt, obsDateStr);
        if (arr) hourlyData[arr.getHours()][type === 'C' ? 'contact' : 'remote']++;
    });

    // Bay Changes
    logs.forEach(l => {
        const dObj = getRecordDate(l.Date || (l._raw && l._raw[0]));
        if (!dObj) return;
        const sibt = l['SIBT'] || (l._raw && l._raw[4]);
        const time = parseMasterDateTime(sibt, dObj.iso);
        if (time && l['Original Bay'] !== l['Final Bay']) {
            hourlyData[time.getHours()].changes++;
        }
    });

    // Peak Style: Single Peak, Vibrant Colors for all
    const maxHour = [...hourlyData].sort((a,b) => (b.contact + b.remote) - (a.contact + a.remote))[0].hour;
    
    // Modern 2026 Color Pairs
    const colors = {
        standard: { C: '#00f2ff', R: '#7000ff' }, // Cyan / Purple
        peak: { C: '#00ff9d', R: '#059669' }      // Emerald / Deep Green
    };

    initChart('peakHourChart', 'bar', {
        labels: hourlyData.map(d => `${String(d.hour).padStart(2, '0')}:00`),
        datasets: [
            { 
                label: 'Contact (A/C)', 
                data: hourlyData.map(d => d.contact), 
                stack: 'ac',
                backgroundColor: hourlyData.map(d => d.hour === maxHour && (d.contact+d.remote)>0 ? colors.peak.C : colors.standard.C) 
            },
            { 
                label: 'Remote (A/C)', 
                data: hourlyData.map(d => d.remote), 
                stack: 'ac',
                backgroundColor: hourlyData.map(d => d.hour === maxHour && (d.contact+d.remote)>0 ? colors.peak.R : colors.standard.R) 
            }
        ]
    }, {
        plugins: { tooltip: { callbacks: { afterBody: (ctx) => `Bay Changes: ${hourlyData[ctx[0].dataIndex].changes}` } } },
        scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 5 } } }
    });

    // 4. Monthly Trend Analysis
    if (mode === 'monthly') {
        const [fMonth, fYear] = filterValue.split('-').map(Number);
        const trend = {};
        master.forEach(r => {
            const dObj = getRecordDate(r.Date || (r._raw && r._raw[0]));
            if (!dObj || dObj.month !== fMonth || dObj.year !== fYear) return;
            if (!trend[dObj.day]) trend[dObj.day] = { flights: 0, changes: 0 };
            const raw = r._raw || [];
            if (isFlight(raw[3])) trend[dObj.day].flights++;
            if (isFlight(raw[5])) trend[dObj.day].flights++;
            // Bay changes: truthy check
            [9, 11, 13, 15, 17].forEach(idx => { if ((raw[idx] || '').trim() !== '') trend[dObj.day].changes++; });
        });

        const labels = Object.keys(trend).sort((a,b)=>Number(a)-Number(b));
        const flightData = labels.map(d => trend[d].flights);
        const changeData = labels.map(d => trend[d].changes);
        
        // Single Peak Logic (Emerald for Flights, Pink for Changes)
        const maxF = Math.max(...flightData);
        const maxC = Math.max(...changeData);
        
        const fColors = flightData.map(v => (v === maxF && v > 0) ? '#00ff9d' : '#00f2ff');
        const cColors = changeData.map(v => (v === maxC && v > 0) ? '#ff70ff' : '#f59e0b');

        initChart('monthlyFlightsChart', 'bar', {
            labels,
            datasets: [{ label: 'Flights', data: flightData, borderRadius: 4, backgroundColor: fColors }]
        }, { 
            scales: { 
                y: { 
                    beginAtZero: false, 
                    // Improved scaling for Day 9 stability (318 vs 350)
                    suggestedMin: Math.min(...flightData) - 20,
                    suggestedMax: Math.max(...flightData) + 10
                } 
            } 
        });
        
        initChart('monthlyChangesChart', 'bar', {
            labels,
            datasets: [{ label: 'Changes', data: changeData, borderRadius: 4, backgroundColor: cColors }]
        }, { scales: { y: { beginAtZero: true } } });
    }
}

function updateTable(data) {
    const tbody = document.querySelector('#flights-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    data.slice(0, 10).forEach(r => {
        const tr = document.createElement('tr');
        const finalBay = r['Final Bay'] || (r._raw && r._raw[8]);
        const type = classifyBay(finalBay);
        
        const hasChange = r['Original Bay'] !== r['Final Bay'];
        const flightIn = (r['Flight In'] || '').trim();
        const flightOut = (r['Flight Out'] || '').trim();
        const combinedFlight = (flightIn && flightOut) ? `${flightIn}/${flightOut.replace(/[A-Za-z]+/, '')}` : (flightIn || flightOut || '-');
        
        const [reason, initial] = (r['Bay Reason 1'] || '-').split(',').map(s => s.trim());
        
        // Color coding logic
        const bayTypeClass = type === 'C' ? 'bay-contact' : 'bay-remote';

        tr.innerHTML = `
            <td style="font-weight:700">${combinedFlight}</td>
            <td><span style="background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 6px;">${r['A/C Type']}</span></td>
            <td>${r['SIBT']} → ${r['SOBT']}</td>
            <td>${r['Original Bay']}</td>
            <td>
                <span class="bay-pill ${bayTypeClass}">
                    ${finalBay}
                </span>
            </td>
            <td><div style="font-weight:600">${reason || '-'}</div><div style="font-size:0.75rem; color:var(--primary)">${initial ? 'Assignee: '+initial : ''}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

function initChart(id, type, data, options = {}) {
    if (typeof Chart === 'undefined') return;
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    // Obsidian Theme Defaults
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#8a8f98';
    const gridColor = 'rgba(255, 255, 255, 0.03)';
    
    charts[id] = new Chart(canvas.getContext('2d'), {
        type, data, options: { 
            responsive: true, maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    backgroundColor: '#101216', 
                    borderColor: 'rgba(255,255,255,0.08)', 
                    borderWidth: 1, 
                    titleColor: '#fff', 
                    bodyColor: '#8a8f98',
                    padding: 12,
                    cornerRadius: 12,
                    usePointStyle: true
                }
            },
            scales: type !== 'doughnut' ? {
                y: { 
                    grid: { color: gridColor }, 
                    ticks: { color: textColor, font: { family: 'Manrope', size: 10, weight: 600 } }, 
                    border: { display: false } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textColor, font: { family: 'Manrope', size: 10, weight: 600 } }, 
                    border: { display: false } 
                }
            } : {},
            ...options 
        }
    });
}

function hideLoader() {
    const l = document.getElementById('loader');
    if (l) { l.style.opacity = '0'; setTimeout(() => l.style.display = 'none', 600); }
}
