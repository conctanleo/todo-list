import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultState,
  normalizeState
} from '../src/lib/state.js';
import {
  createFallbackDesktopBridge,
  mergeDesktopSnapshot
} from '../src/lib/desktop.js';

test('normalizeState preserves eyeProtection on todos', () => {
  const state = normalizeState({
    todos: [
      { id: '1', text: 'with eye', eyeProtection: true },
      { id: '2', text: 'without eye' }
    ]
  });

  assert.equal(state.todos[0].eyeProtection, true);
  assert.equal(state.todos[1].eyeProtection, false);
});

test('normalizeState coerces eyeProtection to boolean', () => {
  const state = normalizeState({
    todos: [
      { id: '1', text: 'truthy', eyeProtection: 'yes' },
      { id: '2', text: 'falsy', eyeProtection: 0 }
    ]
  });

  assert.equal(state.todos[0].eyeProtection, true);
  assert.equal(state.todos[1].eyeProtection, false);
});

test('fallback bridge createLockScreen is a no-op', async () => {
  const bridge = createFallbackDesktopBridge();

  await assert.doesNotReject(async () => {
    await bridge.createLockScreen({ taskName: 'test', durationSeconds: 300 });
  });
});

test('fallback bridge closeLockScreen is a no-op', async () => {
  const bridge = createFallbackDesktopBridge();

  await assert.doesNotReject(async () => {
    await bridge.closeLockScreen();
  });
});

test('mergeDesktopSnapshot preserves existing settings', () => {
  const result = mergeDesktopSnapshot(
    { settingsOpen: true, autoStartEnabled: false, autoStartSupported: false, notificationPermission: 'default', trayReady: false },
    { autoStartSupported: true }
  );

  assert.equal(result.settingsOpen, true);
  assert.equal(result.autoStartSupported, true);
});
