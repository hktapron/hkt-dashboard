/**
 * Movement Logs Component
 * Manages the live movement table, searchable flight data, and row-level details.
 */

export const MovementLogs = {
    render: (logs) => {
        const tbody = document.querySelector('#flights-table tbody');
        if (!tbody) return;

        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem; color: var(--text-dim);">No movements matching criteria</td></tr>';
            return;
        }

        tbody.innerHTML = logs.map(r => `
            <tr>
                <td style="font-weight: 700; color: #f4f4f5;">${r['Flight In'] || '-'} / ${r['Flight Out'] || '-'}</td>
                <td><span style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; padding: 2px 6px; border-radius: 4px; font-weight: 600; font-size: 0.75rem;">${r['A/C Type'] || '-'}</span></td>
                <td>
                    <div style="font-weight: 500;">SIBT: ${r['SIBT'] || '-'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim);">SOBT: ${r['SOBT'] || '-'}</div>
                </td>
                <td>
                    <div style="color: var(--warning); font-weight: 600;">${r['Original Bay'] || '-'}</div>
                </td>
                <td>
                    <div style="color: #10b981; font-weight: 600;">${r['Final Bay'] || '-'}</div>
                </td>
                <td style="font-size: 0.75rem; color: var(--text-muted); max-width: 150px;">
                    ${r['Bay Reason 1'] || '-'}
                </td>
            </tr>
        `).join('');
    }
};
