/*
 * The hierarchy model, hierarchy widget, and sunburst renderer are provided
 * by the installed ggelato package through window.ggelatoAPI. Keeping them
 * out of this bundle prevents fridge from freezing older ggelato behavior.
 */
function requireGgelatoAPI() {
  const api = window.ggelatoAPI;
  if (!api) {
    throw new Error(
      'ggelatoAPI is not loaded. Reinstall ggelato before rebuilding fridge.'
    );
  }
  return api;
}

const safeConvert = data => requireGgelatoAPI().dataFrameToRows(data);
const createHierState = (rows, structure, excludeKeys) =>
  requireGgelatoAPI().createHierState(rows, structure, excludeKeys);
const renderSunburst = (content, x, shared) =>
  requireGgelatoAPI().renderSunburst(content, x, shared);
const parseHierarchy = structure => {
  const parsed = requireGgelatoAPI().parseStructure(structure);
  return { keys: parsed.activeKeys, constraints: parsed.constraints };
};
const TOTAL_KEY = '__total__';

/* =====================================================================
   fridge: composes gig_stldp / gig_point / gig_sunburst payloads into a
   linkvis-style dashboard - floating snappable windows, one shared
   toolbar, one shared hierarchy panel, linked selection everywhere.
   ===================================================================== */

// ---------------- icons ----------------
const SVGS = {
  single: '<svg class="gig-icon-svg" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5" fill="#333"/><circle cx="16" cy="8" r="3.5" fill="#ccc"/><circle cx="8" cy="16" r="3.5" fill="#ccc"/><circle cx="16" cy="16" r="3.5" fill="#ccc"/></svg>',
  multiple: '<svg class="gig-icon-svg" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5" fill="#333"/><circle cx="16" cy="8" r="3.5" fill="#333"/><circle cx="8" cy="16" r="3.5" fill="#333"/><circle cx="16" cy="16" r="3.5" fill="#333"/></svg>',
  inverse: '<svg class="gig-icon-svg" viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5" fill="#ccc"/><circle cx="16" cy="8" r="3.5" fill="#333"/><circle cx="8" cy="16" r="3.5" fill="#333"/><circle cx="16" cy="16" r="3.5" fill="#333"/></svg>',
  inverseAll: '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#333" stroke-width="1.5"/><circle cx="8" cy="8" r="2.5" fill="#ccc"/><circle cx="16" cy="8" r="2.5" fill="#333"/><circle cx="8" cy="16" r="2.5" fill="#333"/><circle cx="16" cy="16" r="2.5" fill="#333"/></svg>',
  hierarchy: '<svg class="gig-icon-svg" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true"><path d="M192 64c0-17.7 14.3-32 32-32h64c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32h-8v64h120c39.8 0 72 32.2 72 72v56h8c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32h-64c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h8v-56c0-13.3-10.7-24-24-24H280v80h8c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32h-64c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h8v-80H112c-13.3 0-24 10.7-24 24v56h8c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32v-64c0-17.7 14.3-32 32-32h8v-56c0-39.8 32.2-72 72-72h120v-64h-8c-17.7 0-32-14.3-32-32V64z"/></svg>'
};
const ICON_BOX = '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9 V6 a2 2 0 0 1 2-2 h3"/><path d="M15 4 h3 a2 2 0 0 1 2 2 v3"/><path d="M20 15 v3 a2 2 0 0 1 -2 2 h-3"/><path d="M9 20 H6 a2 2 0 0 1 -2-2 v-3"/></svg>';
const ICON_RESET = '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
const ICON_LASSO = '<svg class="gig-icon-svg" viewBox="2 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M 7 21 L 9.5 16.5" /><path d="M 9.5 16.5 C 4 11 7 5 15 5 C 21 5 23 11 20 15 C 18 17 13 18 9.5 16.5" /><path d="M 9.5 16.5 C 9 17 8 17 8 16" /></svg>';
const ICON_LABELS = '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>';
const ICON_GRIP = '<svg viewBox="0 0 14 20" fill="currentColor" width="14" height="20" style="pointer-events:none;"><circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="4" r="1.5"/><circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="4" cy="16" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>';
const ICON_MIN = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none"><line x1="4" y1="12" x2="20" y2="12"></line></svg>';
const ICON_SNAP = '<svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>';
const WIN_ICONS = {
  gig_point: '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3v18h18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="14" r="1.5"/><circle cx="11" cy="10" r="1.5"/><circle cx="15" cy="16" r="1.5"/><circle cx="19" cy="8" r="1.5"/><circle cx="8" cy="7" r="1.5"/><circle cx="13" cy="13" r="1.5"/><circle cx="17" cy="5" r="1.5"/></svg>',
  gig_stldp: '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 3 3 21 21 21"></polyline><polyline points="3 16 9 10 14 15 21 6"></polyline></svg>',
  gig_sunburst: '<svg class="gig-icon-svg" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="12" y1="2" x2="12" y2="8" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="16" x2="12" y2="22" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="12" x2="8" y2="12" stroke="currentColor" stroke-width="1.5"/><line x1="16" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/></svg>'
};
const WIN_TITLES = {
  gig_point: 'Time Series Features',
  gig_stldp: 'STL Decomposition',
  gig_sunburst: 'Hierarchy'
};
const FRIDGE_BUILD = 'fridge-scrollytelling-embed-v11-20260729';

