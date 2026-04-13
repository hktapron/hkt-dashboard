# MASTER_GUIDELINES: Baylink HKT Dashboard

This document serves as the ground truth for project architecture, logic rules, and design standards. Any future development or maintenance MUST adhere to these guidelines to ensure consistency and system stability.

## 1. Project Overview & Architecture
### Purpose
The **Baylink HKT Dashboard** is a high-fidelity apron management system for Phuket International Airport (VTSP). It transforms raw movement data into actionable analytics focusing on **Schedule Reliability (OTP)**, **Turnaround Efficiency**, and **Surface Navigation (Taxi)**.

### Tech Stack
- **Frontend**: Standard HTML5 / Vanilla JavaScript (ES6+).
- **Styling**: Vanilla CSS3 + Modern Layout Engines (Flexbox/Grid).
  - *Theme*: Premium Enterprise Dark Mode (Zinc-950/Zinc-900 palette).
- **Data Visualization**: [Chart.js](https://www.chartjs.org/).
- **Data Storage**: Client-side CSV processing (`master.csv`).

### Core Structure
- `index.html`: The structural backbone. Uses a flex-sidebar and a vertical-stack main content area.
- `style.css`: Contains the entire design system, including CSS variables (tokens) and component styles (card-glass, sections-stack).
- `app.js`: The "Engine". Handles CSV parsing, flight data filtering, OTP scoring logic, and chart orchestration.

---

## 2. Current State (Complete & Stable)
The following modules are fully developed and should not be refactored without explicit operational requirement:
- **KPI Summary Row**: Real-time aggregation of Flights, Aircraft, Changes, and Data Quality.
- **Fair OTP Scoring Engine**: A point-based performance system normalized by flight volume.
- **Responsive Layout Engine**: Transitioned from a rigid grid to a vertical flex-stack to eliminate overlapping and squashed cards.
- **Leaderboard Carousel**: Horizontal-scroll award cards for Top 5 carriers.
- **Analytics Charts**: Peak Hour, Contact Bay Utilization, Delay Performance, Turnaround Analysis, and Taxi Metrics.

---

## 3. Strict Rules (Master Conventions)

### Coding & Logic Rules
> [!IMPORTANT]
> **Rule 1: Point-Based Normalization**
> Never use raw variance percentages for ranking. Always use the `totalPoints / totalFlights` average score logic to ensure fairness.

> [!CAUTION]
> **Rule 2: Statistical Significance (The 3-Flight Rule)**
> To prevent small-sample bias, the Excellence Leaderboard MUST filter out airlines with fewer than **3 valid flights** (`MIN_OTP_FLIGHTS = 3`). Do not remove this filter.

### UI & Styling Standards
- **Vertical Flow**: Main content cards MUST be wrapped in `.sections-stack` with `height: auto`. NEVER set fixed `grid-row` spans for analytical cards.
- **Color Palette**:
  - **Background**: `#09090b` (bg-zinc-950).
  - **Cards**: `#18181b` (bg-zinc-900).
  - **Primary (Indigo)**: `#4f46e5` (Indigo-600) for standard analytics.
  - **Special (Awards)**: `#fde68a` to `#d97706` (Gold Gradient) exclusively for top-ranking rewards.
- **Typography**: Primary font is **'Manrope'**. Logo accent is **'Outfit'**.

---

## 4. Known Issues & Roadmap

### Known Issues
- **Tooltip Precision**: Chart tooltips on high-density bar charts may require manual adjustment if data points overlap on mobile viewports.
- **CSV Size**: As `master.csv` grows, initial page load parsing may experience latency. Potential fix: move to IndexedDB or a proper API backend.

### Roadmap
1. **Real-time Integration**: Transition from static CSV to a live Radar/GSE API.
2. **Predictive Analytics**: Implement ETA/ETD variance forecasting using baseline performance data.
3. **Stand-Level Heatmap**: Visual representation of stand occupancy and turnaround hotspots.

---
**Maintained by**: Antigravity AI
**Last Updated**: 2026-04-12
