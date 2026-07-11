# HKT Dashboard — Bug Audit Specification

> ตรวจสอบเมื่อ: 11 ก.ค. 2026 | ฐานโค้ด: `app.js` v5.0 (1,670 บรรทัด) + `index.html` + `style.css`
> วิธีตรวจ: อ่านโค้ดทั้งไฟล์ + ดึง CSV จริงจาก Google Sheets ทั้ง Logs และ Master มาเทียบ header/ข้อมูลกับโค้ดทุกจุด

---

## ข้อมูลอ้างอิงที่ยืนยันจากชีทจริง

**Master sheet** (SHEET_2) — 14 header + ข้อมูลเปลี่ยนเบถึง index 20:
```
idx: 0=Date  1=Callsign  2=SIBT  3=ALDT  4=AIBT  5=A.FLIGHT  6=A/C
     7=D.FLIGHT  8=SOBT  9=AOBT  10=ATOT  11=Bay  12=Gate  13=Revision History
data: 13=เบเปลี่ยนครั้ง1(N)  14=เหตุผล1(O)  15=เบครั้ง2(P)  16=เหตุผล2(Q) ... 21=เบครั้ง5(V)
```

**Logs sheet** (SHEET_1):
```
idx: 0=Date  1=SIBT  2=ALDT  3=AIBT  4=Flight In  5=A/C Type  6=Flight Out
     7=SOBT  8=AOBT  9=ATOT  10=Original Bay  11=Original Gate  12=Final Bay
     13=Bay History 1  14=Bay Reason 1  15=Gate History 1 ...
```

**Date format**: ยืนยันเป็น **M/D/Y** (พบ `3/13/2026`, `7/9/2026` ในชีทจริง) → ตรงกับ default ของ `getRecordDate()` ✅ ไม่มีบัคเรื่อง format

---

## 🔴 BUG-01 (HIGH) — กลับจากโหมด Compare แล้วการ์ด Delay/OTP/Turnaround/Taxi หายถาวร

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:592-594` (ซ่อน) vs `app.js:526-565` (ไม่คืนค่า) |
| **อาการ** | กด Compare Analytics → กลับมา Overview → การ์ด Delay Performance, OTP Scorecard, Turnaround, Taxi Time **หายไปจนกว่าจะ refresh หน้า** |
| **สาเหตุ** | `renderCompareDashboard` ซ่อน `card-delay, card-otp, card-otp-trend, card-turnaround, card-taxi, card-flow` แต่ `renderDashboard` (Visibility Management) คืน display ให้แค่ `card-flow, card-peak, card-util, card-reasons, otpTrend, logsSection, monthlyTrends` — **ไม่เคยคืน 4 การ์ดแรก** |

**วิธีแก้** — เพิ่มใน Visibility Management ของ `renderDashboard` (ก่อน `if (mode === 'monthly')`):
```javascript
// Restore cards hidden by compare mode
['card-delay', 'card-otp', 'card-turnaround', 'card-taxi'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = '';   // กลับไปใช้ค่าจาก CSS
});
```

---

## 🔴 BUG-02 (HIGH) — Fallback index ของ Logs sheet ผิดทุกจุด (6 จุด) → ข้อมูลปนคอลัมน์เมื่อเซลล์ว่าง

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:632, 751-752, 771, 819-822, 885, 981` |
| **อาการ** | ปกติมองไม่เห็น เพราะ named key (`r['Final Bay']`) ทำงานก่อน แต่**เมื่อเซลล์ว่าง** (`''` เป็น falsy) โค้ดจะไปอ่าน `_raw[index]` ที่ชี้ผิดคอลัมน์ เช่น Final Bay ว่าง → ไปอ่าน `_raw[8]` = **AOBT** (เวลา เช่น "14:30") → `parseInt` ได้ 14 → **ถูกนับเป็น Bay 14 ใน Utilization/Flow ทั้งที่ไม่จริง** |
| **สาเหตุ** | fallback index เขียนไว้ตาม layout เก่าที่ไม่มี ALDT/AIBT/ATOT — ชีทจริงตอนนี้: Original Bay=10, Final Bay=12, SIBT=1, Bay Reason 1=14 |

ตารางจุดที่ผิด:

| บรรทัด | โค้ดปัจจุบัน | index ที่ถูกต้อง | ตอนนี้ชี้ไปที่ |
|---|---|---|---|
| 632, 819, 981 | `r['Final Bay'] \|\| _raw[8]` | `_raw[12]` | AOBT (เวลา!) |
| 751, 822 | `r['Original Bay'] \|\| _raw[6]` | `_raw[10]` | Flight Out |
| 752 | `r['Final Bay'] \|\| _raw[8]` | `_raw[12]` | AOBT |
| 771 | `_raw[10] \|\| _raw[11] \|\| _raw[9]` | `_raw[14]` | Original Bay / Original Gate / ATOT |
| 885 | `l['SIBT'] \|\| _raw[4]` | `_raw[1]` | Flight In (ไม่ crash แต่ parse ไม่ได้) |

**วิธีแก้** — แก้ index ให้ตรง และเปลี่ยนเงื่อนไข fallback ให้ใช้เฉพาะเมื่อ key **ไม่มีอยู่จริง** (ไม่ใช่แค่ว่าง):
```javascript
// helper กลาง — วางไว้ใกล้ classifyBay
function logVal(r, key, idx) {
    if (r[key] !== undefined) return r[key];        // '' ว่างจริง ให้คงว่าง ไม่ fallback
    return (r._raw && r._raw[idx]) || '';
}
// ตัวอย่างการใช้:
const from = classifyBay(logVal(r, 'Original Bay', 10));
const to   = classifyBay(logVal(r, 'Final Bay', 12));
const sibt = logVal(l, 'SIBT', 1);
let reason = logVal(r, 'Bay Reason 1', 14) || r['Reason'];
```

---

## 🟠 BUG-03 (MEDIUM) — Sample data (โหมด offline) ใช้ layout เก่า → KPI เป็น 0/เพี้ยนทั้งหน้า

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:420-428` (`getSampleMaster`, `getSampleLogs`) |
| **อาการ** | เมื่อโหลดชีทไม่ได้และ fallback ทำงาน — banner แจ้งเตือนขึ้นถูกต้อง แต่ตัวเลขตัวอย่างที่แสดงจะผิดหมด เพราะ sample ใช้ key เก่า `FLIGHT`/`FLIGHT_2` และ `_raw` layout เก่า (10 คอลัมน์) ซึ่งโค้ดปัจจุบันอ่าน `A.FLIGHT`/`D.FLIGHT` และ index 13-21 |

**วิธีแก้** — อัปเดต sample ให้ตรง layout ใหม่:
```javascript
function getSampleMaster() {
    const d = new Date().toLocaleDateString('en-US'); // M/D/YYYY ให้ตรงชีทจริง
    const raw = [d, 'AIQ3160', '08:00', '08:05', '08:10', 'AIQ650', 'HS-BBC',
                 'AIQ651', '09:00', '08:55', '09:05', '10', '10', '12', 'VE KS'];
    return [{ Date: d, Callsign: 'AIQ3160', SIBT: '08:00', ALDT: '08:05', AIBT: '08:10',
              'A.FLIGHT': 'AIQ650', 'A/C': 'HS-BBC', 'D.FLIGHT': 'AIQ651',
              SOBT: '09:00', AOBT: '08:55', ATOT: '09:05', Bay: '10', Gate: '10', _raw: raw }];
}
```
(`getSampleLogs` layout ตรงกับ Logs sheet อยู่แล้ว เพิ่มแค่ `_raw` ให้ครบ 15 ช่อง)

---

## 🟠 BUG-04 (MEDIUM) — `initChart` ถูก override plugins ทั้งก้อน → กราฟ Peak Hour มี tooltip/legend คนละแบบกับกราฟอื่น

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:1132` (`...options` spread) + call site `app.js:894-920` |
| **อาการ** | ทุกกราฟใช้ external tooltip (กล่องดำสวย) และซ่อน legend — ยกเว้น **Peak Hour Operations** ที่ส่ง `plugins: { tooltip: { callbacks } }` เข้ามา ทำให้ spread ทับ `plugins` ทั้ง object → legend เด้งกลับมาแสดง + tooltip เป็นแบบ native ของ Chart.js |
| **สาเหตุ** | `{ ...defaults, ...options }` เป็น shallow merge — key `plugins` ถูกแทนที่ทั้งก้อน |

**วิธีแก้** — merge ชั้น plugins แยก:
```javascript
// ใน initChart แทน `...options` ท้าย object:
const { plugins: optPlugins, ...restOpts } = options;
// ...
plugins: {
    legend: { display: false },
    tooltip: { enabled: false, position: 'average', external: externalTooltipHandler },
    ...(optPlugins || {})
},
// แล้ว spread ...restOpts ตำแหน่งเดิม
```
> หมายเหตุ: callback `afterBody` (Bay Changes) ของ Peak Hour ใช้กับ external tooltip ไม่ได้ตรงๆ ต้องย้ายข้อความไปใส่ใน label callback หรือยอมให้กราฟนี้ใช้ native tooltip แต่ปิด legend: `plugins: { legend: { display:false }, tooltip: {...} }`  (แก้ขั้นต่ำ 1 บรรทัดที่ call site)

