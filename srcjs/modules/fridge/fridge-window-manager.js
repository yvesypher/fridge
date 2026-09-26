import { WIN_ICONS } from './fridge-icons.js';
import { installEditableTitle } from './fridge-window-card.js';

export function createWindowManager(root, windows, hierarchyMover, resizeAll, listen) {
  const snapOverlay = root.querySelector('.fridge-snap-overlay');
  const assist = root.querySelector('.fridge-snap-assist');
  let toolbar = null;
  let visibilityListener = () => {};
  let renameListener = () => {};
  let z = 100;
  let activeDrag = null;
  let edgeZone = null;

  function setToolbar(element) { toolbar = element; }
  function availableRect() {
    const leftDock = toolbar && toolbar.classList.contains('docked-left');
    const topDock = toolbar && toolbar.classList.contains('docked-top');
    const left = leftDock ? 64 : 8;
    const top = topDock ? 64 : 8;
    return {
      left,
      top,
      width: Math.max(160, root.clientWidth - left - 8),
      height: Math.max(120, root.clientHeight - top - 8)
    };
  }

  function zoneRect(zone) {
    const a = availableRect();
    const gap = 8;
    const halfW = (a.width - gap) / 2;
    const halfH = (a.height - gap) / 2;
    const wide = a.width * 0.666 - gap / 2;
    const narrow = a.width - wide - gap;
    const map = {
      HALF_LEFT: { left: a.left, top: a.top, width: halfW, height: a.height },
      HALF_RIGHT: { left: a.left + halfW + gap, top: a.top, width: halfW, height: a.height },
      WIDE_LEFT: { left: a.left, top: a.top, width: wide, height: a.height },
      NARROW_RIGHT: { left: a.left + wide + gap, top: a.top, width: narrow, height: a.height },
      NARROW_LEFT: { left: a.left, top: a.top, width: narrow, height: a.height },
      WIDE_RIGHT: { left: a.left + narrow + gap, top: a.top, width: wide, height: a.height },
      QUAD_TL: { left: a.left, top: a.top, width: halfW, height: halfH },
      QUAD_TR: { left: a.left + halfW + gap, top: a.top, width: halfW, height: halfH },
      QUAD_BL: { left: a.left, top: a.top + halfH + gap, width: halfW, height: halfH },
      QUAD_BR: { left: a.left + halfW + gap, top: a.top + halfH + gap, width: halfW, height: halfH }
    };
    return map[zone];
  }

  function applyRect(meta, rect, mode, zone) {
    if (!rect) return;
    const next = {
      display: meta.visible ? 'flex' : 'none',
      left: Math.round(rect.left) + 'px',
      top: Math.round(rect.top) + 'px',
      width: Math.max(150, Math.round(rect.width)) + 'px',
      height: Math.max(120, Math.round(rect.height)) + 'px'
    };
    const sizeChanged =
      meta.card.style.width !== next.width ||
      meta.card.style.height !== next.height ||
      meta.card.style.display !== next.display;
    Object.keys(next).forEach(property => {
      if (meta.card.style[property] !== next[property]) {
        meta.card.style[property] = next[property];
      }
    });
    meta.layoutMode = mode || 'free';
    meta.zone = zone || null;
    if (sizeChanged) resizeAll(meta);
  }

  function autoRects(count) {
    const a = availableRect();
    const gap = 8;
    if (count === 1) return [{ left: a.left, top: a.top, width: a.width, height: a.height }];
    if (count === 2) return [zoneRect('HALF_LEFT'), zoneRect('HALF_RIGHT')];
    if (count === 3) return [zoneRect('HALF_LEFT'), zoneRect('QUAD_TR'), zoneRect('QUAD_BR')];
    if (count === 4) return ['QUAD_TL', 'QUAD_TR', 'QUAD_BL', 'QUAD_BR'].map(zoneRect);
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const width = (a.width - gap * (columns - 1)) / columns;
    const height = (a.height - gap * (rows - 1)) / rows;
    return Array.from({ length: count }, (unused, index) => ({
      left: a.left + (index % columns) * (width + gap),
      top: a.top + Math.floor(index / columns) * (height + gap),
      width,
      height
    }));
  }

  function defaultLayout(showAll) {
    if (showAll) windows.forEach(meta => { meta.visible = true; meta.maximized = false; });
    const visible = windows.filter(meta => meta.visible);
    const rects = autoRects(visible.length);
    visible.forEach((meta, index) => applyRect(meta, rects[index], 'auto'));
    windows.filter(meta => !meta.visible).forEach(meta => { meta.card.style.display = 'none'; });
    visibilityListener();
    hierarchyMover.ensureVisibleHost();
  }

  function relayout() {
    const autos = windows.filter(meta => meta.visible && meta.layoutMode === 'auto');
    const autoPositions = autoRects(windows.filter(meta => meta.visible).length);
    windows.filter(meta => meta.visible).forEach((meta, visibleIndex) => {
      if (meta.layoutMode === 'auto') applyRect(meta, autoPositions[visibleIndex], 'auto');
      else if (meta.layoutMode === 'zone' && meta.zone) applyRect(meta, zoneRect(meta.zone), 'zone', meta.zone);
      else if (meta.layoutMode === 'max') applyRect(meta, availableRect(), 'max');
    });
    if (!autos.length) resizeAll();
  }

  function bringFront(meta) {
    z += 1;
    meta.card.style.zIndex = String(z);
    windows.forEach(other => other.card.classList.toggle('active', other === meta));
  }

  function setVisible(meta, visible) {
    meta.visible = visible;
    meta.card.style.display = visible ? 'flex' : 'none';
    if (visible) bringFront(meta);
    visibilityListener();
    hierarchyMover.ensureVisibleHost();
    resizeAll(meta);
  }

  function toggleMaximize(meta) {
    if (meta.layoutMode === 'max' && meta.previous) {
      applyRect(meta, meta.previous.rect, meta.previous.mode, meta.previous.zone);
      meta.previous = null;
      meta.card.classList.remove('maximized');
    } else {
      meta.previous = {
        mode: meta.layoutMode,
        zone: meta.zone,
        rect: { left: meta.card.offsetLeft, top: meta.card.offsetTop,
          width: meta.card.offsetWidth, height: meta.card.offsetHeight }
      };
      applyRect(meta, availableRect(), 'max');
      meta.card.classList.add('maximized');
      bringFront(meta);
    }
  }

  function hideAssist() {
    assist.style.display = 'none';
    assist.innerHTML = '';
  }

  function promptZone(pending, candidates) {
    if (!pending.length || !candidates.length) { hideAssist(); return; }
    const zone = pending.shift();
    const rect = zoneRect(zone);
    Object.assign(assist.style, {
      display: 'flex', left: rect.left + 'px', top: rect.top + 'px',
      width: rect.width + 'px', height: rect.height + 'px'
    });
    assist.innerHTML = '';
    candidates.forEach(meta => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'fridge-snap-assist-card';
      choice.innerHTML = '<span class="fridge-assist-icon">' + (WIN_ICONS[meta.type] || '') + '</span>';
      const label = document.createElement('span');
      label.textContent = meta.title;
      choice.appendChild(label);
      choice.addEventListener('click', event => {
        event.stopPropagation();
        meta.visible = true;
        applyRect(meta, rect, 'zone', zone);
        bringFront(meta);
        const next = candidates.filter(candidate => candidate !== meta);
        visibilityListener();
        promptZone(pending, next);
      });
      assist.appendChild(choice);
    });
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'fridge-snap-assist-card skip';
    skip.textContent = 'Leave empty';
    skip.addEventListener('click', event => { event.stopPropagation(); promptZone(pending, candidates); });
    assist.appendChild(skip);
  }

  function startSnapSequence(meta, sequence) {
    if (!sequence.length) return;
    windows.forEach(other => setVisible(other, other === meta));
    meta.visible = true;
    applyRect(meta, zoneRect(sequence[0]), 'zone', sequence[0]);
    bringFront(meta);
    const candidates = windows.filter(other => other !== meta);
    promptZone(sequence.slice(1), candidates);
  }

  function groupForEdge(zone) {
    if (zone === 'HALF_LEFT' || zone === 'HALF_RIGHT') return ['HALF_LEFT', 'HALF_RIGHT'];
    return ['QUAD_TL', 'QUAD_TR', 'QUAD_BL', 'QUAD_BR'];
  }

  windows.forEach(meta => {
    listen(meta.card, 'mousedown', () => bringFront(meta));
    listen(meta.minimize, 'click', event => { event.stopPropagation(); setVisible(meta, false); });
    listen(meta.maximize, 'click', event => { event.stopPropagation(); toggleMaximize(meta); });
    installEditableTitle(meta, renamed => renameListener(renamed), listen);

    const snapMenu = meta.snapWrap.querySelector('.fridge-snap-menu');
    let menuTimer = null;
    listen(meta.snapWrap, 'mouseenter', () => { clearTimeout(menuTimer); snapMenu.classList.add('visible'); });
    listen(meta.snapWrap, 'mouseleave', () => {
      menuTimer = setTimeout(() => snapMenu.classList.remove('visible'), 180);
    });
    meta.snapWrap.querySelectorAll('.fridge-snap-zone').forEach(choice => {
      listen(choice, 'click', event => {
        event.stopPropagation();
        snapMenu.classList.remove('visible');
        startSnapSequence(meta, choice.dataset.sequence.split(','));
      });
    });

    listen(meta.header, 'mousedown', event => {
      if (event.target.closest('.fridge-window-controls, .fridge-window-title')) return;
      activeDrag = {
        meta, sx: event.clientX, sy: event.clientY,
        left: meta.card.offsetLeft, top: meta.card.offsetTop
      };
      meta.layoutMode = 'free';
      meta.zone = null;
      meta.card.classList.remove('maximized');
      bringFront(meta);
      event.preventDefault();
    });

    meta.card.querySelectorAll('.fridge-resizer').forEach(handle => {
      listen(handle, 'mousedown', event => {
        event.stopPropagation(); event.preventDefault();
        const cls = handle.className;
        const sx = event.clientX, sy = event.clientY;
        const width = meta.card.offsetWidth, height = meta.card.offsetHeight;
        const left = meta.card.offsetLeft, top = meta.card.offsetTop;
        const move = moveEvent => {
          const dx = moveEvent.clientX - sx, dy = moveEvent.clientY - sy;
          let w = width, h = height, l = left, t = top;
          if (/\be\b|ne|se/.test(cls)) w = width + dx;
          if (/\bs\b|sw|se/.test(cls)) h = height + dy;
          if (/\bw\b|nw|sw/.test(cls)) { w = width - dx; l = left + dx; }
          if (/\bn\b|nw|ne/.test(cls)) { h = height - dy; t = top + dy; }
          if (w >= 180) { meta.card.style.width = w + 'px'; meta.card.style.left = l + 'px'; }
          if (h >= 140) { meta.card.style.height = h + 'px'; meta.card.style.top = t + 'px'; }
          meta.layoutMode = 'free'; meta.zone = null;
        };
        const up = () => {
          window.removeEventListener('mousemove', move);
          window.removeEventListener('mouseup', up);
          resizeAll(meta);
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
      });
    });
  });

  listen(window, 'mousemove', event => {
    if (!activeDrag) return;
    const rect = root.getBoundingClientRect();
    const meta = activeDrag.meta;
    meta.card.style.left = (activeDrag.left + event.clientX - activeDrag.sx) + 'px';
    meta.card.style.top = (activeDrag.top + event.clientY - activeDrag.sy) + 'px';
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const a = availableRect();
    const threshold = 28;
    edgeZone = null;
    if (Math.abs(x - a.left) < threshold) edgeZone = 'HALF_LEFT';
    else if (Math.abs(x - (a.left + a.width)) < threshold) edgeZone = 'HALF_RIGHT';
    else if (Math.abs(y - a.top) < threshold) edgeZone = 'QUAD_TL';
    else if (Math.abs(y - (a.top + a.height)) < threshold) edgeZone = 'QUAD_BL';
    if (edgeZone) {
      const preview = zoneRect(edgeZone);
      Object.assign(snapOverlay.style, { display: 'block', left: preview.left + 'px',
        top: preview.top + 'px', width: preview.width + 'px', height: preview.height + 'px' });
    } else snapOverlay.style.display = 'none';
  });

  listen(window, 'mouseup', () => {
    if (activeDrag && edgeZone) startSnapSequence(activeDrag.meta, groupForEdge(edgeZone));
    activeDrag = null;
    edgeZone = null;
    snapOverlay.style.display = 'none';
  });
  listen(assist, 'click', hideAssist);

  return {
    setToolbar,
    setVisibilityListener(callback) { visibilityListener = callback || (() => {}); },
    setRenameListener(callback) { renameListener = callback || (() => {}); },
    setVisible,
    toggleWindow(meta) { setVisible(meta, !meta.visible); },
    defaultLayout,
    resetLayout() { hideAssist(); defaultLayout(true); },
    relayout,
    resizeAll,
    bringFront
  };
}

