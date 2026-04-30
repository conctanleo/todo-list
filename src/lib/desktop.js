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

export function buildTraySnapshot({ isRunning, modeLabel, timeDisplay }) {
  return {
    tooltip: `${modeLabel} · ${timeDisplay}`,
    title: `${modeLabel} ${timeDisplay}`,
    toggleLabel: buildTrayToggleLabel({ isRunning })
  };
}

function areTraySnapshotsEqual(left, right) {
  return (
    left?.tooltip === right?.tooltip &&
    left?.title === right?.title &&
    left?.toggleLabel === right?.toggleLabel
  );
}

async function closeResourceQuietly(resource) {
  if (!resource || typeof resource.close !== 'function') return;
  try {
    await resource.close();
  } catch {}
}

function hasLinuxUserAgent() {
  if (typeof navigator === 'undefined') return false;
  return /linux/i.test(navigator.userAgent || '');
}

export function createTraySyncController({
  createMenu,
  createTrayIcon,
  supportsTooltip,
  supportsTitle,
  supportsLeftClickMenu,
  recreateOnTitleChange = false,
  onBeforeQuit
}) {
  let tray = null;
  let menu = null;
  let lastSnapshot = null;
  let pendingRequest = null;
  let syncLoop = null;
  let handlers = {
    onShowWindow: async () => {},
    onToggleTimer: async () => {},
    onQuit: async () => {}
  };

  async function buildMenu(toggleLabel) {
    return createMenu({
      toggleLabel,
      onShowWindow: async () => handlers.onShowWindow(),
      onToggleTimer: async () => handlers.onToggleTimer(),
      onQuit: async () => {
        if (onBeforeQuit) {
          await onBeforeQuit();
        }
        await handlers.onQuit();
      }
    });
  }

  async function applySnapshot(snapshot) {
    const nextMenuNeeded = !tray || !lastSnapshot || snapshot.toggleLabel !== lastSnapshot.toggleLabel;
    const recreateTrayNeeded =
      Boolean(tray) && recreateOnTitleChange && snapshot.title !== lastSnapshot?.title;

    if (!tray) {
      const nextMenu = await buildMenu(snapshot.toggleLabel);
      try {
        tray = await createTrayIcon({
          menu: nextMenu,
          tooltip: supportsTooltip ? snapshot.tooltip : undefined,
          title: supportsTitle ? snapshot.title : undefined,
          showMenuOnLeftClick: supportsLeftClickMenu
        });
        menu = nextMenu;
        lastSnapshot = snapshot;
      } catch (error) {
        await closeResourceQuietly(nextMenu);
        throw error;
      }
      return;
    }

    if (recreateTrayNeeded) {
      const nextMenu = await buildMenu(snapshot.toggleLabel);
      try {
        const nextTray = await createTrayIcon({
          menu: nextMenu,
          tooltip: supportsTooltip ? snapshot.tooltip : undefined,
          title: supportsTitle ? snapshot.title : undefined,
          showMenuOnLeftClick: supportsLeftClickMenu
        });
        const previousTray = tray;
        const previousMenu = menu;
        tray = nextTray;
        menu = nextMenu;
        lastSnapshot = snapshot;
        await closeResourceQuietly(previousMenu);
        await closeResourceQuietly(previousTray);
      } catch (error) {
        await closeResourceQuietly(nextMenu);
        throw error;
      }
      return;
    }

    if (nextMenuNeeded) {
      const nextMenu = await buildMenu(snapshot.toggleLabel);
      try {
        await tray.setMenu(nextMenu);
      } catch (error) {
        await closeResourceQuietly(nextMenu);
        throw error;
      }
      await closeResourceQuietly(menu);
      menu = nextMenu;
    }

    if (supportsTooltip && snapshot.tooltip !== lastSnapshot.tooltip) {
      await tray.setTooltip(snapshot.tooltip);
    }
    if (supportsTitle && snapshot.title !== lastSnapshot.title) {
      await tray.setTitle(snapshot.title);
    }

    lastSnapshot = snapshot;
  }

  async function drainSyncQueue() {
    try {
      while (pendingRequest) {
        const request = pendingRequest;
        pendingRequest = null;
        handlers = {
          onShowWindow: request.onShowWindow,
          onToggleTimer: request.onToggleTimer,
          onQuit: request.onQuit
        };

        const snapshot = buildTraySnapshot(request);
        if (tray && areTraySnapshotsEqual(snapshot, lastSnapshot)) {
          continue;
        }

        await applySnapshot(snapshot);
      }
    } finally {
      syncLoop = null;
    }
  }

  return {
    isReady() {
      return Boolean(tray);
    },
    async sync(request) {
      pendingRequest = request;
      if (!syncLoop) {
        syncLoop = drainSyncQueue();
      }
      return syncLoop;
    }
  };
}

export function mergeDesktopSnapshot(current, patch) {
  return {
    ...current,
    ...patch,
    settingsOpen: current.settingsOpen
  };
}

export function hasTauriRuntime() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function createFallbackDesktopBridge() {
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

export async function createDesktopBridge() {
  if (!hasTauriRuntime()) {
    return createFallbackDesktopBridge();
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
  const traySync = createTraySyncController({
    supportsTooltip: !hasLinuxUserAgent(),
    supportsTitle: hasLinuxUserAgent(),
    supportsLeftClickMenu: !hasLinuxUserAgent(),
    recreateOnTitleChange: hasLinuxUserAgent(),
    onBeforeQuit: async () => {
      allowWindowClose = true;
    },
    async createMenu({ toggleLabel, onShowWindow, onToggleTimer, onQuit }) {
      return Menu.new({
        items: [
          { id: 'show', text: '显示窗口', action: onShowWindow },
          { id: 'toggle-timer', text: toggleLabel, action: onToggleTimer },
          { id: 'quit', text: '退出', action: onQuit }
        ]
      });
    },
    async createTrayIcon({ menu, tooltip, title, showMenuOnLeftClick }) {
      return TrayIcon.new({
        icon: await defaultWindowIcon(),
        menu,
        tooltip,
        title,
        showMenuOnLeftClick
      });
    }
  });

  async function syncTray({
    isRunning,
    modeLabel,
    timeDisplay,
    onShowWindow,
    onToggleTimer,
    onQuit
  }) {
    await traySync.sync({
      isRunning,
      modeLabel,
      timeDisplay,
      onShowWindow,
      onToggleTimer,
      onQuit
    });
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
        trayReady: traySync.isReady()
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
