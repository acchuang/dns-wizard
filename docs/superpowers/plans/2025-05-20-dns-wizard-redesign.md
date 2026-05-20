# DNS Wizard UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 6 tool panels, sidebar, onboarding, and shared components with a dual-theme widget dashboard aesthetic (macOS Light + GitHub Slate Dark), replacing inline CSS-in-JS with CSS custom properties.

**Architecture:** Create `src/styles/tokens.css` with all color tokens as CSS custom properties under `:root` (light) and `[data-theme="dark"]` (dark). Create `ThemeContext` to manage theme state, reading `localStorage` + `prefers-color-scheme`, setting `data-theme` on `<html>`. Refactor every component from inline `React.CSSProperties` to `var(--token)` references in CSS classes. No framework added — pure CSS custom properties with a single tokens file.

**Tech Stack:** React 18, TypeScript 5.6, Vite 6, Tauri v2, Lucide React v0.460 — same as current. No new dependencies.

---

## Chunk 1: CSS Token System

### Task 1: Create tokens.css

**Files:**
- Create: `src/styles/tokens.css`

- [ ] **Step 1: Write tokens.css**

Create `src/styles/tokens.css` with the complete dual-theme color token system:

```css
/* ===== DNS Wizard Design Tokens ===== */
/* Light theme (default) */
:root {
  --bg-app: #f5f5f7;
  --bg-sidebar: rgba(255, 255, 255, 0.7);
  --bg-card: #ffffff;
  --bg-card-hover: #f8f8fc;
  --bg-input: #f2f2f7;
  --bg-selected: rgba(0, 122, 255, 0.08);
  --border: rgba(0, 0, 0, 0.06);
  --border-strong: rgba(0, 0, 0, 0.1);
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --text-tertiary: #aeaeb2;
  --accent: #007aff;
  --accent-hover: #0062cc;
  --accent-muted: rgba(0, 122, 255, 0.1);
  --success: #34c759;
  --success-muted: rgba(52, 199, 89, 0.1);
  --warning: #ff9500;
  --warning-muted: rgba(255, 149, 0, 0.1);
  --danger: #ff3b30;
  --danger-muted: rgba(255, 59, 48, 0.1);
  --coffee: #ff813f;
  --card-radius: 12px;
  --tile-radius: 8px;
  --sidebar-width: 52px;
  --font-stack: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
}

[data-theme="dark"] {
  --bg-app: #0d1117;
  --bg-sidebar: rgba(22, 27, 34, 0.7);
  --bg-card: #161b22;
  --bg-card-hover: #1c2333;
  --bg-input: #21262d;
  --bg-selected: rgba(88, 166, 255, 0.1);
  --border: #30363d;
  --border-strong: #484f58;
  --text-primary: #c9d1d9;
  --text-secondary: #8b949e;
  --text-tertiary: #484f58;
  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --accent-muted: rgba(88, 166, 255, 0.1);
  --success: #3fb950;
  --success-muted: rgba(63, 185, 80, 0.1);
  --warning: #db6d28;
  --warning-muted: rgba(219, 109, 40, 0.1);
  --danger: #f85149;
  --danger-muted: rgba(248, 81, 73, 0.1);
  --coffee: #db6d28;
}

/* Shared base styles using tokens */
body {
  font-family: var(--font-stack);
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-size: 14px;
  overflow: hidden;
  -webkit-tap-highlight-color: transparent;
}

#root {
  width: 100vw;
  height: 100vh;
  display: flex;
  padding: 0;
}
```

- [ ] **Step 2: Import tokens.css in index.html**

Add the tokens.css import to `index.html` as the first stylesheet (before any other CSS):

```html
<link rel="stylesheet" href="/src/styles/tokens.css" />
```

- [ ] **Step 3: Remove body/#root from index.css**

Remove the `body` and `#root` rules from `src/styles/index.css` since they now live in `tokens.css`. Keep the reset, focus, keyframes, gauge ticks, and tooltip styles.

- [ ] **Step 4: Verify with vite build**

Run: `npx vite build`
Expected: Build succeeds with no CSS errors. Output should include both CSS files bundled.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/index.css index.html
git commit -m "feat: add CSS custom property token system with dual theme support"
```

---

## Chunk 2: Theme Context + App Integration

### Task 2: Create ThemeContext

**Files:**
- Create: `src/components/ThemeContext.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write ThemeContext**

Create `src/components/ThemeContext.tsx`:

```tsx
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

type Theme = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  resolved: "light" | "dark";
}

const STORAGE_KEY = "dnswizard-theme";

function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {}
  return "auto";
}

function resolveTheme(t: Theme): "light" | "dark" {
  if (t === "auto") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return t;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "auto",
  setTheme: () => {},
  resolved: "light",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [resolved, setResolved] = useState<"light" | "dark">(() => resolveTheme(getStoredTheme()));

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try { localStorage.setItem(STORAGE_KEY, t); } catch {}
  }, []);

  useEffect(() => {
    const resolvedValue = resolveTheme(theme);
    setResolved(resolvedValue);
    document.documentElement.setAttribute("data-theme", resolvedValue);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      setResolved(resolveTheme(theme));
      document.documentElement.setAttribute("data-theme", resolveTheme(theme));
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export default ThemeContext;
```

