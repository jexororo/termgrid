# TermGrid User Guide

## Getting Started

When you launch TermGrid, you'll see a single PowerShell terminal filling the window. From here, you can split, resize, and customize your workspace.

## Layout

### Splitting Panes

You can divide any pane into two:

- **Horizontal split** (side by side): `Ctrl+Shift+H` or right-click → "Split Horizontal"
- **Vertical split** (top and bottom): `Ctrl+Shift+J` or right-click → "Split Vertical"
- **"+" button**: Clicks the + in the tab bar to split the active pane horizontally

Each split creates a new independent terminal session. You can split as many times as you want to create complex layouts.

### Resizing Panes

Drag the thin border between any two panes to resize them. The border highlights blue when you hover over it. Terminals automatically reflow their content to fit the new size.

### Closing Panes

- `Ctrl+Shift+W` closes the active pane
- Right-click → "Close Pane"
- Click the **x** on a tab

When a pane is closed, the adjacent pane expands to fill the space. You cannot close the last remaining pane.

When a shell process exits on its own, the pane shows "[Process exited with code X. Press any key to close]" and closes on the next keypress.

## Terminals

### Shell Types

TermGrid supports two shells:

- **PowerShell** (default) - Launched with `-NoLogo` flag for a clean prompt
- **CMD** (Command Prompt)

To change the shell for the **next** new pane, right-click and select "New as CMD" or "New as PowerShell". Existing panes are not affected.

### Focus

Click inside a pane to focus it. The focused pane gets a subtle glow effect and its tab is highlighted in the tab bar. Keyboard input goes to the focused pane only.

## Customization

### Color Borders

Every pane gets a colored border from a rotating palette of 12 colors. To change a pane's color:

1. Right-click the pane
2. Pick a color from the swatch grid

Available colors: Blue, Green, Orange, Red, Purple, Cyan, Yellow, Pink, Lime, Gray, White.

The color appears on:
- The pane's border
- The pane's header label
- The tab bar dot

### Naming

#### Auto-Naming

TermGrid watches your terminal output and automatically detects what's running. It recognizes:

| Tool | Example Name |
|------|-------------|
| Claude Code | "Claude Code" |
| npm scripts | "npm dev", "npm start", "npm test", "npm install" |
| Node.js | "node server.js" |
| Python | "python app.py" |
| Git | "git log", "git status", "git commit" |
| Docker | "docker build", "docker compose" |
| Dev servers | "Server :3000", "Server :8080" |
| SSH | "ssh myserver" |
| Vite / Webpack | "Vite", "Webpack" |

Names update with a 1.5 second delay to avoid flicker.

If no tool is detected, the pane keeps its default shell name ("PowerShell" or "CMD").

#### Manual Naming

To set a custom name:

1. Right-click the pane
2. Click "Rename..."
3. Type a name and press OK

Manual names lock the pane's name, overriding auto-detection. This persists until you rename again.

## Tab Bar

The tab bar at the top shows all open panes. Each tab displays:

- A colored dot matching the pane's border color
- The pane name (auto-detected or manual)
- A close button (visible on hover)

Click a tab to focus that pane. The active tab has a blue underline.

## Window Controls

TermGrid uses a custom frameless window. The title bar has:

- **Minimize** (─) - Minimize to taskbar
- **Maximize** (□) - Toggle between maximized and windowed
- **Close** (✕) - Close the app (all terminal sessions end)

Drag the title bar area to move the window.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+H` | Split active pane horizontally |
| `Ctrl+Shift+J` | Split active pane vertically |
| `Ctrl+Shift+W` | Close active pane |

All other keyboard input goes directly to the focused terminal.
