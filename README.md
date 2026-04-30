# FocusFlow Desktop

FocusFlow is a local-first todo and pomodoro desktop app built with Tauri and the existing HTML/CSS/JS UI. The repository supports Linux development and release builds, and now publishes Windows installers from GitHub Actions.

## Prerequisites

### Linux (Debian / Ubuntu)

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
- Rust via `rustup` (1.77.2+) with `cargo` available on `PATH`

### Windows

- Node.js 20+
- Rust via `rustup`
- Visual Studio C++ Build Tools with the Desktop C++ workload
- Microsoft Edge WebView2 Runtime

## Current Environment Note

In the current Linux verification environment, desktop verification is blocked because `cargo` is unavailable on `PATH`. Until Rust is installed via `rustup` and `cargo` is on `PATH`, `npm run tauri:build` and `npm run tauri:dev` will not work here.

## Development

```bash
npm install
npm run tauri:dev
```

On Windows, run the same commands from a Developer PowerShell or terminal where Rust and the Visual Studio build tools are available.

## Tests

```bash
npm run test
```

## Production Build

```bash
npm run tauri:build
```

On Linux, this produces the configured Linux bundle. On Windows, it produces the configured Windows installers (`.msi` and NSIS `.exe`).

## Release Publishing

Formal release artifacts are published by GitHub Actions instead of this Linux workstation.

- Push a tag matching `v*` to build and publish release assets automatically.
- Or trigger the `release` workflow manually with `workflow_dispatch`.
- GitHub Actions publishes Linux `.deb` assets on `ubuntu-22.04`.
- GitHub Actions publishes Windows `.msi` and NSIS `.exe` installers on `windows-latest`.

The current workflow leaves a placeholder for future Windows code signing. Until signing is added, Windows may show the usual unsigned publisher warning during installation.

## Manual Verification

1. Launch the app and confirm the existing layout matches the web version.
2. Add, complete, and delete todos.
3. Start a focus session, finish it, and confirm the desktop notification appears.
4. Enable the minimize-to-tray setting, close the window, and confirm the app stays available in the tray.
5. Restore the window from the tray.
6. Toggle autostart and relaunch the session to verify the state is persisted.