- [ ] **Step 2: Wrap App with ThemeProvider**

Modify `src/App.tsx`:
1. Import `ThemeProvider` from `./components/ThemeContext`
2. In the `App` function, wrap `SimpleModeProvider` with `ThemeProvider`:

```tsx
import { ThemeProvider } from "./components/ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <SimpleModeProvider>
        <AppInner />
      </SimpleModeProvider>
    </ThemeProvider>
  );
}
```

3. In `AppInner`, change the root div's inline backgroundColor from `"#1a1a2e"` to `"var(--bg-app)"`:

```tsx
<div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "var(--bg-app)" }}>
```

- [ ] **Step 3: Verify with vite build + typecheck**

Run: `npx tsc --noEmit && npx vite build`
Expected: TypeScript compiles with no errors. Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ThemeContext.tsx src/App.tsx
git commit -m "feat: add ThemeContext with light/auto/dark toggle"
```

---

## Chunk 3: Sidebar Refactor

### Task 3: Refactor Sidebar

**Files:**
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/styles/index.css` (add sidebar classes)

- [ ] **Step 1: Add sidebar CSS classes to index.css**

Append to `src/styles/index.css`:

```css
.sidebar {
  width: var(--sidebar-width);
  min-height: 100%;
  background: var(--bg-sidebar);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 8px;
  gap: 3px;
  border-right: 1px solid var(--border);
  box-sizing: border-box;
  overflow: hidden;
}

.sidebar-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 12px;
  margin-bottom: 8px;
}

.sidebar-btn {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--text-tertiary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s, color 0.2s;
}

.sidebar-btn:hover {
  background: var(--bg-selected);
  color: var(--accent);
}

.sidebar-btn.active {
  background: var(--accent);
  color: #fff;
}

.sidebar-ip {
  width: 48px;
  padding: 6px 2px;
  text-align: center;
  font-size: 8px;
  color: var(--text-tertiary);
  line-height: 1.3;
  margin-bottom: 4px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 6px;
  word-break: break-all;
  overflow-wrap: break-word;
}

.sidebar-ip-label {
  font-size: 7px;
  color: var(--text-secondary);
  margin-bottom: 2px;
  letter-spacing: 0.5px;
}

.sidebar-ip-value {
  font-size: 9px;
  font-weight: 600;
  color: var(--text-secondary);
}

.sidebar-theme-toggle {
  display: flex;
  gap: 2px;
  background: var(--bg-input);
  border-radius: 14px;
  padding: 2px;
  margin-top: 4px;
}

.sidebar-theme-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-tertiary);
  transition: background 0.2s;
}

.sidebar-theme-btn.active {
  background: var(--accent);
  color: #fff;
}
```

- [ ] **Step 2: Refactor Sidebar.tsx to use CSS classes + tokens + theme toggle**

Refactor `Sidebar.tsx` with these exact changes:

1. **Imports:** Add `import { useTheme } from "./ThemeContext"`

2. **Remove** all inline style constants (`sidebarStyle`, `btnStyle`) — delete them entirely

3. **Root div:** Replace `<div style={sidebarStyle}>` with `<div className="sidebar">`

4. **Logo:** Add a logo div before the IP info section (first child of sidebar):
   ```tsx
   <div className="sidebar-logo">D</div>
   ```

5. **IP info section:** Replace the conditional IP info block's inline styles with:
   ```tsx
   {ipInfo && (
     <div className="sidebar-ip" title={`IP: ${ipInfo.ip}\nISP: ${ipInfo.isp}\n${ipInfo.city}, ${ipInfo.country}`}>
       <div className="sidebar-ip-label">MY IP</div>
       <div className="sidebar-ip-value">{ipInfo.ip}</div>
     </div>
   )}
   ```

6. **Navigation buttons:** Replace the `tools.map(...)` rendering. Each button:
   ```tsx
   <button
     key={tool.id}
     className={`sidebar-btn ${activeTool === tool.id ? 'active' : ''}`}
     onClick={() => onToolChange(tool.id)}
     title={tool.label}
     aria-label={tool.label}
     aria-pressed={activeTool === tool.id}
   >
     <Icon size={20} />
   </button>
   ```

7. **Spacer:** Replace `<div style={{ flex: 1 }} />` — keep as-is (no visual style needed)

8. **Simple Mode toggle:** Replace inline styles with:
   ```tsx
   <button
     className="sidebar-btn"
     style={{
       background: simpleMode ? 'var(--accent-muted)' : 'transparent',
       color: simpleMode ? 'var(--accent)' : 'var(--text-tertiary)',
     }}
     onClick={toggleSimpleMode}
     title={simpleMode ? "Show technical details" : "Hide technical details"}
     aria-label={simpleMode ? "Switch to detailed mode" : "Switch to simple mode"}
   >
     {simpleMode ? <EyeOff size={16} /> : <Eye size={16} />}
   </button>
   ```

