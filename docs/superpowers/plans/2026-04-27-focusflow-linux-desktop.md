# FocusFlow Linux Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current static FocusFlow web app into a Linux desktop app with Tauri while preserving the current UI and adding desktop notifications, a system tray, and autostart.

**Architecture:** Keep the existing HTML/CSS layout and most of the front-end timer/todo logic in JavaScript, then add a thin desktop integration layer for Tauri-specific APIs. Rust stays small and only initializes Tauri plus required plugins; the browser-side code remains the source of truth for todos, timer state, and settings.

**Tech Stack:** HTML, CSS, ESM JavaScript, Vite, Tauri v2, Rust, `@tauri-apps/plugin-notification`, `@tauri-apps/plugin-autostart`, Node built-in test runner

---

## File Structure

### Existing files to modify

- `index.html`
  - Keep the current layout and add a compact desktop settings entry plus a small settings panel.
- `styles.css`
  - Preserve the visual design and add styles for the compact desktop settings UI.
- `app.js`
  - Stay as the main orchestrator for DOM events, timer behavior, rendering, and desktop bridge coordination.
- `README.md`
  - Replace browser-only instructions with Linux desktop development, build, and verification steps.

### New frontend files

- `package.json`
  - Define the Vite, test, and Tauri scripts plus JavaScript dependencies.
- `vite.config.js`
  - Pin the dev server port and keep console output readable for `tauri dev`.
- `src/lib/state.js`
  - Centralize default state, normalization, shared timer helpers, and shared text maps.
- `src/lib/storage.js`
  - Isolate state persistence from `localStorage`.
- `src/lib/desktop.js`
  - Wrap notification, autostart, tray, and close-to-tray integration behind testable helpers.
- `tests/config.test.js`
  - Guard package and Tauri config layout.
- `tests/state.test.js`
  - Guard state normalization and timer math helpers.
- `tests/desktop.test.js`
  - Guard desktop bridge pure helpers such as notification text and tray labels.

### New Tauri files

- `src-tauri/Cargo.toml`
  - Rust package manifest and Tauri plugin dependencies.
- `src-tauri/build.rs`
  - Tauri build hook.
- `src-tauri/src/main.rs`
  - Minimal binary entrypoint.
- `src-tauri/src/lib.rs`
  - Tauri app builder and plugin initialization.
- `src-tauri/tauri.conf.json`
  - App metadata, build hooks, and main window definition.
- `src-tauri/capabilities/default.json`
  - Explicit Tauri permissions for tray, notification, autostart, and window operations.

## Task 1: Scaffold Vite and Tauri

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `tests/config.test.js`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/build.rs`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Write the failing config test**

```js
// tests/config.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const vitePath = path.resolve('vite.config.js');
const tauriConfigPath = path.resolve('src-tauri/tauri.conf.json');
const capabilityPath = path.resolve('src-tauri/capabilities/default.json');

test('package.json exists and defines desktop scripts', () => {
  assert.ok(fs.existsSync(packagePath), 'package.json should exist');

  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.dev, 'vite');
  assert.equal(pkg.scripts.build, 'vite build');
  assert.equal(pkg.scripts.test, 'node --test');
  assert.equal(pkg.scripts.tauri, 'tauri');
});

test('vite config exists', () => {
  assert.ok(fs.existsSync(vitePath), 'vite.config.js should exist');
});

test('tauri build config points at vite output', () => {
  assert.ok(fs.existsSync(tauriConfigPath), 'src-tauri/tauri.conf.json should exist');

  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
  assert.equal(tauriConfig.build.devUrl, 'http://localhost:5173');
  assert.equal(tauriConfig.build.frontendDist, '../dist');
});

