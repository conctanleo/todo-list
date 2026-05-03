import {
  CIRCLE_LENGTH,
  clampNumber,
  escapeHtml,
  formatSeconds,
  getDateKey,
  getModeDurationSeconds,
  modeColorMap,
  modeNameMap
} from "./src/lib/state.js";
import {
  createFallbackDesktopBridge,
  createDesktopBridge,
  mergeDesktopSnapshot
} from "./src/lib/desktop.js";
import { loadStoredState, saveStoredState } from "./src/lib/storage.js";

const state = loadStoredState();

const refs = {
  todayLabel: document.getElementById("todayLabel"),
  desktopSettingsToggle: document.getElementById("desktopSettingsToggle"),
  desktopPanel: document.getElementById("desktopPanel"),
  todoForm: document.getElementById("todoForm"),
  todoInput: document.getElementById("todoInput"),
  eyeProtectionCheckbox: document.getElementById("eyeProtectionCheckbox"),
  todoCount: document.getElementById("todoCount"),
  todoList: document.getElementById("todoList"),
  filterGroup: document.getElementById("filterGroup"),
  modeSwitch: document.getElementById("modeSwitch"),
  modeLabel: document.getElementById("modeLabel"),
  timeDisplay: document.getElementById("timeDisplay"),
  progressCircle: document.getElementById("progressCircle"),
  activeTaskDisplay: document.getElementById("activeTaskDisplay"),
  startPauseBtn: document.getElementById("startPauseBtn"),
  resetBtn: document.getElementById("resetBtn"),
  skipBtn: document.getElementById("skipBtn"),
  focusDurationInput: document.getElementById("focusDuration"),
  shortBreakDurationInput: document.getElementById("shortBreakDuration"),
  longBreakDurationInput: document.getElementById("longBreakDuration"),
  todayFocusSessions: document.getElementById("todayFocusSessions"),
  todayCompletedTasks: document.getElementById("todayCompletedTasks"),
  estimatedFocusTime: document.getElementById("estimatedFocusTime"),
  notificationsEnabled: document.getElementById("notificationsEnabled"),
  minimizeToTray: document.getElementById("minimizeToTray"),
  autoStartEnabled: document.getElementById("autoStartEnabled"),
  testNotificationBtn: document.getElementById("testNotificationBtn"),
  toast: document.getElementById("toast"),
};

let ticker = null;
let toastTimer = null;
let desktop = null;

if (location.hash.startsWith('#lock-screen')) {
  import('./src/lib/lock-screen.js').then(m => m.initLockScreen()).catch(console.error);
} else {
  initialize().catch((error) => {
    console.error(error);
    showToast("桌面模块初始化失败，已回退为基础模式");
  });
}

async function initialize() {
  refs.progressCircle.style.strokeDasharray = String(CIRCLE_LENGTH);
  desktop = createFallbackDesktopBridge();

  try {
    desktop = await createDesktopBridge();
    state.desktop = mergeDesktopSnapshot(state.desktop, await desktop.getSnapshot());
    await desktop.installCloseGuard({
      shouldHideToTray: () => desktop.isDesktop && state.preferences.minimizeToTray,
      onHideToTray: async () => {
        showToast('FocusFlow 已最小化到托盘');
      }
    });
  } catch (error) {
    console.error(error);
    desktop = createFallbackDesktopBridge();
    state.desktop = mergeDesktopSnapshot(state.desktop, await desktop.getSnapshot());
    showToast("桌面模块初始化失败，已回退为基础模式");
  }

  bindEvents();
  renderAll();
  ensureTicker();
}

