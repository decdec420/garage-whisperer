# Ratchet — Strategic Roadmap

> Five high-impact ideas to take Ratchet from "functional app" to "fundable product."  
> Each is a standalone sprint. Ordered by estimated impact-to-effort ratio.

---

## 1. Shareable Vehicle Health Report (Viral Loop)

**What**: Let users generate a one-page summary of their vehicle's health score, maintenance history, and upcoming services — shareable as a public link or downloadable PDF.

**Use cases**: Selling a car, showing a mechanic your history, bragging about your build.

**Why it matters**: Creates organic sharing and word-of-mouth. Every shared report is free marketing.

**Implementation sketch**:
- "Share Report" button on vehicle detail page
- Edge function generates styled HTML summary → renders to PDF or serves as a public read-only page
- Short-lived, token-gated links (24-hour expiry)
- New `shared_reports` table: `id`, `vehicle_id`, `token`, `expires_at`, `created_at`

---

## 2. Maintenance Cost Predictor

**What**: Using existing data (vehicle age, mileage, service history, known failure patterns), show users a 12-month cost forecast.

**Example output**: "Based on your 2012 Accord at 87k miles, expect ~$1,200 in maintenance this year."

**Why it matters**: This is the kind of insight that makes users never leave. Also positions Ratchet as a financial planning tool for vehicle ownership.

**Implementation sketch**:
- Dashboard widget showing projected costs
- Edge function queries historical data + service intervals + diagnostic patterns
- Aggregate data from `maintenance_logs`, `repair_logs`, `vehicle_service_schedules`

---

## 3. Mechanic Collaboration Mode

**What**: Let users invite their mechanic (via email link) to view a specific vehicle's diagnostics and chat history. The mechanic gets a read-only view without needing a full account.

**Why it matters**: Bridges DIY and professional. Makes Ratchet the communication layer between car owner and mechanic. Potential B2B revenue path.

**Implementation sketch**:
- New `shared_access` table: `id`, `vehicle_id`, `owner_user_id`, `recipient_email`, `token`, `permissions` (read/annotate), `expires_at`
- Read-only route `/shared/:token` — shows vehicle summary, diagnosis history, project status
- Owner can revoke access anytime

---

## 4. "Ask Ratchet" Embeddable Widget

**What**: A lightweight embeddable chat widget (like Intercom, but for car help) that partners — auto parts stores, car forums, dealerships — could embed on their sites.

**Why it matters**: Opens a massive distribution channel beyond the app. Every embedded widget is a lead-gen funnel.

**Implementation sketch**:
- Separate Vite build target producing an embeddable `<script>` + `<iframe>`
- Minimal UI: chat bubble → conversation panel
- API key per partner, rate-limited
- Monetization via API calls or partner licensing

---

## 5. OBD-II Bluetooth Integration

**What**: Connect to a $15 ELM327 Bluetooth adapter. Pull live DTCs, clear codes, read sensor data — all inside Ratchet.

**Why it matters**: Turns the app from "tracker" to "scanner." Single biggest differentiator vs. competitors. Hardware connection creates massive lock-in.

**Implementation sketch**:
- Web Bluetooth API (Chrome Android) or Capacitor BLE plugin (iOS/Android native)
- "Connect Scanner" flow in vehicle detail page
- Real-time sensor dashboard (RPM, coolant temp, voltage)
- Auto-import DTCs into `dtc_records` table
- Pair with existing diagnostic engine for instant analysis

---

## Priority Matrix

| Idea | Impact | Effort | Revenue Potential |
|------|--------|--------|-------------------|
| Health Report | High | Low | Indirect (viral) |
| Cost Predictor | High | Medium | Retention |
| Mechanic Collab | Medium | Medium | B2B |
| Embed Widget | High | High | Direct (API fees) |
| OBD-II | Very High | Very High | Lock-in + Premium |