9. **Theme toggle** (add between Simple Mode and About, after the spacer):
   ```tsx
   import { useTheme } from "./ThemeContext";
   // In the component:
   const { theme, setTheme } = useTheme();
   ```
   JSX for theme toggle:
   ```tsx
   <div className="sidebar-theme-toggle">
     <button className={`sidebar-theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')} title="Light mode">☀️</button>
     <button className={`sidebar-theme-btn ${theme === 'auto' ? 'active' : ''}`} onClick={() => setTheme('auto')} title="Auto mode">🔄</button>
     <button className={`sidebar-theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')} title="Dark mode">🌙</button>
   </div>
   ```

10. **About button:** Replace inline styles with:
    ```tsx
    <button
      className={`sidebar-btn ${activeTool === 'about' ? 'active' : ''}`}
      onClick={() => onToolChange("about")}
      title="About"
      aria-label="About"
      aria-pressed={activeTool === "about"}
    >
      <Info size={20} />
    </button>
    ```

Keep the `useState`, `useEffect`, `invoke`, and `PublicIpInfo` logic identical — only change the rendering styles.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx src/styles/index.css
git commit -m "refactor: sidebar with CSS classes, token references, and theme toggle"
```

---

## Chunk 4: Shared Components

### Task 4: Refactor shared components (ResultTable, ExportButton, Tooltip, ProgressDots)

**Files:**
- Modify: `src/components/ResultTable.tsx`
- Modify: `src/components/ExportButton.tsx`
- Modify: `src/components/Tooltip.tsx`
- Modify: `src/components/ProgressDots.tsx`
- Modify: `src/styles/index.css`

- [ ] **Step 1: Update Tooltip styles with token references**

In `src/styles/index.css`, update `.tooltip-wrapper`, `.tooltip-box` to use tokens:

```css
.tooltip-wrapper {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: help;
  border-bottom: 1px dotted var(--text-tertiary);
}

.tooltip-box {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--bg-card);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 400;
  padding: 8px 12px;
  border-radius: 6px;
  white-space: normal;
  width: max-content;
  max-width: 260px;
  z-index: 1000;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.tooltip-wrapper:hover .tooltip-box {
  display: block;
}
```

- [ ] **Step 2: Refactor ResultTable to use CSS classes**

Replace inline `tableStyle`, `thStyle`, `tdStyle` with CSS classes using tokens. Add to `index.css`:

```css
.result-table {
  width: 100%;
  border-collapse: collapse;
}

.result-table th {
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
}

.result-table td {
  padding: 8px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
}
```

Update `ResultTable.tsx` to use `className="result-table"` and remove the inline style constants.

- [ ] **Step 3: Refactor ExportButton to use tokens**

Replace all hardcoded colors in `ExportButton.tsx` inline styles with `var(--token)`:
- Button background: `transparent`
- Button border: `var(--border)`
- Button color: `var(--text-secondary)`
- Dropdown background: `var(--bg-card)`
- Dropdown border: `var(--border)`
- Menu item color: `var(--text-primary)`
- Menu item hover: use a CSS class

- [ ] **Step 4: Refactor ProgressDots to use tokens**

Replace `dotStyle` function. Add to `index.css`:

```css
.progress-dots {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  transition: background-color 0.3s ease;
}

.progress-dot.active {
  background: var(--accent);
}

.progress-dot.done {
  background: var(--success);
}
```

Update `ProgressDots.tsx` to use these classes and update dot states to show checkmarks or numbers per the spec (completed = green with ✓, active = accent with number, pending = muted border with number).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ResultTable.tsx src/components/ExportButton.tsx src/components/Tooltip.tsx src/components/ProgressDots.tsx src/styles/index.css
git commit -m "refactor: shared components to use CSS token references"
```

---

## Chunk 5: HealthPanel Refactor

### Task 5: Refactor HealthPanel

**Files:**
- Modify: `src/components/HealthPanel.tsx`
- Modify: `src/styles/index.css` (add health panel classes)

- [ ] **Step 1: Add health panel CSS classes to index.css**

```css
.health-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 16px;
}

.health-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.health-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.health-header-right {
  font-size: 10px;
  color: var(--text-tertiary);
}

.health-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.health-cards {
  display: flex;
  gap: 8px;
}

.health-card {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--card-radius);
  padding: 14px;
}

.health-card-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}

.health-card-label {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 10px;
}

.health-status-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.health-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 6px var(--status-color);
  flex-shrink: 0;
}

.health-status-dot.good { background: var(--success); }
.health-status-dot.warn { background: var(--warning); }
.health-status-dot.bad { background: var(--danger); }
.health-status-dot.unknown { background: var(--text-tertiary); }

.health-status-text {
  font-weight: 700;
  font-size: 13px;
}

.health-status-text.good { color: var(--success); }
.health-status-text.warn { color: var(--warning); }
.health-status-text.bad { color: var(--danger); }
.health-status-text.unknown { color: var(--text-tertiary); }

.health-card-detail {
  color: var(--text-tertiary);
  font-size: 10px;
  margin-top: 4px;
}

.health-actions {
  display: flex;
  gap: 8px;
}

.health-metric-tiles {
  display: flex;
  gap: 6px;
}

.health-metric-tile {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--tile-radius);
  padding: 10px;
  text-align: center;
}

.health-metric-value {
  font-weight: 800;
  font-size: 14px;
  color: var(--text-primary);
}

.health-metric-label {
  color: var(--text-tertiary);
  font-size: 8px;
  margin-top: 2px;
}

.btn-accent {
  padding: 8px 16px;
  border-radius: var(--tile-radius);
  border: none;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}

.btn-outline {
  padding: 8px 16px;
  border-radius: var(--tile-radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--accent);
  font-weight: 600;
  font-size: 12px;
  cursor: pointer;
}
```

- [ ] **Step 2: Rewrite HealthPanel with widget layout per spec**

Rewrite `HealthPanel.tsx` to use the new CSS classes and match the widget dashboard layout:
1. Top bar: title "DNS Wizard" left + current IP/DNS info right
2. 3 health cards in a row (DNS, Speed, Security) — each with icon badge, status dot + label, detail text
3. 3 quick action buttons: "Quick Fix DNS" (accent-filled), "Run Speed Test" (outlined), "DNS Leak Test" (outlined)
4. 4 metric tiles: latency, download, jitter, loss — show "—" placeholders before any speed test, populated after
5. Keep existing health check logic (DNS detection, speed history reading, etc.)
6. Keep SimpleMode support

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HealthPanel.tsx src/styles/index.css
git commit -m "refactor: HealthPanel with widget dashboard layout and token references"
```

---

## Chunk 6: SpeedPanel + SpeedGauge Refactor

### Task 6: Refactor SpeedPanel + SpeedGauge

**Files:**
- Modify: `src/components/SpeedPanel.tsx`
- Modify: `src/components/SpeedGauge.tsx`
- Modify: `src/styles/index.css` (add speed panel classes)

- [ ] **Step 1: Add speed panel CSS classes to index.css**

```css
.speed-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  gap: 16px;
  overflow-y: auto;
}