test('capabilities allow tray, notification, autostart, and window control', () => {
  assert.ok(fs.existsSync(capabilityPath), 'src-tauri/capabilities/default.json should exist');

  const capability = JSON.parse(fs.readFileSync(capabilityPath, 'utf8'));
  assert.ok(capability.permissions.includes('core:default'));
  assert.ok(capability.permissions.includes('notification:default'));
  assert.ok(capability.permissions.includes('autostart:allow-enable'));
  assert.ok(capability.permissions.includes('autostart:allow-disable'));
  assert.ok(capability.permissions.includes('autostart:allow-is-enabled'));
  assert.ok(capability.permissions.includes('core:window:allow-hide'));
  assert.ok(capability.permissions.includes('core:window:allow-show'));
  assert.ok(capability.permissions.includes('core:window:allow-close'));
  assert.ok(capability.permissions.includes('core:window:allow-set-focus'));
});
```

- [ ] **Step 2: Run the config test to verify it fails**

Run: `node --test tests/config.test.js`

Expected: FAIL with `package.json should exist` and `src-tauri/tauri.conf.json should exist`

- [ ] **Step 3: Add the JavaScript toolchain files**

```json
// package.json
{
  "name": "focusflow-linux-desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "node --test",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-autostart": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "vite": "^5.0.0"
  }
}
```

```js
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true
  }
});
```

- [ ] **Step 4: Add the Rust package files**

```toml
# src-tauri/Cargo.toml
[package]
name = "focusflow_desktop"
version = "0.1.0"
description = "FocusFlow Linux desktop app"
authors = ["OpenAI Codex"]
edition = "2021"

[lib]
name = "focusflow_desktop"
crate-type = ["cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-autostart = "2"
tauri-plugin-notification = "2"
```

```rust
// src-tauri/build.rs
fn main() {
    tauri_build::build()
}
```

```rust
// src-tauri/src/main.rs
fn main() {
    focusflow_desktop::run();
}
```

```rust
// src-tauri/src/lib.rs
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_autostart::init(
                    tauri_plugin_autostart::MacosLauncher::LaunchAgent,
                    None::<Vec<&str>>,
                ))?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running FocusFlow desktop app");
}
```

- [ ] **Step 5: Add the Tauri config and capability files**

```json
// src-tauri/tauri.conf.json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "FocusFlow",
  "version": "0.1.0",
  "identifier": "com.focusflow.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devUrl": "http://localhost:5173",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "label": "main",
        "title": "FocusFlow",
        "width": 1180,
        "height": 840,
        "resizable": true,
        "center": true
      }
    ]
  },
  "bundle": {
    "active": true,
    "targets": "all"
  }
}
```

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "main-capability",
  "description": "Capability for the FocusFlow main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "core:app:allow-default-window-icon",
    "core:window:allow-close",
    "core:window:allow-hide",
    "core:window:allow-minimize",
    "core:window:allow-set-focus",
    "core:window:allow-show",
    "notification:default",
    "autostart:allow-enable",
    "autostart:allow-disable",
    "autostart:allow-is-enabled"
  ]
}
```

- [ ] **Step 6: Run the config test to verify it passes**

Run: `node --test tests/config.test.js`

Expected: PASS with 4 passing tests

- [ ] **Step 7: Commit**

```bash
git add package.json vite.config.js tests/config.test.js src-tauri
git commit -m "chore: scaffold tauri desktop shell"
```

## Task 2: Extract Shared State and Persistence Helpers

**Files:**
- Create: `src/lib/state.js`
- Create: `src/lib/storage.js`
- Create: `tests/state.test.js`
- Modify: `index.html`
- Modify: `app.js`

- [ ] **Step 1: Write the failing state test**

```js
// tests/state.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultState,
  normalizeState,
  getModeDurationSeconds,
  formatSeconds
} from '../src/lib/state.js';

test('createDefaultState enables desktop-friendly defaults', () => {
  const state = createDefaultState();

  assert.equal(state.filter, 'all');
  assert.equal(state.timer.mode, 'focus');
  assert.equal(state.preferences.notificationsEnabled, true);
  assert.equal(state.preferences.minimizeToTray, true);
});

test('normalizeState clamps invalid durations and filter', () => {
  const normalized = normalizeState({
    filter: 'broken',
    timer: {
      mode: 'focus',
      focusDuration: 400,
      shortBreakDuration: -1,
      longBreakDuration: 0,
      remaining: NaN
    }
  });

  assert.equal(normalized.filter, 'all');
  assert.equal(normalized.timer.focusDuration, 90);
  assert.equal(normalized.timer.shortBreakDuration, 1);
  assert.equal(normalized.timer.longBreakDuration, 5);
  assert.equal(normalized.timer.remaining, 90 * 60);
});

test('getModeDurationSeconds resolves the requested mode from timer settings', () => {
  const state = createDefaultState();
  state.timer.focusDuration = 30;
  state.timer.shortBreakDuration = 7;
  state.timer.longBreakDuration = 20;

  assert.equal(getModeDurationSeconds(state.timer, 'focus'), 1800);
  assert.equal(getModeDurationSeconds(state.timer, 'shortBreak'), 420);
  assert.equal(getModeDurationSeconds(state.timer, 'longBreak'), 1200);
});

test('formatSeconds rounds up partial seconds for the visible clock', () => {
  assert.equal(formatSeconds(1500), '25:00');
  assert.equal(formatSeconds(1499.2), '25:00');
  assert.equal(formatSeconds(1.1), '00:02');
});
```

