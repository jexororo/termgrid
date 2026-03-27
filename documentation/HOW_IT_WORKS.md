# How TermGrid Works

## Architecture

TermGrid is an Electron app with two process domains connected by IPC:

```
┌─────────────────────────────────────────────────────┐
│  Main Process (main/)                               │
│  ┌──────────────┐  ┌─────────────┐                  │
│  │ pty-manager   │  │ ipc-handlers│                  │
│  │ (node-pty)    │◄─┤ (routing)   │                  │
│  └──────┬───────┘  └──────▲──────┘                  │
│         │                  │                         │
│    pty stdin/stdout    IPC channels                  │
│         │                  │                         │
│  ┌──────▼──────────────────┴──────┐                  │
│  │         preload.js             │                  │
│  │   (contextBridge API)          │                  │
│  └──────────────┬─────────────────┘                  │
│                 │                                    │
├─────────────────┼────────────────────────────────────┤
│  Renderer Process (renderer/)                        │
│                 │                                    │
│  ┌──────────────▼─────────────────┐                  │
│  │       app.bundle.js            │                  │
│  │  ┌──────────┐ ┌────────────┐   │                  │
│  │  │Split Tree│ │Terminal    │   │                  │
│  │  │(layout)  │ │Panes       │   │                  │
│  │  └──────────┘ │(xterm.js)  │   │                  │
│  │  ┌──────────┐ └────────────┘   │                  │
│  │  │Tab Bar   │ ┌────────────┐   │                  │
│  │  └──────────┘ │Name Guesser│   │                  │
│  │  ┌──────────┐ └────────────┘   │                  │
│  │  │Ctx Menu  │                  │                  │
│  │  └──────────┘                  │                  │
│  └────────────────────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

## Data Flow

When you type in a terminal:

```
Keypress → xterm.js onData → window.termgrid.writePty(id, data)
  → IPC 'pty:write' → pty-manager → node-pty → cmd.exe/powershell.exe

cmd.exe output → node-pty onData → IPC 'pty:data'
  → preload → renderer callback → xterm.js terminal.write(data)
  → Name Guesser (pattern matching)
```

## Key Components

### Split Tree (Tiling Layout Engine)

The layout is modeled as a **binary tree**:

```
             SplitNode (horizontal, ratio=0.6)
            /                               \
    LeafNode (pane-1)          SplitNode (vertical, ratio=0.5)
                              /                              \
                    LeafNode (pane-2)                LeafNode (pane-3)
```

- **LeafNode**: Contains a single terminal pane (identified by UUID)
- **SplitNode**: Contains two children, a direction (`h` or `v`), and a ratio (0.1 to 0.9)

**Splitting** replaces a LeafNode with a SplitNode containing the original leaf and a new one.

**Closing** removes a LeafNode and replaces its parent SplitNode with the surviving sibling.

**Rendering** is recursive: each SplitNode creates a flex container with two children and a draggable resize handle between them.

### PTY Manager

Each terminal pane has a corresponding `node-pty` process in the main process, keyed by UUID. The manager handles:

- **Spawning**: `pty.spawn(shell, args, { cols, rows, cwd, env })`
- **Data routing**: pty output → IPC → renderer
- **Resize**: When panes resize, the pty gets updated col/row counts
- **Cleanup**: Kill processes on pane close or app exit

### Name Guesser

A heuristic engine that maintains a rolling buffer of the last 30 lines of terminal output per pane. On each new data chunk:

1. Scans for known tool patterns (regex matches)
2. Falls back to prompt parsing (extracts the last command typed)
3. Debounces updates by 1.5 seconds to avoid flicker
4. Manual names override auto-detection permanently

### Preload Bridge

Electron's security model requires `contextIsolation: true`. The preload script uses `contextBridge.exposeInMainWorld` to expose a safe `window.termgrid` API:

```
window.termgrid.createPty(id, shellType)  → spawns a new PTY
window.termgrid.writePty(id, data)        → sends input to PTY
window.termgrid.resizePty(id, cols, rows) → resizes PTY
window.termgrid.destroyPty(id)            → kills PTY
window.termgrid.onPtyData(callback)       → receives PTY output
window.termgrid.onPtyExit(callback)       → receives PTY exit events
window.termgrid.minimize/maximize/close() → window controls
```

## File Reference

| File | Purpose |
|------|---------|
| `main/main.js` | Electron entry point, creates BrowserWindow, registers window control IPC |
| `main/preload.js` | Context bridge between main and renderer processes |
| `main/pty-manager.js` | Manages node-pty process lifecycle (spawn, write, resize, kill) |
| `main/ipc-handlers.js` | Registers IPC handlers that delegate to PtyManager |
| `shared/constants.js` | IPC channel names, shell configs, default color palette |
| `renderer/index.html` | HTML shell, loads xterm.js and app.bundle.js |
| `renderer/app.bundle.js` | All renderer logic bundled into one IIFE |
| `renderer/styles/main.css` | Title bar, tab bar, context menu styling |
| `renderer/styles/terminal.css` | Split layout, pane borders, resize handles |

## Dependencies

| Package | Role |
|---------|------|
| `electron` | Desktop app framework |
| `node-pty` | Native PTY spawning (cmd.exe, powershell.exe) |
| `@xterm/xterm` | Terminal emulator rendering in the browser |
| `@xterm/addon-fit` | Auto-fits terminal to container dimensions |
| `@electron/rebuild` | Recompiles native modules for Electron's Node ABI |
