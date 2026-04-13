/**
 * Modular Chart Component
 * Wrapper for Chart.js to ensure consistent styling and responsive handling.
 */

import { CONFIG } from '../core/Config.js';

const charts = {};

export const ChartComponent = {
    /**
     * Initializes or updates a Chart.js instance
     */
    init: (id, type, data, options = {}) => {
        const ctx = document.getElementById(id);
        if (!ctx) return;

        // Cleanup existing instance to prevent memory leaks and hover bugs
        if (charts[id]) {
            charts[id].destroy();
        }

        const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
        const textColor = isDark ? '#71717a' : '#a1a1aa';
        const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDark ? '#18181b' : '#fff',
                    titleColor: isDark ? '#f4f4f5' : '#18181b',
                    bodyColor: isDark ? '#a1a1aa' : '#71717a',
                    borderColor: isDark ? '#27272a' : '#e4e4e7',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 4,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 10 } }
                },
                y: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: textColor, font: { size: 10 } }
                }
            }
        };

        // Merge deep options safely
        const mergedOptions = { ...defaultOptions, ...options };
        if (options.scales) {
            mergedOptions.scales.x = { ...defaultOptions.scales.x, ...options.scales.x };
            mergedOptions.scales.y = { ...defaultOptions.scales.y, ...options.scales.y };
        }

        charts[id] = new Chart(ctx, {
            type: type,
            data: data,
            options: mergedOptions
        });

        return charts[id];
    }
};
