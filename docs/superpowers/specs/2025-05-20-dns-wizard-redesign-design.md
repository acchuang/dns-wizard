# DNS Wizard UI/UX Redesign — Design Specification

**Date:** 2025-05-20
**Status:** Approved
**Scope:** Full app redesign — all 6 tools, sidebar, onboarding, theme system

---

## Overview

DNS Wizard is a 6-tool network utility suite for macOS built with Tauri v2 + React 18 + TypeScript. The current UI uses a single pure-dark color scheme with inline CSS-in-JS (`React.CSSProperties`), no CSS framework, and no theming system. This redesign introduces a widget dashboard aesthetic with a dual light/dark theme, fresher macOS-native styling, and improved visual hierarchy across all screens.

## Design Direction

**Widget Dashboard** — compact metric tiles, bold data displays, rounded cards, soft borders, and a clean sidebar navigation. Inspired by macOS widgets but purpose-built for a network utility.

### Existing Feature: Simple Mode Toggle

The sidebar includes a Simple Mode toggle (eye icon) that switches between detailed technical output and plain-English summaries across all tools. The toggle uses `SimpleModeContext` (React context) and applies to all panels. The redesign preserves this feature: the toggle icon remains at the bottom of the sidebar (muted, 14px), accessible regardless of theme.

## Layout System

### Sidebar (56px width, frosted glass)

| Region         | Content                                                         |
| -------------- | --------------------------------------------------------------- |
| Top            | App icon (32×32, rounded 8px, brand gradient)                   |
| Navigation     | 6 icon buttons (36×36, rounded 8px, active = accent background) |
| Bottom (info)  | Network IP + current DNS display (compact, 2 lines, 9px text)   |
| Bottom (toggle)| System preference toggle: ☀️ / 🌙 / 🔄 (segmented pill, 28×28) |
| Background     | Light: `rgba(255,255,255,0.7)` with `backdrop-filter: blur(20px)`<br>Dark: `rgba(22,27,34,0.7)` with `backdrop-filter: blur(20px)` |

### Main Content Area

- Padding: 24px (top/left/right), scrollable
- Section spacing: 16px between widgets
- Content uses a flexible column layout with widget cards in rows

## Theme System

### Dual Theme with Auto Toggle

| Theme         | Trigger              | Base Background | Card Background | Accent      |
| ------------- | -------------------- | --------------- | --------------- | ----------- |
| macOS Light   | System light mode    | `#f5f5f7`       | `#ffffff`       | `#007aff`   |
| GitHub Dark   | System dark mode     | `#0d1117`       | `#161b22`       | `#58a6ff`   |

**Toggle behavior:**
- Defaults to `Auto` (follows `prefers-color-scheme`)
- 3-position segmented pill at sidebar bottom: Light → Auto → Dark
- Manual selection overrides system preference until user selects Auto again
- Persisted to `localStorage`

### Complete Color Tokens

| Token             | Light                     | Dark                      | Usage                          |
| ----------------- | ------------------------- | ------------------------- | ------------------------------ |
| `bg-app`          | `#f5f5f7`                 | `#0d1117`                 | Window background              |
| `bg-sidebar`      | `rgba(255,255,255,0.7)`   | `rgba(22,27,34,0.7)`      | Sidebar background             |
| `bg-card`         | `#ffffff`                 | `#161b22`                 | Card/panel backgrounds         |
| `bg-card-hover`   | `#f8f8fc`                 | `#1c2333`                 | Card hover state               |
| `bg-input`        | `#f2f2f7`                 | `#21262d`                 | Input fields, dropdowns        |
| `bg-selected`     | `rgba(0,122,255,0.08)`    | `rgba(88,166,255,0.1)`    | Selected item highlight        |
| `border`          | `rgba(0,0,0,0.06)`        | `#30363d`                 | Card/panel borders             |
| `border-strong`   | `rgba(0,0,0,0.1)`         | `#484f58`                 | Focus rings, dividers          |
| `text-primary`    | `#1d1d1f`                 | `#c9d1d9`                 | Headings, body text            |
| `text-secondary`  | `#6e6e73`                 | `#8b949e`                 | Secondary labels               |
| `text-tertiary`   | `#aeaeb2`                 | `#484f58`                 | Muted/placeholder text         |
| `accent`          | `#007aff`                 | `#58a6ff`                 | Buttons, links, active states  |
| `accent-hover`    | `#0062cc`                 | `#79c0ff`                 | Accent hover/interaction       |
| `success`         | `#34c759`                 | `#3fb950`                 | Positive status, good metrics  |
| `warning`         | `#ff9500`                 | `#db6d28`                 | Caution state, moderate values |
| `danger`          | `#ff3b30`                 | `#f85149`                 | Errors, poor metrics           |