// Critical layout overrides are installed by the binding as well as shipped
// in styles.css. This prevents an older cached stylesheet from hiding a newly
// bundled interface revision in RStudio Viewer or a browser tab.
function installRuntimeStyles() {
  const id = 'fridge-linkvis-runtime-v11';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent =
    'html.fridge-fullscreen-page,body.fridge-fullscreen-page{' +
      'width:100%!important;height:100%!important;margin:0!important;' +
      'padding:0!important;overflow:hidden!important}' +
    '.fridge-fullscreen-host{position:fixed!important;inset:0!important;' +
      'z-index:2147483000;width:100vw!important;height:100vh!important;' +
      'min-width:100vw!important;min-height:100vh!important;max-width:none!important;' +
      'max-height:none!important;margin:0!important;padding:0!important}' +
    '.fridge-fullscreen-host>.fridge-widget{width:100vw!important;' +
      'height:100vh!important;min-height:100vh!important}' +
    '.fridge-embedded-host{position:relative!important;inset:auto!important;' +
      'z-index:auto!important;width:100%!important;min-width:0!important;' +
      'max-width:100%!important;margin:0!important;padding:0!important;' +
      'overflow:hidden!important;isolation:isolate}' +
    '.fridge-embedded-host>.fridge-widget{width:100%!important;' +
      'height:100%!important;min-height:0!important}' +
    '.fridge-window,.fridge-window-content{contain:layout style}' +
    '.fridge-window-content.gig-point-main{display:flex;align-items:center;' +
      'justify-content:center}' +
    '.fridge-window-content .gig-scatter-grid{flex:none;min-width:0;' +
      'min-height:0;transition:none!important;contain:layout size style}' +
    '.fridge-window-content .gig-chart-wrap{flex:none;min-width:0;' +
      'min-height:0;overflow:hidden;contain:strict}' +
    '.fridge-window-content .gig-chart-wrap canvas{display:block;' +
      'max-width:none;max-height:none;transition:none!important}' +
    '.fridge-hierarchy-panel{width:158px;height:176px;padding:10px;cursor:grab}' +
    '.fridge-hierarchy-panel-inner{position:absolute!important;left:50%!important;' +
      'top:50%!important;max-height:none!important;overflow:visible!important;' +
      'transform-origin:center center!important;will-change:transform}' +
    '.fridge-data-switch{--fridge-switch-width:104px;--fridge-switch-height:36px;' +
      'width:var(--fridge-switch-width)!important;height:var(--fridge-switch-height)!important}' +
    '.fridge-label{font-size:calc(var(--fridge-switch-height)*.26)!important;' +
      'font-weight:800!important;letter-spacing:.1px!important}' +
    '.fridge-label-original{right:8px!important}.fridge-label-scaled{left:9px!important}' +
    '.fridge-data-switch input:checked+.fridge-slider .fridge-knob{' +
      'transform:translateX(calc(var(--fridge-switch-width) - var(--fridge-switch-height)))!important}' +
    '.fridge-toolbar.docked-left .fridge-data-switch,' +
      '.fridge-toolbar.floating-vertical .fridge-data-switch{margin:34px 0!important}';
  (document.head || document.documentElement).appendChild(style);
}

// Point-in-polygon / point-in-box, shared by all brushing code
const inBox = (x, y, b) => x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax;
const inLasso = (p, vs) => {
  let ins = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    if (((vs[i].y > p.y) !== (vs[j].y > p.y)) &&
        (p.x < (vs[j].x - vs[i].x) * (p.y - vs[i].y) / (vs[j].y - vs[i].y) + vs[i].x)) ins = !ins;
  }
  return ins;
};
const fmt = v => typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(4)) : v;

/* =====================================================================
   RENDERERS - each returns { update(full), resize() } and paints inside
   a window's content element, driven entirely by the shared object.
   ===================================================================== */

