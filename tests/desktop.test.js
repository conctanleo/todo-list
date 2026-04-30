import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildNotificationMessage,
  buildTraySnapshot,
  buildTrayToggleLabel,
  createTraySyncController,
  createDesktopBridge,
  hasTauriRuntime,
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

test('buildTraySnapshot returns stable menu labels for the current timer state', () => {
  const snapshot = buildTraySnapshot({
    isRunning: true,
    modeLabel: '专注时间',
    timeDisplay: '13:20'
  });

  assert.equal(snapshot.tooltip, '专注时间 · 13:20');
  assert.equal(snapshot.title, '专注时间 13:20');
  assert.equal(snapshot.toggleLabel, '暂停计时');
});

test('createTraySyncController skips redundant native sync when snapshot is unchanged', async () => {
  const operations = [];
  const firstMenu = {
    async close() {
      operations.push('closeMenu:first');
    }
  };
  const tray = {
    async setMenu() {
      operations.push('setMenu');
    },
    async setTooltip() {
      operations.push('setTooltip');
    },
    async setTitle() {
      operations.push('setTitle');
    }
  };

  const controller = createTraySyncController({
    supportsTitle: true,
    supportsTooltip: true,
    supportsLeftClickMenu: true,
    async createMenu({ toggleLabel }) {
      operations.push(`createMenu:${toggleLabel}`);
      return firstMenu;
    },
    async createTrayIcon({ title, tooltip, showMenuOnLeftClick }) {
      operations.push(`createTray:${title}:${tooltip}:${showMenuOnLeftClick}`);
      return tray;
    }
  });

  const request = {
    isRunning: true,
    modeLabel: '专注时间',
    timeDisplay: '13:20',
    onShowWindow: async () => {},
    onToggleTimer: async () => {},
    onQuit: async () => {}
  };

  await controller.sync(request);
  await controller.sync({ ...request });

  assert.equal(controller.isReady(), true);
  assert.deepEqual(operations, [
    'createMenu:暂停计时',
    'createTray:专注时间 13:20:专注时间 · 13:20:true'
  ]);
});

test('createTraySyncController serializes overlapping sync requests', async () => {
  const operations = [];
  let resolveFirstMenu;
  const firstMenuPromise = new Promise((resolve) => {
    resolveFirstMenu = resolve;
  });
  const tray = {
    async setMenu() {
      operations.push('setMenu');
    },
    async setTooltip(value) {
      operations.push(`setTooltip:${value}`);
    },
    async setTitle(value) {
      operations.push(`setTitle:${value}`);
    }
  };

  const controller = createTraySyncController({
    supportsTitle: true,
    supportsTooltip: true,
    supportsLeftClickMenu: true,
    async createMenu({ toggleLabel }) {
      operations.push(`createMenu:${toggleLabel}`);
      return firstMenuPromise;
    },
    async createTrayIcon({ title, tooltip, showMenuOnLeftClick }) {
      operations.push(`createTray:${title}:${tooltip}:${showMenuOnLeftClick}`);
      return tray;
    }
  });

  const baseRequest = {
    isRunning: true,
    modeLabel: '专注时间',
    onShowWindow: async () => {},
    onToggleTimer: async () => {},
    onQuit: async () => {}
  };

  const firstSync = controller.sync({
    ...baseRequest,
    timeDisplay: '13:20'
  });
  const secondSync = controller.sync({
    ...baseRequest,
    timeDisplay: '13:19'
  });

  resolveFirstMenu({
    async close() {
      operations.push('closeMenu:first');
    }
  });

  await Promise.all([firstSync, secondSync]);

  assert.deepEqual(operations, [
    'createMenu:暂停计时',
    'createTray:专注时间 13:20:专注时间 · 13:20:true',
    'setTooltip:专注时间 · 13:19',
    'setTitle:专注时间 13:19'
  ]);
});

