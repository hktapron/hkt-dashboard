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

### [Template: Copy this for new bugs]
> **Bug Name**: short-description
> - **Hypothesis**: what-is-causing-it
> - **Attempt 1**: description-of-method
> - **Result**: [Failure Reason / Success Code Snippet]

---
*Maintained by: Antigravity AI Protocol v1.0*