### Typography

- **Font stack:** `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif`
- **Weights used:** 400 (body), 600 (labels), 700-800 (metric values, headings)
- **Size scale:** 8px (micro labels) → 9px (captions, secondary) → 11-12px (body, labels) → 14-16px (headings) → 22-36px (hero metrics, grade badges)

### Spacing & Shape

| Property      | Value                              |
| ------------- | ---------------------------------- |
| Card radius   | 12px (primary), 8px (tiles/inputs) |
| Sidebar items | 8px border-radius                  |
| Buttons       | 8-10px border-radius               |
| Gaps          | 4px, 6px, 8px, 12px, 16px          |

---

## Screen-by-Screen Specifications

### 1. Network Health Dashboard (Home Screen)

**Purpose:** At-a-glance overview of the user's network status. Acts as the landing screen.

**Layout:**
- Top bar: app title "DNS Wizard" (left) + current IP/DNS info (right, compact)
- 3 status cards in a row (equal width, 1:1:1)
- 3 quick action buttons below cards
- 4 data metric tiles in a row (latency, download, jitter, loss) — shown conditionally: display placeholder values ("—") before first speed test, populated with results after

**Default/Empty State:** DNS card shows current detected DNS server; Speed card shows "Not tested yet" with a "Run Test" link; Security card shows "Check recommended" with a "Run Leak Test" link.

**Status Cards (DNS, Speed, Security):**
```
┌─────────────────────┐
│  🔒 Icon   DNS      │
│  ● Green   Secure   │
│  1.1.1.1            │
└─────────────────────┘
```
- Each card: icon badge (20×20, accent-tinted background) + label + status indicator (7px colored dot with glow) + detail text
- DNS card shows server IP, Speed card shows grade (A+), Security card shows check/action needed
- "Fix" buttons on cards that need attention route to the relevant tool

**Quick Actions:** 3 equal-width buttons — "Quick Fix DNS" (accent-filled), "Run Speed Test" (outlined), "DNS Leak Test" (outlined)

### 2. DNS Wizard (3-Step Flow)

**Purpose:** Guided workflow to select a DNS profile, benchmark servers, and apply the fastest one.

**Step 1 — Choose Profile:**
- 3-step progress indicator at top (numbered dots, completed = green, active = accent, pending = muted)
- 8 profile cards in a 2×4 or 4×2 grid
- Selected card: accent border + subtle accent background tint + subtle glow
- Unselected cards: 70% opacity or muted border
- Profile card content: emoji icon (18px), name (11px, bold), tagline (9px, tertiary)
- Next/Back buttons at bottom (accent-filled Next on right)

**Step 2 — Benchmark:**
- Animated spinner (accent color, 32×32) centered
- Status text: "Benchmarking DNS servers..." (12px, secondary)
- Progress bar if measurable, otherwise indeterminate
- Abort button below spinner
- Error state: retry button + error message

