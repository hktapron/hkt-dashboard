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

> **Bug Name**: Blank Dashboard & Extreme Sync Latency
> - **Hypothesis**: The `Validator` was too strict, checking for `FLT/Stand` columns which don't exist in the actual `master.csv` (uses `Flight In/Final Bay`). Additionally, sequential proxy fetching caused the "Long Load" hang.
> - **Attempt 1**: Aligned Validator with production headers + implemented Parallel Proxy Racing with a 4s timeout in `DataEngine`.
> - **Result**: ✅ SUCCESS. Dashboard renders instantly and data integrity is maintained using the correct production schema.

---
*Maintained by: Antigravity AI Protocol v1.0*