// ---------------- gig_stldp renderer ----------------
function renderStldp(content, x, shared) {
  const rows = safeConvert(x.data || x.unscaled || x.stl_unscaled || x.stl_u);
  const scaledRows = safeConvert(x.scaled || x.stl_scaled || x.stl_s);
  const hasScaled = scaledRows.length > 0;
  if (hasScaled) shared.hasScaled = true;

  const sample = rows[0] || {};
  const keys = Object.keys(sample);
  const timeVar = ['Quarter', 'Time', 'Month', 'Week', 'Date'].find(k => keys.includes(k)) || 'Time';
  const seasonVar = x.season || keys.find(k => k.startsWith('season') && k !== 'season_adjust') || 'season_year';
  const targetVar = x.target || keys.find(k =>
    typeof sample[k] === 'number' &&
    !['trend', 'remainder', 'season_adjust'].includes(k) && !k.startsWith('season')) || 'value';

  const dictU = {}, dictS = {};
  const fill = (rs, out) => {
    rs.forEach(r => {
      const id = shared.state.canonicalId(r);
      (out[id] = out[id] || []).push(r);
    });
    const sorter = (a, b) => String(a[timeVar] || '').localeCompare(String(b[timeVar] || ''));
    Object.values(out).forEach(a => a.sort(sorter));
  };
  fill(rows, dictU);
  if (hasScaled) fill(scaledRows, dictS);
  const dict = () => (shared.isScaled.v && hasScaled) ? dictS : dictU;

  content.innerHTML =
    '<div class="gig-stl-controls">' +
    ['Data', 'Trend', 'Season', 'Remainder'].map(c =>
      '<button class="gig-stl-chip active" data-comp="' + c + '">' +
      (c === 'Season' ? 'Seasonality' : c) + '</button>').join('') +
    '</div>' +
    ['Data', 'Trend', 'Season', 'Remainder'].map(c =>
      '<div class="gig-stl-wrapper" data-wrap="' + c + '"><canvas></canvas></div>').join('');

  const ORDER = ['Data', 'Trend', 'Season', 'Remainder'];
  const MAP = { Data: 'data', Trend: 'trend', Season: 'season', Remainder: 'remainder' };
  const charts = {};
  let lastWidth = -1;
  let lastHeight = -1;

  function tooltipHandler(ctx) {
    const { chart, tooltip } = ctx;
    const tt = shared.tooltipEl;
    if (tooltip.opacity === 0) { tt.style.opacity = 0; return; }
    if (tooltip.dataPoints && tooltip.dataPoints.length) {
      const dp = tooltip.dataPoints[0];
      const i = chart.data.datasets[dp.datasetIndex]._trueIndex;
      const d = shared.state.series[i];
      if (d) {
        const name = chart.options.plugins.title.text;
        tt.innerHTML = '<div style="font-weight:bold;margin-bottom:4px;">' +
          '<span class="gig-tooltip-swatch" style="background:' +
          chart.data.datasets[dp.datasetIndex].borderColor + '"></span>' +
          shared.state.label(d) + '</div>' +
          '<div>' + timeVar + ': ' + dp.label + '</div>' +
          '<div>' + name + ': ' + fmt(dp.parsed.y) + '</div>';
      }
    }
    const r = chart.canvas.getBoundingClientRect();
    tt.style.opacity = 1;
    tt.style.left = (r.left + tooltip.caretX) + 'px';
    tt.style.top = (r.top + tooltip.caretY) + 'px';
  }

  const common = {
    responsive: true, maintainAspectRatio: false, animation: false, normalized: true,
    elements: { point: { radius: 0, hitRadius: 5 }, line: { borderWidth: 1, tension: 0 } },
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false, external: tooltipHandler, mode: 'nearest', intersect: false }
    },
    interaction: { mode: 'nearest', axis: 'xy', intersect: false },
    onClick: (e, els, chart) => {
      if (shared.tools.box || shared.tools.lasso) return;
      if (!els.length) { shared.select(-1, false); return; }
      shared.select(chart.data.datasets[els[0].datasetIndex]._trueIndex,
        e.native ? e.native.shiftKey : false);
    }
  };
  ORDER.forEach(name => {
    const canv = content.querySelector('.gig-stl-wrapper[data-wrap="' + name + '"] canvas');
    charts[MAP[name]] = new Chart(canv, {
      type: 'line', data: { labels: [], datasets: [] },
      options: {
        ...common,
        scales: {
          x: { display: false, grid: { display: false },
               ticks: { maxTicksLimit: 10, font: { weight: 'bold' } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false },
               ticks: { font: { weight: 'bold' } },
               title: { display: true, text: name === 'Season' ? 'Seasonality' : name,
                        align: 'center', font: { size: 11, weight: 'bold' } },
               afterFit: sc => { sc.width = 70; } }
        },
        plugins: { ...common.plugins,
          title: { display: false, text: name === 'Season' ? 'Seasonality' : name } }
      }
    });
  });

  function axes() {
    let last = null;
    for (let i = ORDER.length - 1; i >= 0; i--) {
      const w = content.querySelector('.gig-stl-wrapper[data-wrap="' + ORDER[i] + '"]');
      if (w && !w.classList.contains('hidden')) { last = MAP[ORDER[i]]; break; }
    }
    Object.keys(charts).forEach(k => {
      charts[k].options.scales.x.display = (k === last);
      charts[k].update('none');
    });
  }
  content.querySelectorAll('.gig-stl-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const w = content.querySelector('.gig-stl-wrapper[data-wrap="' + btn.dataset.comp + '"]');
      if (w) w.classList.toggle('hidden');
      axes();
    });
  });

  // brushing on each panel
  ORDER.forEach(name => {
    const canv = content.querySelector('.gig-stl-wrapper[data-wrap="' + name + '"] canvas');
    attachCanvasBrush(canv, shared, () => {
      const chart = charts[MAP[name]];
      return (box, path, useBox) => {
        const hits = [];
        chart.data.datasets.forEach((ds, di) => {
          if (ds._trueIndex === undefined) return;
          const meta = chart.getDatasetMeta(di);
          for (let i = 0; i < meta.data.length; i++) {
            const pt = meta.data[i];
            if (pt.x === undefined || isNaN(pt.x)) continue;
            if ((useBox && inBox(pt.x, pt.y, box)) ||
                (!useBox && inLasso({ x: pt.x, y: pt.y }, path))) {
              hits.push(ds._trueIndex); break;
            }
          }
        });
        return hits;
      };
    });
  });

  function update(full) {
    if (full) {
      const ds = { data: [], trend: [], season: [], remainder: [] };
      let labels = null;
      shared.state.series.forEach((d, i) => {
        if (shared.state.isSeriesHidden(d)) return;
        const rws = dict()[d._canonicalId] || [];
        if (!rws.length) return;
        if (!labels) labels = rws.map(r => r[timeVar]);
        const st = shared.getStyle(d, i);
        const mk = arr => ({
          data: arr, borderColor: st.c, backgroundColor: st.c, borderWidth: st.w,
          order: st.o, pointRadius: 0, pointHitRadius: 5, tension: 0, fill: false,
          _trueIndex: i
        });
        ds.data.push(mk(rws.map(r => r[targetVar])));
        ds.trend.push(mk(rws.map(r => r.trend)));
        ds.season.push(mk(rws.map(r => r[seasonVar])));
        ds.remainder.push(mk(rws.map(r => r.remainder)));
      });
      Object.keys(charts).forEach(k => {
        charts[k].data.labels = labels || [];
        charts[k].data.datasets = ds[k];
        charts[k].update('none');
      });
    } else {
      Object.values(charts).forEach(chart => {
        chart.data.datasets.forEach(dsi => {
          if (dsi._trueIndex === undefined) return;
          const st = shared.getStyle(shared.state.series[dsi._trueIndex], dsi._trueIndex);
          dsi.borderColor = st.c; dsi.backgroundColor = st.c;
          dsi.borderWidth = st.w; dsi.order = st.o;
        });
        chart.update('none');
      });
    }
  }

  function resize(force = false) {
    const width = Math.round(content.clientWidth);
    const height = Math.round(content.clientHeight);
    if (!force && width === lastWidth && height === lastHeight) return;
    lastWidth = width;
    lastHeight = height;
    Object.values(charts).forEach(chart => chart.resize());
  }

  return {
    update,
    resize,
    destroy() {
      Object.values(charts).forEach(chart => chart.destroy());
    }
  };
}