**Step 3 — Results:**
- Progress indicator shows all 3 steps completed (green)
- Results table: server IP, latency (ms), status (Fastest / OK / Slow)
- Fastest server highlighted with green row background tint
- Primary CTA: "Apply [Server IP]" (success-colored button)
- Secondary: "Restore Defaults", "Flush DNS Cache" (outlined/muted)
- Export button (CSV/JSON dropdown)

**Progress Indicator Component:**
```
[✓]──[✓]──[3]     (step 3 active)
[✓]──[2]──[3]     (step 2 active)
[1]──[2]──[3]     (step 1 active)
```
- Completed steps: green, checkmark icon
- Active step: accent color, number
- Pending steps: muted border, number
- Connector lines: matching completed/accent color

### 3. Speed Test

**Purpose:** Run latency + download benchmarks and display a Network Quality Score.

**Layout:**
- **Grade Badge** (top-left): Large colored tile with letter grade, subtitle "Network Quality Score" with human-readable label
- **Gauge Arc** (center): SVG half-circle gauge (220×110) showing download speed in Mbps. Animated needle. Color gradient from green (fast) through yellow to red (slow).
- **4 Metric Tiles** (row): Latency (ms, green), Jitter (ms, blue), Loss (%, accent), Download (Mbps, primary)
- **Download Stage Bars** (vertical list): 5 horizontal progress bars (100kB → 50MB), each showing Mbps value. Gradient fill from accent.
- **Actions:** "Run Speed Test" button (accent-filled, full-width), "Export" dropdown (outlined)
- **History** (collapsible section): Table of past test results from localStorage, with timestamps, grades, and speeds

**Grade-to-Score Mapping:**

| Grade | Score Range  | Label     | Badge Color |
| ----- | ------------ | --------- | ----------- |
| A+    | ≥ 90         | Excellent | `success`   |
| A     | 80–89        | Great     | `success`   |
| B     | 65–79        | Good      | `success`   |
| C     | 50–64        | Fair      | `warning`   |
| D     | 35–49        | Poor      | `warning`   |
| F     | < 35         | Bad       | `danger`    |

The existing scoring algorithm (weighted combination of latency and download speed) remains unchanged. Only the visual presentation is redesigned.

**States:**
- **Idle:** Grade badge shows "—" with muted color, gauge shows no reading (placeholder), metric tiles show "—", stage bars hidden. "Run Speed Test" button prominent.
- **Running:** Gauge animates, metric tiles update in real time, stage bars fill progressively. Button replaced by spinner + "Testing..." label. Current stage name displayed under spinner.
- **Complete:** Grade badge filled with score, gauge needle rests on final value, all tiles populated, stage bars fully rendered. "Run Speed Test" reverts to button.
- **Error:** Grade badge shows "⚠️" in danger color, error message displayed below gauge ("Connection failed. Check your network."), "Retry" button shown.
- **History:** Hidden by default. Expandable section with timestamp, grade, speed, and latency per entry. Empty state: "No test history yet."

### 4. Ping & Traceroute

**Purpose:** TCP ping and hop-by-hop traceroute to a target host.

**Layout:**
- **Input Row:** Host input field (flex:1, with "TCP:443" badge) + 3 preset buttons (Cloudflare, Google, Quad9) + "Run Ping" button (accent-filled)
- Presets shown as small pill buttons, active one gets accent border
- **Result Table:** Compact data table with columns — #, Host, IP, Time (ms), Status (✓)
- Row highlight: green text for low latency, yellow for moderate, red for high (>50ms)
- **Summary Tiles** (row below table): Avg, Min, Max, Loss %, Ping Count (4-5 equal tiles)
- **Traceroute Tab** (optional secondary view): Hop-by-hop table with IP, hostname, latency per hop, timeout indicator

