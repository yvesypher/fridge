import {
  createHierState, parseHierarchy, renderGgelatoPlot, requireGgelatoAPI,
  safeConvert, TOTAL_KEY
} from '../core/ggelato-adapter.js';
import { hierarchyRows } from '../core/hierarchy-data.js';
import { renderWidgetError } from './fridge-errors.js';
import { FRIDGE_BUILD, WIN_TITLES } from './fridge-icons.js';
import { createWindowCard } from './fridge-window-card.js';
import { installHierarchyMover } from './fridge-hierarchy-mover.js';
import { createWindowManager } from './fridge-window-manager.js';
import { makeToolbar } from './fridge-toolbar.js';

export function buildFridge(el, value) {
  const plots = Array.isArray(value && value.plots) ? value.plots : [];
  const fullscreen = !value || value.fullscreen !== false;
  const hierarchy = value && (value.structure || value.hierarchy)
    ? String(value.structure || value.hierarchy)
    : '';

  if (!plots.length) {
    renderWidgetError(el, 'fridge() did not receive any plots.');
    return null;
  }
  if (!hierarchy) {
    renderWidgetError(el, 'fridge() did not receive a hierarchy specification.');
    return null;
  }
  let api;
  try {
    api = requireGgelatoAPI();
  } catch (error) {
    renderWidgetError(el, error.message);
    return null;
  }

  const needsChart = plots.some(plot => plot.type === 'gig_stldp' || plot.type === 'gig_point');
  const needsD3 = plots.some(plot => plot.type === 'gig_sunburst');
  if (needsChart && typeof Chart === 'undefined') {
    renderWidgetError(el, 'Chart.js is not loaded. Add it to inst/htmlwidgets/fridge.yaml.');
    return null;
  }
  if (needsD3 && typeof d3 === 'undefined') {
    renderWidgetError(el, 'D3 is not loaded. Add it to inst/htmlwidgets/fridge.yaml.');
    return null;
  }

  const rows = hierarchyRows(plots, hierarchy);
  if (!rows.length) {
    renderWidgetError(el, 'The supplied plots contain no data for hierarchy "' + hierarchy + '".');
    return null;
  }

  const state = createHierState(rows, hierarchy);
  const requestedKeys = parseHierarchy(hierarchy).keys;
  const missingKeys = requestedKeys.filter(key => !state.activeKeys.includes(key));
  if (missingKeys.length) {
    renderWidgetError(el, 'Hierarchy columns missing from the plot data: ' + missingKeys.join(', ') + '.');
    return null;
  }
  const initialHierarchyState = {
    activeKeys: [...state.activeKeys],
    disabled: new Set(state.disabled),
    hiddenValues: new Set(state.hiddenValues)
  };

  el.innerHTML = '';
  const cleanup = [];
  el.dataset.fridgeBuild = FRIDGE_BUILD;
  el.classList.toggle('fridge-fullscreen-host', fullscreen);
  el.classList.toggle('fridge-embedded-host', !fullscreen);
  if (fullscreen) {
    document.documentElement.classList.add('fridge-fullscreen-page');
    if (document.body) document.body.classList.add('fridge-fullscreen-page');
  }
  cleanup.push(() => {
    delete el.dataset.fridgeBuild;
    el.classList.remove('fridge-fullscreen-host', 'fridge-embedded-host');
    if (!document.querySelector('.fridge-fullscreen-host')) {
      document.documentElement.classList.remove('fridge-fullscreen-page');
      if (document.body) document.body.classList.remove('fridge-fullscreen-page');
    }
  });
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options);
    cleanup.push(() => target.removeEventListener(type, handler, options));
  };
  const root = document.createElement('div');
  root.className = 'fridge-widget';
  root.dataset.fridgeBuild = FRIDGE_BUILD;
  const tooltip = document.createElement('div');
  tooltip.className = 'gig-tooltip';
  const snapOverlay = document.createElement('div');
  snapOverlay.className = 'fridge-snap-overlay';
  const snapAssist = document.createElement('div');
  snapAssist.className = 'fridge-snap-assist';
  const panel = document.createElement('div');
  panel.className = 'fridge-hierarchy-panel';
  panel.title = 'Drag the empty panel background to move it to another plot';
  panel.innerHTML =
    '<div class="fridge-hierarchy-panel-inner">' +
      '<div class="fridge-hierarchy-widget-host"></div>' +
    '</div>' +
    ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se']
      .map(side => '<span class="fridge-hierarchy-resize-handle ' + side + '"></span>').join('');

  root.appendChild(snapOverlay);
  root.appendChild(snapAssist);
  root.appendChild(tooltip);
  el.appendChild(root);

  const renderers = [];
  const windows = [];
  let hierarchyWidget = null;
  let totalDimmed = false;
  const hasScaled = plots.some(plot => plot.type === 'gig_stldp' &&
    safeConvert(plot.x.scaled || plot.x.stl_scaled || plot.x.stl_s).length > 0);
  const initialLabelsOn = plots.some(plot => plot.type === 'gig_sunburst' && plot.x.labels !== false);
  const shared = {
    state,
    listen,
    // Match standalone ggelato semantics: an empty explicit selection means
    // "Total only". createGigHierarchyAdapter already treats Total as selected
    // in this state, while every lower-level value remains unselected.
    selected: new Set(),
    selectionMode: 'single',
    tools: { box: false, lasso: false },
    labelsOn: { v: initialLabelsOn },
    isScaled: { v: false },
    hasScaled,
    hasSunburst: plots.some(plot => plot.type === 'gig_sunburst'),
    resetFns: [],
    tooltipEl: tooltip,
    visibleIndices() {
      const indices = [];
      this.state.series.forEach((series, index) => {
        if (!this.state.isSeriesHidden(series)) indices.push(index);
      });
      return indices;
    },
    prepareStylePass() {
      this._styleFiltering = this.selected.size > 0;
    },
    getStyle(d, index) {
      const base = state.depthColor(d._depth);
      const hasSelection = this.selected.size > 0;
      const selected = this.selected.has(index);
      const isTotal = d._depth === 0;

      if (hasSelection) {
        return {
          c: selected ? base : 'rgba(148,163,184,0.22)',
          w: selected ? 3 : 1.3,
          r: selected ? 7 : 3,
          o: selected ? 0 : 100 + d._depth,
          focus: selected
        };
      }

      const totalFocused = isTotal && !totalDimmed;
      return {
        c: totalFocused ? base : 'rgba(148,163,184,0.22)',
        w: totalFocused ? 2.2 : 1.3,
        r: totalFocused ? 5 : 3,
        o: totalFocused ? 0 : 100 + d._depth,
        focus: totalFocused
      };
    },

    select(index, additive) {
      api.updateGigSelection({
        state: this.state,
        selectedIndices: this.selected,
        index,
        shift: Boolean(additive),
        mode: this.selectionMode
      });
      refresh(false);
    },
    brush(indices, additive) {
      if (!additive) this.selected.clear();
      api.applyBrushSelection({
        hits: indices,
        state: this.state,
        selectedIndices: this.selected,
        mode: this.selectionMode
      });
      refresh(false);
    }
  };

  function refresh(full) {
    shared.prepareStylePass();
    renderers.forEach(renderer => renderer.update(full));
  }
  function rebuild() {
    refresh(true);
  }
  const pendingResize = new Set();
  let resizeFrame = 0;
  function resizeAll(meta = null) {
    if (meta && meta.renderer) {
      pendingResize.add(meta.renderer);
    } else {
      windows.forEach(windowMeta => {
        if (windowMeta.visible && windowMeta.renderer) {
          pendingResize.add(windowMeta.renderer);
        }
      });
    }
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const queue = Array.from(pendingResize);
      pendingResize.clear();
      queue.forEach(renderer => renderer.resize());
    });
  }

  const duplicateCount = {};
  plots.forEach((plot, index) => {
    duplicateCount[plot.type] = (duplicateCount[plot.type] || 0) + 1;
    const baseTitle = plot.title || plot.x.title || WIN_TITLES[plot.type] || plot.type;
    const title = !plot.title && duplicateCount[plot.type] > 1
      ? baseTitle + ' ' + duplicateCount[plot.type] : baseTitle;
    const parts = createWindowCard(plot, index, title);
    root.appendChild(parts.card);
    const meta = Object.assign(parts, {
      index, type: plot.type, plot, title, visible: true,
      renderer: null, layoutMode: 'auto', zone: null, previous: null
    });
    windows.push(meta);

    try {
      const renderer = renderGgelatoPlot(plot.type, parts.body, plot.x, shared);
      if (renderer) { meta.renderer = renderer; renderers.push(renderer); }
    } catch (error) {
      parts.body.innerHTML = '<div class="fridge-panel-error"></div>';
      parts.body.querySelector('.fridge-panel-error').textContent =
        'Unable to render ' + plot.type + ': ' + error.message;
    }
  });

  const hierarchyMover = installHierarchyMover(panel, windows, root, resizeAll, listen);
  const initialHierarchyHost = windows.find(meta => meta.type === 'gig_sunburst') || windows[0];
  hierarchyMover.attach(initialHierarchyHost);
  const hierarchyController = new AbortController();
  cleanup.push(() => hierarchyController.abort());
  const hierarchyAdapter = api.createGigHierarchyAdapter({
    state,
    selectedIndices: shared.selected,
    getTotalDimmed: () => totalDimmed,
    setTotalDimmed: value => { totalDimmed = Boolean(value); },
    onSelectionChange: () => {
      refresh(false);
    },
    onStructureChange: () => {
      rebuild();
      renderSharedLegend();
    },
    onVisibilityChange: () => {
      rebuild();
      renderSharedLegend();
    }
  });
  hierarchyWidget = api.createHierarchyWidget({
    host: panel.querySelector('.fridge-hierarchy-widget-host'),
    structure: hierarchy,
    signal: hierarchyController.signal,
    model: hierarchyAdapter.model,
    valueControls: hierarchyAdapter.valueControls,
    overlayParent: root,
    menuBoundary: root,
    protectedElement: panel
  });
  if (!hierarchyWidget) {
    throw new Error('ggelato could not create the shared hierarchy widget.');
  }

  hierarchyWidget.container.style.pointerEvents = 'none';
  const manager = createWindowManager(root, windows, hierarchyMover, resizeAll, listen);

  function resetPlatform() {
    state.activeKeys = [...initialHierarchyState.activeKeys];
    state.disabled.clear();
    initialHierarchyState.disabled.forEach(key => state.disabled.add(key));
    state.hiddenValues.clear();
    initialHierarchyState.hiddenValues.forEach(value => state.hiddenValues.add(value));
    state.rebuild();
    shared.selectionMode = 'single';
    shared.tools.box = false;
    shared.tools.lasso = false;
    shared.labelsOn.v = initialLabelsOn;
    shared.isScaled.v = false;
    totalDimmed = false;
    // Reset to the same initial state as standalone ggelato: Total only.
    shared.selected.clear();
    shared.resetFns.forEach(fn => fn());
    manager.resetLayout();
    hierarchyMover.reset(initialHierarchyHost);
    renderSharedLegend();
    rebuild();
  }

  const toolbar = makeToolbar(
    root, shared, windows, manager, hierarchyMover,
    refresh, rebuild, resetPlatform, listen
  );

  function renderSharedLegend() {
    hierarchyWidget?.sync({
      activeKeys: state.activeKeys,
      disabledKeys: state.disabled,
      totalVisible: !state.isHidden(TOTAL_KEY, 'Total')
    });
    requestAnimationFrame(() => hierarchyMover.refreshScale(false));
  }
  renderSharedLegend();
  requestAnimationFrame(() => hierarchyMover.refreshScale(true));
  manager.defaultLayout(true);
  rebuild();
  toolbar.update();

  let observer = null;
  let layoutFrame = 0;
  let observedWidth = -1;
  let observedHeight = -1;
  function scheduleRelayout(force = false) {
    const width = Math.round(el.clientWidth);
    const height = Math.round(el.clientHeight);
    if (!force && width === observedWidth && height === observedHeight) return;
    observedWidth = width;
    observedHeight = height;
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      manager.relayout();
    });
  }
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => scheduleRelayout(false));
    observer.observe(el);
  }

  return {
    resize() {
      scheduleRelayout(true);
    },
    destroy() {
      if (observer) observer.disconnect();
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      pendingResize.clear();
      renderers.forEach(renderer => renderer.destroy?.());
      cleanup.forEach(fn => fn());
      tooltip.remove();
    }
  };
}