---

## 🟠 BUG-05 (MEDIUM) — ช่องคะแนน OTP มี "ช่วงว่าง" ที่ได้ 0 แต้มโดยไม่ระบุใน tooltip

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:1335-1344` |
| **อาการ** | Arrival สาย **6–15 นาที** ได้ 0 แต้ม (ไม่เข้าเงื่อนไขไหนเลย), Arrival เร็วเกิน 20 นาที ได้ 0 แต้ม, Departure สาย 6–20 นาที ได้ 0 แต้ม — ทั้งหมด "ตกหล่น" แบบเงียบ ไม่ตรงกับ tooltip ที่อธิบายผู้ใช้ |
| **ผลกระทบ** | คะแนนไม่ผิด แต่ผู้ใช้อ่าน tooltip แล้วคำนวณตามไม่ได้ → ดูเหมือนระบบผิด |

**วิธีแก้ (เลือกอย่างใดอย่างหนึ่ง):**
1. **ยืนยันว่า 0 แต้มคือความตั้งใจ** → เพิ่มบรรทัดใน tooltip (index.html): `Arr Late 6-15m / Early >20m = 0pt`, `Dep Late 6-20m = 0pt`
2. หรือปรับ scoring ให้ครอบคลุมทุกช่วง (ต้องเคาะ business rule ก่อน)

---

## 🟡 BUG-06 (LOW-MEDIUM) — พิมพ์ค้นหาแล้ว re-render กราฟทั้งหน้า ~12 ตัวต่อ 1 ตัวอักษร

| | |
|---|---|
| **ไฟล์/บรรทัด** | `app.js:430-441` (`setupSearch`) |
| **อาการ** | พิมพ์ "AIQ650" = 6 ตัวอักษร → destroy+create กราฟ 6 รอบ (~70 chart instances) บนข้อมูล 1,400+ แถว → หน่วงบนมือถือ |

**วิธีแก้** — debounce 300ms:
```javascript
function setupSearch() {
    const input = document.getElementById('flight-search');
    if (!input) return;
    let t;
    input.addEventListener('input', (e) => {
        clearTimeout(t);
        t = setTimeout(() => {
            const term = e.target.value.toLowerCase();
            const mode = document.getElementById('filter-mode').value;
            const val = mode === 'daily'
                ? document.getElementById('daily-picker').value
                : document.getElementById('monthly-picker').value;
            renderDashboard(mode, val, term);
        }, 300);
    });
}
```

---

## 🟡 BUG-07 (LOW) — `noDataPlugin` มองข้อมูลที่เป็น 0 ทั้งหมดว่า "ไม่มีข้อมูล"

`app.js:21-22` — เงื่อนไข `v !== 0` ทำให้กราฟที่มีข้อมูลจริงแต่ค่าเป็น 0 ทุกช่อง (เช่น วันไม่มี delay เลย) ขึ้นข้อความ "ไม่มีข้อมูลในช่วงเวลานี้" ทั้งที่ควรโชว์แกนเปล่า
**วิธีแก้** (ถ้าต้องการแยก 2 กรณี): เช็คจาก `labels.length === 0` แทนค่าใน data:
```javascript
const hasData = chart.data.labels && chart.data.labels.length > 0 &&
    chart.data.datasets.some(ds => ds.data && ds.data.length > 0);