- [ ] **Step 2: Run the state test to verify it fails**

Run: `node --test tests/state.test.js`

Expected: FAIL with `Cannot find module '../src/lib/state.js'`

- [ ] **Step 3: Create the shared state module**

```js
// src/lib/state.js
export const STORAGE_KEY = 'focusflow.v2';
export const CIRCLE_LENGTH = 2 * Math.PI * 52;

export const modeNameMap = {
  focus: '专注时间',
  shortBreak: '短休息',
  longBreak: '长休息'
};

export const modeColorMap = {
  focus: '#d95f27',
  shortBreak: '#3f7d74',
  longBreak: '#6b8aa5'
};

export function createDefaultState() {
  return {
    todos: [],
    filter: 'all',
    selectedTodoId: null,
    timer: {
      mode: 'focus',
      remaining: 25 * 60,
      isRunning: false,
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      completedFocusSessions: 0,
      lastTickAt: null
    },
    focusHistory: [],
    preferences: {
      notificationsEnabled: true,
      minimizeToTray: true
    },
    desktop: {
      settingsOpen: false,
      autoStartEnabled: false,
      autoStartSupported: false,
      notificationPermission: 'default',
      trayReady: false
    }
  };
}

export function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function getModeDurationSeconds(timer, mode = timer.mode) {
  if (mode === 'focus') return timer.focusDuration * 60;
  if (mode === 'shortBreak') return timer.shortBreakDuration * 60;
  return timer.longBreakDuration * 60;
}

export function normalizeState(raw) {
  const merged = structuredClone(createDefaultState());
  Object.assign(merged, raw || {});
  Object.assign(merged.timer, raw?.timer || {});
  Object.assign(merged.preferences, raw?.preferences || {});
  Object.assign(merged.desktop, raw?.desktop || {});

  merged.filter = ['all', 'active', 'done'].includes(merged.filter) ? merged.filter : 'all';
  merged.todos = Array.isArray(merged.todos) ? merged.todos : [];
  merged.focusHistory = Array.isArray(merged.focusHistory) ? merged.focusHistory : [];

  if (!['focus', 'shortBreak', 'longBreak'].includes(merged.timer.mode)) {
    merged.timer.mode = 'focus';
  }

  merged.timer.focusDuration = clampNumber(merged.timer.focusDuration, 5, 90, 25);
  merged.timer.shortBreakDuration = clampNumber(merged.timer.shortBreakDuration, 1, 30, 5);
  merged.timer.longBreakDuration = clampNumber(merged.timer.longBreakDuration, 5, 60, 15);
  merged.timer.remaining = Number.isFinite(merged.timer.remaining)
    ? merged.timer.remaining
    : getModeDurationSeconds(merged.timer, merged.timer.mode);
  merged.timer.isRunning = false;
  merged.timer.lastTickAt = null;

  if (!merged.todos.some((todo) => todo.id === merged.selectedTodoId)) {
    merged.selectedTodoId = merged.todos[0]?.id || null;
  }

  merged.preferences.notificationsEnabled = Boolean(merged.preferences.notificationsEnabled);
  merged.preferences.minimizeToTray = merged.preferences.minimizeToTray !== false;
  merged.desktop.settingsOpen = false;
  merged.desktop.autoStartEnabled = Boolean(merged.desktop.autoStartEnabled);
  merged.desktop.autoStartSupported = Boolean(merged.desktop.autoStartSupported);
  merged.desktop.notificationPermission = merged.desktop.notificationPermission || 'default';
  merged.desktop.trayReady = Boolean(merged.desktop.trayReady);

  return merged;
}

export function formatSeconds(value) {
  const total = Math.max(0, Math.ceil(value));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function getDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
```

- [ ] **Step 4: Create the storage wrapper**

