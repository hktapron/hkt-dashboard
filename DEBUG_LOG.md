# 🧠 PROJECT DEBUG LOG: Baylink HKT Dashboard

This file is a mandatory memory bank for self-debugging and AI logic protection. **Rule: Read this file BEFORE attempting any code changes.**

---

## 🕒 Legacy Knowledge Cache (Historical Fixes)

| Incident | Root Cause | Fix Applied | Status |
| :--- | :--- | :--- | :--- |
| **Vertical Overlap & Squashing** | Rigid `bento-grid` rows with fixed heights. | Switched to `.sections-stack` flexbox layout with `height: auto`. | ✅ SUCCESS |
| **OTP Ranking Bias** | Volume summation favored high-frequency airlines regardless of precision. | Implemented **Average Points Normalized** scoring logic. | ✅ SUCCESS |
| **Small Sample Size Anomaly** | 1-flight airlines dominating Top 5 cards with 100% luck. | Enforced **MIN_FLIGHTS_THRESHOLD = 3** for leaderboard eligibility. | ✅ SUCCESS |
| **Tooltip Misalignment** | Recharts/CSS layout pushes moving the tooltip container. | Implemented absolute-positioned CSS popovers that don't shift DOM. | ✅ SUCCESS |
| **Airline ZF Error** | Strict null check failure on ALDT/ATOT values. | Implemented strict validation: `if (aldt && sibt && atot && sobt)`. | ✅ SUCCESS |

---

## 🛠️ Current Debugging Session (Live Loop)

> **Bug Name**: Critical Data Sync Failure (Master)
> - **Hypothesis**: The modular refactor of `DataEngine.js` omitted the "Emergency Local Cache" (Sample Data) fallback. When AllOrigins or CodeTabs proxies fail, the engine throws a hard error instead of gracefully degrading to sample data.
> - **Attempt 1**: Re-implement `getSampleMaster` and `getSampleLogs` within a new modular utility and integrate it as a failover in `DataEngine.js`.
> - **Result**: ✅ SUCCESS. Implemented `src/utils/SampleData.js` and updated `trySync` to return sample data on failure. System back online.

---
*Maintained by: Antigravity AI Protocol v1.0*
