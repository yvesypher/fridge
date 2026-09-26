export function installHierarchyMover(panel, windows, root, resizeAll, listen) {
  let host = null;
  let visible = true;
  let moving = false;
  let resizing = false;
  let sx = 0, sy = 0, startLeft = 0, startTop = 0;
  let baseInnerWidth = 0, baseInnerHeight = 0;
  const panelInner = panel.querySelector('.fridge-hierarchy-panel-inner');

  function refreshScale(resetBase) {
    if (!panelInner || panel.style.display === 'none') return;
    if (resetBase || !baseInnerWidth || !baseInnerHeight) {
      panelInner.style.transform = 'none';
      panelInner.style.width = '';
      panelInner.style.height = '';
      baseInnerWidth = Math.max(1, panelInner.scrollWidth, panelInner.offsetWidth);
      baseInnerHeight = Math.max(1, panelInner.scrollHeight, panelInner.offsetHeight);
      panelInner.style.width = baseInnerWidth + 'px';
      panelInner.style.height = baseInnerHeight + 'px';
    }
    const availableWidth = Math.max(1, panel.clientWidth - 20);
    const availableHeight = Math.max(1, panel.clientHeight - 20);
    const scale = Math.max(0.5, Math.min(3,
      Math.min(availableWidth / baseInnerWidth, availableHeight / baseInnerHeight)));
    panel.style.setProperty('--fridge-hierarchy-scale', String(scale));
    panelInner.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
  }

  function centerInHost() {
    if (!host || panel.parentElement !== host.body) return;
    panel.style.left = Math.max(8, (host.body.clientWidth - panel.offsetWidth) / 2) + 'px';
    panel.style.top = Math.max(8, (host.body.clientHeight - panel.offsetHeight) / 2) + 'px';
  }

  function attach(meta, left, top) {
    if (!meta) return;
    if (host) host.card.classList.remove('has-hierarchy-widget');
    host = meta;
    host.card.classList.add('has-hierarchy-widget');
    host.body.appendChild(panel);
    panel.style.position = 'absolute';
    const wantedLeft = left === undefined ? 12 : left;
    const wantedTop = top === undefined ? 12 : top;
    const maxLeft = Math.max(8, host.body.clientWidth - panel.offsetWidth - 8);
    const maxTop = Math.max(8, host.body.clientHeight - panel.offsetHeight - 8);
    panel.style.left = Math.min(maxLeft, Math.max(8, wantedLeft)) + 'px';
    panel.style.top = Math.min(maxTop, Math.max(8, wantedTop)) + 'px';
    panel.style.display = visible ? 'block' : 'none';
    requestAnimationFrame(() => refreshScale(false));
  }

  function setVisible(value) {
    visible = value;
    panel.style.display = value ? 'block' : 'none';
    if (value) requestAnimationFrame(() => refreshScale(false));
  }

  function ensureVisibleHost() {
    if (host && host.visible) return;
    const next = windows.find(meta => meta.visible);
    if (next) attach(next);
  }

  function reset(meta) {
    visible = true;
    baseInnerWidth = 0;
    baseInnerHeight = 0;
    panel.style.width = '';
    panel.style.height = '';
    panel.style.zIndex = '';
    panel.style.removeProperty('--fridge-hierarchy-scale');
    if (panelInner) {
      panelInner.style.width = '';
      panelInner.style.height = '';
      panelInner.style.transform = '';
    }
    attach(meta || host || windows.find(windowMeta => windowMeta.visible), 12, 12);
    requestAnimationFrame(() => refreshScale(true));
  }

  listen(panel, 'mousedown', event => {
    if (event.target.closest(
      'button, input, label, .hierarchy-chip, .hierarchy-value-dropdown, ' +
      '.fridge-hierarchy-resize-handle'
    )) return;
    moving = true;
    const panelRect = panel.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    root.appendChild(panel);
    panel.style.left = (panelRect.left - rootRect.left) + 'px';
    panel.style.top = (panelRect.top - rootRect.top) + 'px';
    panel.style.zIndex = '12000';
    sx = event.clientX;
    sy = event.clientY;
    startLeft = panel.offsetLeft;
    startTop = panel.offsetTop;
    event.preventDefault();
  });

  listen(window, 'mousemove', event => {
    if (!moving) return;
    panel.style.left = (startLeft + event.clientX - sx) + 'px';
    panel.style.top = (startTop + event.clientY - sy) + 'px';
  });

  listen(window, 'mouseup', event => {
    if (!moving) return;
    moving = false;
    panel.style.zIndex = '';
    const target = windows.find(meta => {
      if (!meta.visible) return false;
      const rect = meta.body.getBoundingClientRect();
      return event.clientX >= rect.left && event.clientX <= rect.right &&
        event.clientY >= rect.top && event.clientY <= rect.bottom;
    }) || host || windows.find(meta => meta.visible);
    if (target) {
      const rect = target.body.getBoundingClientRect();
      attach(target,
        event.clientX - rect.left - panel.offsetWidth / 2,
        event.clientY - rect.top - panel.offsetHeight / 2);
    }
  });

  panel.querySelectorAll('.fridge-hierarchy-resize-handle').forEach(handle => {
    listen(handle, 'mousedown', event => {
      event.stopPropagation();
      event.preventDefault();
      resizing = true;
      const cls = handle.className;
      const rsx = event.clientX, rsy = event.clientY;
      const width = panel.offsetWidth, height = panel.offsetHeight;
      const left = panel.offsetLeft, top = panel.offsetTop;
      const move = moveEvent => {
        if (!resizing) return;
        const dx = moveEvent.clientX - rsx, dy = moveEvent.clientY - rsy;
        let w = width, h = height, l = left, t = top;
        if (/\be\b|ne|se/.test(cls)) w = width + dx;
        if (/\bs\b|sw|se/.test(cls)) h = height + dy;
        if (/\bw\b|nw|sw/.test(cls)) { w = width - dx; l = left + dx; }
        if (/\bn\b|nw|ne/.test(cls)) { h = height - dy; t = top + dy; }
        const maxWidth = host ? Math.max(120, host.body.clientWidth - 16) : w;
        const maxHeight = host ? Math.max(80, host.body.clientHeight - 16) : h;
        w = Math.min(w, maxWidth);
        h = Math.min(h, maxHeight);
        if (w >= 120) { panel.style.width = w + 'px'; panel.style.left = l + 'px'; }
        if (h >= 80) { panel.style.height = h + 'px'; panel.style.top = t + 'px'; }
        centerInHost();
        refreshScale(false);
      };
      const up = () => {
        resizing = false;
        centerInHost();
        refreshScale(false);
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
      };
      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  });

  return {
    attach,
    setVisible,
    isVisible: () => visible,
    ensureVisibleHost,
    host: () => host,
    refreshScale,
    centerInHost,
    reset
  };
}