```js
// src/lib/storage.js
import { STORAGE_KEY, createDefaultState, normalizeState } from './state.js';

export function loadStoredState(storage = window.localStorage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveStoredState(state, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 5: Convert the page bootstrap to modules and use the shared helpers**

```html
<!-- index.html -->
<script type="module" src="./app.js"></script>
```

```js
// app.js (replace the top constants and state bootstrap)
import {
  CIRCLE_LENGTH,
  clampNumber,
  escapeHtml,
  formatSeconds,
  getDateKey,
  getModeDurationSeconds,
  modeColorMap,
  modeNameMap
} from './src/lib/state.js';
import { loadStoredState, saveStoredState } from './src/lib/storage.js';

const state = loadStoredState();
```

```js
// app.js (replace every saveState implementation with this)
function saveState() {
  saveStoredState(state);
}
```

```js
// app.js (delete the old in-file implementations of these helpers)
// - STORAGE_KEY
// - CIRCLE_LENGTH
// - modeNameMap
// - modeColorMap
// - loadState
// - getModeDurationSecondsFromTimer
// - formatSeconds
// - getDateKey
// - clampNumber
// - escapeHtml
```

- [ ] **Step 6: Run the state test to verify it passes**

Run: `node --test tests/state.test.js`

Expected: PASS with 4 passing tests

- [ ] **Step 7: Commit**

```bash
git add index.html app.js src/lib/state.js src/lib/storage.js tests/state.test.js
git commit -m "refactor: extract shared state and storage helpers"
```

## Task 3: Add Desktop Settings and a Tauri Bridge

**Files:**
- Create: `src/lib/desktop.js`
- Create: `tests/desktop.test.js`
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `app.js`

- [ ] **Step 1: Write the failing desktop bridge test**

```js
// tests/desktop.test.js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationMessage,
  buildTrayToggleLabel,
  mergeDesktopSnapshot
} from '../src/lib/desktop.js';

test('buildNotificationMessage prefers the active task name when present', () => {
  const message = buildNotificationMessage({
    finishedModeLabel: '专注时间',
    nextModeLabel: '短休息',
    activeTaskText: '写周报'
  });

  assert.equal(message.title, 'FocusFlow');
  assert.match(message.body, /写周报/);
  assert.match(message.body, /短休息/);
});

test('buildTrayToggleLabel reflects timer state', () => {
  assert.equal(buildTrayToggleLabel({ isRunning: true }), '暂停计时');
  assert.equal(buildTrayToggleLabel({ isRunning: false }), '开始计时');
});

test('mergeDesktopSnapshot keeps conservative defaults outside Tauri', () => {
  const snapshot = mergeDesktopSnapshot(
    {
      settingsOpen: false,
      autoStartEnabled: false,
      autoStartSupported: false,
      notificationPermission: 'default',
      trayReady: false
    },
    {
      autoStartSupported: true,
      notificationPermission: 'granted'
    }
  );

  assert.equal(snapshot.autoStartSupported, true);
  assert.equal(snapshot.notificationPermission, 'granted');
  assert.equal(snapshot.settingsOpen, false);
});
```

- [ ] **Step 2: Run the desktop bridge test to verify it fails**

Run: `node --test tests/desktop.test.js`

Expected: FAIL with `Cannot find module '../src/lib/desktop.js'`

- [ ] **Step 3: Create the desktop bridge module**

```js
// src/lib/desktop.js
import { modeNameMap } from './state.js';

export function buildNotificationMessage({
  finishedModeLabel,
  nextModeLabel,
  activeTaskText
}) {
  const taskPrefix = activeTaskText ? `任务「${activeTaskText}」` : finishedModeLabel;
  return {
    title: 'FocusFlow',
    body: `${taskPrefix}已结束，进入${nextModeLabel}。`
  };
}

export function buildTrayToggleLabel({ isRunning }) {
  return isRunning ? '暂停计时' : '开始计时';
}

export function mergeDesktopSnapshot(current, patch) {
  return {
    ...current,
    ...patch,
    settingsOpen: current.settingsOpen
  };
}

function hasTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function createDesktopBridge() {
  if (!hasTauriRuntime()) {
    return {
      isDesktop: false,
      async getSnapshot() {
        return {
          autoStartEnabled: false,
          autoStartSupported: false,
          notificationPermission: 'default',
          trayReady: false
        };
      },
      async requestNotificationPermission() {
        return 'default';
      },
      async setAutostart() {},
      async sendTimerNotification() {}
    };
  }

  const [{ enable, disable, isEnabled }, notification] = await Promise.all([
    import('@tauri-apps/plugin-autostart'),
    import('@tauri-apps/plugin-notification')
  ]);

  return {
    isDesktop: true,
    async getSnapshot() {
      return {
        autoStartEnabled: await isEnabled(),
        autoStartSupported: true,
        notificationPermission: await notification.isPermissionGranted()
          ? 'granted'
          : 'default',
        trayReady: false
      };
    },
    async requestNotificationPermission() {
      if (await notification.isPermissionGranted()) return 'granted';
      return notification.requestPermission();
    },
    async setAutostart(enabled) {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
    },
    async sendTimerNotification({ finishedMode, nextMode, activeTaskText }) {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') return;

      const payload = buildNotificationMessage({
        finishedModeLabel: modeNameMap[finishedMode],
        nextModeLabel: modeNameMap[nextMode],
        activeTaskText
      });

      await notification.sendNotification(payload);
    }
  };
}
```

- [ ] **Step 4: Add the compact desktop settings UI**

```html
<!-- index.html: replace the existing todayLabel paragraph with this block -->
<div class="topbar-actions">
  <p class="today" id="todayLabel"></p>
  <button id="desktopSettingsToggle" type="button" class="ghost compact">
    桌面设置
  </button>
</div>
```

```html
<!-- index.html: add after the stats panel -->
<section class="panel desktop-panel hidden" id="desktopPanel">
  <div class="panel-head">
    <h2>桌面设置</h2>
  </div>
  <div class="desktop-settings">
    <label class="setting-row">
      <span>到点桌面通知</span>
      <input id="notificationsEnabled" type="checkbox" />
    </label>
    <label class="setting-row">
      <span>关闭窗口后最小化到托盘</span>
      <input id="minimizeToTray" type="checkbox" />
    </label>
    <label class="setting-row">
      <span>开机自启</span>
      <input id="autoStartEnabled" type="checkbox" />
    </label>
    <div class="setting-actions">
      <button id="testNotificationBtn" type="button" class="ghost">测试通知</button>
    </div>
  </div>
</section>
```

```css
/* styles.css */
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.compact {
  padding: 0.58rem 0.82rem;
  font-size: 0.85rem;
}

.desktop-panel {
  margin-top: 1rem;
}

.hidden {
  display: none;
}

.desktop-settings {
  display: grid;
  gap: 0.85rem;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  color: var(--text);
}

.setting-row input[type="checkbox"] {
  width: 18px;
  height: 18px;
  accent-color: var(--accent-2);
}

