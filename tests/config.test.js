import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const packagePath = path.resolve('package.json');
const vitePath = path.resolve('vite.config.js');
const cargoManifestPath = path.resolve('src-tauri/Cargo.toml');
const tauriConfigPath = path.resolve('src-tauri/tauri.conf.json');
const capabilityPath = path.resolve('src-tauri/capabilities/default.json');
const tauriIconDir = path.resolve('src-tauri/icons');
const indexHtmlPath = path.resolve('index.html');
const stylesPath = path.resolve('styles.css');
const fontAssetDir = path.resolve('assets/fonts');

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
  assert.deepEqual(tauriConfig.bundle.icon, [
    'icons/32x32.png',
    'icons/128x128.png',
    'icons/128x128@2x.png',
    'icons/icon.png'
  ]);
});

test('rust manifest and capabilities include tray, notification, autostart, and window control support', () => {
  assert.ok(fs.existsSync(cargoManifestPath), 'src-tauri/Cargo.toml should exist');
  assert.ok(fs.existsSync(capabilityPath), 'src-tauri/capabilities/default.json should exist');

  const cargoManifest = fs.readFileSync(cargoManifestPath, 'utf8');
  assert.match(
    cargoManifest,
    /tauri = \{ version = "2", features = \["tray-icon"\] \}/,
    'src-tauri/Cargo.toml should enable the tauri tray-icon feature'
  );

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

test('tauri icon assets exist for desktop builds', () => {
  assert.ok(fs.existsSync(tauriIconDir), 'src-tauri/icons should exist');
  assert.ok(fs.existsSync(path.join(tauriIconDir, 'icon.png')), 'src-tauri/icons/icon.png should exist');
  assert.ok(fs.existsSync(path.join(tauriIconDir, '32x32.png')), 'src-tauri/icons/32x32.png should exist');
  assert.ok(fs.existsSync(path.join(tauriIconDir, '128x128.png')), 'src-tauri/icons/128x128.png should exist');
  assert.ok(
    fs.existsSync(path.join(tauriIconDir, '128x128@2x.png')),
    'src-tauri/icons/128x128@2x.png should exist'
  );
});

test('app shell uses bundled local fonts instead of remote font providers', () => {
  assert.ok(fs.existsSync(indexHtmlPath), 'index.html should exist');
  assert.ok(fs.existsSync(stylesPath), 'styles.css should exist');

  const html = fs.readFileSync(indexHtmlPath, 'utf8');
  const styles = fs.readFileSync(stylesPath, 'utf8');

  assert.doesNotMatch(html, /fonts\.googleapis\.com/i);
  assert.doesNotMatch(html, /fonts\.gstatic\.com/i);
  assert.match(styles, /url\(['"]\.\/assets\/fonts\/focusflow-sans\.ttf['"]\)/);
  assert.match(styles, /url\(['"]\.\/assets\/fonts\/focusflow-serif\.ttf['"]\)/);
});

test('bundled local font assets exist for offline desktop startup', () => {
  assert.ok(fs.existsSync(fontAssetDir), 'assets/fonts should exist');
  assert.ok(
    fs.existsSync(path.join(fontAssetDir, 'focusflow-sans.ttf')),
    'assets/fonts/focusflow-sans.ttf should exist'
  );
  assert.ok(
    fs.existsSync(path.join(fontAssetDir, 'focusflow-serif.ttf')),
    'assets/fonts/focusflow-serif.ttf should exist'
  );
});
