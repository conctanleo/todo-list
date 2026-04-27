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