function bindEvents() {
  refs.todoForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = refs.todoInput.value.trim();
    if (!value) return;
    addTodo(value);
    refs.todoInput.value = "";
  });

  refs.filterGroup.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-filter]");
    if (!btn) return;
    state.filter = btn.dataset.filter;
    saveState();
    renderTodos();
  });

  refs.todoList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = event.target.closest("[data-id]");
    if (!item) return;
    const todoId = item.dataset.id;
    const action = button.dataset.action;

    if (action === "toggle") toggleTodo(todoId);
    if (action === "delete") deleteTodo(todoId);
    if (action === "focus") selectFocusTodo(todoId);
  });

  refs.modeSwitch.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-mode]");
    if (!btn) return;
    setMode(btn.dataset.mode, { stop: true, resetDuration: true });
  });

  refs.startPauseBtn.addEventListener("click", () => {
    if (state.timer.isRunning) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  refs.resetBtn.addEventListener("click", () => {
    pauseTimer();
    state.timer.remaining = getModeDurationSeconds(state.timer);
    saveState();
    renderTimer();
    showToast("计时器已重置");
  });

  refs.skipBtn.addEventListener("click", () => {
    pauseTimer();
    void completeCurrentSession({ skipped: true });
  });

  refs.desktopSettingsToggle.addEventListener("click", () => {
    state.desktop.settingsOpen = !state.desktop.settingsOpen;
    renderDesktopSettings();
  });

  refs.notificationsEnabled.addEventListener("change", async () => {
    state.preferences.notificationsEnabled = refs.notificationsEnabled.checked;
    saveState();
  });

  refs.minimizeToTray.addEventListener("change", () => {
    state.preferences.minimizeToTray = refs.minimizeToTray.checked;
    saveState();
  });

  refs.autoStartEnabled.addEventListener("change", async () => {
    try {
      await desktop.setAutostart(refs.autoStartEnabled.checked);
      state.desktop.autoStartEnabled = refs.autoStartEnabled.checked;
      saveState();
      renderDesktopSettings();
    } catch (error) {
      console.error(error);
      refs.autoStartEnabled.checked = state.desktop.autoStartEnabled;
      showToast("开机自启切换失败");
    }
  });

  refs.testNotificationBtn.addEventListener("click", async () => {
    if (!state.preferences.notificationsEnabled) {
      showToast("请先开启桌面通知");
      return;
    }

    try {
      await desktop.sendTimerNotification({
        finishedMode: "focus",
        nextMode: "shortBreak",
        activeTaskText: state.todos.find((todo) => todo.id === state.selectedTodoId)?.text || ""
      });
    } catch (error) {
      console.error(error);
      showToast("测试通知发送失败");
    }
  });

  refs.focusDurationInput.addEventListener("change", () => {
    updateDuration("focusDuration", refs.focusDurationInput.value, 5, 90, "focus");
  });
  refs.shortBreakDurationInput.addEventListener("change", () => {
    updateDuration("shortBreakDuration", refs.shortBreakDurationInput.value, 1, 30, "shortBreak");
  });
  refs.longBreakDurationInput.addEventListener("change", () => {
    updateDuration("longBreakDuration", refs.longBreakDurationInput.value, 5, 60, "longBreak");
  });
}

function addTodo(text) {
  const todo = {
    id: crypto.randomUUID(),
    text,
    done: false,
    pomodoros: 0,
    createdAt: Date.now(),
    completedAt: null,
    eyeProtection: refs.eyeProtectionCheckbox.checked
  };
  state.todos.unshift(todo);
  if (!state.selectedTodoId) state.selectedTodoId = todo.id;
  refs.eyeProtectionCheckbox.checked = false;
  saveState();
  renderAll();
  showToast("任务已添加");
}

function toggleTodo(todoId) {
  const todo = state.todos.find((item) => item.id === todoId);
  if (!todo) return;
  todo.done = !todo.done;
  todo.completedAt = todo.done ? Date.now() : null;
  saveState();
  renderAll();
}

function deleteTodo(todoId) {
  state.todos = state.todos.filter((todo) => todo.id !== todoId);
  if (state.selectedTodoId === todoId) state.selectedTodoId = null;
  if (!state.selectedTodoId && state.todos.length > 0) {
    const next = state.todos.find((item) => !item.done) || state.todos[0];
    state.selectedTodoId = next.id;
  }
  saveState();
  renderAll();
  showToast("任务已删除");
}

function selectFocusTodo(todoId) {
  if (!state.todos.some((todo) => todo.id === todoId)) return;
  state.selectedTodoId = todoId;
  saveState();
  renderTodos();
  renderActiveTask();
}

function startTimer() {
  if (state.timer.isRunning) return;
  if (
    !desktop?.isDesktop &&
    state.preferences.notificationsEnabled &&
    typeof Notification !== "undefined" &&
    Notification.permission === "default"
  ) {
    Notification.requestPermission().catch(() => {});
  }
  state.timer.isRunning = true;
  state.timer.lastTickAt = Date.now();
  saveState();
  renderTimer();
}

function pauseTimer() {
  state.timer.isRunning = false;
  state.timer.lastTickAt = null;
  saveState();
  renderTimer();
}

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

async function completeCurrentSession({ skipped }) {
  const finishedMode = state.timer.mode;
  const isFocus = finishedMode === "focus";
  let nextMode = "focus";

  if (isFocus) {
    if (!skipped) {
      state.timer.completedFocusSessions += 1;
      state.focusHistory.push({
        ts: Date.now(),
        minutes: state.timer.focusDuration,
      });
      if (state.focusHistory.length > 500) {
        state.focusHistory = state.focusHistory.slice(-500);
      }
      const activeTodo = state.todos.find((todo) => todo.id === state.selectedTodoId);
      if (activeTodo) activeTodo.pomodoros += 1;
      const shouldLongBreak = state.timer.completedFocusSessions % 4 === 0;
      nextMode = shouldLongBreak ? "longBreak" : "shortBreak";
    } else {
      nextMode = "shortBreak";
    }
  } else {
    nextMode = "focus";
  }

  state.timer.mode = nextMode;
  state.timer.remaining = getModeDurationSeconds(state.timer, nextMode);
  state.timer.isRunning = false;
  state.timer.lastTickAt = null;

  saveState();
  renderAll();

  const activeTodo = state.todos.find((todo) => todo.id === state.selectedTodoId);

  if (!skipped && desktop?.isDesktop && activeTodo?.eyeProtection) {
    showToast('护眼模式将在 3 秒后启动');
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      await desktop.createLockScreen({
        taskName: activeTodo.text,
        durationSeconds: 300
      });
    } catch (error) {
      console.error(error);
      showToast('护眼模式启动失败');
    }
  }

  if (!skipped) {
    playBell();
    if (state.preferences.notificationsEnabled) {
      if (desktop?.isDesktop) {
        try {
          await desktop.sendTimerNotification({
            finishedMode,
            nextMode,
            activeTaskText: activeTodo?.text || ""
          });
        } catch (error) {
          console.error(error);
        }
      } else {
        notifyUser(`${modeNameMap[finishedMode]}已结束，进入${modeNameMap[nextMode]}。`);
      }
    }
    showToast(`${modeNameMap[finishedMode]}结束，已切换到${modeNameMap[nextMode]}`);
  } else {
    showToast(`已跳过，切换到${modeNameMap[nextMode]}`);
  }
}

