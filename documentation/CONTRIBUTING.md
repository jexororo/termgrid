# Contributing to TermGrid

Thanks for your interest in contributing to TermGrid!

## Getting Set Up

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Patch and rebuild `node-pty` (see [Troubleshooting](TROUBLESHOOTING.md) if the rebuild fails):
   ```bash
   npm run rebuild
   ```
4. Run the app:
   ```bash
   npm start
   ```
5. Enable DevTools for debugging by uncommenting `openDevTools()` in `main/main.js`

## Project Structure

```
main/                  # Electron main process
  main.js              # Window creation, IPC for window controls
  preload.js           # Context bridge (renderer ↔ main API)
  pty-manager.js       # node-pty process lifecycle
  ipc-handlers.js      # IPC channel registration

renderer/              # Electron renderer process (UI)
  index.html           # Entry HTML
  app.bundle.js        # All renderer logic (single IIFE bundle)
  styles/
    main.css           # Title bar, tabs, context menu
    terminal.css       # Pane layout, borders, resize handles

shared/
  constants.js         # IPC channel names, shell paths, color palette
```

### Why app.bundle.js?

The renderer code is in a single file (`app.bundle.js`) instead of using ES modules because Electron's renderer with `contextIsolation: true` has restrictions on module loading. The IIFE pattern avoids module system issues while keeping everything in one place.

The original modular source files (`renderer/app.js`, `renderer/layout/split-tree.js`, etc.) are kept for reference but are **not** used at runtime.

## How to Contribute

### Bug Fixes

1. Open an issue describing the bug
2. Fork, create a branch, fix, and submit a PR
3. Include steps to reproduce if possible

### New Features

Some ideas for contributions:

- **Session persistence** - Save and restore layout/shells on restart
- **Drag-and-drop pane reordering** - Click a pane header and drag it to swap positions
- **Custom themes** - User-configurable terminal color schemes
- **Search in terminal** - Ctrl+F to search terminal scrollback
- **Tab reordering** - Drag tabs to reorder
- **Linux/macOS support** - node-pty supports Unix; the app just needs testing and shell config
- **Configurable shortcuts** - Let users rebind keyboard shortcuts
- **Profile system** - Save shell + working directory + name presets

### Code Style

- No framework dependencies in the renderer (vanilla JS/HTML/CSS)
- Keep the renderer bundle as a single IIFE
- Use `var` and `function` declarations in `app.bundle.js` for consistency
- Main process files use CommonJS (`require`/`module.exports`)
- Avoid adding dependencies unless absolutely necessary

## Reporting Issues

When reporting a bug, include:

- Windows version (Settings → System → About)
- Node.js version (`node --version`)
- Steps to reproduce
- DevTools console output (errors/warnings)
- Screenshot if visual