test('createTraySyncController replaces and closes the old menu when the toggle label changes', async () => {
  const operations = [];
  const tray = {
    async setMenu() {
      operations.push('setMenu');
    },
    async setTooltip(value) {
      operations.push(`setTooltip:${value}`);
    },
    async setTitle(value) {
      operations.push(`setTitle:${value}`);
    }
  };

  const controller = createTraySyncController({
    supportsTitle: true,
    supportsTooltip: true,
    supportsLeftClickMenu: false,
    async createMenu({ toggleLabel }) {
      operations.push(`createMenu:${toggleLabel}`);
      return {
        async close() {
          operations.push(`closeMenu:${toggleLabel}`);
        }
      };
    },
    async createTrayIcon({ title, tooltip, showMenuOnLeftClick }) {
      operations.push(`createTray:${title}:${tooltip}:${showMenuOnLeftClick}`);
      return tray;
    }
  });

  const request = {
    modeLabel: '专注时间',
    onShowWindow: async () => {},
    onToggleTimer: async () => {},
    onQuit: async () => {}
  };

  await controller.sync({
    ...request,
    isRunning: true,
    timeDisplay: '13:20'
  });
  await controller.sync({
    ...request,
    isRunning: false,
    timeDisplay: '13:19'
  });

  assert.deepEqual(operations, [
    'createMenu:暂停计时',
    'createTray:专注时间 13:20:专注时间 · 13:20:false',
    'createMenu:开始计时',
    'setMenu',
    'closeMenu:暂停计时',
    'setTooltip:专注时间 · 13:19',
    'setTitle:专注时间 13:19'
  ]);
});

test('createTraySyncController can recreate the tray icon when only the Linux title changes', async () => {
  const operations = [];

  const controller = createTraySyncController({
    supportsTitle: true,
    supportsTooltip: false,
    supportsLeftClickMenu: false,
    recreateOnTitleChange: true,
    async createMenu({ toggleLabel }) {
      operations.push(`createMenu:${toggleLabel}`);
      return {
        async close() {
          operations.push(`closeMenu:${toggleLabel}`);
        }
      };
    },
    async createTrayIcon({ title, tooltip, showMenuOnLeftClick }) {
      operations.push(`createTray:${title}:${tooltip}:${showMenuOnLeftClick}`);
      return {
        async setMenu() {
          operations.push('setMenu');
        },
        async setTooltip(value) {
          operations.push(`setTooltip:${value}`);
        },
        async setTitle(value) {
          operations.push(`setTitle:${value}`);
        },
        async close() {
          operations.push(`closeTray:${title}`);
        }
      };
    }
  });

  const request = {
    isRunning: true,
    modeLabel: '专注时间',
    onShowWindow: async () => {},
    onToggleTimer: async () => {},
    onQuit: async () => {}
  };

  await controller.sync({
    ...request,
    timeDisplay: '25:00'
  });
  await controller.sync({
    ...request,
    timeDisplay: '24:59'
  });

  assert.deepEqual(operations, [
    'createMenu:暂停计时',
    'createTray:专注时间 25:00:undefined:false',
    'createMenu:暂停计时',
    'createTray:专注时间 24:59:undefined:false',
    'closeMenu:暂停计时',
    'closeTray:专注时间 25:00'
  ]);
});

test('hasTauriRuntime stays false outside a browser runtime', () => {
  assert.equal(hasTauriRuntime(), false);
});

test('createDesktopBridge returns a non-Tauri fallback contract', async () => {
  const bridge = await createDesktopBridge();

  assert.equal(bridge.isDesktop, false);
  assert.deepEqual(await bridge.getSnapshot(), {
    autoStartEnabled: false,
    autoStartSupported: false,
    notificationPermission: 'default',
    trayReady: false
  });
  assert.equal(await bridge.requestNotificationPermission(), 'default');
  await assert.doesNotReject(async () => {
    await bridge.setAutostart(true);
    await bridge.setAutostart(false);
    await bridge.sendTimerNotification({
      finishedMode: 'focus',
      nextMode: 'shortBreak',
      activeTaskText: '写周报'
    });
  });
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