**States:**
- **Idle:** Input field empty/default, presets visible, "Run Ping" button enabled with placeholder text. Result table area shows empty state: "Enter a host and run ping to see results."
- **Running:** Button shows spinner + "Pinging..." label. Result rows appear progressively as responses arrive. Table scrolls automatically to latest entry.
- **Complete:** All rows populated, summary tiles filled, "Run Ping" reverts to button. If all packets lost: summary shows 100% loss in danger color, table shows all rows as timed out.
- **Error:** Host unreachable: error banner below input ("Cannot resolve host. Check the address and try again."). Connection refused: "Connection refused on TCP:443."
- **Traceroute:** Results show per-hop latency. Timeout hops marked with "—" and danger color. Max 20 hops with 2s timeout per hop.

### 5. DNS Leak Test

**Purpose:** Verify no DNS queries leak to unintended servers.

**Layout:**
- **Result Banner** (top): Large success/warning card with icon (✅/⚠️), bold status text, and explanation
- **Detected Servers List:** Card list showing each detected DNS server with: server IP/icon, provider name, location, and status badge (Configured ✓ or Leaked ⚠️)
- Leaked servers get a warning-colored border and status indicator
- **Side Panel (right):** Two stat tiles — "Servers Detected" (count), "Leaked Servers" (count, green if 0, red if >0)
- **Action:** "Run Leak Test" button (accent-filled)

**States:**
- **Idle:** Banner area shows "No test run yet" with muted text. Server list empty. Stat tiles show "—". "Run Leak Test" button prominent.
- **Running:** Button shows spinner + "Testing..." label. Status text: "Checking DNS resolution paths..."
- **Complete (No Leaks):** Banner shows ✅ "No Leaks Detected" in success color. Server list populated with detected servers, all marked "Configured". Leaked count = 0 (green).
- **Complete (Leaks Found):** Banner shows ⚠️ "[N] Leak(s) Detected" in danger color. Leaked servers highlighted with danger border. Leaked count > 0 (red).
- **Error:** Banner shows ⚠️ "Test failed" in danger color. Error message: "Unable to complete DNS leak test. Check your network connection and try again." Retry button shown.

### 6. About

**Purpose:** App documentation, version info, keyboard shortcuts, and support link.

**Layout:**
- **Centered header:** App icon (40×40), "DNS Wizard" title, version number
- **Description card:** Brief summary of the 6 tools
- **Stats row:** 3 metric cards — Tools (6), Commands (14), Telemetry (0/None)
- **Keyboard Shortcuts** (compact grid): Cmd+1 through Cmd+6 mapped to tools
- **Footer:** "☕ Buy Me a Coffee" button (orange/warm accent)

### 7. Onboarding Modal

**Purpose:** First-run walkthrough for new users.

**Layout:** Modal overlay with backdrop blur. Centered card (280px width).

- **Step indicators:** Dot navigation (active = accent, inactive = muted border)
- **4 Steps:**
  - Step 1: Welcome — app icon/emoji + "Welcome to DNS Wizard" + one-sentence description
  - Step 2: DNS Wizard — emoji + "Find Your Fastest DNS" + "Pick a profile, benchmark servers, and apply the best one"
  - Step 3: Speed Test — emoji + "Measure Your Speed" + "Get a Network Quality Score with detailed metrics"
  - Step 4: Leak Test — emoji + "Verify Your Privacy" + "Make sure your DNS isn't leaking to unintended servers"
- **Navigation:** Skip (left, muted) + Next/Get Started (right, accent-filled)
- **Dismissible:** Click backdrop or skip to close; remembered via localStorage flag

---

## Shared Components

### Metric Tile
- Fixed height (varies by context: 48-72px)
- Centered content: large value (14-16px, bold) + label (7-9px, tertiary)
- Background: card color, border: default border color
- Optional: value colored by status (green/good, yellow/warning, red/poor)

### Status Dot
- 7px circle with colored glow (`box-shadow: 0 0 6px <color>40`)
- Green (`success`), Yellow (`warning`), Red (`danger`)

### Data Table
- Compact: 9-10px font, 5-6px cell padding
- Header row: secondary background, bold secondary text
- Row dividers: subtle border (1px border color)
- Zebra: alternating rows optional for large datasets

