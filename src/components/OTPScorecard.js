/**
 * OTP Scorecard Component
 * Handles the "Excellence Awards" leaderboard and Indigo-themed performance charts.
 * Features: Flight-volume normalization, 1:N Airline point-based scoring.
 */

import { CONFIG } from '../core/Config.js';
import { ChartComponent } from './AnalyticsCharts.js';

export const OTPScorecard = {
    render: (master, mode, filterValue) => {
        const leaderboardEl = document.getElementById('otp-leaderboard');
        if (!leaderboardEl) return;

        // 1. Calculate Per-Airline Point Data
        const excellenceData = {};
        const airlineOTP = {};

        master.forEach(r => {
            const code = r['Callsign'] ? r['Callsign'].substring(0, 2) : '??';
            if (!excellenceData[code]) {
                excellenceData[code] = { totalPoints: 0, totalFlights: 0, sumArrPoints: 0, sumDepPoints: 0 };
            }
            if (!airlineOTP[code]) {
                airlineOTP[code] = { points: 0, total: 0 };
            }

            // Logic: Points calculation (extracted from Engine and applied here for modular display)
            // [Note: Re-calculating here to keep component self-contained for UI]
            const arrP = parseInt(r['_otp_arr_points']) || 0;
            const depP = parseInt(r['_otp_dep_points']) || 0;

            excellenceData[code].totalPoints += (arrP + depP);
            excellenceData[code].totalFlights += 1;
            excellenceData[code].sumArrPoints += arrP;
            excellenceData[code].sumDepPoints += depP;

            airlineOTP[code].points += (arrP + depP);
            airlineOTP[code].total += 1;
        });

        // 2. Render Leaderboard Cards
        const topPerformers = Object.entries(excellenceData)
            .map(([code, d]) => ({
                code,
                avgScore: d.totalFlights > 0 ? d.totalPoints / d.totalFlights : 0,
                flights: d.totalFlights,
                avgArr: (d.sumArrPoints / d.totalFlights).toFixed(1),
                avgDep: (d.sumDepPoints / d.totalFlights).toFixed(1)
            }))
            .filter(p => p.flights >= CONFIG.MIN_OTP_FLIGHTS)
            .sort((a, b) => b.avgScore - a.avgScore || b.flights - a.flights)
            .slice(0, 5);

        if (topPerformers.length === 0) {
            leaderboardEl.innerHTML = '<div style="grid-column: 1/-1; color: var(--text-dim); font-size: 0.8rem; text-align: center; padding: 20px;">No flights with enough data available for ranking.</div>';
        } else {
            leaderboardEl.innerHTML = topPerformers.map((p, i) => `
                <div class="otp-award-card ${i === 0 ? 'rank-1' : ''}">
                    <div class="rank-badge">RANK ${i + 1}</div>
                    <div class="otp-card-airline">${p.code}</div>
                    <div class="otp-card-score">${p.avgScore.toFixed(1)} Avg Pts</div>
                    <div class="otp-card-diff">
                        ${p.flights} Flights <span style="opacity: 0.3; margin: 0 4px;">|</span> Arr: ${p.avgArr} / Dep: ${p.avgDep} avg
                    </div>
                </div>
            `).join('');
        }

        // 3. Render Indigo Performance Chart
        const sortedOTP = Object.entries(airlineOTP)
            .map(([code, d]) => ({ 
                code, 
                avgScore: d.total > 0 ? d.points / d.total : 0, 
                total: d.total 
            }))
            .sort((a, b) => b.avgScore - a.avgScore || b.total - a.total)
            .slice(0, 15);

        ChartComponent.init('otpAirlineChart', 'bar', {
            labels: sortedOTP.map(x => `${x.code}`),
            datasets: [{
                label: 'Avg Performance Points',
                data: sortedOTP.map(x => x.avgScore.toFixed(2)),
                backgroundColor: sortedOTP.map(x => x.avgScore >= 4.5 ? CONFIG.CHART_COLORS.INDIGO : x.avgScore >= 3 ? CONFIG.CHART_COLORS.INDIGO_LIGHT : CONFIG.CHART_COLORS.DANGER),
                borderRadius: 2,
                barPercentage: 0.5
            }]
        }, {
            indexAxis: 'y',
            scales: { 
                x: { 
                    title: { display: true, text: 'Avg Points per Flight', color: CONFIG.CHART_COLORS.MUTED, font: { size: 9 } }
                }
            }
        });
    }
};