.speed-grade-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.speed-grade-tile {
  width: 48px;
  height: 48px;
  border-radius: var(--tile-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 800;
  font-size: 22px;
}

.speed-grade-tile.excellent { background: linear-gradient(135deg, var(--success), #059669); }
.speed-grade-tile.good, .speed-grade-tile.great { background: linear-gradient(135deg, var(--success), #059669); }
.speed-grade-tile.fair, .speed-grade-tile.poor { background: linear-gradient(135deg, var(--warning), #c2410c); }
.speed-grade-tile.bad { background: linear-gradient(135deg, var(--danger), #dc2626); }

.speed-grade-label {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 13px;
}

.speed-grade-detail {
  color: var(--success);
  font-size: 11px;
  font-weight: 600;
}

.speed-metric-tiles {
  display: flex;
  gap: 6px;
  width: 100%;
  max-width: 360px;
}

.speed-metric-tile {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--tile-radius);
  padding: 10px;
  text-align: center;
}

.speed-metric-value {
  font-weight: 800;
  font-size: 16px;
}

.speed-metric-label {
  color: var(--text-tertiary);
  font-size: 8px;
  margin-top: 2px;
}

.speed-stage-bars {
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.speed-stage-bar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
}

.speed-stage-bar-track {
  flex: 1;
  height: 5px;
  background: var(--bg-input);
  border-radius: 3px;
  overflow: hidden;
}

.speed-stage-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent-hover));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.speed-history-toggle {
  width: 100%;
  max-width: 360px;
  margin-top: 8px;
}

.speed-history-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-tertiary);
}

/* Gauge updates */
.speed-gauge-tick line {
  stroke: var(--text-tertiary);
  stroke-width: 1.5;
}

.speed-gauge-tick text {
  fill: var(--text-tertiary);
  font-size: 11px;
}
```

- [ ] **Step 2: Refactor SpeedGauge to use tokens**

Replace all hardcoded colors in `SpeedGauge.tsx` with `var(--token)` references:
- Background arc: `var(--bg-input)` instead of `#1e293b`
- Arc colors: keep dynamic `getArcColor()` values (those are semantic), update the colors to match token values: `#06b6d4` → `var(--accent)`, `#22c55e` → `var(--success)`, `#eab308` → `var(--warning)`, `#ef4444` → `var(--danger)`
- Center text colors: use `var(--text-secondary)` and `var(--text-tertiary)`

- [ ] **Step 3: Refactor SpeedPanel with widget dashboard layout**

Rewrite `SpeedPanel.tsx`:
1. **Grade badge** at top-left: a colored tile with letter grade + subtitle "Network Quality Score" + human-readable label. Use CSS classes `speed-grade-badge`, `speed-grade-tile` with modifier classes (`excellent`, `good`, `fair`, `poor`, `bad`)
2. Gauge in center (keep existing `SpeedGauge` component)
3. 4 metric tiles in a row: Latency (green), Jitter (blue), Loss (accent), Download (primary). Use `speed-metric-tiles`/`speed-metric-tile` CSS classes
4. Download stage bars (keep existing logic, use `speed-stage-bars` CSS classes)
5. "Run Speed Test" button (full-width accent, class `btn-accent` full-width)
6. **Error state:** Grade badge shows "⚠️" with `danger` tile class. Error message "Connection failed. Check your network." displayed in danger color. Primary button changes to "Retry"
7. History section (collapsible, using CSS classes from Step 1)
8. Export button (already refactored in Chunk 4)
9. Keep all existing state management and Tauri invoke logic unchanged
10. Update color functions: `getGradeColor`, `getGradeLabel`, `getBarColor` etc. to use new grade mapping per the spec (A+=Excellent, A=Great, B=Good, C=Fair, D=Poor, F=Bad)
11. Convert all inline styles to CSS classes — the `SpeedState` type already supports `"error"` status, just wire up the UI

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/SpeedPanel.tsx src/components/SpeedGauge.tsx src/styles/index.css
git commit -m "refactor: SpeedPanel and SpeedGauge with widget dashboard layout and token references"
```

---

## Chunk 7: DnsPanel + Wizard Steps Refactor

### Task 7: Refactor DnsPanel, step components, and ProfileCard

**Files:**
- Modify: `src/components/DnsPanel.tsx`
- Modify: `src/components/Step1_ChooseProfile.tsx`
- Modify: `src/components/Step2_Benchmark.tsx`
- Modify: `src/components/Step3_Results.tsx`
- Modify: `src/components/ProfileCard.tsx`
- Modify: `src/styles/index.css` (add DNS panel classes)

- [ ] **Step 1: Add DNS panel CSS classes to index.css**

```css
.dns-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow: hidden;
}

.dns-quick-fix {
  margin-bottom: 16px;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--card-radius);
}

.dns-quick-fix h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px 0;
}

.dns-quick-fix p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0 0 10px 0;
}