.setting-actions {
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 5: Wire app state to the desktop bridge**

```js
// app.js (extend refs)
const refs = {
  // existing refs...
  desktopSettingsToggle: document.getElementById('desktopSettingsToggle'),
  desktopPanel: document.getElementById('desktopPanel'),
  notificationsEnabled: document.getElementById('notificationsEnabled'),
  minimizeToTray: document.getElementById('minimizeToTray'),
  autoStartEnabled: document.getElementById('autoStartEnabled'),
  testNotificationBtn: document.getElementById('testNotificationBtn')
};
```

```js
// app.js (create the bridge during startup)
import {
  createDesktopBridge,
  mergeDesktopSnapshot
} from './src/lib/desktop.js';

let desktop = null;

initialize().catch((error) => {
  console.error(error);
  showToast('桌面模块初始化失败，已回退为基础模式');
});

async function initialize() {
  refs.progressCircle.style.strokeDasharray = String(CIRCLE_LENGTH);
  desktop = await createDesktopBridge();
  state.desktop = mergeDesktopSnapshot(state.desktop, await desktop.getSnapshot());
  bindEvents();
  renderAll();
  ensureTicker();
}
```

```js
// app.js (desktop settings events)
refs.desktopSettingsToggle.addEventListener('click', () => {
  state.desktop.settingsOpen = !state.desktop.settingsOpen;
  renderDesktopSettings();
});

refs.notificationsEnabled.addEventListener('change', async () => {
  state.preferences.notificationsEnabled = refs.notificationsEnabled.checked;
  saveState();
});

refs.minimizeToTray.addEventListener('change', () => {
  state.preferences.minimizeToTray = refs.minimizeToTray.checked;
  saveState();
});

refs.autoStartEnabled.addEventListener('change', async () => {
  try {
    await desktop.setAutostart(refs.autoStartEnabled.checked);
    state.desktop.autoStartEnabled = refs.autoStartEnabled.checked;
    saveState();
    renderDesktopSettings();
  } catch (error) {
    console.error(error);
    refs.autoStartEnabled.checked = state.desktop.autoStartEnabled;
    showToast('开机自启切换失败');
  }
});

refs.testNotificationBtn.addEventListener('click', async () => {
  if (!state.preferences.notificationsEnabled) {
    showToast('请先开启桌面通知');
    return;
  }

  await desktop.sendTimerNotification({
    finishedMode: 'focus',
    nextMode: 'shortBreak',
    activeTaskText: state.todos.find((todo) => todo.id === state.selectedTodoId)?.text || ''
  });
});
```

```js
// app.js (render helper)
function renderDesktopSettings() {
  refs.desktopPanel.classList.toggle('hidden', !state.desktop.settingsOpen);
  refs.notificationsEnabled.checked = state.preferences.notificationsEnabled;
  refs.minimizeToTray.checked = state.preferences.minimizeToTray;
  refs.autoStartEnabled.checked = state.desktop.autoStartEnabled;
  refs.autoStartEnabled.disabled = !state.desktop.autoStartSupported;
}
```

```js
// app.js (call renderDesktopSettings from renderAll)
function renderAll() {
  renderDate();
  renderTodos();
  renderTimer();
  renderStats();
  renderActiveTask();
  renderDesktopSettings();
}
```

- [ ] **Step 6: Run the desktop bridge and state tests**

Run: `node --test tests/state.test.js tests/desktop.test.js`

Expected: PASS with 7 passing tests

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css app.js src/lib/desktop.js tests/desktop.test.js
git commit -m "feat: add desktop settings bridge"
```

## Task 4: Add Tray, Close-to-Tray, and Timer Notifications

**Files:**
- Modify: `src/lib/desktop.js`
- Modify: `app.js`
- Test: `tests/desktop.test.js`

- [ ] **Step 1: Extend the desktop test with a tray snapshot expectation**

```js
// tests/desktop.test.js (update the existing import block)
import {
  buildNotificationMessage,
  buildTraySnapshot,
  buildTrayToggleLabel,
  mergeDesktopSnapshot
} from '../src/lib/desktop.js';

test('buildTraySnapshot returns stable menu labels for the current timer state', () => {
  const snapshot = buildTraySnapshot({
    isRunning: true,
    modeLabel: '专注时间',
    timeDisplay: '13:20'
  });

  assert.equal(snapshot.tooltip, '专注时间 · 13:20');
  assert.equal(snapshot.toggleLabel, '暂停计时');
});
```

- [ ] **Step 2: Run the extended desktop test to verify the new expectation fails**

Run: `node --test tests/desktop.test.js`

Expected: FAIL with `The requested module '../src/lib/desktop.js' does not provide an export named 'buildTraySnapshot'`

- [ ] **Step 3: Extend the desktop bridge with tray and close-to-tray helpers**

```js
// src/lib/desktop.js (add to the exports)
export function buildTraySnapshot({ isRunning, modeLabel, timeDisplay }) {
  return {
    tooltip: `${modeLabel} · ${timeDisplay}`,
    toggleLabel: buildTrayToggleLabel({ isRunning })
  };
}

export async function createDesktopBridge() {
  if (!hasTauriRuntime()) {
    return {
      isDesktop: false,
      async getSnapshot() {
        return {
          autoStartEnabled: false,
          autoStartSupported: false,
          notificationPermission: 'default',
          trayReady: false
        };
      },
      async requestNotificationPermission() {
        return 'default';
      },
      async setAutostart() {},
      async sendTimerNotification() {},
      async syncTray() {},
      async installCloseGuard() {},
      async requestQuit() {}
    };
  }

  const [
    { enable, disable, isEnabled },
    notification,
    { defaultWindowIcon },
    { Menu },
    { TrayIcon },
    { getCurrentWindow }
  ] = await Promise.all([
    import('@tauri-apps/plugin-autostart'),
    import('@tauri-apps/plugin-notification'),
    import('@tauri-apps/api/app'),
    import('@tauri-apps/api/menu'),
    import('@tauri-apps/api/tray'),
    import('@tauri-apps/api/window')
  ]);

  const appWindow = getCurrentWindow();
  let allowWindowClose = false;
  let tray = null;

  async function syncTray({ isRunning, modeLabel, timeDisplay, onShowWindow, onToggleTimer, onQuit }) {
    const snapshot = buildTraySnapshot({ isRunning, modeLabel, timeDisplay });
    const menu = await Menu.new({
      items: [
        { id: 'show', text: '显示窗口', action: onShowWindow },
        { id: 'toggle-timer', text: snapshot.toggleLabel, action: onToggleTimer },
        { id: 'quit', text: '退出', action: async () => {
          allowWindowClose = true;
          await onQuit();
        } }
      ]
    });

    if (!tray) {
      tray = await TrayIcon.new({
        icon: await defaultWindowIcon(),
        menu,
        tooltip: snapshot.tooltip,
        menuOnLeftClick: true
      });
    } else {
      await tray.setMenu(menu);
      await tray.setTooltip(snapshot.tooltip);
    }
  }

  async function installCloseGuard({ shouldHideToTray, onHideToTray }) {
    await appWindow.onCloseRequested(async (event) => {
      if (allowWindowClose || !shouldHideToTray()) {
        return;
      }

      event.preventDefault();
      await appWindow.hide();
      await onHideToTray();
    });
  }

  async function requestQuit() {
    allowWindowClose = true;
    await appWindow.close();
  }

  return {
    isDesktop: true,
    async getSnapshot() {
      return {
        autoStartEnabled: await isEnabled(),
        autoStartSupported: true,
        notificationPermission: await notification.isPermissionGranted()
          ? 'granted'
          : 'default',
        trayReady: Boolean(tray)
      };
    },
    async requestNotificationPermission() {
      if (await notification.isPermissionGranted()) return 'granted';
      return notification.requestPermission();
    },
    async setAutostart(enabled) {
      if (enabled) {
        await enable();
      } else {
        await disable();
      }
    },
    async sendTimerNotification({ finishedMode, nextMode, activeTaskText }) {
      const permission = await this.requestNotificationPermission();
      if (permission !== 'granted') return;

      await notification.sendNotification(
        buildNotificationMessage({
          finishedModeLabel: modeNameMap[finishedMode],
          nextModeLabel: modeNameMap[nextMode],
          activeTaskText
        })
      );
    },
    syncTray,
    installCloseGuard,
    requestQuit
  };
}
```

- [ ] **Step 4: Wire tray sync and desktop notifications into the main app**

```js
// app.js (inside initialize after desktop snapshot)
await desktop.installCloseGuard({
  shouldHideToTray: () => desktop.isDesktop && state.preferences.minimizeToTray,
  onHideToTray: async () => {
    showToast('FocusFlow 已最小化到托盘');
  }
});
```

```js
// app.js (new helper)
async function syncDesktopTray() {
  if (!desktop?.isDesktop) return;

  await desktop.syncTray({
    isRunning: state.timer.isRunning,
    modeLabel: modeNameMap[state.timer.mode],
    timeDisplay: formatSeconds(state.timer.remaining),
    onShowWindow: async () => {
      const windowApi = await import('@tauri-apps/api/window');
      const currentWindow = windowApi.getCurrentWindow();
      await currentWindow.show();
      await currentWindow.setFocus();
    },
    onToggleTimer: async () => {
      if (state.timer.isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
    },
    onQuit: async () => {
      await desktop.requestQuit();
    }
  });
}
```

```js
// app.js (call syncDesktopTray from renderTimer)
function renderTimer() {
  refs.modeSwitch.querySelectorAll('[data-mode]').forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === state.timer.mode);
  });

  refs.modeLabel.textContent = modeNameMap[state.timer.mode];
  refs.timeDisplay.textContent = formatSeconds(state.timer.remaining);
  refs.startPauseBtn.textContent = state.timer.isRunning ? '暂停' : '开始';

  refs.focusDurationInput.value = String(state.timer.focusDuration);
  refs.shortBreakDurationInput.value = String(state.timer.shortBreakDuration);
  refs.longBreakDurationInput.value = String(state.timer.longBreakDuration);

  const full = getModeDurationSeconds(state.timer, state.timer.mode);
  const ratio = full > 0 ? Math.max(0, Math.min(1, state.timer.remaining / full)) : 0;
  refs.progressCircle.style.strokeDashoffset = String(CIRCLE_LENGTH * (1 - ratio));
  refs.progressCircle.style.stroke = modeColorMap[state.timer.mode];

  document.title = `${formatSeconds(state.timer.remaining)} · ${modeNameMap[state.timer.mode]} | FocusFlow`;
  void syncDesktopTray();
}
```

```js
// app.js (change the function signature and await the desktop call)
async function completeCurrentSession({ skipped }) {
  // keep the existing session-completion logic
}
```

```js
// app.js (inside completeCurrentSession, before the toast branch)
const activeTodo = state.todos.find((todo) => todo.id === state.selectedTodoId);