### Progress Bar
- 5-6px height, rounded 3px
- Track: input background color
- Fill: gradient using accent colors
- Label: value displayed outside bar (Mbps, ms, etc.)

### Export Button
- Dropdown trigger: "Export" with chevron
- Menu items: "Export as CSV", "Export as JSON"
- Uses Tauri save dialog for file destination

### Tooltip
- CSS-only hover tooltip (already exists, unchanged)
- Dark theme aware: adapts background/text per current theme

---

## localStorage Handling

The app uses localStorage for theme preference, speed test history, Simple Mode preference, and onboarding dismissal. If localStorage is unavailable (private browsing, storage quota):

- **Fallback:** In-memory state is used for the session; no data persists across launches
- **Onboarding:** If the dismissal flag cannot be persisted, the onboarding modal shows on every launch — this is an acceptable edge case for private browsing
- **Speed test history:** Falls back to an in-memory array for the current session
- **Theme preference:** Falls back to system preference only; manual override is not remembered

No user-facing errors are shown for localStorage unavailability — the app degrades silently.

---

## Implementation Approach

### Current State vs Target

| Aspect           | Current                          | Target                                  |
| ---------------- | -------------------------------- | --------------------------------------- |
| Styling          | Inline `CSS.CSSProperties`       | CSS custom properties (variables)       |
| Theming          | Single dark theme, hardcoded     | Dual theme via `data-theme` attribute   |
| Color references | Hex values scattered in JSX      | `var(--token-name)` references          |
| Components       | Each file contains inline styles | Shared token file + per-component vars  |

### Migration Strategy

1. **Create `src/styles/tokens.css`** — define all color tokens as CSS custom properties under `:root` (light default) and `[data-theme="dark"]`
2. **Refactor global styles** in `src/styles/index.css` — use token references for body, scrollbars, keyframes
3. **Refactor one screen at a time** — start with `HealthPanel` (simplest), progress to `SpeedPanel`, `DnsPanel`, etc.
4. **Update shared components** — `Sidebar`, `ResultTable`, `ExportButton`, `Tooltip`, `ProgressDots`
5. **Add theme context** — `ThemeContext` wraps app, reads `localStorage` + system preference, sets `data-theme` on `<html>`
6. **Update onboarding modal** — use token references
7. **Remove old hardcoded colors** — final cleanup pass

### Files to Create
- `src/styles/tokens.css`
- `src/components/ThemeContext.tsx`

### Files to Modify
- `src/styles/index.css`
- `src/App.tsx`
- `src/components/Sidebar.tsx`
- `src/components/DnsPanel.tsx`
- `src/components/Step1_ChooseProfile.tsx`
- `src/components/Step2_Benchmark.tsx`
- `src/components/Step3_Results.tsx`
- `src/components/ProfileCard.tsx`
- `src/components/SpeedPanel.tsx`
- `src/components/SpeedGauge.tsx`
- `src/components/PingPanel.tsx`
- `src/components/LeakPanel.tsx`
- `src/components/HealthPanel.tsx`
- `src/components/AboutPanel.tsx`
- `src/components/OnboardingModal.tsx`
- `src/components/ResultTable.tsx`
- `src/components/ExportButton.tsx`
- `src/components/Tooltip.tsx`
- `src/components/ProgressDots.tsx`

---

## Success Criteria

1. ✅ App renders correctly in both light and dark modes
2. ✅ Theme toggle (Light/Auto/Dark) switches themes and persists preference
3. ✅ All 6 tools maintain full functionality with new styling
4. ✅ No visual regressions: all interactive states (hover, active, selected, disabled) are styled
5. ✅ Keyboard shortcuts (Cmd+1 through Cmd+6) continue to work
6. ✅ Onboarding modal works on first launch
7. ✅ Export buttons function with Tauri save dialog
8. ✅ Simple Mode toggle is preserved and works with both themes