.dns-step-wrapper {
  flex: 0 0 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.dns-step-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.dns-step-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
}

.dns-step-network {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
  text-align: center;
}

.dns-profile-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
  padding: 2px;
}

.dns-profile-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.dns-profile-card:hover {
  border-color: var(--accent);
  background: var(--bg-card-hover);
}

.dns-profile-card.selected {
  border-color: var(--accent);
  background: var(--bg-selected);
  box-shadow: 0 0 12px rgba(0, 122, 255, 0.1);
}

.dns-profile-card .profile-icon {
  color: var(--accent);
}

.dns-profile-card .profile-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.dns-profile-card .profile-desc {
  font-size: 10px;
  color: var(--text-tertiary);
  text-align: center;
  line-height: 1.3;
}

.dns-benchmark-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--border);
  border-top: 4px solid var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.dns-results-wrapper {
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  overflow-y: auto;
}

.dns-results-table {
  width: 100%;
  max-width: 440px;
  border-collapse: collapse;
}

.dns-results-table th {
  padding: 8px 12px;
  text-align: left;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
}

.dns-results-table td {
  padding: 10px 12px;
  font-size: 14px;
  border-bottom: 1px solid var(--border);
  color: var(--text-primary);
}

.dns-result-row {
  cursor: pointer;
  transition: background-color 0.15s;
}

.dns-result-row:hover {
  background: var(--bg-card-hover);
}

.dns-result-row.selected {
  background: var(--bg-selected);
}

.dns-result-row.fastest {
  background: var(--success-muted);
}
```

- [ ] **Step 2: Refactor ProfileCard to use CSS classes**

Rewrite `ProfileCard.tsx`:
- Use `className="dns-profile-card"` with conditional `selected` class
- Replace inline styles with class-based styling
- Use `var(--accent)` for the icon color
- Keep the Lucide icon mapping
- Add `selected` prop to the interface
- Remove `onMouseEnter`/`onMouseLeave` inline handlers (CSS hover handles it)

- [ ] **Step 3: Refactor Step1_ChooseProfile**

Rewrite `Step1_ChooseProfile.tsx`:
- Use CSS classes from step 1
- Use `dns-step-wrapper`, `dns-step-title`, `dns-step-desc`, `dns-step-network`, `dns-profile-grid`
- Keep the `selectedProfile` tracking — pass `isSelected` to each `ProfileCard`
- Keep the network info display

- [ ] **Step 4: Refactor Step2_Benchmark**

Rewrite `Step2_Benchmark.tsx`:
- Use CSS classes: `dns-step-wrapper`, `dns-step-title`, `dns-step-desc`, `dns-benchmark-spinner`
- Replace inline spinner with `dns-benchmark-spinner` class
- Error/retry states use token classes

- [ ] **Step 5: Refactor Step3_Results**

Rewrite `Step3_Results.tsx`:
- Use CSS classes: `dns-results-wrapper`, `dns-results-table`, `dns-result-row`
- Apply row classes: `selected` when IP matches, `fastest` for first reachable entry
- Use token references for all button styles
- Keep SimpleMode support
- Keep export functionality
- **Primary CTA:** "Apply [Server IP]" button (success/accent-filled). Keep existing `onAuthorizeApply` logic
- **Secondary actions:** "Restore Default DNS" button (outlined, class `btn-outline`) — calls `onAuthorizeRestore`. "Flush DNS Cache" button (muted outline, calls `onFlushCache`). Both shown only after DNS is applied (`applied` prop is true)
- "Start Over" button (text-only, muted) — calls `onStartOver`
- Keep existing `thStyle`/`tdStyle` → replace with `dns-results-table th`/`dns-results-table td` CSS classes
- Keep the `UNREACHABLE_SENTINEL` filtering logic and the `allUnreachable` error display

- [ ] **Step 6: Refactor DnsPanel**

Rewrite `DnsPanel.tsx`:
- Use CSS classes: `dns-panel`, `dns-quick-fix`
- Replace inline styles in Quick Fix section with classes
- Replace button inline styles with `btn-accent`, `btn-outline` classes
- Keep all state management and invoke calls unchanged

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 8: Commit**

```bash
git add src/components/DnsPanel.tsx src/components/Step1_ChooseProfile.tsx src/components/Step2_Benchmark.tsx src/components/Step3_Results.tsx src/components/ProfileCard.tsx src/styles/index.css
git commit -m "refactor: DNS wizard panels with widget dashboard layout and token references"
```

---

## Chunk 8: PingPanel Refactor

### Task 8: Refactor PingPanel

**Files:**
- Modify: `src/components/PingPanel.tsx`
- Modify: `src/styles/index.css` (add ping panel classes)

- [ ] **Step 1: Add ping panel CSS classes to index.css**

```css
.ping-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 16px;
}

