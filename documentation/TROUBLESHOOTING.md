# Troubleshooting

## Installation Issues

### `npm run rebuild` fails with "GetCommitHash.bat not recognized"

The `node-pty` package includes a `winpty` dependency that tries to run batch files during compilation. The gyp build system runs them from the wrong directory.

**Fix:** Patch the gyp file before rebuilding:

```bash
# Open this file in your editor:
# node_modules/node-pty/deps/winpty/src/winpty.gyp

# Find this line (around line 13):
'WINPTY_COMMIT_HASH%': '<!(cmd /c "cd shared && GetCommitHash.bat")',
# Replace with:
'WINPTY_COMMIT_HASH%': 'none',

# Find this line (around line 25):
'<!(cmd /c "cd shared && UpdateGenVersion.bat <(WINPTY_COMMIT_HASH)")',
# Replace with:
'gen',

# Create the gen directory and version header:
mkdir node_modules/node-pty/deps/winpty/src/gen
```

Then create the file `node_modules/node-pty/deps/winpty/src/gen/GenVersion.h`:

```c
// AUTO-GENERATED
const char GenVersion_Version[] = "0.4.3";
const char GenVersion_Commit[] = "none";
```

Then run `npm run rebuild` again.

### `npm run rebuild` fails with "Spectre mitigation libraries required" (MSB8040)

Your Visual Studio Build Tools have Spectre mitigation enabled but the libraries aren't installed.

**Fix (Option A):** Install Spectre libraries via Visual Studio Installer → Individual Components → search "Spectre" → install the MSVC Spectre-mitigated libs for your architecture.

**Fix (Option B):** Disable the requirement by editing two files:

```bash
# In node_modules/node-pty/binding.gyp, find:
'SpectreMitigation': 'Spectre'
# Replace with:
'SpectreMitigation': 'false'

# In node_modules/node-pty/deps/winpty/src/winpty.gyp, find BOTH occurrences of:
'SpectreMitigation': 'Spectre'
# Replace each with:
'SpectreMitigation': 'false'
```

Then run `npm run rebuild` again.

### `npm install` fails with "node-gyp" errors

You need C++ build tools installed:

1. Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. In the installer, select "Desktop development with C++"
3. Make sure "MSVC v143" and "Windows SDK" components are checked
4. Restart your terminal after installation

### Module version mismatch / NODE_MODULE_VERSION error

The native `node-pty` module was compiled for a different Node.js version than Electron uses.

**Fix:** Rebuild for Electron:

```bash
npm run rebuild
```

If that doesn't work, try specifying the module:

```bash
npx electron-rebuild -o node-pty
```

## Runtime Issues

### App launches but shows a blank/static window

Open DevTools (`Ctrl+Shift+I` if enabled, or check if DevTools is already open) and look at the Console tab for errors.

Common causes:
- **"module not found: ../shared/constants"** in preload.js: The preload script can't use relative requires to files outside `main/`. The constants must be inlined in `preload.js`.
- **"Cannot read properties of undefined (reading 'onPtyData')"**: The preload script failed to load, so `window.termgrid` is undefined. Fix the preload error first.
- **xterm.js not loading**: Check that `node_modules/@xterm/xterm/lib/xterm.js` exists. Run `npm install` if missing.

### Terminal appears but no shell prompt

- Check that `cmd.exe` or `powershell.exe` is accessible in your PATH
- Check DevTools console for IPC errors
- The node-pty native module may not be built correctly; try `npm run rebuild`

### Resize handles don't work / terminals don't refit

Make sure you're dragging the thin line between panes (it turns blue on hover). The cursor should change to a resize cursor. If terminals don't refit after resize, it may be a FitAddon issue; try clicking inside the pane to trigger a refit.

### GPU cache errors on launch

```
Unable to move the cache: Access denied
Gpu Cache Creation failed: -2
```

These are harmless Electron/Chromium warnings about GPU shader caching. They don't affect functionality. You can ignore them.

## Development

### Enabling DevTools

In `main/main.js`, add this line after `mainWindow.loadFile(...)`:

```js
mainWindow.webContents.openDevTools();
```

### Disabling DevTools for production

Remove or comment out the `openDevTools()` line in `main/main.js`.
