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
        const dObj = getRecordDate(d);
        if (dObj) {
            const mIdx = dObj.month - 1;
            const yearStr = dObj.year.toString().slice(-2);
            const monthLabel = new Date(2000, mIdx).toLocaleString('en-GB', { month: 'short' }).toUpperCase();
            const label = `${monthLabel} ${yearStr}`;
            const key = `${String(dObj.month).padStart(2, '0')}-${dObj.year}`;
            monthGroups[key] = label;
        }
    });

    console.log('Month Groups:', monthGroups);

    // 2. Populate Monthly Picker Default
    const sortedMonthKeys = Object.keys(monthGroups).sort().reverse();
    if (sortedMonthKeys.length > 0) {
        const latestKey = sortedMonthKeys[0]; // MM-YYYY
        const [m, y] = latestKey.split('-');
        monthlyPicker.value = `${y}-${m}`; // Set value as YYYY-MM
        
        // Also set comparison month defaults
        const m1 = document.getElementById('compare-m1');
        const m2 = document.getElementById('compare-m2');
        if (m1 && !m1.value) m1.value = `${y}-${m}`;
        if (m2 && !m2.value) m2.value = `${y}-${m}`;
    }

    // 3. Set Defaults
    // Sort dates
    const latestDate = uniqueDates.sort((a,b) => {
        const dA = getRecordDate(a);
        const dB = getRecordDate(b);
        if (!dA || !dB) return 0;
        return dB.iso.localeCompare(dA.iso);
    })[0];

    if (latestDate) {
        const dObj = getRecordDate(latestDate);
        if (dObj) {
            dailyPicker.value = dObj.iso;
            console.log('Default Daily Value Set:', dailyPicker.value);

            // Set initial values for comparison dates if they exist
            const compD1 = document.getElementById('compare-d1');
            const compD2 = document.getElementById('compare-d2');
            if (compD1 && !compD1.value) compD1.value = dObj.iso;
            if (compD2 && !compD2.value) compD2.value = dObj.iso;
        }
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
    const handlePickerChange = (e) => {
        triggerRender();
        closeSidebar();
        dismissPicker(e.target);
    };

    dailyPicker.addEventListener('change', handlePickerChange);
    monthlyPicker.addEventListener('change', handlePickerChange);

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
        const openCompareModal = (e) => {
            e.preventDefault();
            closeSidebar();
            modal.classList.add('active');
        };

        compareBtn.addEventListener('click', openCompareModal);
        
        const sidebarCompareBtn = document.getElementById('sidebar-compare-btn');
        if (sidebarCompareBtn) {
            sidebarCompareBtn.addEventListener('click', openCompareModal);
        }

        // Add change listeners to comparison pickers for auto-dismissal
        ['compare-d1', 'compare-d2', 'compare-m1', 'compare-m2'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', (e) => dismissPicker(e.target));
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
            let v1 = scope === 'daily' ? document.getElementById('compare-d1').value : document.getElementById('compare-m1').value;
            let v2 = scope === 'daily' ? document.getElementById('compare-d2').value : document.getElementById('compare-m2').value;
            
            if (scope === 'monthly') {
                if (v1) { const [y, m] = v1.split('-'); v1 = `${m}-${y}`; }
                if (v2) { const [y, m] = v2.split('-'); v2 = `${m}-${y}`; }
            }
            
            if (!v1 || !v2) { alert('Please select both targets to compare.'); return; }
            
            // Explicitly dismiss pickers on run
            ['compare-d1', 'compare-d2', 'compare-m1', 'compare-m2'].forEach(id => {
                const el = document.getElementById(id);
                if (el) dismissPicker(el);
            });

            renderCompareDashboard(scope, v1, v2);
        });
    }

    function triggerRender() {
        const mode = filterMode.value;
        let val = mode === 'daily' ? dailyPicker.value : monthlyPicker.value;
        if (mode === 'monthly' && val) {
            const [y, m] = val.split('-');
            val = `${m}-${y}`;
        }
        renderDashboard(mode, val);
    }

    // Initial Render
    triggerRender();
}

/**
 * Aggressive dismissal for mobile date pickers
 */