// ---------------- gig_point renderer ----------------
function renderPoint(content, x, shared) {
  const rows = safeConvert(x.data);
  const sample = rows[0] || {};
  const features = Object.keys(sample).filter(k => typeof sample[k] === 'number');
  const feats = {
    X: (x.xvar && features.includes(x.xvar)) ? x.xvar : features[0],
    Y: (x.yvar && features.includes(x.yvar)) ? x.yvar : (features[1] || features[0])
  };
  let pointIndexMap = [];
  let hasUserZoomed = false;
  let clickMoved = false;
  let lastGridWidth = -1;
  let lastGridHeight = -1;

  content.innerHTML =
    '<div class="gig-scatter-grid">' +
    '<div class="gig-y-axis-area"><select class="gig-axis-select" data-role="featY"></select></div>' +
    '<div class="gig-chart-wrap"><canvas></canvas></div>' +
    '<div class="gig-x-axis-area"><select class="gig-axis-select" data-role="featX"></select></div>' +
    '</div>';

  ['featX', 'featY'].forEach(role => {
    const sel = content.querySelector('[data-role="' + role + '"]');
    features.forEach(f => {
      const op = document.createElement('option');
      op.value = f; op.text = f;
      if ((role === 'featX' && f === feats.X) || (role === 'featY' && f === feats.Y)) op.selected = true;
      sel.appendChild(op);
    });
    sel.addEventListener('change', e => {
      if (role === 'featX') feats.X = e.target.value; else feats.Y = e.target.value;
      hasUserZoomed = false;
      update(true);
    });
  });

  const canv = content.querySelector('.gig-chart-wrap canvas');
  const chart = new Chart(canv, {
    type: 'scatter',
    data: { datasets: [{ data: [], backgroundColor: [], pointRadius: [], pointHitRadius: 6 }] },
    options: {
      // Fridge owns the canvas dimensions. Chart.js automatic responsive
      // sizing would otherwise change the wrapper, trigger ResizeObserver,
      // and start a layout feedback loop.
      responsive: false, maintainAspectRatio: false, animation: false,
      scales: {
        x: { type: 'linear', ticks: { font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } },
        y: { type: 'linear', ticks: { font: { weight: 'bold' } }, grid: { color: 'rgba(0,0,0,0.05)' }, border: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: false, mode: 'nearest', intersect: true,
          external: ctx => {
            const { tooltip } = ctx;
            const tt = shared.tooltipEl;
            if (tooltip.opacity === 0) { tt.style.opacity = 0; return; }
            if (tooltip.dataPoints && tooltip.dataPoints.length) {
              const dp = tooltip.dataPoints[0];
              const i = pointIndexMap[dp.dataIndex];
              const d = shared.state.series[i];
              if (d) {
                const col = chart.data.datasets[0].backgroundColor[dp.dataIndex];
                tt.innerHTML = '<div style="font-weight:bold;margin-bottom:4px;">' +
                  '<span class="gig-tooltip-swatch" style="background:' + col + '"></span>' +
                  shared.state.label(d) + '</div>' +
                  '<div>' + feats.X + ': ' + fmt(dp.parsed.x) + '</div>' +
                  '<div>' + feats.Y + ': ' + fmt(dp.parsed.y) + '</div>';
              }
            }
            const r = canv.getBoundingClientRect();
            tt.style.opacity = 1;
            tt.style.left = (r.left + tooltip.caretX) + 'px';
            tt.style.top = (r.top + tooltip.caretY) + 'px';
          }
        }
      },
      onClick: (e, els) => {
        if (shared.tools.box || shared.tools.lasso || clickMoved) return;
        if (!els.length) { shared.select(-1, false); return; }
        const i = pointIndexMap[els[0].index];
        if (i !== undefined) shared.select(i, e.native ? e.native.shiftKey : false);
      }
    }
  });

  // zoom + pan (linkvis)
  let isPanning = false, sx0, sy0;
  shared.listen(canv, 'wheel', e => {
    if (shared.tools.box || shared.tools.lasso) return;
    e.preventDefault();
    hasUserZoomed = true;
    const f = e.deltaY > 0 ? 1.1 : 0.9;
    const xa = chart.scales.x, ya = chart.scales.y;
    if (!xa || !ya) return;
    const xd = xa.getValueForPixel(e.offsetX), yd = ya.getValueForPixel(e.offsetY);
    const xr = xa.max - xa.min, yr = ya.max - ya.min;
    const xp = (xd - xa.min) / xr, yp = (yd - ya.min) / yr;
    chart.options.scales.x.min = xd - xr * f * xp;
    chart.options.scales.x.max = xd + xr * f * (1 - xp);
    chart.options.scales.y.min = yd - yr * f * yp;
    chart.options.scales.y.max = yd + yr * f * (1 - yp);
    chart.update('none');
  }, { passive: false });
  shared.listen(canv, 'mousedown', e => {
    if (shared.tools.box || shared.tools.lasso) return;
    isPanning = true; clickMoved = false;
    sx0 = e.offsetX; sy0 = e.offsetY;
  });
  shared.listen(window, 'mousemove', e => {
    if (!isPanning) return;
    const r = canv.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    if (Math.abs(cx - sx0) < 2 && Math.abs(cy - sy0) < 2) return;
    clickMoved = true; hasUserZoomed = true;
    const xa = chart.scales.x, ya = chart.scales.y;
    if (!xa || !ya) return;
    const dx = (xa.max - xa.min) / xa.width * (cx - sx0);
    const dy = (ya.max - ya.min) / ya.height * (cy - sy0);
    chart.options.scales.x.min = xa.min - dx;
    chart.options.scales.x.max = xa.max - dx;
    chart.options.scales.y.min = ya.min + dy;
    chart.options.scales.y.max = ya.max + dy;
    sx0 = cx; sy0 = cy;
    chart.update('none');
  });
  shared.listen(window, 'mouseup', () => { isPanning = false; });
  shared.listen(canv, 'mouseleave', () => { isPanning = false; });

  attachCanvasBrush(canv, shared, () => (box, path, useBox) => {
    const hits = [];
    const meta = chart.getDatasetMeta(0);
    for (let i = 0; i < meta.data.length; i++) {
      const pt = meta.data[i];
      if (pt.x === undefined || isNaN(pt.x)) continue;
      if ((useBox && inBox(pt.x, pt.y, box)) ||
          (!useBox && inLasso({ x: pt.x, y: pt.y }, path))) {
        if (pointIndexMap[i] !== undefined) hits.push(pointIndexMap[i]);
      }
    }
    return hits;
  });

  shared.resetFns.push(() => {
    hasUserZoomed = false;
    delete chart.options.scales.x.min; delete chart.options.scales.x.max;
    delete chart.options.scales.y.min; delete chart.options.scales.y.max;
  });

  function update(full) {
    if (full) {
      const pts = [], cols = [], rads = [];
      pointIndexMap = [];
      let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
      shared.state.series.forEach((d, i) => {
        if (shared.state.isSeriesHidden(d)) return;
        const px = +d[feats.X], py = +d[feats.Y];
        if (isNaN(px) || isNaN(py)) return;
        if (px < mnx) mnx = px; if (px > mxx) mxx = px;
        if (py < mny) mny = py; if (py > mxy) mxy = py;
        const st = shared.getStyle(d, i);
        pts.push({ x: px, y: py }); cols.push(st.c); rads.push(st.r);
        pointIndexMap.push(i);
      });
      if (!hasUserZoomed && mnx !== Infinity) {
        let xp = (mxx - mnx) * 0.05; if (xp === 0) xp = 1;
        let yp = (mxy - mny) * 0.05; if (yp === 0) yp = 1;
        chart.options.scales.x.min = mnx - xp; chart.options.scales.x.max = mxx + xp;
        chart.options.scales.y.min = mny - yp; chart.options.scales.y.max = mxy + yp;
      }
      Object.assign(chart.data.datasets[0], { data: pts, backgroundColor: cols, pointRadius: rads });
      chart.update('none');
    } else {
      const cols = [], rads = [];
      pointIndexMap.forEach(i => {
        const st = shared.getStyle(shared.state.series[i], i);
        cols.push(st.c); rads.push(st.r);
      });
      chart.data.datasets[0].backgroundColor = cols;
      chart.data.datasets[0].pointRadius = rads;
      chart.update('none');
    }
  }

  function resize(force = false) {
    const style = window.getComputedStyle(content);
    const number = property => Number.parseFloat(style[property]) || 0;
    const availableWidth = Math.max(
      0,
      content.clientWidth - number('paddingLeft') - number('paddingRight')
    );
    const availableHeight = Math.max(
      0,
      content.clientHeight - number('paddingTop') - number('paddingBottom')
    );
    const yGutter = 44;
    const xGutter = 36;
    const side = Math.max(
      0,
      Math.floor(Math.min(
        availableWidth - yGutter,
        availableHeight - xGutter
      ))
    );
    if (side < 1) return;

    const gridWidth = side + yGutter;
    const gridHeight = side + xGutter;
    if (!force && gridWidth === lastGridWidth && gridHeight === lastGridHeight) {
      return;
    }
    lastGridWidth = gridWidth;
    lastGridHeight = gridHeight;

    const grid = content.querySelector('.gig-scatter-grid');
    const wrap = content.querySelector('.gig-chart-wrap');
    grid.style.width = gridWidth + 'px';
    grid.style.height = gridHeight + 'px';
    wrap.style.width = side + 'px';
    wrap.style.height = side + 'px';
    chart.resize(side, side);
  }

  return {
    update,
    resize,
    destroy() {
      chart.destroy();
    }
  };
}

