# TermGrid

A tiling terminal multiplexer for Windows. Run multiple CMD and PowerShell sessions in a single window with resizable, color-coded panes and smart auto-naming.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![License](https://img.shields.io/badge/license-MIT-yellow)

## Why TermGrid?

When working with multiple terminals (dev servers, git, Claude Code, builds), it's hard to tell which window is doing what. TermGrid solves this by putting all your terminals in one window with:

- **Tiling layout** - Split horizontally or vertically, drag borders to resize
- **Color-coded borders** - Instantly identify each terminal at a glance
- **Smart auto-naming** - Detects what's running (npm, git, docker, Claude Code, etc.)
- **Activity indicators** - Green = running, gray = idle, orange = waiting for your input
- **Drag to rearrange** - Grab a pane's header and drop it on any edge of another pane
- **File drag-and-drop** - Drop files from Explorer onto any pane to paste the path
- **Clipboard image paste** - Paste screenshots from clipboard, image is saved and path inserted
- **Tiny footprint** - 8MB portable exe, no install needed

## Download

Grab `termgrid.exe` from the [latest release](https://github.com/jexororo/termgrid/releases/latest) and double-click it. That's it.

> Requires Windows 10/11 (WebView2 is built in).

## Usage

| Action | How |
|--------|-----|
| **Split horizontal** | `Ctrl+Shift+H` or right-click > Split Horizontal |
| **Split vertical** | `Ctrl+Shift+J` or right-click > Split Vertical |
| **Close pane** | `Ctrl+Shift+W` or right-click > Close Pane |
| **Resize panes** | Drag the border between panes |
| **Move pane** | Drag the colored header bar to another pane's edge |
| **Change color** | Right-click > pick a color swatch |
| **Rename pane** | Right-click > Rename... |
| **Add terminal** | Click the **+** button in the tab bar |
| **Switch shell** | Right-click > New as CMD / New as PowerShell |

### Status Indicators

Each pane header has a status dot:
- **Green (blinking)** - Terminal is actively running
- **Gray** - Idle
- **Orange (pulsing)** - Waiting for your input (password, y/n, etc.)

When a background pane needs input, its tab and header pulse to get your attention.

## Build from Source

Prerequisites: [Rust](https://rustup.rs/) toolchain

```bash
git clone https://github.com/jexororo/termgrid.git
cd termgrid
cargo tauri build
```

Output:
- `src-tauri/target/release/termgrid.exe` (8MB portable)
- `src-tauri/target/release/bundle/nsis/TermGrid_*-setup.exe` (2MB installer)

For development with hot reload:
```bash
cargo tauri dev
```

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](documentation/CONTRIBUTING.md) for details.

1. Fork the repo
2. Create a branch (`git checkout -b my-feature`)
3. Make your changes
4. Submit a Pull Request

Some ideas: session persistence, custom themes, Linux/macOS support, tab reordering, search in terminal.

## Documentation

- [User Guide](documentation/USER_GUIDE.md)
- [How It Works](documentation/HOW_IT_WORKS.md)
- [Troubleshooting](documentation/TROUBLESHOOTING.md)
- [Contributing](documentation/CONTRIBUTING.md)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Rust + [portable-pty](https://crates.io/crates/portable-pty) |
| Frontend | Vanilla JS + [xterm.js](https://xtermjs.org/) |
| Framework | [Tauri 2](https://tauri.app/) |
| Output | 8MB exe (uses system WebView2) |

## License

MIT