```
> ปัจจุบันพฤติกรรมนี้อาจ "โอเคอยู่แล้ว" ในเชิง UX — เลือกได้ว่าจะแก้หรือไม่

---

## 🟡 BUG-08 (LOW) — ข้อจำกัดการคำนวณข้ามเที่ยงคืนของ `getDelayMinutes`

`app.js:1166-1170` — heuristic ±720 นาที: ถ้าดีเลย์จริงเกิน 12 ชม. เครื่องหมายจะพลิก (เช่น สาย 13 ชม. → กลายเป็น "เร็ว 11 ชม.")
**ความเสี่ยงจริง**: ต่ำมาก (ไม่มีเที่ยวบินดีเลย์เกิน 12 ชม.ในข้อมูลปกติ) — **แนะนำรับทราบไว้ ไม่ต้องแก้** เว้นแต่จะเริ่มใส่ค่า `/1` (วันถัดไป) ในชีทอย่างสม่ำเสมอ ซึ่ง `parseTimeWithDay` รองรับแล้ว

เช่นเดียวกับ Turnaround (`app.js:1514-1516`): เวลา arr/dep สลับกันในวันเดียว จะถูกตีความเป็นค้างคืน ~23 ชม. — กันไว้แล้วบางส่วนด้วยเงื่อนไข `> 1440 return`

---

## 🟡 BUG-09 (ยอมรับความเสี่ยง — บันทึกไว้) — XSS จากข้อมูลชีทเข้า innerHTML

จุดฉีด: `app.js:789-797` (reasons list), `975-1007` (ตาราง), `1273-1274` (delay list), `1386-1395` (leaderboard), `1524` (dropdown)
**สถานะ**: ชีทไม่เปิดสาธารณะ → โอกาสโจมตีต่ำ ทีมรับความเสี่ยงแล้ว (บันทึกการตัดสินใจ 16 พ.ค. 2026)
**วิธีแก้เมื่อพร้อม** — helper เดียวใช้ทุกจุด:
```javascript
const esc = (s) => String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ใช้: `<td>${esc(r['A/C Type'])}</td>`
```

---

## 🧹 Housekeeping (ไม่ใช่บัค แต่ควรเก็บกวาด)

| รายการ | ที่อยู่ | ทำไม |
|---|---|---|
| `master.csv` ในโปรเจกต์เป็น export เก่า (layout เก่า) **ไม่ได้ใช้จริง** | repo root | ทำให้คนตรวจโค้ดเข้าใจผิด (audit รอบก่อนหลงเทียบกับไฟล์นี้) — ลบทิ้ง หรือ export ใหม่จากชีทปัจจุบัน |
| พารามิเตอร์ `logs` ไม่ได้ใช้แล้ว | `updateMasterMetrics` (675) | เหลือจากตอนย้ายการนับ changes มาที่ Master |
| ตัวแปร `under15` ประกาศแต่ไม่ใช้ | `renderDelaySection` (1228) | dead code |
| ตัวแปร `hasChange` ประกาศแต่ไม่ใช้ | `updateTable` (984) | dead code |
| `hideLoader()` ถูกเรียกซ้ำใน catch + finally | DOMContentLoaded (107, 110) | ไม่พัง แต่ซ้ำซ้อน |
| `const defaultFilter =` ไม่ได้ใช้ | DOMContentLoaded (94) | dead code |
| banner offline มี `display:none` ซ้ำ 2 ครั้งใน style attr | index.html | ซ้ำซ้อน ไม่มีผล |

---

## สิ่งที่ตรวจแล้ว "ไม่พบปัญหา" (ยืนยันกับข้อมูลจริง)

- ✅ Date format M/D/Y ตรงกับ default ของ `getRecordDate` — ไม่มีบัค D/M/Y ที่เคยสงสัย
- ✅ Master `_raw` index 13,15,17,19,21 (N,P,R,T,V) ตรงกับข้อมูลจริง (พบแถวเปลี่ยนเบ 2 ครั้งที่ index 13+15)
- ✅ คอลัมน์ V ยังไม่เคยมีข้อมูล (แถวกว้างสุด = index 20) — โค้ดกัน `undefined` ด้วย `|| ''` ครบทุกจุด
- ✅ `parseMasterDateTime` ใช้แค่ `.getHours()` ทุกจุด → ส่วนวันที่ที่ parse หลวมไม่มีผลกระทบจริง
- ✅ Total Flights / Total Changes / getFinalBay / Monthly Trend / getAirlineCode — แก้ถูกต้องแล้วจากรอบก่อน
- ✅ `parseTimeWithDay` validate ชั่วโมง/นาทีแล้ว, chart destroy + delete แล้ว, offline banner ทำงาน

---

## ลำดับความสำคัญที่แนะนำ

| ลำดับ | Bug | เหตุผล |
|---|---|---|
| 1 | BUG-01 การ์ดหายหลัง Compare | ผู้ใช้เจอได้ทุกวัน กระทบการใช้งานตรงๆ |
| 2 | BUG-02 Logs fallback index | ข้อมูลผิดแบบเงียบเมื่อเซลล์ว่าง |
| 3 | BUG-03 Sample data เก่า | โหมด offline โชว์ค่าผิดทั้งหน้า |
| 4 | BUG-04 Peak Hour tooltip/legend | ความสม่ำเสมอของ UI |
| 5 | BUG-06 Search debounce | ประสิทธิภาพบนมือถือ |
| 6 | BUG-05 ช่วงคะแนน 0 | เอกสาร/ความชัดเจน (รอเคาะ business rule) |
| 7 | BUG-07/08/09 + Housekeeping | ตามสะดวก |