// Legacy implementation retained only for source compatibility during this
// transition. It is not called: fridge uses ggelatoAPI.renderSunburst above.
function renderSunburstLegacy(content, x, shared) {
  shared.hasSunburst = true;
  let treeNodes = null, radiusStep = 55;
  let treeX = 0, treeY = 0, treeZoom = 1;

  content.innerHTML =
    '<div class="gig-sun-wrap">' +
    '<svg viewBox="-250 -250 500 500" preserveAspectRatio="xMidYMid meet">' +
    '<rect x="-2500" y="-2500" width="5000" height="5000" fill="transparent"></rect>' +
    '<g class="gig-tree-group"></g></svg></div>';
  const svg = content.querySelector('svg');
  const wrap = content.querySelector('.gig-sun-wrap');

  function initTree() {
    let maxDepth = 0;
    const flat = [];
    shared.state.series.forEach((d, i) => {
      if (shared.state.isSeriesHidden(d)) return;
      flat.push({ ...d, _gIdx: i, children: [] });
    });
    const roots = [];
    flat.forEach(n => {
      if (n._depth > maxDepth) maxDepth = n._depth;
      if (n._depth > 0) {
        const p = flat.find(m => m._id === n._parentId && m._depth === n._depth - 1);
        if (p) p.children.push(n); else roots.push(n);
      } else roots.push(n);
    });
    let hr;
    if (roots.length > 1) hr = { _id: 'VIRTUAL_ROOT', _depth: -1, children: roots };
    else if (roots.length === 1) hr = roots[0];
    else { treeNodes = []; return; }
    radiusStep = Math.min(55, 170 / (maxDepth + 1));
    const rootD3 = d3.hierarchy(hr)
      .sum(d => (d.children && d.children.length > 0) ? 0 : 1)
      .sort((a, b) => b.value - a.value);
    const virt = roots.length > 1;
    d3.partition().size([2 * Math.PI, 1])(rootD3);
    treeNodes = rootD3.descendants()
      .filter(d => d.data._id !== 'VIRTUAL_ROOT')
      .map(d => {
        const rd = virt ? d.depth - 1 : d.depth;
        d.y0 = rd === 0 ? 0 : rd * radiusStep;
        d.y1 = (rd + 1) * radiusStep;
        return d;
      });
  }

  function render() {
    if (!treeNodes) return;
    const g = d3.select(content).select('.gig-tree-group');
    g.selectAll('*').remove();
    const arc = d3.arc().startAngle(d => d.x0).endAngle(d => d.x1)
      .innerRadius(d => d.y0).outerRadius(d => d.y1).padAngle(0);
    const nodes = g.selectAll('g').data(treeNodes).enter().append('g');
    nodes.append('path')
      .attr('class', 'gig-tree-node')
      .attr('data-gidx', d => d.data._gIdx)
      .attr('d', arc)
      .on('click', (e, d) => {
        e.stopPropagation();
        if (shared.tools.box || shared.tools.lasso) return;
        shared.select(d.data._gIdx, e.shiftKey);
      })
      .on('mousemove', (e, d) => {
        const tt = shared.tooltipEl;
        tt.innerHTML = '<div style="font-weight:bold;">' + shared.state.label(d.data) + '</div>';
        tt.style.opacity = 1;
        tt.style.left = (e.clientX + 12) + 'px';
        tt.style.top = (e.clientY + 12) + 'px';
      })
      .on('mouseleave', () => { shared.tooltipEl.style.opacity = 0; });
    nodes.append('text')
      .attr('class', 'gig-tree-label' + (shared.labelsOn.v ? ' visible' : ''))
      .attr('transform', d => {
        if (d.data._depth === 0) return '';
        const a = (d.x0 + d.x1) / 2;
        const r = d.children ? (d.y0 + d.y1) / 2 : d.y1 + 5;
        let rot = (a * 180 / Math.PI) - 90;
        if (rot > 90 && rot < 270) rot += 180;
        return 'translate(' + (r * Math.sin(a)) + ',' + (-r * Math.cos(a)) + ') rotate(' + rot + ')';
      })
      .attr('dy', '0.35em')
      .attr('text-anchor', d => {
        if (d.data._depth === 0) return 'middle';
        const rot = ((d.x0 + d.x1) / 2 * 180 / Math.PI) - 90;
        if (!d.children) return (rot > 90 && rot < 270) ? 'end' : 'start';
        return 'middle';
      })
      .text(d => {
        let n = shared.state.label(d.data) || '';
        const mx = !d.children ? 20 : Math.max(3, Math.floor((radiusStep - 8) / 5.4));
        return (d.data._depth > 0 && n.length > mx) ? n.substring(0, mx - 1) + '\u2026' : n;
      })
      .style('font-size', d => (!d.children ? 9 : Math.max(9, 12 - d.data._depth)) + 'px')
      .style('pointer-events', 'none');
    style();
  }

  function style() {
    if (!treeNodes) return;
    treeNodes.forEach(d => {
      const n = content.querySelector('.gig-tree-node[data-gidx="' + d.data._gIdx + '"]');
      if (!n) return;
      const st = shared.getStyle(d.data, d.data._gIdx);
      n.setAttribute('fill', st.c === 'rgba(200,200,200,0.15)' ? '#e2e8f0' : st.c);
      n.setAttribute('stroke', '#fff');
      n.setAttribute('stroke-width', st.w);
    });
    content.querySelectorAll('.gig-tree-label')
      .forEach(l => l.classList.toggle('visible', shared.labelsOn.v));
  }

  const zoomB = d3.zoom().scaleExtent([0.1, 10])
    .filter(e => !(shared.tools.box || shared.tools.lasso) && !e.ctrlKey && !e.button)
    .on('zoom', e => {
      treeX = e.transform.x; treeY = e.transform.y; treeZoom = e.transform.k;
      d3.select(content).select('.gig-tree-group').attr('transform', e.transform);
    });
  d3.select(svg).call(zoomB);
  d3.select(svg).on('click', () => {
    if (shared.tools.box || shared.tools.lasso) return;
    shared.select(-1, false);
  });
  shared.resetFns.push(() => {
    d3.select(svg).call(zoomB.transform, d3.zoomIdentity);
    treeX = 0; treeY = 0; treeZoom = 1;
  });

  // brushing in viewBox coordinates
  const vb = (cx, cy) => {
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / 500, r.height / 500);
    const ox = (r.width - 500 * s) / 2, oy = (r.height - 500 * s) / 2;
    return { x: ((cx - r.left) - ox) / s - 250, y: ((cy - r.top) - oy) / s - 250 };
  };
  let brushing = false, path = [], shape = null;
  svg.addEventListener('mousedown', e => {
    if (!(shared.tools.box || shared.tools.lasso)) return;
    brushing = true;
    path = [vb(e.clientX, e.clientY)];
    shape = document.createElementNS('http://www.w3.org/2000/svg', shared.tools.box ? 'rect' : 'path');
    shape.setAttribute('fill', 'rgba(0,114,178,0.2)');
    shape.setAttribute('stroke', '#0072B2');
    svg.appendChild(shape);
  });
  window.addEventListener('mousemove', e => {
    if (!brushing) return;
    const c = vb(e.clientX, e.clientY);
    path.push(c);
    if (shared.tools.box) {
      shape.setAttribute('x', Math.min(path[0].x, c.x));
      shape.setAttribute('y', Math.min(path[0].y, c.y));
      shape.setAttribute('width', Math.abs(c.x - path[0].x));
      shape.setAttribute('height', Math.abs(c.y - path[0].y));
    } else {
      shape.setAttribute('d', 'M ' + path.map(p => p.x + ',' + p.y).join(' L ') + ' Z');
    }
  });
  window.addEventListener('mouseup', e => {
    if (!brushing) return;
    brushing = false;
    if (shape) { svg.removeChild(shape); shape = null; }
    const useBox = shared.tools.box;
    const box = {
      xMin: Math.min(path[0].x, path[path.length - 1].x),
      xMax: Math.max(path[0].x, path[path.length - 1].x),
      yMin: Math.min(path[0].y, path[path.length - 1].y),
      yMax: Math.max(path[0].y, path[path.length - 1].y)
    };
    const hits = [];
    (treeNodes || []).forEach(d => {
      const a = (d.x0 + d.x1) / 2;
      [ (d.y0 + d.y1) / 2, d.y0 + 5, d.y1 - 5 ].some(rr => {
        const vx = (rr * Math.sin(a)) * treeZoom + treeX;
        const vy = (-rr * Math.cos(a)) * treeZoom + treeY;
        if ((useBox && inBox(vx, vy, box)) || (!useBox && inLasso({ x: vx, y: vy }, path))) {
          hits.push(d.data._gIdx);
          return true;
        }
        return false;
      });
    });
    shared.brush(hits, e.shiftKey);
  });

  function update(full) {
    if (full) { initTree(); render(); }
    else style();
  }
  return { update, resize: () => {} };
}