if (!skipped && state.preferences.notificationsEnabled) {
  await desktop.sendTimerNotification({
    finishedMode,
    nextMode,
    activeTaskText: activeTodo?.text || ''
  });
}
```

```js
// app.js (update the existing callers to ignore the returned promise explicitly)
refs.skipBtn.addEventListener('click', () => {
  pauseTimer();
  void completeCurrentSession({ skipped: true });
});

function ensureTicker() {
  if (ticker) return;
  ticker = setInterval(() => {
    if (!state.timer.isRunning) return;
    const now = Date.now();
    const last = state.timer.lastTickAt || now;
    const delta = (now - last) / 1000;
    state.timer.lastTickAt = now;
    state.timer.remaining = Math.max(0, state.timer.remaining - delta);

    if (state.timer.remaining <= 0) {
      void completeCurrentSession({ skipped: false });
      return;
    }
    renderTimer();
  }, 250);
}
```

- [ ] **Step 5: Run tests and build the web bundle**

Run: `node --test tests/state.test.js tests/desktop.test.js`

Expected: PASS with 8 passing tests

Run: `npm install`

Expected: dependencies install successfully

Run: `npm run build`

Expected: PASS and a generated `dist/` directory

- [ ] **Step 6: Commit**

```bash
git add app.js src/lib/desktop.js tests/desktop.test.js package-lock.json
git commit -m "feat: add tray and notification integration"
```

## Task 5: Document Linux Prerequisites and Verify the Desktop Build

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the browser-only README with Linux desktop instructions**

````md
# FocusFlow Linux Desktop

FocusFlow is a local-first todo and pomodoro desktop app for Linux, built with Tauri and the existing HTML/CSS/JS UI.

## Prerequisites

### Debian / Ubuntu

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev \
  build-essential \
  curl \
  wget \
  file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev
```

