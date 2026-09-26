import {
  FRIDGE_BUILD, ICON_BOX, ICON_GRIP, ICON_HIERARCHY_PANEL, ICON_LABELS,
  ICON_LASSO, ICON_RESET, ICON_SNAP, SELECTION_LABELS, SELECTION_TITLES,
  SVGS, WIN_ICONS
} from './fridge-icons.js';

export function makeToolbar(root, shared, windows, manager, hierarchyMover, refresh, rebuild, resetPlatform, listen) {
  const toolbar = document.createElement('div');
  toolbar.className = 'fridge-toolbar docked-left';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Linked plot controls');

  function toolButton(title, icon, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fridge-tool-btn';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.dataset.action = action || '';
    button.innerHTML = icon;
    return button;
  }

  const handleWrap = document.createElement('div');
  handleWrap.className = 'fridge-toolbar-handle-wrap';
  const handle = document.createElement('div');
  handle.className = 'fridge-toolbar-handle';
  handle.title = 'Drag toolbar or click for placement options · ' + FRIDGE_BUILD;
  handle.innerHTML = ICON_GRIP;
  const modeMenu = document.createElement('div');
  modeMenu.className = 'fridge-toolbar-menu';
  [
    ['docked-top', 'Dock Top'], ['floating-horizontal', 'Float Horizontal'],
    ['floating-vertical', 'Float Vertical'], ['minimized', 'Minimize'],
    ['docked-left', 'Dock Left (Reset)']
  ].forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.toolbarMode = item[0];
    button.textContent = item[1];
    if (item[0] === 'docked-left') button.className = 'primary';
    modeMenu.appendChild(button);
  });
  handleWrap.appendChild(handle);
  handleWrap.appendChild(modeMenu);
  toolbar.appendChild(handleWrap);

  const selectionWrap = document.createElement('div');
  selectionWrap.className = 'fridge-tool-dropdown';
  const selectionButton = toolButton('Single selection', SVGS.single, 'selection-menu');
  const selectionMenu = document.createElement('div');
  selectionMenu.className = 'fridge-selection-menu';

  function modeButton(mode) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.selectionMode = mode;
    button.textContent = SELECTION_LABELS[mode];
    return button;
  }

  selectionMenu.appendChild(modeButton('single'));
  selectionMenu.appendChild(modeButton('multiple'));

  const inverseGroup = document.createElement('div');
  inverseGroup.className = 'fridge-has-sub';
  inverseGroup.innerHTML =
    '<span>Inverse Selection</span><span class="fridge-sub-arrow">&#9656;</span>';
  const inverseSub = document.createElement('div');
  inverseSub.className = 'fridge-selection-submenu';
  inverseSub.appendChild(modeButton('inverse'));
  inverseSub.appendChild(modeButton('inverseAll'));
  inverseGroup.appendChild(inverseSub);
  selectionMenu.appendChild(inverseGroup);

  selectionMenu.appendChild(modeButton('hierarchy'));

  selectionWrap.appendChild(selectionButton);
  selectionWrap.appendChild(selectionMenu);
  toolbar.appendChild(selectionWrap);

  const box = toolButton('Box selection', ICON_BOX, 'box');
  const lasso = toolButton('Lasso selection', ICON_LASSO, 'lasso');
  const reset = toolButton('Reset platform', ICON_RESET, 'reset');
  toolbar.appendChild(box);
  toolbar.appendChild(lasso);
  toolbar.appendChild(reset);

  const sep1 = document.createElement('div');
  sep1.className = 'fridge-separator';
  toolbar.appendChild(sep1);

  let scaleInput = null;
  if (shared.hasScaled) {
    const scale = document.createElement('label');
    scale.className = 'fridge-data-switch';
    scale.title = 'Switch between original and scaled data';
    scale.innerHTML = '<input type="checkbox"><span class="fridge-slider"><span class="fridge-label fridge-label-scaled">Scaled</span><span class="fridge-label fridge-label-original">Original</span><span class="fridge-knob"></span></span>';
    scaleInput = scale.querySelector('input');
    scaleInput.checked = shared.isScaled.v;
    listen(scaleInput, 'change', () => { shared.isScaled.v = scaleInput.checked; rebuild(); });
    toolbar.appendChild(scale);
    const sep = document.createElement('div');
    sep.className = 'fridge-separator';
    toolbar.appendChild(sep);
  }

  const hierarchyButton = toolButton(
    'Show or hide the shared hierarchy widget', ICON_HIERARCHY_PANEL, 'hierarchy-panel');
  hierarchyButton.classList.add('active');
  toolbar.appendChild(hierarchyButton);
  let labels = null;
  if (shared.hasSunburst) {
    labels = toolButton('Show or hide hierarchy labels', ICON_LABELS, 'labels');
    labels.classList.toggle('active', shared.labelsOn.v);
    toolbar.appendChild(labels);
  }

  const sep2 = document.createElement('div');
  sep2.className = 'fridge-separator';
  toolbar.appendChild(sep2);
  const plotToggles = document.createElement('div');
  plotToggles.className = 'fridge-plot-toggles';
  const typeCounts = {};
  windows.forEach(meta => {
    typeCounts[meta.type] = (typeCounts[meta.type] || 0) + 1;
    const button = toolButton(meta.title, WIN_ICONS[meta.type] || ICON_SNAP, 'plot');
    button.dataset.plotIndex = String(meta.index);
    button.classList.add('active');
    if (typeCounts[meta.type] > 1) {
      const badge = document.createElement('span');
      badge.className = 'fridge-plot-badge';
      badge.textContent = String(typeCounts[meta.type]);
      button.appendChild(badge);
    }
    meta.toolbarButton = button;
    plotToggles.appendChild(button);
  });
  toolbar.appendChild(plotToggles);
  root.appendChild(toolbar);
  manager.setToolbar(toolbar);

  function update() {
    selectionButton.innerHTML = SVGS[shared.selectionMode] || SVGS.single;
    selectionButton.title = 'Selection Mode: ' +
      (SELECTION_TITLES[shared.selectionMode] || shared.selectionMode);
    selectionMenu.querySelectorAll('[data-selection-mode]').forEach(button =>
      button.classList.toggle('active-mode', button.dataset.selectionMode === shared.selectionMode));
    inverseGroup.classList.toggle('active-mode', shared.selectionMode.startsWith('inverse'));
    box.classList.toggle('active', shared.tools.box);
    lasso.classList.toggle('active', shared.tools.lasso);
    hierarchyButton.classList.toggle('active', hierarchyMover.isVisible());
    if (labels) labels.classList.toggle('active', shared.labelsOn.v);
    if (scaleInput) scaleInput.checked = shared.isScaled.v;
    windows.forEach(meta => {
      meta.toolbarButton.classList.toggle('active', meta.visible);
      meta.toolbarButton.title = meta.title;
    });
  }

  function setToolbarMode(mode) {
    toolbar.classList.remove('docked-left', 'docked-top', 'floating-horizontal', 'floating-vertical', 'minimized');
    toolbar.classList.add(mode);
    if (mode === 'docked-left' || mode === 'docked-top') {
      toolbar.style.left = ''; toolbar.style.top = ''; toolbar.style.right = ''; toolbar.style.bottom = '';
    } else if (!toolbar.style.left) {
      toolbar.style.left = '64px'; toolbar.style.top = '64px';
    }
    modeMenu.classList.remove('show');
    manager.relayout();
  }

  listen(toolbar, 'click', event => {
    if (toolbar.classList.contains('minimized')) { setToolbarMode('docked-left'); return; }
    const modeItem = event.target.closest('[data-toolbar-mode]');
    if (modeItem) { setToolbarMode(modeItem.dataset.toolbarMode); return; }
    const selectionItem = event.target.closest('[data-selection-mode]');
    if (selectionItem) {
      shared.selectionMode = selectionItem.dataset.selectionMode;
      selectionMenu.classList.remove('show');
      update();
      return;
    }
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'selection-menu') selectionMenu.classList.toggle('show');
    else if (action === 'box') { shared.tools.box = !shared.tools.box; shared.tools.lasso = false; }
    else if (action === 'lasso') { shared.tools.lasso = !shared.tools.lasso; shared.tools.box = false; }
    else if (action === 'labels') { shared.labelsOn.v = !shared.labelsOn.v; refresh(false); }
    else if (action === 'hierarchy-panel') hierarchyMover.setVisible(!hierarchyMover.isVisible());
    else if (action === 'plot') {
      const meta = windows[Number(target.dataset.plotIndex)];
      if (meta) manager.toggleWindow(meta);
    } else if (action === 'reset') {
      resetPlatform();
    }
    update();
  });

  let dragging = false, moved = false, sx = 0, sy = 0, left = 0, top = 0;
  listen(handle, 'mousedown', event => {
    dragging = true; moved = false; sx = event.clientX; sy = event.clientY;
    left = toolbar.offsetLeft; top = toolbar.offsetTop; event.preventDefault();
  });
  listen(window, 'mousemove', event => {
    if (!dragging) return;
    const dx = event.clientX - sx, dy = event.clientY - sy;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
    if (!moved) return;
    if (toolbar.classList.contains('docked-left') || toolbar.classList.contains('docked-top')) {
      toolbar.classList.remove('docked-left', 'docked-top');
      toolbar.classList.add('floating-vertical');
    }
    toolbar.style.left = (left + dx) + 'px'; toolbar.style.top = (top + dy) + 'px';
    toolbar.style.right = 'auto'; toolbar.style.bottom = 'auto';
  });
  listen(window, 'mouseup', () => {
    if (dragging && !moved) modeMenu.classList.toggle('show');
    dragging = false;
  });
  listen(root, 'click', event => {

    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const within = selector => path.some(node =>
      node && node.nodeType === 1 && typeof node.matches === 'function' && node.matches(selector));
    if (!within('.fridge-tool-dropdown')) selectionMenu.classList.remove('show');
    if (!within('.fridge-toolbar-handle-wrap')) modeMenu.classList.remove('show');
  });

  manager.setVisibilityListener(update);
  manager.setRenameListener(update);
  update();
  return { element: toolbar, update, setToolbarMode };
}
