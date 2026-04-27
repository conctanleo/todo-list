import { STORAGE_KEY, createDefaultState, normalizeState } from './state.js';

export function loadStoredState(storage) {
  try {
    const targetStorage = storage ?? window.localStorage;
    const raw = targetStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return createDefaultState();
  }
}

export function saveStoredState(state, storage) {
  try {
    const targetStorage = storage ?? window.localStorage;
    targetStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