.ping-panel h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.ping-tabs {
  display: flex;
  gap: 6px;
}

.ping-tab {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  background: transparent;
  color: var(--text-tertiary);
  transition: background 0.2s, color 0.2s;
}

.ping-tab.active {
  background: var(--accent);
  color: #fff;
}

.ping-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.ping-input {
  padding: 8px 12px;
  border-radius: var(--tile-radius);
  border: 1px solid var(--border);
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  flex: 1;
  max-width: 260px;
}

.ping-port-badge {
  font-size: 9px;
  color: var(--accent);
  background: var(--accent-muted);
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
}

.ping-presets {
  display: flex;
  gap: 6px;
}

.ping-preset {
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.ping-preset:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.ping-preset.active {
  border-color: var(--accent);
  background: var(--accent-muted);
  color: var(--accent);
}

.ping-summary-tiles {
  display: flex;
  gap: 6px;
}

.ping-summary-tile {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--tile-radius);
  padding: 8px;
  text-align: center;
}

.ping-summary-value {
  font-weight: 800;
  font-size: 14px;
  color: var(--text-primary);
}

.ping-summary-label {
  color: var(--text-tertiary);
  font-size: 8px;
  margin-top: 2px;
}

.ping-empty {
  color: var(--text-tertiary);
  font-size: 13px;
  margin: 0;
}
```

- [ ] **Step 2: Refactor PingPanel with CSS classes + widget layout**

Rewrite `PingPanel.tsx` with these exact changes:

1. **Container:** `<div className="ping-panel">` replaces the outer div with inline flex styles

2. **Header:** `<h2>` uses `ping-panel h2` CSS styles, keep the dynamic `{state.mode === "ping" ? "Ping" : "Traceroute"}` text

3. **Mode tabs:** Replace inline `tabStyle()` with:
   ```tsx
   <div className="ping-tabs">
     <button className={`ping-tab ${state.mode === "ping" ? "active" : ""}`} onClick={...}>Ping</button>
     <button className={`ping-tab ${state.mode === "traceroute" ? "active" : ""}`} onClick={...}>Traceroute</button>
   </div>
   ```

4. **Input row:** `<div className="ping-input-row">` containing:
   - `<input className="ping-input">` with the host value, `onChange`, `disabled`, and `placeholder`
   - A port badge: `<span className="ping-port-badge">TCP:443</span>` placed inside the input area or after it
   - Run/Cancel button: `btn-accent` class for Run, `btn-outline` for Cancel

5. **Presets:** `<div className="ping-presets">` wrapping preset buttons. Each preset:
   ```tsx
   <button className={`ping-preset ${state.host === p.host && !state.isRunning ? 'active' : ''}`} ...>
   ```

6. **Simple mode message:** Keep existing logic, replace inline styles with CSS classes or token references

7. **Error display:** Replace `<p style={{ color: "#ef4444", ... }}>` with `<p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>`

8. **Idle state:** `<p className="ping-empty">Enter a host and run ping to see results.</p>` (only when no results and not running and no error)

9. **Result table:** Keep using `<ResultTable>` (already refactored in Chunk 4)

10. **Summary tiles** (below table, after results):
    ```tsx
    {state.results.length > 0 && !state.isRunning && state.mode === "ping" && (
      <div className="ping-summary-tiles">
        <div className="ping-summary-tile">
          <div className="ping-summary-value" style={{ color: "var(--success)" }}>{avgMs.toFixed(1)}ms</div>
          <div className="ping-summary-label">Avg</div>
        </div>
        {/* Min, Max, Loss %, Count — same pattern */}
      </div>
    )}
    ```
    Compute `avgMs`, `minMs`, `maxMs`, `lossPct` from `state.results` (PingResult array). Loss calc: `(results.filter(r => !r.success).length / results.length * 100)`

11. **Export:** Keep `<ExportButton>` as-is (already refactored)

12. **Keep unchanged:** all `invoke` calls, `cancelledRef`, `setState` logic, SimpleMode context usage, traceroute tab switching

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/PingPanel.tsx src/styles/index.css
git commit -m "refactor: PingPanel with widget dashboard layout and token references"
```

---

## Chunk 9: LeakPanel Refactor

### Task 9: Refactor LeakPanel

**Files:**
- Modify: `src/components/LeakPanel.tsx`
- Modify: `src/styles/index.css` (add leak panel classes)

- [ ] **Step 1: Add leak panel CSS classes to index.css**

