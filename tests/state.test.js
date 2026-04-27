import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDefaultState,
  normalizeState,
  getModeDurationSeconds,
  formatSeconds
} from '../src/lib/state.js';
import { loadStoredState, saveStoredState } from '../src/lib/storage.js';

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

test('normalizeState preserves valid remaining while clearing active timer runtime flags', () => {
  const normalized = normalizeState({
    timer: {
      mode: 'shortBreak',
      remaining: 123,
      isRunning: true,
      lastTickAt: 456
    }
  });

  assert.equal(normalized.timer.remaining, 123);
  assert.equal(normalized.timer.isRunning, false);
  assert.equal(normalized.timer.lastTickAt, null);
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

test('loadStoredState falls back to defaults when stored JSON is invalid', () => {
  const state = loadStoredState({
    getItem() {
      return '{not-valid-json';
    }
  });

  assert.deepEqual(state, createDefaultState());
});

test('loadStoredState falls back to defaults when storage access throws', () => {
  const state = loadStoredState({
    getItem() {
      throw new Error('storage denied');
    }
  });

  assert.deepEqual(state, createDefaultState());
});

test('saveStoredState returns false when storage write throws', () => {
  const state = createDefaultState();

  const result = saveStoredState(state, {
    setItem() {
      throw new Error('quota exceeded');
    }
  });

  assert.equal(result, false);
});