// Shared pixel-space brushing scaffold for canvas plots
function attachCanvasBrush(canv, shared, makeHitTest) {
  const wrapper = canv.parentElement;
  const bs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(bs.style, {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: 40
  });
  wrapper.style.position = 'relative';
  wrapper.appendChild(bs);

  let brushing = false, path = [], shape = null, sx, sy;
  canv.addEventListener('mousedown', e => {
    if (!(shared.tools.box || shared.tools.lasso)) return;
    brushing = true;
    const r = canv.getBoundingClientRect();
    sx = e.clientX - r.left; sy = e.clientY - r.top;
    path = [{ x: sx, y: sy }];
    shape = document.createElementNS('http://www.w3.org/2000/svg', shared.tools.box ? 'rect' : 'path');
    shape.setAttribute('fill', 'rgba(0,114,178,0.2)');
    shape.setAttribute('stroke', '#0072B2');
    bs.appendChild(shape);
    e.stopPropagation();
  });
  window.addEventListener('mousemove', e => {
    if (!brushing) return;
    const r = canv.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    path.push({ x, y });
    if (shared.tools.box) {
      shape.setAttribute('x', Math.min(sx, x));
      shape.setAttribute('y', Math.min(sy, y));
      shape.setAttribute('width', Math.abs(x - sx));
      shape.setAttribute('height', Math.abs(y - sy));
    } else {
      shape.setAttribute('d', 'M ' + path.map(p => p.x + ',' + p.y).join(' L ') + ' Z');
    }
  });
  window.addEventListener('mouseup', e => {
    if (!brushing) return;
    brushing = false;
    if (shape) { bs.removeChild(shape); shape = null; }
    const last = path[path.length - 1];
    const box = {
      xMin: Math.min(sx, last.x), xMax: Math.max(sx, last.x),
      yMin: Math.min(sy, last.y), yMax: Math.max(sy, last.y)
    };
    const hits = makeHitTest()(box, path, shared.tools.box);
    shared.brush(hits, e.shiftKey);
  });
}