```css
.leak-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 16px;
}

.leak-panel h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.leak-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--card-radius);
  padding: 14px;
}

.leak-banner.success {
  border-color: var(--success);
}

.leak-banner.warning {
  border-color: var(--warning);
}

.leak-banner.danger {
  border-color: var(--danger);
}

.leak-banner-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--tile-radius);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.leak-banner-icon.success { background: var(--success-muted); }
.leak-banner-icon.warning { background: var(--warning-muted); }
.leak-banner-icon.danger { background: var(--danger-muted); }

.leak-banner-title {
  font-weight: 700;
  font-size: 14px;
}

.leak-banner-title.success { color: var(--success); }
.leak-banner-title.danger { color: var(--danger); }

.leak-banner-desc {
  font-size: 10px;
  color: var(--text-secondary);
}

.leak-content {
  display: flex;
  gap: 16px;
  flex: 1;
}

.leak-server-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.leak-server-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--tile-radius);
  padding: 10px;
}

.leak-server-card.leaked {
  border-color: var(--danger);
}

.leak-server-icon {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--success);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 9px;
}

.leak-server-info {
  flex: 1;
}

.leak-server-ip {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
}

.leak-server-provider {
  font-size: 9px;
  color: var(--text-tertiary);
}

.leak-server-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
}

.leak-server-badge.configured {
  color: var(--success);
  background: var(--success-muted);
}

.leak-server-badge.leaked {
  color: var(--danger);
  background: var(--danger-muted);
}

.leak-side-panel {
  width: 140px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.leak-stat-tile {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--card-radius);
  padding: 12px;
  text-align: center;
}

.leak-stat-value {
  font-weight: 800;
  font-size: 22px;
  color: var(--text-primary);
}

.leak-stat-label {
  font-size: 10px;
  color: var(--text-tertiary);
  margin-top: 2px;
}
```

- [ ] **Step 2: Refactor LeakPanel with widget layout**

Rewrite `LeakPanel.tsx`:
1. Use CSS classes: `leak-panel`, `leak-banner`, `leak-content`, etc.
2. Result banner at top (when results exist): success/warning icon + bold status + description
3. Idle state: "Run a leak test to check your DNS privacy" message
4. Running state: button shows "Testing..." with spinner
5. Server list (left): detected servers with provider names, IPs, status badges
6. Side panel (right): "Servers Detected" (count) + "Leaked Servers" (count, green if 0, red if >0) stat tiles
7. "Run Leak Test" button (accent-filled)
8. Keep all state management and Tauri invoke logic unchanged
9. Keep SimpleMode support
10. Warn user if no DNS profile applied (configuredDns empty)

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/LeakPanel.tsx src/styles/index.css
git commit -m "refactor: LeakPanel with widget dashboard layout and token references"
```

---

## Chunk 10: AboutPanel + OnboardingModal Refactor

### Task 10: Refactor AboutPanel and OnboardingModal

**Files:**
- Modify: `src/components/AboutPanel.tsx`
- Modify: `src/components/OnboardingModal.tsx`
- Modify: `src/styles/index.css` (add about/onboarding classes)

- [ ] **Step 1: Add about/onboarding CSS classes to index.css**

```css
.about-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  gap: 0;
  overflow-y: auto;
}

.about-header {
  text-align: center;
  margin-bottom: 20px;
}

.about-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--accent);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  margin-bottom: 8px;
}

.about-title {
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
}

.about-version {
  font-size: 11px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.about-section {
  margin-bottom: 20px;
}

.about-section h2 {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.about-section p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.about-stats {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.about-stat {
  flex: 1;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--tile-radius);
  padding: 10px;
  text-align: center;
}

.about-stat-value {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.about-stat-label {
  color: var(--text-tertiary);
  font-size: 8px;
  margin-top: 2px;
}

.about-footer {
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 8px;
}

.about-coffee-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--tile-radius);
  background: var(--coffee);
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-bottom: 12px;
}

.about-coffee-btn:hover {
  opacity: 0.9;
}

.about-credit {
  font-size: 12px;
  color: var(--text-tertiary);
  margin: 0;
}

/* Onboarding */
.onboarding-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.onboarding-modal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 28px 24px;
  max-width: 320px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
}

.onboarding-icon {
  font-size: 36px;
  line-height: 1;
}

.onboarding-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
  text-align: center;
}

.onboarding-desc {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
  text-align: center;
  line-height: 1.5;
}

.onboarding-dots {
  display: flex;
  gap: 6px;
  align-items: center;
}

.onboarding-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s;
}

.onboarding-dot.active {
  background: var(--accent);
}

.onboarding-actions {
  display: flex;
  gap: 8px;
  width: 100%;
}