function updateDuration(timerKey, rawValue, min, max, mode) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return;
  const clamped = clampNumber(parsed, min, max, min);
  state.timer[timerKey] = clamped;

  if (state.timer.mode === mode) {
    state.timer.remaining = clamped * 60;
    state.timer.isRunning = false;
    state.timer.lastTickAt = null;
  }
  saveState();
  renderAll();
}

function setMode(mode, options = { stop: true, resetDuration: true }) {
  if (!modeNameMap[mode]) return;
  if (options.stop) {
    state.timer.isRunning = false;
    state.timer.lastTickAt = null;
  }
  state.timer.mode = mode;
  if (options.resetDuration) {
    state.timer.remaining = getModeDurationSeconds(state.timer, mode);
  }
  saveState();
  renderTimer();
}

function renderAll() {
  renderDate();
  renderTodos();
  renderTimer();
  renderStats();
  renderActiveTask();
  renderDesktopSettings();
}

function renderDate() {
  const now = new Date();
  refs.todayLabel.textContent = now.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function renderTodos() {
  const activeCount = state.todos.filter((todo) => !todo.done).length;
  refs.todoCount.textContent = `${state.todos.length} 项任务 · ${activeCount} 项进行中`;

  refs.filterGroup.querySelectorAll("[data-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === state.filter);
  });

  const filtered = state.todos.filter((todo) => {
    if (state.filter === "active") return !todo.done;
    if (state.filter === "done") return todo.done;
    return true;
  });

  if (filtered.length === 0) {
    refs.todoList.innerHTML = `<li class="todo-item"><p class="todo-title">当前筛选下没有任务</p></li>`;
    return;
  }

  refs.todoList.innerHTML = filtered
    .map((todo) => {
      const isSelected = state.selectedTodoId === todo.id;
      const created = new Date(todo.createdAt).toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <li class="todo-item ${todo.done ? "done" : ""}" data-id="${todo.id}">
          <button class="todo-check" type="button" data-action="toggle" aria-label="切换完成状态"></button>
          <div class="todo-left">
            <p class="todo-title">${escapeHtml(todo.text)}</p>
            <div class="todo-meta">
              <span>🍅 ${todo.pomodoros}</span>
              <span>创建于 ${created}</span>
              ${todo.eyeProtection ? '<span class="eye-badge">👁 护眼</span>' : ''}
            </div>
          </div>
          <div class="todo-actions">
            <button type="button" data-action="focus" class="focus-pick ${isSelected ? "active" : ""}">
              ${isSelected ? "专注中" : "设为专注"}
            </button>
            <button type="button" data-action="delete" class="danger">删除</button>
          </div>
        </li>
      `;
    })
    .join("");
}

function renderTimer() {
  refs.modeSwitch.querySelectorAll("[data-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.mode === state.timer.mode);
  });

  refs.modeLabel.textContent = modeNameMap[state.timer.mode];
  refs.timeDisplay.textContent = formatSeconds(state.timer.remaining);
  refs.startPauseBtn.textContent = state.timer.isRunning ? "暂停" : "开始";

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

async function syncDesktopTray() {
  if (!desktop?.isDesktop) return;

  try {
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

    if (!state.desktop.trayReady) {
      state.desktop.trayReady = true;
      saveState();
    }
  } catch (error) {
    console.error(error);
  }
}

function renderStats() {
  const todayKey = getDateKey(new Date());
  const todayCompletedTasks = state.todos.filter((todo) => {
    if (!todo.completedAt) return false;
    return getDateKey(new Date(todo.completedAt)) === todayKey;
  }).length;

  const todayFocusLogs = state.focusHistory.filter((entry) => {
    const ts = typeof entry === "number" ? entry : entry.ts;
    return getDateKey(new Date(ts)) === todayKey;
  });

  const totalMinutes = todayFocusLogs.reduce((sum, entry) => {
    if (typeof entry === "number") return sum + state.timer.focusDuration;
    return sum + (entry.minutes || state.timer.focusDuration);
  }, 0);

  refs.todayFocusSessions.textContent = String(todayFocusLogs.length);
  refs.todayCompletedTasks.textContent = String(todayCompletedTasks);
  refs.estimatedFocusTime.textContent = `${totalMinutes} 分钟`;
}

function renderActiveTask() {
  const selected = state.todos.find((todo) => todo.id === state.selectedTodoId);
  refs.activeTaskDisplay.textContent = selected
    ? `当前专注任务：${selected.text}`
    : "当前专注任务：未选择";
}

function renderDesktopSettings() {
  refs.desktopPanel.classList.toggle("hidden", !state.desktop.settingsOpen);
  refs.notificationsEnabled.checked = state.preferences.notificationsEnabled;
  refs.minimizeToTray.checked = state.preferences.minimizeToTray;
  refs.autoStartEnabled.checked = state.desktop.autoStartEnabled;
  refs.autoStartEnabled.disabled = !state.desktop.autoStartSupported;
}

function showToast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    refs.toast.classList.remove("show");
  }, 1800);
}

function notifyUser(message) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  new Notification("FocusFlow", { body: message });
}

function saveState() {
  saveStoredState(state);
}

function playBell() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  const ctx = new AudioCtx();
  const now = ctx.currentTime;

  const toneA = ctx.createOscillator();
  const gainA = ctx.createGain();
  toneA.type = "sine";
  toneA.frequency.value = 880;
  gainA.gain.setValueAtTime(0.0001, now);
  gainA.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gainA.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
  toneA.connect(gainA).connect(ctx.destination);

  const toneB = ctx.createOscillator();
  const gainB = ctx.createGain();
  toneB.type = "triangle";
  toneB.frequency.value = 1175;
  gainB.gain.setValueAtTime(0.0001, now + 0.18);
  gainB.gain.exponentialRampToValueAtTime(0.09, now + 0.23);
  gainB.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  toneB.connect(gainB).connect(ctx.destination);

  toneA.start(now);
  toneA.stop(now + 0.25);
  toneB.start(now + 0.18);
  toneB.stop(now + 0.5);
}
