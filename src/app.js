// TermGrid - Tauri Edition
(function () {
  'use strict';

  // ── Tauri API bridge ──
  var invoke = window.__TAURI__.core.invoke;
  var listen = window.__TAURI__.event.listen;
  var tauriWindow = window.__TAURI__.window;

  var termgrid = {
    createPty: function (id, shellType) { return invoke('create_pty', { id: id, shellType: shellType }); },
    writePty: function (id, data) { return invoke('write_pty', { id: id, data: data }); },
    resizePty: function (id, cols, rows) { return invoke('resize_pty', { id: id, cols: cols, rows: rows }); },
    destroyPty: function (id) { return invoke('destroy_pty', { id: id }); },
    onPtyData: function (cb) { listen('pty:data', function (event) { cb(event.payload.id, event.payload.data); }); },
    onPtyExit: function (cb) { listen('pty:exit', function (event) { cb(event.payload.id, event.payload.code); }); },
    minimize: function () { tauriWindow.getCurrentWindow().minimize(); },
    maximize: function () { tauriWindow.getCurrentWindow().toggleMaximize(); },
    close: function () { tauriWindow.getCurrentWindow().close(); },
  };

  // ════════════════════════════════════════════════════
  //  CONSTANTS
  // ════════════════════════════════════════════════════
  const DEFAULT_COLORS = [
    '#4fc3f7', '#81c784', '#ffb74d', '#e57373',
    '#ba68c8', '#4dd0e1', '#fff176', '#f48fb1',
    '#aed581', '#90a4ae', '#ce93d8', '#80deea',
  ];

  const CONTEXT_COLORS = [
    { name: 'Blue', value: '#4fc3f7' },
    { name: 'Green', value: '#81c784' },
    { name: 'Orange', value: '#ffb74d' },
    { name: 'Red', value: '#e57373' },
    { name: 'Purple', value: '#ba68c8' },
    { name: 'Cyan', value: '#4dd0e1' },
    { name: 'Yellow', value: '#fff176' },
    { name: 'Pink', value: '#f48fb1' },
    { name: 'Lime', value: '#aed581' },
    { name: 'Gray', value: '#90a4ae' },
    { name: 'White', value: '#ffffff' },
  ];

  let colorIndex = 0;

  // ════════════════════════════════════════════════════
  //  NAME GUESSER
  // ════════════════════════════════════════════════════
  const TOOL_PATTERNS = [
    { pattern: /claude/i, name: 'Claude Code' },
    { pattern: /npm\s+(run\s+)?dev/i, name: 'npm dev' },
    { pattern: /npm\s+start/i, name: 'npm start' },
    { pattern: /npm\s+test/i, name: 'npm test' },
    { pattern: /npm\s+install/i, name: 'npm install' },
    { pattern: /node\s+(\S+)/i, name: function(m) { return 'node ' + m[1].split(/[/\\]/).pop(); } },
    { pattern: /python\s+(\S+)/i, name: function(m) { return 'python ' + m[1].split(/[/\\]/).pop(); } },
    { pattern: /git\s+(log|diff|status|push|pull|commit|merge|rebase|checkout|branch)/i, name: function(m) { return 'git ' + m[1]; } },
    { pattern: /docker\s+(build|run|compose|ps)/i, name: function(m) { return 'docker ' + m[1]; } },
    { pattern: /ssh\s+(\S+)/i, name: function(m) { return 'ssh ' + m[1]; } },
    { pattern: /Server running on port\s*(\d+)/i, name: function(m) { return 'Server :' + m[1]; } },
    { pattern: /listening on.*:(\d+)/i, name: function(m) { return 'Server :' + m[1]; } },
    { pattern: /vite/i, name: 'Vite' },
    { pattern: /webpack/i, name: 'Webpack' },
  ];

  function createNameGuesser() {
    var buffer = [];
    var debounceTimer = null;
    var lastGuess = '';

    return {
      feed: function (data) {
        var lines = data.split(/\r?\n/).filter(function(l) { return l.trim().length > 0; });
        buffer = buffer.concat(lines);
        if (buffer.length > 30) buffer = buffer.slice(-30);
      },
      guess: function () {
        for (var i = buffer.length - 1; i >= Math.max(0, buffer.length - 15); i--) {
          var line = buffer[i];
          for (var j = 0; j < TOOL_PATTERNS.length; j++) {
            var m = line.match(TOOL_PATTERNS[j].pattern);
            if (m) {
              return typeof TOOL_PATTERNS[j].name === 'function' ? TOOL_PATTERNS[j].name(m) : TOOL_PATTERNS[j].name;
            }
          }
        }
        for (var i = buffer.length - 1; i >= Math.max(0, buffer.length - 5); i--) {
          var pm = buffer[i].match(/^PS [A-Z]:\\[^>]*>\s*(.+)$/) || buffer[i].match(/^[A-Z]:\\[^>]*>(.+)$/);
          if (pm) {
            var cmd = pm[1].trim().split(/\s+/)[0];
            if (cmd && cmd.length > 0 && cmd.length < 30) return cmd;
          }
        }
        return '';
      },
      guessDebounced: function (callback) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function () {
          var name = this.guess();
          if (name && name !== lastGuess) {
            lastGuess = name;
            callback(name);
          }
        }.bind(this), 1500);
      }
    };
  }

  // ════════════════════════════════════════════════════
  //  SPLIT TREE (Blender-style tiling layout)
  // ════════════════════════════════════════════════════
  var splitRoot = null;

  function splitTreeInit(paneId) {
    splitRoot = { type: 'leaf', paneId: paneId };
  }

  function splitPane(paneId, direction) {
    var newPaneId = crypto.randomUUID();
    var result = _splitInTree(splitRoot, null, -1, paneId, direction, newPaneId);
    if (result) splitRoot = result;
    return newPaneId;
  }

  // Split with new pane inserted BEFORE (left/top) the target
  function splitPaneBefore(paneId, direction) {
    var newPaneId = crypto.randomUUID();
    var result = _splitInTreeBefore(splitRoot, null, -1, paneId, direction, newPaneId);
    if (result) splitRoot = result;
    return newPaneId;
  }

  function _splitInTree(node, parent, childIdx, targetId, direction, newId) {
    if (node.type === 'leaf') {
      if (node.paneId === targetId) {
        var newSplit = {
          type: 'split', direction: direction, ratio: 0.5,
          children: [
            { type: 'leaf', paneId: targetId },
            { type: 'leaf', paneId: newId }
          ]
        };
        if (parent) { parent.children[childIdx] = newSplit; return null; }
        return newSplit;
      }
      return null;
    }
    var r0 = _splitInTree(node.children[0], node, 0, targetId, direction, newId);
    if (r0) return r0;
    return _splitInTree(node.children[1], node, 1, targetId, direction, newId);
  }

  function _splitInTreeBefore(node, parent, childIdx, targetId, direction, newId) {
    if (node.type === 'leaf') {
      if (node.paneId === targetId) {
        var newSplit = {
          type: 'split', direction: direction, ratio: 0.5,
          children: [
            { type: 'leaf', paneId: newId },
            { type: 'leaf', paneId: targetId }
          ]
        };
        if (parent) { parent.children[childIdx] = newSplit; return null; }
        return newSplit;
      }
      return null;
    }
    var r0 = _splitInTreeBefore(node.children[0], node, 0, targetId, direction, newId);
    if (r0) return r0;
    return _splitInTreeBefore(node.children[1], node, 1, targetId, direction, newId);
  }

  function closePane(paneId) {
    if (splitRoot.type === 'leaf') return false;
    var result = _closeInTree(splitRoot, null, -1, paneId);
    if (result) splitRoot = result;
    return true;
  }

  function _closeInTree(node, parent, childIdx, targetId) {
    if (node.type === 'leaf') return null;
    for (var i = 0; i < 2; i++) {
      if (node.children[i].type === 'leaf' && node.children[i].paneId === targetId) {
        var sibling = node.children[1 - i];
        if (parent) { parent.children[childIdx] = sibling; return null; }
        return sibling;
      }
    }
    var r0 = _closeInTree(node.children[0], node, 0, targetId);
    if (r0) return r0;
    return _closeInTree(node.children[1], node, 1, targetId);
  }

  function getAllPaneIds(node) {
    if (!node) node = splitRoot;
    if (node.type === 'leaf') return [node.paneId];
    return getAllPaneIds(node.children[0]).concat(getAllPaneIds(node.children[1]));
  }

  // Swap two panes in the tree
  function swapPanes(idA, idB) {
    var leafA = _findLeaf(splitRoot, idA);
    var leafB = _findLeaf(splitRoot, idB);
    if (leafA && leafB) {
      leafA.paneId = idB;
      leafB.paneId = idA;
    }
  }

  function _findLeaf(node, paneId) {
    if (!node) return null;
    if (node.type === 'leaf') return node.paneId === paneId ? node : null;
    return _findLeaf(node.children[0], paneId) || _findLeaf(node.children[1], paneId);
  }

  function renderTree(container) {
    container.innerHTML = '';
    if (!splitRoot) return;
    _renderNode(splitRoot, container);
  }

  function _renderNode(node, container) {
    if (node.type === 'leaf') {
      var paneEl = document.createElement('div');
      paneEl.className = 'pane-leaf';
      paneEl.dataset.paneId = node.paneId;
      container.appendChild(paneEl);
      return;
    }

    var isH = node.direction === 'h';
    container.classList.add('split-container');
    container.style.flexDirection = isH ? 'row' : 'column';

    var first = document.createElement('div');
    first.className = 'split-child';
    first.style.flex = node.ratio + ' 1 0%';

    var handle = document.createElement('div');
    handle.className = 'resize-handle ' + (isH ? 'handle-h' : 'handle-v');

    var second = document.createElement('div');
    second.className = 'split-child';
    second.style.flex = (1 - node.ratio) + ' 1 0%';

    container.appendChild(first);
    container.appendChild(handle);
    container.appendChild(second);

    _renderNode(node.children[0], first);
    _renderNode(node.children[1], second);

    // Resize drag
    (function (h, f, s, n, horizontal, cont) {
      h.addEventListener('mousedown', function (e) {
        e.preventDefault();
        var startPos = horizontal ? e.clientX : e.clientY;
        var startRatio = n.ratio;
        document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
        document.body.style.userSelect = 'none';

        function onMove(e) {
          var pos = horizontal ? e.clientX : e.clientY;
          var size = horizontal ? cont.offsetWidth : cont.offsetHeight;
          n.ratio = Math.max(0.1, Math.min(0.9, startRatio + (pos - startPos) / size));
          f.style.flex = n.ratio + ' 1 0%';
          s.style.flex = (1 - n.ratio) + ' 1 0%';
          fitAllTerminals();
        }
        function onUp() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          fitAllTerminals();
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });
    })(handle, first, second, node, isH, container);
  }

  // ════════════════════════════════════════════════════
  //  TERMINAL PANE
  // ════════════════════════════════════════════════════
  var panes = {};

  function createPane(paneId, shellType) {
    var color = DEFAULT_COLORS[colorIndex++ % DEFAULT_COLORS.length];
    var pane = {
      paneId: paneId,
      shellType: shellType || 'powershell',
      color: color,
      name: shellType === 'cmd' ? 'CMD' : 'PowerShell',
      manualName: false,
      terminal: null,
      fitAddon: null,
      nameGuesser: createNameGuesser(),
      element: null,
      resizeObserver: null,
    };
    panes[paneId] = pane;
    return pane;
  }

  // Build the wrapper DOM for a pane (once, on first creation)
  function buildPaneDOM(pane) {
    var wrapper = document.createElement('div');
    wrapper.className = 'terminal-pane';
    wrapper.style.borderColor = pane.color;
    wrapper.dataset.paneId = pane.paneId;

    var label = document.createElement('div');
    label.className = 'pane-label';
    label.style.backgroundColor = pane.color;

    var dragIcon = document.createElement('span');
    dragIcon.className = 'drag-icon';
    dragIcon.textContent = '\u2630';
    label.appendChild(dragIcon);

    var labelText = document.createElement('span');
    labelText.textContent = pane.name;
    label.appendChild(labelText);

    var statusDot = document.createElement('span');
    statusDot.className = 'status-dot idle';
    statusDot.title = 'Idle';
    label.appendChild(statusDot);
    pane._statusDot = statusDot;
    pane._lastDataTime = Date.now();
    pane._idleTimer = null;
    pane._status = 'idle';

    var xtermDiv = document.createElement('div');
    xtermDiv.className = 'xterm-container';

    var zones = ['left', 'right', 'top', 'bottom'];
    var zoneLabels = { left: '\u2190 Left', right: 'Right \u2192', top: '\u2191 Top', bottom: '\u2193 Bottom' };
    zones.forEach(function (side) {
      var zone = document.createElement('div');
      zone.className = 'drop-zone drop-zone-' + side;
      zone.dataset.side = side;
      zone.dataset.paneId = pane.paneId;
      var inner = document.createElement('div');
      inner.className = 'drop-zone-inner';
      inner.textContent = zoneLabels[side];
      zone.appendChild(inner);
      wrapper.appendChild(zone);
    });

    wrapper.appendChild(label);
    wrapper.appendChild(xtermDiv);
    pane.element = wrapper;

    // Create xterm instance (ONCE)
    var term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        selectionBackground: '#264f78',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#b1bac4',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc',
      },
    });

    var fit = new FitAddon.FitAddon();
    term.loadAddon(fit);
    term.open(xtermDiv);
    pane.terminal = term;
    pane.fitAddon = fit;

    // Input -> pty
    term.onData(function (data) {
      termgrid.writePty(pane.paneId, data);
    });

    // Focus tracking
    wrapper.addEventListener('mousedown', function (e) {
      if (e.target.closest('.pane-label')) return;
      term.focus();
      setActive(pane.paneId);
    });

    // Spawn pty process (ONCE)
    termgrid.createPty(pane.paneId, pane.shellType);

    // Resize observer
    pane.resizeObserver = new ResizeObserver(function () {
      try {
        fit.fit();
        termgrid.resizePty(pane.paneId, term.cols, term.rows);
      } catch (e) { }
    });
    pane.resizeObserver.observe(xtermDiv);

    // Drag from label
    setupDragFromLabel(label, pane);

    setTimeout(function () {
      try {
        fit.fit();
        termgrid.resizePty(pane.paneId, term.cols, term.rows);
      } catch (e) { }
    }, 100);
  }

  // Attach an already-built pane wrapper into a container (safe to call repeatedly)
  function attachPane(pane, container) {
    if (pane.element) {
      container.appendChild(pane.element);
      // Refit after reattach
      setTimeout(function () {
        try {
          if (pane.fitAddon) pane.fitAddon.fit();
        } catch (e) { }
      }, 50);
    }
  }

  function disposePane(paneId) {
    var pane = panes[paneId];
    if (!pane) return;
    if (pane.resizeObserver) pane.resizeObserver.disconnect();
    if (pane.element && pane.element.parentNode) {
      pane.element.parentNode.removeChild(pane.element);
    }
    if (pane.terminal) pane.terminal.dispose();
    clearTimeout(pane._idleTimer);
    termgrid.destroyPty(paneId);
    delete panes[paneId];
  }

  function fitAllTerminals() {
    setTimeout(function () {
      Object.keys(panes).forEach(function (id) {
        var p = panes[id];
        if (p.fitAddon && p.terminal) {
          try {
            p.fitAddon.fit();
            termgrid.resizePty(id, p.terminal.cols, p.terminal.rows);
          } catch (e) { }
        }
      });
    }, 50);
  }

  // ════════════════════════════════════════════════════
  //  DRAG & DROP (move panes between positions)
  // ════════════════════════════════════════════════════
  var dragState = null; // { paneId, ghost }

  function setupDragFromLabel(label, pane) {
    var startX, startY, isDragging = false;

    label.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startY = e.clientY;
      isDragging = false;

      // Also focus the pane on click
      setActive(pane.paneId);
      if (pane.terminal) pane.terminal.focus();

      function onMove(e) {
        var dx = e.clientX - startX;
        var dy = e.clientY - startY;
        if (!isDragging && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
          isDragging = true;
          startDrag(pane, e);
        }
        if (isDragging) {
          updateDrag(e);
        }
      }

      function onUp(e) {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        if (isDragging) {
          endDrag(e);
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  function startDrag(pane, e) {
    // Create ghost
    var ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.backgroundColor = pane.color;
    ghost.textContent = pane.name;
    ghost.style.left = e.clientX + 10 + 'px';
    ghost.style.top = e.clientY + 10 + 'px';
    document.body.appendChild(ghost);

    dragState = { paneId: pane.paneId, ghost: ghost };

    // Show drop zones on ALL OTHER panes
    document.querySelectorAll('.drop-zone').forEach(function (zone) {
      if (zone.dataset.paneId !== pane.paneId) {
        zone.classList.add('visible');
      }
    });

    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }

  function updateDrag(e) {
    if (!dragState) return;
    dragState.ghost.style.left = e.clientX + 10 + 'px';
    dragState.ghost.style.top = e.clientY + 10 + 'px';

    // Highlight drop zone under cursor
    document.querySelectorAll('.drop-zone.visible').forEach(function (zone) {
      var rect = zone.getBoundingClientRect();
      var over = e.clientX >= rect.left && e.clientX <= rect.right &&
                 e.clientY >= rect.top && e.clientY <= rect.bottom;
      zone.classList.toggle('drag-over', over);
    });
  }

  function endDrag(e) {
    if (!dragState) return;

    // Find which drop zone we're over
    var targetZone = null;
    document.querySelectorAll('.drop-zone.visible.drag-over').forEach(function (zone) {
      targetZone = zone;
    });

    if (targetZone && targetZone.dataset.paneId !== dragState.paneId) {
      var targetPaneId = targetZone.dataset.paneId;
      var side = targetZone.dataset.side;
      var sourcePaneId = dragState.paneId;

      // Remove source from tree first
      if (getAllPaneIds().length > 1) {
        closePane(sourcePaneId);
        // Now insert at the target location
        var newId;
        if (side === 'left') {
          newId = splitPaneBefore(targetPaneId, 'h');
        } else if (side === 'right') {
          newId = splitPane(targetPaneId, 'h');
        } else if (side === 'top') {
          newId = splitPaneBefore(targetPaneId, 'v');
        } else if (side === 'bottom') {
          newId = splitPane(targetPaneId, 'v');
        }

        // The split created a new pane with newId, but we want to use the existing pane
        // Swap the new leaf's id to the source pane's id
        if (newId) {
          var leaf = _findLeaf(splitRoot, newId);
          if (leaf) leaf.paneId = sourcePaneId;
          // Remove the tab for newId (it was never a real pane)
          removeTab(newId);
          delete panes[newId];
        }
        rerender();
      }
    } else if (targetZone === null) {
      // Dropped on another pane's center area? Check if we're over a different pane
      var el = document.elementFromPoint(e.clientX, e.clientY);
      var targetPane = el && el.closest('.terminal-pane');
      if (targetPane && targetPane.dataset.paneId !== dragState.paneId) {
        // Swap the two panes
        swapPanes(dragState.paneId, targetPane.dataset.paneId);
        rerender();
      }
    }

    // Cleanup
    dragState.ghost.remove();
    document.querySelectorAll('.drop-zone').forEach(function (zone) {
      zone.classList.remove('visible', 'drag-over');
    });
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    dragState = null;
  }

  // ════════════════════════════════════════════════════
  //  TAB BAR
  // ════════════════════════════════════════════════════
  var tabBarEl = document.getElementById('tab-bar');
  var addBtn = document.getElementById('add-pane-btn');
  var tabs = {};

  function addTab(paneId, name, color) {
    var tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.paneId = paneId;

    var dot = document.createElement('span');
    dot.className = 'tab-dot';
    dot.style.backgroundColor = color;

    var label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = name;

    var close = document.createElement('span');
    close.className = 'tab-close';
    close.innerHTML = '&times;';
    close.addEventListener('click', function (e) {
      e.stopPropagation();
      doClosePane(paneId);
    });

    tab.appendChild(dot);
    tab.appendChild(label);
    tab.appendChild(close);

    tab.addEventListener('click', function () {
      setActive(paneId);
    });

    tabBarEl.insertBefore(tab, addBtn);
    tabs[paneId] = { element: tab, dot: dot, label: label };
  }

  function removeTab(paneId) {
    if (tabs[paneId]) {
      tabs[paneId].element.remove();
      delete tabs[paneId];
    }
  }

  function updateTabName(paneId, name) {
    if (tabs[paneId]) tabs[paneId].label.textContent = name;
  }

  function updateTabColor(paneId, color) {
    if (tabs[paneId]) tabs[paneId].dot.style.backgroundColor = color;
  }

  // ════════════════════════════════════════════════════
  //  CONTEXT MENU
  // ════════════════════════════════════════════════════
  var ctxMenu = document.getElementById('context-menu');

  function showContextMenu(x, y, paneId) {
    ctxMenu.innerHTML = '';
    ctxMenu.classList.remove('hidden');

    var items = [
      { label: 'Split Horizontal', action: function () { doSplit(paneId, 'h'); } },
      { label: 'Split Vertical', action: function () { doSplit(paneId, 'v'); } },
      { type: 'sep' },
      { label: 'Rename...', action: function () { doRename(paneId); } },
      { type: 'sep' },
      { label: 'New as CMD', action: function () { currentShellType = 'cmd'; doSplit(paneId, 'h'); } },
      { label: 'New as PowerShell', action: function () { currentShellType = 'powershell'; doSplit(paneId, 'h'); } },
      { type: 'sep' },
    ];

    items.forEach(function (item) {
      if (item.type === 'sep') {
        var sep = document.createElement('div');
        sep.className = 'ctx-separator';
        ctxMenu.appendChild(sep);
        return;
      }
      var el = document.createElement('div');
      el.className = 'ctx-item' + (item.danger ? ' ctx-danger' : '');
      el.textContent = item.label;
      el.addEventListener('click', function (e) {
        e.stopPropagation();
        ctxMenu.classList.add('hidden');
        item.action();
      });
      ctxMenu.appendChild(el);
    });

    // Color swatches
    var colorLabel = document.createElement('div');
    colorLabel.className = 'ctx-item ctx-color-label';
    colorLabel.textContent = 'Border Color';
    ctxMenu.appendChild(colorLabel);

    var swatches = document.createElement('div');
    swatches.className = 'ctx-swatches';
    CONTEXT_COLORS.forEach(function (c) {
      var s = document.createElement('div');
      s.className = 'ctx-swatch';
      s.style.backgroundColor = c.value;
      s.title = c.name;
      s.addEventListener('click', function (e) {
        e.stopPropagation();
        ctxMenu.classList.add('hidden');
        doSetColor(paneId, c.value);
      });
      swatches.appendChild(s);
    });
    ctxMenu.appendChild(swatches);

    var sepClose = document.createElement('div');
    sepClose.className = 'ctx-separator';
    ctxMenu.appendChild(sepClose);

    var closeItem = document.createElement('div');
    closeItem.className = 'ctx-item ctx-danger';
    closeItem.textContent = 'Close Pane';
    closeItem.addEventListener('click', function (e) {
      e.stopPropagation();
      ctxMenu.classList.add('hidden');
      doClosePane(paneId);
    });
    ctxMenu.appendChild(closeItem);

    // Position - measure actual menu height after rendering
    requestAnimationFrame(function () {
      var menuW = ctxMenu.offsetWidth || 200;
      var menuH = ctxMenu.offsetHeight || 350;
      ctxMenu.style.left = (x + menuW > window.innerWidth ? window.innerWidth - menuW - 5 : x) + 'px';
      ctxMenu.style.top = (y + menuH > window.innerHeight ? window.innerHeight - menuH - 5 : y) + 'px';
    });
  }

  document.addEventListener('click', function () {
    ctxMenu.classList.add('hidden');
  });

  // ════════════════════════════════════════════════════
  //  ACTIONS
  // ════════════════════════════════════════════════════
  var activePaneId = null;
  var currentShellType = 'powershell';
  var paneContainer = document.getElementById('pane-container');

  function setActive(paneId) {
    activePaneId = paneId;
    // Update tabs
    Object.keys(tabs).forEach(function (id) {
      tabs[id].element.classList.toggle('active', id === paneId);
    });
    // Update pane visual focus - border glow using pane's own color
    document.querySelectorAll('.terminal-pane').forEach(function (el) {
      var isFocused = el.dataset.paneId === paneId;
      el.classList.toggle('focused', isFocused);
      if (isFocused) {
        var pane = panes[paneId];
        if (pane) {
          el.style.borderColor = pane.color;
          el.style.boxShadow = '0 0 14px ' + pane.color + '55, inset 0 0 1px ' + pane.color + '33';
        }
      } else {
        var otherId = el.dataset.paneId;
        var otherPane = panes[otherId];
        if (otherPane) {
          el.style.borderColor = otherPane.color;
          el.style.boxShadow = 'none';
        }
      }
    });
    var pane = panes[paneId];
    if (pane && pane.terminal) pane.terminal.focus();
    // Clear attention when focused
    if (pane && pane.element) {
      var label = pane.element.querySelector('.pane-label');
      if (label) label.classList.remove('attention');
    }
    if (tabs[paneId]) tabs[paneId].element.classList.remove('attention');
  }

  function rerender() {
    // Detach all pane elements before clearing (preserves xterm instances)
    Object.keys(panes).forEach(function (id) {
      var pane = panes[id];
      if (pane.element && pane.element.parentNode) {
        pane.element.parentNode.removeChild(pane.element);
      }
    });

    renderTree(paneContainer);

    getAllPaneIds().forEach(function (id) {
      var pane = panes[id];
      var leaf = paneContainer.querySelector('.pane-leaf[data-pane-id="' + id + '"]');
      if (leaf && pane) {
        if (!pane.element) {
          // First time - build the DOM and create xterm + pty
          buildPaneDOM(pane);
        }
        // Reattach into the leaf
        attachPane(pane, leaf);
      }
    });

    fitAllTerminals();

    if (activePaneId && panes[activePaneId]) {
      setTimeout(function () { setActive(activePaneId); }, 100);
    }
  }

  function doSplit(paneId, direction) {
    var newId = splitPane(paneId, direction);
    createPane(newId, currentShellType);
    addTab(newId, panes[newId].name, panes[newId].color);
    rerender();
  }

  function doClosePane(paneId) {
    if (getAllPaneIds().length <= 1) return;
    var closed = closePane(paneId);
    if (!closed) return;
    disposePane(paneId);
    removeTab(paneId);
    if (activePaneId === paneId) {
      var remaining = getAllPaneIds();
      if (remaining.length > 0) setActive(remaining[0]);
    }
    rerender();
  }

  function doRename(paneId) {
    var name = prompt('Enter pane name:');
    if (name !== null && name.trim()) {
      var pane = panes[paneId];
      if (pane) {
        pane.name = name.trim();
        pane.manualName = true;
        if (pane.element) {
          var labelText = pane.element.querySelector('.pane-label span:last-child');
          if (labelText) labelText.textContent = pane.name;
        }
        updateTabName(paneId, pane.name);
      }
    }
  }

  function doSetColor(paneId, color) {
    var pane = panes[paneId];
    if (pane) {
      pane.color = color;
      if (pane.element) {
        pane.element.style.borderColor = color;
        var label = pane.element.querySelector('.pane-label');
        if (label) label.style.backgroundColor = color;
      }
      updateTabColor(paneId, color);
      // Re-apply focus glow if active
      if (activePaneId === paneId) setActive(paneId);
    }
  }

  // ════════════════════════════════════════════════════
  //  DATA ROUTING
  // ════════════════════════════════════════════════════
  // ── Waiting-state patterns (needs user input) ──
  var WAITING_PATTERNS = [
    /\?\s*$/,                          // ends with ?
    /\(y\/n\)/i,                       // (y/n) prompts
    /press any key/i,
    /enter.*:/i,                       // "Enter something:"
    /password/i,
    /confirm/i,
    /waiting for input/i,
    /Are you sure/i,
    /\[Y\/n\]/i,
    /\[yes\/no\]/i,
    /Do you want to/i,
    /choice:/i,
  ];

  function detectStatus(pane, data) {
    pane._lastDataTime = Date.now();

    // Check for waiting patterns in latest output
    var lines = data.split(/\r?\n/);
    var lastLine = '';
    for (var i = lines.length - 1; i >= 0; i--) {
      if (lines[i].trim().length > 0) { lastLine = lines[i]; break; }
    }

    var isWaiting = false;
    for (var j = 0; j < WAITING_PATTERNS.length; j++) {
      if (WAITING_PATTERNS[j].test(lastLine)) { isWaiting = true; break; }
    }

    if (isWaiting) {
      setPaneStatus(pane, 'waiting');
    } else {
      setPaneStatus(pane, 'active');
    }

    // Set idle after 3 seconds of no data
    clearTimeout(pane._idleTimer);
    pane._idleTimer = setTimeout(function () {
      setPaneStatus(pane, 'idle');
    }, 3000);
  }

  function setPaneStatus(pane, status) {
    if (pane._status === status) return;
    pane._status = status;

    if (pane._statusDot) {
      pane._statusDot.className = 'status-dot ' + status;
      pane._statusDot.title = status === 'active' ? 'Running...' :
                              status === 'waiting' ? 'Needs input' : 'Idle';
    }

    // If waiting and NOT the active pane, show attention on label + tab
    var label = pane.element && pane.element.querySelector('.pane-label');
    var tab = tabs[pane.paneId];

    if (status === 'waiting' && pane.paneId !== activePaneId) {
      if (label) label.classList.add('attention');
      if (tab) tab.element.classList.add('attention');
    } else {
      if (label) label.classList.remove('attention');
      if (tab) tab.element.classList.remove('attention');
    }
  }

  termgrid.onPtyData(function (id, data) {
    var pane = panes[id];
    if (!pane || !pane.terminal) return;
    pane.terminal.write(data);

    // Activity detection
    detectStatus(pane, data);

    if (!pane.manualName) {
      pane.nameGuesser.feed(data);
      pane.nameGuesser.guessDebounced(function (name) {
        pane.name = name;
        if (pane.element) {
          var spans = pane.element.querySelectorAll('.pane-label span');
          // labelText is the second span (after drag icon, before status dot)
          if (spans.length >= 2) spans[1].textContent = name;
        }
        updateTabName(id, name);
      });
    }
  });

  termgrid.onPtyExit(function (id, exitCode) {
    var pane = panes[id];
    if (pane && pane.terminal) {
      pane.terminal.writeln('\r\n\x1b[90m[Process exited with code ' + exitCode + '. Press any key to close]\x1b[0m');
      pane.terminal.onData(function () {
        doClosePane(id);
      });
    }
  });

  // ════════════════════════════════════════════════════
  //  EVENT WIRING
  // ════════════════════════════════════════════════════

  paneContainer.addEventListener('contextmenu', function (e) {
    var paneEl = e.target.closest('.terminal-pane');
    if (paneEl) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, paneEl.dataset.paneId);
    }
  });

  addBtn.addEventListener('click', function () {
    if (activePaneId) doSplit(activePaneId, 'h');
  });

  // Shell toggle
  var shellToggleBtn = document.getElementById('shell-toggle');
  shellToggleBtn.textContent = currentShellType === 'powershell' ? 'PS' : 'CMD';

  shellToggleBtn.addEventListener('click', function () {
    currentShellType = currentShellType === 'powershell' ? 'cmd' : 'powershell';
    shellToggleBtn.textContent = currentShellType === 'powershell' ? 'PS' : 'CMD';
  });

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', function () {
    termgrid.minimize();
  });
  document.getElementById('btn-maximize').addEventListener('click', function () {
    termgrid.maximize();
  });
  document.getElementById('btn-close').addEventListener('click', function () {
    termgrid.close();
  });

  // Global resize
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fitAllTerminals, 100);
  });

  // Shortcuts overlay
  var shortcutsOverlay = document.getElementById('shortcuts-overlay');

  function toggleShortcuts() {
    shortcutsOverlay.classList.toggle('hidden');
  }

  document.getElementById('btn-help').addEventListener('click', toggleShortcuts);
  document.getElementById('shortcuts-close').addEventListener('click', toggleShortcuts);
  shortcutsOverlay.addEventListener('click', function (e) {
    if (e.target === shortcutsOverlay) toggleShortcuts();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', function (e) {
    // F1 or ? to toggle shortcuts
    if (e.code === 'F1') {
      e.preventDefault();
      toggleShortcuts();
      return;
    }
    // Close overlay on Escape
    if (e.code === 'Escape' && !shortcutsOverlay.classList.contains('hidden')) {
      toggleShortcuts();
      return;
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyH') {
      e.preventDefault();
      if (activePaneId) doSplit(activePaneId, 'h');
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyJ') {
      e.preventDefault();
      if (activePaneId) doSplit(activePaneId, 'v');
    }
    if (e.ctrlKey && e.shiftKey && e.code === 'KeyW') {
      e.preventDefault();
      if (activePaneId) doClosePane(activePaneId);
    }
  });

  // ════════════════════════════════════════════════════
  //  BOOT
  // ════════════════════════════════════════════════════
  var firstId = crypto.randomUUID();
  splitTreeInit(firstId);
  createPane(firstId, 'powershell');
  addTab(firstId, panes[firstId].name, panes[firstId].color);
  rerender();
  setActive(firstId);

  console.log('TermGrid loaded successfully');
})();
