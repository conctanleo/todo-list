# FocusFlow Linux Desktop

FocusFlow is a local-first todo and pomodoro desktop app for Linux, built with Tauri and the existing HTML/CSS/JS UI.

## Prerequisites

### Debian / Ubuntu

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

## Current Environment Note

In the current verification environment, desktop verification is blocked because `cargo` is unavailable on `PATH`. Until Rust is installed via `rustup` and `cargo` is on `PATH`, `npm run tauri:build` and `npm run tauri:dev` will not work here.

## Development

```bash
npm install
npm run tauri:dev
```

## Tests

```bash
npm run test
```

## Production Build

```bash
npm run tauri:build
```

## Manual Verification

1. Launch the app and confirm the existing layout matches the web version.
2. Add, complete, and delete todos.
3. Start a focus session, finish it, and confirm the desktop notification appears.
4. Enable the minimize-to-tray setting, close the window, and confirm the app stays available in the tray.
5. Restore the window from the tray.
6. Toggle autostart and relaunch the session to verify the state is persisted.
