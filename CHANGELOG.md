# Changelog

All notable changes to TermGrid will be documented in this file.

## [0.2.0] - 2026-03-27

### Added
- Shortcuts overlay panel (press `F1` or click `?` in title bar)
- Shell toggle button (`PS`/`CMD`) in tab bar to switch default shell for new panes
- Status dot legend in shortcuts panel

### Changed
- Shortcuts panel closes with `Escape` or clicking outside

## [0.1.0] - 2026-03-27

### Added
- Initial release
- Blender-style binary tree tiling layout (horizontal/vertical splits)
- Drag-to-resize borders between panes
- Drag pane headers to move/swap panes with drop zones on all 4 edges
- Color-coded borders with 12-color palette, customizable via right-click menu
- Smart auto-naming: detects npm, git, docker, Claude Code, vite, webpack, ssh, etc.
- Activity indicators: green (running), gray (idle), orange (needs input)
- Attention pulse on background panes waiting for input
- Tab bar with colored dots and active highlight
- CMD and PowerShell support
- Keyboard shortcuts: Ctrl+Shift+H (split h), Ctrl+Shift+J (split v), Ctrl+Shift+W (close)
- Custom frameless titlebar with window controls
- Right-click context menu with split, rename, color, shell, close options
- Built with Tauri 2 + Rust + xterm.js
- 8MB portable exe output
