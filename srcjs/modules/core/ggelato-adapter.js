export const TOTAL_KEY = '__total__';

export function requireGgelatoAPI() {
  const api = window.ggelatoAPI;
  if (!api) {
    throw new Error(
      'ggelatoAPI is not loaded. Reinstall ggelato before rebuilding fridge.'
    );
  }
  return api;
}

function requireRenderer(name) {
  const api = requireGgelatoAPI();
  const fn = api[name];
  if (typeof fn !== 'function') {
    throw new Error(
      'The installed ggelato does not provide ' + name + '() ' +
      '(api build: ' + (api.build || 'unknown') + '). Available keys: ' +
      Object.keys(api).join(', ') + '. Rebuild and reinstall ggelato, ' +
      'then rebuild fridge.'
    );
  }
  return fn;
}

const RENDERER_NAMES = {
  gig_stldp: 'renderStldp',
  gig_point: 'renderPoint',
  gig_sunburst: 'renderSunburst'
};

export function renderGgelatoPlot(type, content, x, shared) {
  const rendererName = RENDERER_NAMES[type];
  if (!rendererName) {
    throw new Error('fridge does not know the ggelato renderer for "' + type + '".');
  }
  return requireRenderer(rendererName)(content, x, shared);
}

export function safeConvert(data) {
  return requireGgelatoAPI().dataFrameToRows(data);
}

export function createHierState(rows, structure, excludeKeys) {
  return requireGgelatoAPI().createHierState(rows, structure, excludeKeys);
}

export function parseHierarchy(structure) {
  const parsed = requireGgelatoAPI().parseStructure(structure);
  return { keys: parsed.activeKeys, constraints: parsed.constraints };
}