.onboarding-nav-btn {
  flex: 1;
  padding: 8px;
  border-radius: var(--tile-radius);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.onboarding-nav-btn:hover {
  background: var(--bg-card-hover);
}

.onboarding-nav-btn.primary {
  flex: 2;
  background: var(--accent);
  color: #fff;
  border: none;
}

.onboarding-skip {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 11px;
  cursor: pointer;
  padding: 0;
}
```

- [ ] **Step 2: Refactor AboutPanel**

Rewrite `AboutPanel.tsx`:
1. Use CSS classes: `about-panel`, `about-header`, `about-logo`, etc.
2. Centered header with app icon + title + version
3. Stats row: 3 cards (Tools: 6, Commands: 14, Telemetry: 0)
4. Description card: brief summary
5. Tool sections: compact, no inline styles
6. Keyboard shortcuts: compact grid
7. Footer: coffee button + credit line
8. Remove all inline `style` objects

- [ ] **Step 3: Refactor OnboardingModal — reduce to 4 steps**

Rewrite `OnboardingModal.tsx`:
1. Reduce to 4 steps per the spec:
   - Step 1: Welcome — "🪄" + "Welcome to DNS Wizard" + one-sentence description
   - Step 2: DNS Wizard — "🪄" emoji + "Find Your Fastest DNS" + "Pick a profile, benchmark servers, and apply the best one"
   - Step 3: Speed Test — "⚡" emoji + "Measure Your Speed" + "Get a Network Quality Score with detailed metrics"
   - Step 4: Leak Test — "🔍" emoji + "Verify Your Privacy" + "Make sure your DNS isn't leaking to unintended servers"
2. Use CSS classes: `onboarding-overlay`, `onboarding-modal`, etc.
3. Keep dot navigation, skip button, back/next buttons
4. Keep localStorage persistence (`ONBOARDING_KEY`)
5. Remove all inline style objects

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit && npx vite build`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/AboutPanel.tsx src/components/OnboardingModal.tsx src/styles/index.css
git commit -m "refactor: AboutPanel and OnboardingModal with token references and reduced onboarding steps"
```

---

## Chunk 11: Final Cleanup + Verification

### Task 11: Final cleanup pass

**Files:**
- Modify: `src/styles/index.css` (remove old hardcoded colors)
- Verify: All files compile

- [ ] **Step 1: Clean up index.css**

Remove any remaining hardcoded color values from `index.css` that should use tokens. Verify the only hardcoded values are:
- `.speed-gauge-tick` styles (already handled)
- `.tooltip-*` styles (already handled)
- `@keyframes spin` and `@keyframes pulse` (no color values)
- `button:focus` etc. (generic)

Also ensure `.app-content` uses tokens:
```css
.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding-left: 12px;
}
```

- [ ] **Step 2: Final typecheck + build**

Run: `npx tsc --noEmit && npx vite build`
Expected: Zero TypeScript errors. Vite build succeeds with no warnings.

- [ ] **Step 3: Visual verification checklist**

Run: `npm run tauri dev`

Check each item in both light and dark themes (toggle via sidebar switch):

| # | Check | Expected |
|---|-------|----------|
| 1 | Sidebar theme toggle | 3-position pill switches between Light/Auto/Dark. Persists across reloads |
| 2 | Health dashboard | 3 widget cards (DNS/Speed/Security) + quick action buttons. Metric tiles show "—" before first speed test |
| 3 | DNS Wizard Step 1 | 8 profile cards in grid. Selected card gets accent border + background tint |
| 4 | DNS Wizard Step 2 | Spinner + "Testing DNS servers..." text |
| 5 | DNS Wizard Step 3 | Results table. "Apply", "Restore Defaults", "Flush DNS Cache", "Start Over" buttons |
| 6 | Speed Test idle | Grade badge shows "—", gauge empty, "Run Speed Test" button prominent |
| 7 | Speed Test error | (Unplug network, click Run) Grade badge shows "⚠️", "Connection failed" message, "Retry" button |
| 8 | Speed Test complete | Grade filled, 4 metric tiles populated, stage bars rendered, history collapsible |
| 9 | Ping idle | Input + presets + "Enter a host and run ping to see results" |
| 10 | Ping results | Table populated, 5 summary tiles (Avg/Min/Max/Loss/Count) |
| 11 | Leak Test ideal | Server list with status badges, side panel with stat tiles |
| 12 | About | Centered logo, version, 3 stat cards, shortcuts, coffee button |
| 13 | Onboarding | Clear localStorage entry `dnswizard-onboarded`, restart app. 4-step walkthrough with skip/back/next |
| 14 | Keyboard shortcuts | Cmd+1→DNS, Cmd+2→Speed, Cmd+3→Ping, Cmd+4→Leak, Cmd+5→Health, Cmd+6→About |
| 15 | Simple Mode toggle | Eye icon in sidebar toggles between detailed/simple views in all panels |
| 16 | localStorage fallback | Open private browsing session. App works with in-memory state, onboarding shows every launch (acceptable) |

Fix any visual issues found before proceeding to final commit.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup, remove remaining hardcoded colors"
```

---

## Success Criteria Verification

After all chunks are complete, verify:

1. ✅ App renders correctly in both light and dark modes
2. ✅ Theme toggle (Light/Auto/Dark) switches themes and persists to localStorage
3. ✅ All 6 tools maintain full functionality with new styling
4. ✅ No visual regressions: all interactive states (hover, active, selected, disabled) styled
5. ✅ Keyboard shortcuts (Cmd+1 through Cmd+6) continue to work
6. ✅ Onboarding modal works on first launch (4 steps)
7. ✅ Export buttons function with Tauri save dialog
8. ✅ Simple Mode toggle is preserved and works with both themes
