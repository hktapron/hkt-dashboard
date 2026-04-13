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

### [Bug: Stuck on Loading "Syncing with Cloud Data..."]
> - **Hypothesis**: `app.js` (the core engine) is missing from the directory after the rollback, causing a 404 error that prevents the loader from being hidden.
> - **Attempt 1**: Search for the missing file and check git history to restore the stable `app.js`.
> - **Result**: ✅ SUCCESS. Restored `app.js` from commit `a3d8d21`. The file was missing after the rollback because the modular `src/` folder was deleted but the monolithic `app.js` was not put back in the root.

---
*Maintained by: Antigravity AI Protocol v1.0*
