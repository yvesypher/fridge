import { ICON_MIN, ICON_SNAP } from './fridge-icons.js';

const SNAP_PATTERNS = [
  { cls: 'layout-50', zones: ['HALF_LEFT', 'HALF_RIGHT'], title: 'Split vertical' },
  { cls: 'layout-66', zones: ['WIDE_LEFT', 'NARROW_RIGHT'], title: 'Wide left, narrow right' },
  { cls: 'layout-33', zones: ['NARROW_LEFT', 'WIDE_RIGHT'], title: 'Narrow left, wide right' },
  { cls: 'layout-3-left', zones: ['HALF_LEFT', 'QUAD_TR', 'QUAD_BR'], title: 'Three plots, left primary' },
  { cls: 'layout-3-right', zones: ['QUAD_TL', 'QUAD_BL', 'HALF_RIGHT'], title: 'Three plots, right primary' },
  { cls: 'layout-grid', zones: ['QUAD_TL', 'QUAD_TR', 'QUAD_BL', 'QUAD_BR'], title: 'Four quadrants' }
];

function createSnapMenu() {
  const menu = document.createElement('div');
  menu.className = 'fridge-snap-menu';
  SNAP_PATTERNS.forEach(pattern => {
    const group = document.createElement('div');
    group.className = 'fridge-snap-group ' + pattern.cls;
    group.title = pattern.title;
    pattern.zones.forEach((zone, index) => {
      const choice = document.createElement('button');
      choice.type = 'button';
      choice.className = 'fridge-snap-zone';
      choice.dataset.sequence = [zone]
        .concat(pattern.zones.filter((unused, i) => i !== index)).join(',');
      choice.setAttribute('aria-label', pattern.title + ', start here');
      group.appendChild(choice);
    });
    menu.appendChild(group);
  });
  return menu;
}

export function createWindowCard(plot, index, title) {
  const card = document.createElement('section');
  card.className = 'fridge-window fridge-window-' + plot.type;
  card.dataset.plotIndex = String(index);

  ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'].forEach(side => {
    const handle = document.createElement('span');
    handle.className = 'fridge-resizer ' + side;
    card.appendChild(handle);
  });

  const header = document.createElement('header');
  header.className = 'fridge-window-header';
  const titleEl = document.createElement('span');
  titleEl.className = 'fridge-window-title';
  titleEl.textContent = title;
  titleEl.title = 'Click to rename this plot';

  const controls = document.createElement('div');
  controls.className = 'fridge-window-controls';
  const minimize = document.createElement('button');
  minimize.type = 'button';
  minimize.className = 'fridge-window-btn fridge-btn-minimize';
  minimize.title = 'Minimize';
  minimize.innerHTML = ICON_MIN;

  const snapWrap = document.createElement('div');
  snapWrap.className = 'fridge-snap-wrap';
  const maximize = document.createElement('button');
  maximize.type = 'button';
  maximize.className = 'fridge-window-btn fridge-btn-maximize';
  maximize.title = 'Maximize or restore';
  maximize.innerHTML = ICON_SNAP;
  snapWrap.appendChild(maximize);
  snapWrap.appendChild(createSnapMenu());
  controls.appendChild(minimize);
  controls.appendChild(snapWrap);
  header.appendChild(titleEl);
  header.appendChild(controls);

  const body = document.createElement('div');
  body.className = 'fridge-window-content';
  if (plot.type === 'gig_stldp') body.classList.add('gig-stldp-main');
  if (plot.type === 'gig_point') body.classList.add('gig-point-main');
  if (plot.type === 'gig_sunburst') body.classList.add('gig-sunburst-main');

  card.appendChild(header);
  card.appendChild(body);
  return { card, header, titleEl, controls, minimize, maximize, body, snapWrap };
}

export function installEditableTitle(meta, onRename, listen) {
  const title = meta.titleEl;
  let before = title.textContent;

  function finish(cancel) {
    if (cancel) title.textContent = before;
    const next = title.textContent.trim() || before;
    title.textContent = next;
    title.contentEditable = 'false';
    title.classList.remove('editing');
    meta.title = next;
    onRename(meta);
  }

  listen(title, 'click', event => {
    event.stopPropagation();
    before = title.textContent;
    title.contentEditable = 'true';
    title.classList.add('editing');
    title.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(title);
    selection.removeAllRanges();
    selection.addRange(range);
  });
  listen(title, 'mousedown', event => event.stopPropagation());
  listen(title, 'keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); title.blur(); }
    if (event.key === 'Escape') { event.preventDefault(); finish(true); }
  });
  listen(title, 'blur', () => finish(false));
}