/* =====================================================================
   HTMLWIDGET BINDING
   ===================================================================== */

function hierarchyRows(plots, hierarchy) {
  const keys = parseHierarchy(hierarchy).keys;
  const merged = new Map();

  const valueId = value => {
    if (value === null || value === undefined) return 'AGG';
    const text = String(value).trim();
    return text === '' || text.toLowerCase() === '<aggregated>' ||
      text.toLowerCase() === 'na' ? 'AGG' : text;
  };

  plots.forEach(plot => {
    safeConvert(plot && plot.x ? plot.x.data : null).forEach(row => {
      // Ignore payload rows that do not carry the requested hierarchy.
      if (!keys.some(key => Object.prototype.hasOwnProperty.call(row, key))) return;
      const id = keys.map(key => valueId(row[key])).join('\u0001');
      merged.set(id, { ...(merged.get(id) || {}), ...row });
    });
  });

  return Array.from(merged.values());
}

function renderWidgetError(el, message) {
  el.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fridge-error';
  box.textContent = message;
  el.appendChild(box);
}

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

function createWindowCard(plot, index, title) {
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

function installEditableTitle(meta, onRename, listen) {
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

function installHierarchyMover(panel, windows, root, resizeAll, listen) {
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

function createWindowManager(root, windows, hierarchyMover, resizeAll, listen) {
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

function makeToolbar(root, shared, windows, manager, hierarchyMover, refresh, rebuild, resetDashboard, listen) {
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
  ['single', 'multiple', 'inverse', 'hierarchy'].forEach(mode => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.selectionMode = mode;
    button.textContent = mode.charAt(0).toUpperCase() + mode.slice(1) + ' Selection';
    selectionMenu.appendChild(button);
  });
  selectionWrap.appendChild(selectionButton);
  selectionWrap.appendChild(selectionMenu);
  toolbar.appendChild(selectionWrap);

  const box = toolButton('Box selection', ICON_BOX, 'box');
  const lasso = toolButton('Lasso selection', ICON_LASSO, 'lasso');
  const reset = toolButton('Reset dashboard', ICON_RESET, 'reset');
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

  const hierarchyButton = toolButton('Show or hide the shared hierarchy widget', SVGS.hierarchy, 'hierarchy-panel');
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
    selectionButton.title = shared.selectionMode + ' selection';
    selectionMenu.querySelectorAll('[data-selection-mode]').forEach(button =>
      button.classList.toggle('active-mode', button.dataset.selectionMode === shared.selectionMode));
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
      resetDashboard();
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
    // Use composedPath() rather than event.target.closest(): the toolbar's
    // own click handler (registered above, and fired first since it bubbles
    // from an inner element) may replace a clicked icon's innerHTML (e.g.
    // update() rewriting selectionButton.innerHTML). That detaches the
    // original event.target from the DOM, so .closest() on it can no longer
    // walk up to find the wrapper and would incorrectly treat the click as
    // "outside", closing the menu that was just opened. composedPath() is
    // captured at dispatch time and stays valid even if nodes are removed
    // mid-bubble.
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

function buildFridge(el, value) {
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
  try {
    requireGgelatoAPI();
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
  installRuntimeStyles();
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
    selected: new Set(state.series.map((unused, index) => index)),
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
    selectAllVisible() {
      this.selected.clear();
      this.visibleIndices().forEach(index => this.selected.add(index));
    },
    allVisibleSelected() {
      const visible = this.visibleIndices();
      return visible.length > 0 && visible.every(index => this.selected.has(index));
    },
    prepareStylePass() {
      // Compute this once per redraw. Calling allVisibleSelected() from
      // getStyle() for every mark makes a redraw quadratic in series count.
      this._styleFiltering = !this.allVisibleSelected();
    },
    getStyle(d, index) {
      const base = state.depthColor(d._depth);
      const filtering = Boolean(this._styleFiltering);
      const selected = this.selected.has(index);
      return {
        c: filtering && !selected ? 'rgba(148,163,184,0.22)' : base,
        w: filtering && selected ? 3 : (d._depth === 0 ? 2.2 : 1.3),
        r: filtering && selected ? 7 : (filtering ? 3 : 5),
        o: filtering && selected ? 0 : 100 + d._depth
      };
    },
    select(index, additive) {
      if (index < 0) {
        this.selectAllVisible();
      } else if (this.selectionMode === 'inverse') {
        this.selected.clear();
        const bottomDepth = this.state.displayKeys().length;
        this.state.series.forEach((series, i) => {
          if (i !== index && series._depth === bottomDepth) this.selected.add(i);
        });
      } else if (this.selectionMode === 'hierarchy') {
        if (!additive) this.selected.clear();
        const selected = this.state.series[index];
        if (selected) this.state.series.forEach((series, i) => {
          if (series._id !== selected._id && series._id.indexOf(selected._id + '|') === 0) this.selected.add(i);
        });
      } else if (this.selectionMode === 'multiple' || additive) {
        if (this.selected.has(index)) this.selected.delete(index);
        else this.selected.add(index);
      } else {
        const wasOnly = this.selected.size === 1 && this.selected.has(index);
        this.selected.clear();
        if (wasOnly) this.selectAllVisible();
        else this.selected.add(index);
      }
      refresh(false);
      renderSharedLegend();
    },
    brush(indices, additive) {
      if (!additive && this.selectionMode !== 'multiple') this.selected.clear();
      indices.forEach(index => this.selected.add(index));
      refresh(false);
      renderSharedLegend();
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
      let renderer;
      if (plot.type === 'gig_stldp') renderer = renderStldp(parts.body, plot.x, shared);
      else if (plot.type === 'gig_point') renderer = renderPoint(parts.body, plot.x, shared);
      else if (plot.type === 'gig_sunburst') renderer = renderSunburst(parts.body, plot.x, shared);
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
  const hierarchyAdapter = requireGgelatoAPI().createGigHierarchyAdapter({
    state,
    selectedIndices: shared.selected,
    getTotalDimmed: () => totalDimmed,
    setTotalDimmed: value => { totalDimmed = Boolean(value); },
    onSelectionChange: () => {
      refresh(false);
      renderSharedLegend();
    },
    onStructureChange: () => {
      shared.selectAllVisible();
      rebuild();
      renderSharedLegend();
    },
    onVisibilityChange: () => {
      rebuild();
      renderSharedLegend();
    }
  });
  hierarchyWidget = requireGgelatoAPI().createHierarchyWidget({
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
  // The outer fridge panel owns cross-window dragging. Empty space passes
  // through to it, while chips and menu controls remain interactive.
  hierarchyWidget.container.style.pointerEvents = 'none';
  const manager = createWindowManager(root, windows, hierarchyMover, resizeAll, listen);

  function resetDashboard() {
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
    shared.selectAllVisible();
    shared.resetFns.forEach(fn => fn());
    manager.resetLayout();
    hierarchyMover.reset(initialHierarchyHost);
    renderSharedLegend();
    rebuild();
  }

  const toolbar = makeToolbar(
    root, shared, windows, manager, hierarchyMover,
    refresh, rebuild, resetDashboard, listen
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

HTMLWidgets.widget({
  name: 'fridge',
  type: 'output',
  factory(el) {
    let instance = null;
    return {
      renderValue(value) {
        if (instance && instance.destroy) instance.destroy();
        instance = buildFridge(el, value);
      },
      resize() {
        if (instance && instance.resize) instance.resize();
      }
    };
  }
});