### Tooling

- Node.js 20+
- Rust via `rustup` (1.77.2+)

## Development

```bash
npm install
npm run tauri:dev
```

## Tests

```bash
npm run test
```

## Production Build

```bash
npm run tauri:build
```

## Manual Verification

1. Launch the app and confirm the existing layout matches the web version.
2. Add, complete, and delete todos.
3. Start a focus session, finish it, and confirm the desktop notification appears.
4. Close the window and confirm the app stays available in the tray.
5. Restore the window from the tray.
6. Toggle autostart and relaunch the session to verify the state is persisted.
```
````

- [ ] **Step 2: Run the full automated test suite**

Run: `npm run test`

Expected: PASS with `config`, `state`, and `desktop` tests all green

- [ ] **Step 3: Build the desktop app**

Run: `npm run tauri:build`

Expected: PASS with Tauri bundle artifacts generated under `src-tauri/target/release/bundle/`

- [ ] **Step 4: Perform the Linux manual verification checklist**

Run: `npm run tauri:dev`

Expected: the FocusFlow window opens, the tray icon is present, the close button hides to tray, and end-of-session notifications can be observed manually

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add linux desktop workflow and verification notes"
```

## Self-Review

- Spec coverage:
  - Linux desktop shell: Task 1
  - Keep existing UI and behavior: Tasks 2-4
  - Desktop notifications and reminder flow: Tasks 3-4
  - System tray and close-to-tray: Task 4
  - Autostart: Tasks 3-4
  - Linux build and verification: Task 5
- Placeholder scan:
  - No `TODO`, `TBD`, or “implement later” markers remain.
- Type consistency:
  - Shared state keys are `preferences` and `desktop` everywhere.
  - Desktop bridge method names are `getSnapshot`, `setAutostart`, `sendTimerNotification`, `syncTray`, `installCloseGuard`, `requestQuit`.

## Notes for Execution

- Do not commit `dist/` or `src-tauri/target/` if the repository policy excludes built artifacts. If a `.gitignore` is added during execution, adjust Task 5 Step 5 accordingly and commit only source changes plus docs.
- The current directory is not a Git repository today. If execution starts before Git is initialized, either initialize Git first or skip the commit steps and record that deviation in the execution notes.
