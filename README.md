# Baylink HKT Apron Analytics Dashboard

A high-fidelity, real-time apron management dashboard for Phuket International Airport (VTSP), featuring **Schedule Reliability (OTP)**, **Turnaround Efficiency**, and **Surface Navigation (Taxi)** analytics.

## 🏗️ Architecture: Secure Modular ES6
This project has been refactored and adheres to the **"Iron Rules"** of high-standard dashboard development:
1. **No Sensitive Data**: Configs are externalized; no API keys or Sheet IDs in logic files.
2. **Modular Components**: UI widgets (Charts, Tables, KPIs) are separated into autonomous modules in `src/`.
3. **Data Integrity**: Every movement record is sanitized and validated by a dedicated Validator layer before rendering.

## 🚀 Deployment (GitHub Pages)

1. **Repository Structure**: Ensure `src/`, `index.html`, `style.css`, and `MASTER_GUIDELINES.md` are in the root.
2. **Setup**:
   - Go to **Settings** > **Pages**.
   - Select `main` branch and `/root` (or `/(root)`) as the source.
3. **Requirement**: Since this is an **ES Module** project, it *must* be served via a web server (like GitHub Pages or a local dev server) to allow `import` statements to function.

## 📊 Data Source
- **Real-time Sync**: Automatically fetches from Google Sheets CSV Export API via multi-proxy failover.
- **Master Metrics**: `master.csv` processing for trend analysis.
- **Movement Logs**: Deep-dive bay change reasons and flow monitoring.

## 📗 Documentation
- See [MASTER_GUIDELINES.md](MASTER_GUIDELINES.md) for architecture deep-dives.
- See [DEBUG_LOG.md](DEBUG_LOG.md) for historical fixes and known issues.

---
Built with Modern ES6+, CSS3, and Chart.js.