function dismissPicker(el) {
    if (!el) return;
    el.blur();
    
    // Create a temporary focusable element to steal focus from the system picker
    const temp = document.createElement('input');
    temp.setAttribute('type', 'text');
    temp.style.position = 'fixed';
    temp.style.top = '-100px';
    temp.style.left = '-100px';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    
    temp.focus();
    
    // Small delay to ensure the system UI retracts, then clean up
    setTimeout(() => {
        temp.blur();
        document.body.removeChild(temp);
    }, 10);
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
    
    let m, d, y;
    const p0 = parseInt(p[0]);
    const p1 = parseInt(p[1]);
    const p2 = p[2];

    // Auto-detect format based on which part exceeds 12
    if (p0 > 12) {
        // First part > 12: Must be D/M/Y
        d = p0; m = p1;
    } else if (p1 > 12) {
        // Second part > 12: Must be M/D/Y
        m = p0; d = p1;
    } else {
        // Ambiguous (both <= 12): Default to M/D/Y as per original logic
        m = p0; d = p1;
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

    updateMasterMetrics(fMaster, fLogs);
    updateFlowStats(fLogs);
    renderCharts(fLogs, fMaster, mode, filterValue);
    updateTable(searchedLogs);
    updateDataCoverage(fMaster);
    renderDelaySection(fMaster, mode, filterValue);
    renderOTPSection(fMaster, mode, filterValue);
    renderTurnaroundSection(fMaster);
    renderTaxiTimeSection(fMaster);
    
    // Visibility Management
    const monthlyTrends = document.getElementById('monthly-trends-container');
    const logsSection = document.querySelector('.logs-section');
    const cardReasons = document.getElementById('card-reasons');
    const cardFlow = document.getElementById('card-flow');
    const cardPeak = document.getElementById('card-peak');
    const cardUtil = document.getElementById('card-util');

    const otpTrend = document.getElementById('card-otp-trend');

    if (mode === 'monthly') {
        if (monthlyTrends) monthlyTrends.style.display = 'contents';
        if (logsSection) logsSection.style.display = 'none';
        if (otpTrend) otpTrend.style.display = 'block';
        
        if (cardReasons) cardReasons.parentElement.style.display = 'grid';
        if (cardFlow) cardFlow.style.display = 'block';
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
        if (otpTrend) otpTrend.style.display = 'none';
        if (cardReasons) cardReasons.parentElement.style.display = 'grid';
        if (cardFlow) cardFlow.style.display = 'block';
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
    document.getElementById('card-reasons').parentElement.style.display = 'none';
    document.getElementById('card-peak').style.display = 'block';
    document.getElementById('card-util').style.display = 'block';
    // Hide new analytics sections in compare mode
    ['card-delay','card-otp','card-otp-trend','card-turnaround','card-taxi','card-flow'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });

    // Update KPI for first target mainly or hide? Let's show Target A for now
    updateMasterMetrics(master1, logs1);
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

function updateMasterMetrics(data, logs) {
    const counts = { aircraft: data.length, flights: 0, changes: 0 };
    data.forEach(r => {
        const raw = r._raw || [];
        const flightIn = r['FLIGHT'] || '';
        const flightOut = r['FLIGHT_2'] || '';
        if (isFlight(flightIn)) counts.flights++;
        if (isFlight(flightOut)) counts.flights++;
    });
    // Count bay changes from logs - Bay History at indices 13, 17, 21, 25...
    if (logs) {
        logs.forEach(r => {
            const raw = r._raw || [];
            for (let i = 13; i < raw.length; i += 4) {
                if ((raw[i] || '').trim() !== '') counts.changes++;
            }
        });
    }
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
    
    // Count from Master (Arrivals/Base Bay)
    master.forEach(r => {
        const b = parseInt(r['Bay'] || (r._raw && r._raw[7]));
        if (usage[b] !== undefined) {
            usage[b]++;
        }
    });

    // Count from Logs (Changes/Mid-stay transitions)
    logs.forEach(r => {
        const b = parseInt(r['Final Bay'] || (r._raw && r._raw[8]));
        if (usage[b] !== undefined) {
            // Check if it's a real change (optional: prevent double counting if redundant)
            const from = parseInt(r['Original Bay'] || (r._raw && r._raw[6]));
            if (from !== b) {
                usage[b]++;
                console.log(`Log increment: Bay ${b} (from ${from})`);
            }
        }
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
        datasets: [{ 
            label: 'Usage Count', 
            data: utilCounts, 
            backgroundColor: '#6366f1', 
            borderRadius: { topLeft: 4, topRight: 4 },
            barPercentage: 0.6
        }]
    }, {
        scales: {
            y: {
                beginAtZero: true,
                ticks: { font: { size: 10 }, color: '#71717a' }
            },
            x: {
                ticks: { font: { size: 10 }, color: '#71717a' }
            }
        }
    });

    // 3. Peak Hour Operations
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({ hour: i, contact: 0, remote: 0, changes: 0 }));
    
    // Occupancy
    master.forEach(r => {
        const obsDateStr = r.Date || (r._raw && r._raw[0]);
        const aibt = r['AIBT'] || '';
        const sibt = r['SIBT'] || (r._raw && r._raw[2]);
        const effectiveTime = aibt || sibt;
        const type = classifyBay(getFinalBay(r));
        if (type === 'N/A') return;
        const arr = parseMasterDateTime(effectiveTime, obsDateStr);
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

    // Peak Style: Strict Enterprise Palette

    initChart('peakHourChart', 'bar', {
        labels: hourlyData.map(d => `${String(d.hour).padStart(2, '0')}:00`),
        datasets: [
            { 
                label: 'Contact', 
                data: hourlyData.map(d => d.contact), 
                stack: 'ac',
                backgroundColor: '#2563eb',
                barPercentage: 0.6,
                categoryPercentage: 0.8
            },
            { 
                label: 'Remote', 
                data: hourlyData.map(d => d.remote), 
                stack: 'ac',
                backgroundColor: '#64748b',
                barPercentage: 0.6,
                categoryPercentage: 0.8
            }
        ]
    }, {
        plugins: { tooltip: { callbacks: { afterBody: (ctx) => `Bay Changes: ${hourlyData[ctx[0].dataIndex].changes}` } } },
        scales: { 
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 10 }, color: '#71717a' } }, 
            y: { stacked: true, beginAtZero: true, ticks: { font: { size: 10 }, color: '#71717a' } } 
        }
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
        
        initChart('monthlyFlightsChart', 'bar', {
            labels,
            datasets: [{ 
                label: 'Flights', 
                data: flightData, 
                backgroundColor: '#2563eb',
                borderRadius: 2,
                barPercentage: 0.6
            }]
        }, { 
            scales: { 
                y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#71717a' } },
                x: { ticks: { font: { size: 10 }, color: '#71717a' } }
            } 
        });
        
        initChart('monthlyChangesChart', 'bar', {
            labels,
            datasets: [{ 
                label: 'Changes', 
                data: changeData, 
                backgroundColor: '#f59e0b',
                borderRadius: 2,
                barPercentage: 0.6
            }]
        }, { 
            scales: { 
                y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#71717a' } },
                x: { ticks: { font: { size: 10 }, color: '#71717a' } }
            } 
        });
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

const getOrCreateTooltip = (chart) => {
    let tooltipEl = chart.canvas.parentNode.querySelector('div.chart-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.classList.add('chart-tooltip');
        const table = document.createElement('table');
        table.style.margin = '0px';
        tooltipEl.appendChild(table);
        chart.canvas.parentNode.appendChild(tooltipEl);
    }
    return tooltipEl;
};

const externalTooltipHandler = (context) => {
    // Tooltip Element
    const {chart, tooltip} = context;
    const tooltipEl = getOrCreateTooltip(chart);

    // Hide if no tooltip
    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    // Set Text
    if (tooltip.body) {
        const titleLines = tooltip.title || [];
        const bodyLines = tooltip.body.map(b => b.lines);

        const tableHead = document.createElement('thead');
        titleLines.forEach(title => {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.style.borderWidth = 0;
            th.style.textAlign = 'left';
            th.style.paddingBottom = '4px';
            th.style.color = '#f4f4f5'; // Zinc 100
            th.style.fontSize = '12px';
            th.style.fontWeight = '700';
            const text = document.createTextNode(title);
            th.appendChild(text);
            tr.appendChild(th);
            tableHead.appendChild(tr);
        });

        const tableBody = document.createElement('tbody');
        bodyLines.forEach((body, i) => {
            const colors = tooltip.labelColors[i];
            const span = document.createElement('span');
            span.style.background = colors.backgroundColor;
            span.style.borderColor = colors.borderColor;
            span.style.borderWidth = '1px';
            span.style.marginRight = '8px';
            span.style.height = '10px';
            span.style.width = '10px';
            span.style.borderRadius = '2px';
            span.style.display = 'inline-block';

            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.style.borderWidth = 0;
            td.style.display = 'flex';
            td.style.alignItems = 'center';
            td.style.fontSize = '11px';
            td.style.color = '#a1a1aa'; // Zinc 400
            td.appendChild(span);
            td.appendChild(document.createTextNode(body));
            tr.appendChild(td);
            tableBody.appendChild(tr);
        });

        const tableRoot = tooltipEl.querySelector('table');
        while (tableRoot.firstChild) tableRoot.firstChild.remove();
        tableRoot.appendChild(tableHead);
        tableRoot.appendChild(tableBody);
    }

    const {offsetLeft: positionX, offsetTop: positionY} = chart.canvas;

    // Display, position, and set styles for font
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.padding = tooltip.options.padding + 'px ' + tooltip.options.padding + 'px';
    tooltipEl.style.pointerEvents = 'none';
};

function initChart(id, type, data, options = {}) {
    if (typeof Chart === 'undefined') return;
    if (charts[id]) charts[id].destroy();
    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const textColor = isDark ? '#a1a1aa' : '#52525b';
    const gridColor = isDark ? '#27272a' : '#e4e4e7';
    
    charts[id] = new Chart(canvas.getContext('2d'), {
        type, data, options: { 
            responsive: true, maintainAspectRatio: false, 
            interaction: { mode: 'index', intersect: false },
            hover: { mode: 'index', intersect: false },
            plugins: { 
                legend: { display: false },
                tooltip: { 
                    enabled: false,
                    position: 'average',
                    external: externalTooltipHandler
                }
            },
            scales: type !== 'doughnut' ? {
                y: { 
                    grid: { color: gridColor, drawTicks: false, borderDash: [3, 3] }, 
                    ticks: { color: textColor, font: { family: 'Manrope', size: 10, weight: 500 }, padding: 8 }, 
                    border: { display: false } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: textColor, font: { family: 'Manrope', size: 10, weight: 500 }, padding: 8 }, 
                    border: { display: false } 
                }
            } : {},
            ...options 
        }
    });
}

// ============================================
// NEW ANALYTICS FUNCTIONS (v5.0)
// ============================================

function getAirlineCode(flightStr) {
    if (!flightStr) return null;
    const clean = flightStr.trim();
    const match = clean.match(/^([A-Z0-9]{2})\s*\d+/i);
    return match ? match[1].toUpperCase() : null;
}

function parseTimeWithDay(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return null;
    const [time, dayPart] = timeStr.trim().split('/');
    const parts = time.split(/[:.]/);
    if (parts.length < 2) return null;
    const h = parseInt(parts[0]);
    const m = parseInt(parts[1]);
    if (isNaN(h) || isNaN(m)) return null;
    const day = dayPart ? parseInt(dayPart) : 0;
    return { hours: h, minutes: m, day: isNaN(day) ? 0 : day, totalMinutes: (isNaN(day) ? 0 : day) * 1440 + h * 60 + m };
}

function getDelayMinutes(actualStr, scheduledStr) {
    if (!actualStr || !scheduledStr) return null;
    const actual = parseTimeWithDay(String(actualStr).trim());
    const scheduled = parseTimeWithDay(String(scheduledStr).trim());
    if (!actual || !scheduled) return null;
    
    let diff = actual.totalMinutes - scheduled.totalMinutes;
    // Handle cross-midnight (e.g. 23:55 to 00:05)
    // If diff is roughly -24h, add 1440. If diff is roughly +24h, sub 1440.
    if (diff < -720) diff += 1440;
    else if (diff > 720) diff -= 1440;
    
    return diff;
}

function updateDataCoverage(data) {
    let tracked = 0, scheduled = 0;
    data.forEach(r => {
        const aibt = (r['AIBT'] || '').trim();
        const aobt = (r['AOBT'] || '').trim();
        if (aibt || aobt) tracked++;
        else scheduled++;
    });
    const tEl = document.getElementById('dc-tracked');
    const sEl = document.getElementById('dc-scheduled');
    if (tEl) tEl.textContent = tracked;
    if (sEl) sEl.textContent = scheduled;
}

function renderDelaySection(master, mode, filterValue) {
    const delays = { arrival: [], departure: [] };
    const airlineDelays = {};
    
    master.forEach(r => {
        const flightIn = r['FLIGHT'] || '';
        const flightOut = r['FLIGHT_2'] || '';
        const aldt = (r['ALDT'] || '').trim();
        const sibt = (r['SIBT'] || '').trim();
        const atot = (r['ATOT'] || '').trim();
        const sobt = (r['SOBT'] || '').trim();
        
        const airline = getAirlineCode(flightIn) || getAirlineCode(flightOut) || getAirlineCode(r['Callsign'] || '');
        if (!airline) return;
        
        // Arrival delay = ALDT - SIBT
        if (aldt && sibt) {
            const d = getDelayMinutes(aldt, sibt);
            if (d !== null) {
                delays.arrival.push({ airline, delay: d, flight: flightIn });
                if (!airlineDelays[airline]) airlineDelays[airline] = [];
                airlineDelays[airline].push({ type: 'arr', delay: d, flight: flightIn });
            }
        }
        
        // Departure delay = ATOT - SOBT
        if (atot && sobt) {
            const d = getDelayMinutes(atot, sobt);
            if (d !== null) {
                delays.departure.push({ airline, delay: d, flight: flightOut });
                if (!airlineDelays[airline]) airlineDelays[airline] = [];
                airlineDelays[airline].push({ type: 'dep', delay: d, flight: flightOut });
            }
        }
    });
    
    const allDelays = [...delays.arrival, ...delays.departure];
    
    // Delay Distribution (>15min = delayed)
    let onTime = 0, under15 = 0, under30 = 0, over30 = 0;
    allDelays.forEach(d => {
        if (d.delay <= 15) onTime++;
        else if (d.delay <= 30) under30++;
        else over30++;
    });
    
    const distLabels = ['On-Time', '16-30 min', '>30 min'];
    const distData = [onTime, under30, over30];
    const distColors = ['#10b981', '#f59e0b', '#f43f5e']; // Emerald, Amber, Rose (SaaS Palette)
    
    initChart('delayDistChart', 'doughnut', {
        labels: distLabels,
        datasets: [{ data: distData, backgroundColor: distColors, borderWidth: 0 }]
    }, { 
        plugins: { 
            legend: { 
                display: false
            } 
        }, 
        cutout: '85%', 
        maintainAspectRatio: false 
    });
    
    // Top 10 delayed airlines (avg delay for flights >15min only)
    const airlineAvg = {};
    Object.entries(airlineDelays).forEach(([code, arr]) => {
        const delayed = arr.filter(x => x.delay > 15);
        if (delayed.length > 0) {
            const flightSet = new Set(delayed.map(x => x.flight).filter(f => f));
            const flightList = Array.from(flightSet).join(', ');
            airlineAvg[code] = { 
                avg: delayed.reduce((s, x) => s + x.delay, 0) / delayed.length, 
                count: delayed.length,
                flights: flightList
            };
        }
    });
    
    const top10 = Object.entries(airlineAvg).sort((a, b) => b[1].avg - a[1].avg).slice(0, 10);
    const listEl = document.getElementById('top-delay-list');
    if (listEl) {
        if (top10.length === 0) {
            listEl.innerHTML = '<div style="color:var(--text-dim); font-size:0.8rem; padding:8px;">No delay data available (ALDT/ATOT required)</div>';
        } else {
            listEl.innerHTML = '<div style="font-size:0.7rem; font-weight:700; color:var(--text-dim); text-transform:uppercase; margin-bottom:4px;">Top Delayed Airlines</div>' +
                top10.map(([code, d], i) => `<div class="delay-rank-item"><div class="rank-num">${i + 1}</div><div class="rank-info"><span class="rank-airline">${code} <span style="font-size:0.6rem; color:var(--text-dim); font-weight:400;">(${d.flights})</span></span><span class="rank-delay">${Math.round(d.avg)}m avg</span></div></div>`).join('');
        }
    }
    
    // Avg delay per airline bar chart (all airlines with delays >15min)
    const sortedAirlines = Object.entries(airlineAvg).sort((a, b) => b[1].avg - a[1].avg).slice(0, 15);
    initChart('avgDelayChart', 'bar', {
        labels: sortedAirlines.map(a => `${a[0]}`),
        datasets: [{
            label: 'Avg Delay (min)',
            data: sortedAirlines.map(a => Math.round(a[1].avg)),
            backgroundColor: '#3b82f6',
            borderRadius: 2,
            barThickness: 12
        }]
    }, { 
        indexAxis: 'y', 
        scales: { 
            x: { 
                beginAtZero: true, 
                title: { display: false },
                ticks: { font: { size: 10 }, color: '#71717a' }
            },
            y: { ticks: { autoSkip: false, font: { size: 10 }, color: '#71717a' } }
        } 
    });
}

function renderOTPSection(master, mode, filterValue) {
    const airlineOTP = {};
    const timeslotOTP = {};
    
    // Leaderboard calculation data
    const excellenceData = {};
    
    master.forEach(r => {
        const flightIn = r['FLIGHT'] || '';
        const flightOut = r['FLIGHT_2'] || '';
        const airline = getAirlineCode(flightIn) || getAirlineCode(flightOut) || getAirlineCode(r['Callsign'] || '');
        if (!airline) return;
        
        const aldt = (r['ALDT'] || '').trim();
        const sibt = (r['SIBT'] || '').trim();
        const atot = (r['ATOT'] || '').trim();
        const sobt = (r['SOBT'] || '').trim();
        
        const effectiveArr = aldt || sibt;
        const tp = parseTimeWithDay(effectiveArr);
        const hour = tp ? tp.hours : null;
        
        // New Baylink Point-Based Scoring Engine
        if (aldt && sibt && atot && sobt) {
            const rawArr = getDelayMinutes(aldt, sibt); // ALDT - SIBT
            const rawDep = getDelayMinutes(atot, sobt); // ATOT - SOBT
            
            if (rawArr !== null && rawDep !== null) {
                if (!excellenceData[airline]) excellenceData[airline] = { totalPoints: 0, totalFlights: 0, sumArrPoints: 0, sumDepPoints: 0 };
                
                let arrPts = 0;
                let depPts = 0;

                // Rule 2: Arrival Scoring logic
                if (rawArr >= -5 && rawArr <= 5) arrPts = 3;
                else if (rawArr >= -20 && rawArr <= -6) arrPts = 1;
                else if (rawArr > 15) arrPts = -1;

                // Rule 3: Departure Scoring logic
                if (rawDep < 0) depPts = 3;
                else if (rawDep >= 0 && rawDep <= 5) depPts = 2;
                else if (rawDep >= 21 && rawDep <= 60) depPts = -1;
                else if (rawDep > 60) depPts = -2;

                const totalLoopPts = arrPts + depPts;
                excellenceData[airline].totalPoints += totalLoopPts;
                excellenceData[airline].sumArrPoints += arrPts;
                excellenceData[airline].sumDepPoints += depPts;
                excellenceData[airline].totalFlights++;

                // Also populate for secondary charts
                if (!airlineOTP[airline]) airlineOTP[airline] = { points: 0, total: 0 };
                airlineOTP[airline].points += totalLoopPts;
                airlineOTP[airline].total++;

                if (hour !== null) {
                    const slot = `${String(hour).padStart(2, '0')}:00`;
                    if (!timeslotOTP[slot]) timeslotOTP[slot] = { points: 0, total: 0 };
                    timeslotOTP[slot].points += totalLoopPts;
                    timeslotOTP[slot].total++;
                }
            }
        }
    });

    // Render Baylink Point-Based Leaderboard
    const leaderboardEl = document.getElementById('otp-leaderboard');
    if (leaderboardEl) {
        const topPerformers = Object.entries(excellenceData)
            .map(([code, d]) => ({
                code,
                points: d.totalPoints,
                flights: d.totalFlights,
                avgArr: (d.sumArrPoints / d.totalFlights).toFixed(1),
                avgDep: (d.sumDepPoints / d.totalFlights).toFixed(1)
            }))
            .sort((a, b) => b.points - a.points || b.flights - a.flights)
            .slice(0, 5);

        if (topPerformers.length === 0) {
            leaderboardEl.innerHTML = '<div style="grid-column: 1/-1; color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 20px;">No flights with complete ALDT+ATOT data available.</div>';
        } else {
            leaderboardEl.innerHTML = topPerformers.map((p, i) => `
                <div class="otp-award-card ${i === 0 ? 'rank-1' : ''}">
                    <div class="rank-badge">RANK ${i + 1}</div>
                    <div class="otp-card-airline">${p.code}</div>
                    <div class="otp-card-score">${p.points} Pts</div>
                    <div class="otp-card-diff">
                        ${p.flights} Flights <span style="opacity: 0.3; margin: 0 4px;">|</span> Arr: ${p.avgArr} / Dep: ${p.avgDep} avg
                    </div>
                </div>
            `).join('');
        }
    }
    
    // OTP Chart Points
    const sortedOTP = Object.entries(airlineOTP)
        .map(([code, d]) => ({ code, points: d.points, total: d.total }))
        .sort((a, b) => b.points - a.points)
        .slice(0, 15);
    
    initChart('otpAirlineChart', 'bar', {
        labels: sortedOTP.map(x => `${x.code}`),
        datasets: [{
            label: 'Total Performance Points',
            data: sortedOTP.map(x => x.points),
            backgroundColor: sortedOTP.map(x => x.points >= 0 ? '#4f46e5' : '#f43f5e'),
            borderRadius: 2,
            barPercentage: 0.5
        }]
    }, {
        indexAxis: 'y',
        scales: { 
            x: { 
                beginAtZero: true, 
                title: { display: false },
                ticks: { font: { size: 10 }, color: '#71717a' }
            },
            y: { ticks: { autoSkip: false, font: { size: 10 }, color: '#f4f4f5' } }
        }
    });

    const sortedSlots = Object.entries(timeslotOTP)
        .map(([slot, d]) => ({ slot, points: d.points }))
        .sort((a, b) => a.slot.localeCompare(b.slot));

    initChart('otpTimeslotChart', 'bar', {
        labels: sortedSlots.map(x => x.slot),
        datasets: [{
            label: 'Total Performance Points',
            data: sortedSlots.map(x => x.points),
            backgroundColor: '#4f46e566',
            borderColor: '#6366f1',
            borderWidth: 1,
            borderRadius: 2
        }]
    }, {
        scales: {
            y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#71717a' } },
            x: { ticks: { font: { size: 10 }, color: '#71717a' } }
        }
    });
    
    // Monthly Variance Trend
    if (mode === 'monthly') {
        const [fMonth, fYear] = filterValue.split('-').map(Number);
        const dailyOTP = {};
        master.forEach(r => {
            const dObj = getRecordDate(r.Date || (r._raw && r._raw[0]));
            if (!dObj || dObj.month !== fMonth || dObj.year !== fYear) return;
            const aldt = (r['ALDT'] || '').trim();
            const sibt = (r['SIBT'] || '').trim();
            if (!aldt || !sibt) return;
            const d = getDelayMinutes(aldt, sibt);
            if (d === null) return;
            if (!dailyOTP[dObj.day]) dailyOTP[dObj.day] = { sumDiff: 0, total: 0 };
            dailyOTP[dObj.day].total++;
            dailyOTP[dObj.day].sumDiff += Math.abs(d);
        });
        const days = Object.keys(dailyOTP).sort((a, b) => Number(a) - Number(b));
        initChart('otpTrendChart', 'line', {
            labels: days,
            datasets: [{
                label: 'Avg Variance (min)',
                data: days.map(d => dailyOTP[d].total > 0 ? Math.round(dailyOTP[d].sumDiff / dailyOTP[d].total) : 0),
                borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.05)', fill: true, tension: 0.4, pointRadius: 0
            }]
        }, { scales: { y: { beginAtZero: true, title: { display: true, text: 'Minutes', color: '#71717a', font: { size: 10 } } } } });
    }
}

function renderTurnaroundSection(master) {
    const dropdown = document.getElementById('turnaround-airline');
    const statsEl = document.getElementById('turnaround-stats');
    if (!dropdown) return;
    
    // Collect all turnarounds
    const allTurnarounds = [];
    const airlines = new Set();
    
    master.forEach(r => {
        const flightIn = r['FLIGHT'] || '';
        const airline = getAirlineCode(flightIn) || getAirlineCode(r['Callsign'] || '');
        if (!airline) return;
        airlines.add(airline);
        
        const aibt = (r['AIBT'] || '').trim();
        const aobt = (r['AOBT'] || '').trim();
        const sibt = (r['SIBT'] || '').trim();
        const sobt = (r['SOBT'] || '').trim();
        
        const arrTime = aibt || sibt;
        const depTime = aobt || sobt;
        if (!arrTime || !depTime) return;
        
        const ta = parseTimeWithDay(arrTime);
        const td = parseTimeWithDay(depTime);
        if (!ta || !td) return;
        
        let ground = td.totalMinutes - ta.totalMinutes;
        if (ground < 0) ground += 1440;
        if (ground > 1440) return; // Skip overnight > 24h
        
        allTurnarounds.push({ airline, ground, isActual: !!(aibt && aobt) });
    });
    
    // Populate dropdown
    const sortedAirlines = [...airlines].sort();
    const currentVal = dropdown.value;
    dropdown.innerHTML = '<option value="all">All Airlines</option>' + sortedAirlines.map(a => `<option value="${a}">${a}</option>`).join('');
    if (sortedAirlines.includes(currentVal)) dropdown.value = currentVal;
    
    const renderTurnaround = () => {
        const selected = dropdown.value;
        const filtered = selected === 'all' ? allTurnarounds : allTurnarounds.filter(t => t.airline === selected);
        
        if (filtered.length === 0) {
            if (statsEl) statsEl.innerHTML = '<span style="color:var(--text-dim); font-size:0.8rem;">No data</span>';
            initChart('turnaroundChart', 'bar', { labels: [], datasets: [] });
            return;
        }
        
        const times = filtered.map(t => t.ground);
        const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        if (statsEl) {
            statsEl.innerHTML = `
                <div class="stat-pill"><span class="stat-label">Avg</span><span class="stat-value">${avg}m</span></div>
                <div class="stat-pill"><span class="stat-label">Min</span><span class="stat-value">${min}m</span></div>
                <div class="stat-pill"><span class="stat-label">Max</span><span class="stat-value">${max}m</span></div>
                <div class="stat-pill"><span class="stat-label">Flights</span><span class="stat-value">${filtered.length}</span></div>
            `;
        }
        
        // Histogram by 15-min buckets
        const buckets = {};
        times.forEach(t => {
            const b = Math.floor(t / 15) * 15;
            const label = `${b}-${b + 15}m`;
            buckets[label] = (buckets[label] || 0) + 1;
        });
        const bLabels = Object.keys(buckets).sort((a, b) => parseInt(a) - parseInt(b));
        
        initChart('turnaroundChart', 'bar', {
            labels: bLabels,
            datasets: [{
                label: 'Flights',
                data: bLabels.map(l => buckets[l]),
                backgroundColor: '#6366f1',
                borderRadius: { topLeft: 2, topRight: 2 },
                barPercentage: 0.6
            }]
        }, { 
            scales: { 
                y: { 
                    beginAtZero: true,
                    ticks: { font: { size: 10 }, color: '#71717a' }
                },
                x: {
                    ticks: { font: { size: 10 }, color: '#71717a' }
                }
            } 
        });
    };
    
    dropdown.onchange = renderTurnaround;
    renderTurnaround();
}

function renderTaxiTimeSection(master) {
    const statsEl = document.getElementById('taxi-stats');
    const taxiIn = [], taxiOut = [];
    const hourlyTaxi = {};
    
    master.forEach(r => {
        const aldt = (r['ALDT'] || '').trim();
        const aibt = (r['AIBT'] || '').trim();
        const aobt = (r['AOBT'] || '').trim();
        const atot = (r['ATOT'] || '').trim();
        const sibt = (r['SIBT'] || '').trim();
        
        // Taxi-In = AIBT - ALDT
        if (aibt && aldt) {
            const d = getDelayMinutes(aibt, aldt);
            if (d !== null && d >= 0 && d < 60) {
                taxiIn.push(d);
                const tp = parseTimeWithDay(aldt);
                if (tp) {
                    const h = `${String(tp.hours).padStart(2, '0')}:00`;
                    if (!hourlyTaxi[h]) hourlyTaxi[h] = { in: [], out: [] };
                    hourlyTaxi[h].in.push(d);
                }
            }
        }
        
        // Taxi-Out = ATOT - AOBT
        if (atot && aobt) {
            const d = getDelayMinutes(atot, aobt);
            if (d !== null && d >= 0 && d < 60) {
                taxiOut.push(d);
                const tp = parseTimeWithDay(aobt);
                if (tp) {
                    const h = `${String(tp.hours).padStart(2, '0')}:00`;
                    if (!hourlyTaxi[h]) hourlyTaxi[h] = { in: [], out: [] };
                    hourlyTaxi[h].out.push(d);
                }
            }
        }
    });
    
    const avgIn = taxiIn.length > 0 ? Math.round(taxiIn.reduce((a, b) => a + b, 0) / taxiIn.length) : '-';
    const avgOut = taxiOut.length > 0 ? Math.round(taxiOut.reduce((a, b) => a + b, 0) / taxiOut.length) : '-';
    
    if (statsEl) {
        statsEl.innerHTML = `
            <div class="stat-pill"><span class="stat-label">Avg Taxi-In</span><span class="stat-value" style="color:#2563eb;">${avgIn}m</span></div>
            <div class="stat-pill"><span class="stat-label">Avg Taxi-Out</span><span class="stat-value" style="color:#71717a;">${avgOut}m</span></div>
            <div class="stat-pill"><span class="stat-label">Samples In</span><span class="stat-value">${taxiIn.length}</span></div>
            <div class="stat-pill"><span class="stat-label">Samples Out</span><span class="stat-value">${taxiOut.length}</span></div>
        `;
    }
    
    const hours = Object.keys(hourlyTaxi).sort();
    if (hours.length === 0) {
        initChart('taxiChart', 'bar', { labels: ['No Data'], datasets: [{ label: 'Taxi-In', data: [0] }] });
        return;
    }
    
    initChart('taxiChart', 'bar', {
        labels: hours,
        datasets: [
            {
                label: 'Avg Taxi-In (min)',
                data: hours.map(h => hourlyTaxi[h].in.length > 0 ? Math.round(hourlyTaxi[h].in.reduce((a, b) => a + b, 0) / hourlyTaxi[h].in.length) : 0),
                backgroundColor: '#2563eb',
                borderRadius: { topLeft: 2, topRight: 2 },
                barPercentage: 0.5
            },
            {
                label: 'Avg Taxi-Out (min)',
                data: hours.map(h => hourlyTaxi[h].out.length > 0 ? Math.round(hourlyTaxi[h].out.reduce((a, b) => a + b, 0) / hourlyTaxi[h].out.length) : 0),
                backgroundColor: '#71717a',
                borderRadius: { topLeft: 2, topRight: 2 },
                barPercentage: 0.5
            }
        ]
    }, { scales: { y: { beginAtZero: true, ticks: { font: { size: 10 }, color: '#71717a' } }, x: { ticks: { font: { size: 10 }, color: '#71717a' } } } });
}

function hideLoader() {
    const l = document.getElementById('loader');
    if (l) { l.style.opacity = '0'; setTimeout(() => l.style.display = 'none', 600); }
}
