import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const tauriConfigPath = path.resolve('src-tauri/tauri.conf.json');
const releaseWorkflowPath = path.resolve('.github/workflows/release.yml');
const readmePath = path.resolve('README.md');
const windowsIconPath = path.resolve('src-tauri/icons/icon.ico');

test('tauri bundle config includes Linux and Windows release targets', () => {
  const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));

  assert.deepEqual(tauriConfig.bundle.targets, ['deb', 'msi', 'nsis']);
  assert.ok(
    tauriConfig.bundle.icon.includes('icons/icon.ico'),
    'Windows bundles should declare an .ico icon'
  );
});

test('release workflow publishes Linux and Windows bundles', () => {
  const workflow = fs.readFileSync(releaseWorkflowPath, 'utf8');

  assert.match(workflow, /linux-release:/);
  assert.match(workflow, /windows-release:/);
  assert.match(workflow, /runs-on:\s+ubuntu-22\.04/);
  assert.match(workflow, /runs-on:\s+windows-latest/);
  assert.match(workflow, /args:\s+--bundles deb/);
  assert.match(workflow, /args:\s+--bundles msi,nsis/);
});

test('documentation covers Windows release prerequisites and CI flow', () => {
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.match(readme, /Windows/i);
  assert.match(readme, /Visual Studio C\+\+ Build Tools/i);
  assert.match(readme, /WebView2 Runtime/i);
  assert.match(readme, /GitHub Actions/i);
  assert.match(readme, /v\*/);
});

test('windows icon asset exists for desktop bundling', () => {
  assert.ok(fs.existsSync(windowsIconPath), 'src-tauri/icons/icon.ico should exist');
});
