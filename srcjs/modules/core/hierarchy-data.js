import { parseHierarchy, safeConvert } from './ggelato-adapter.js';

export function hierarchyRows(plots, hierarchy) {
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

      if (!keys.some(key => Object.prototype.hasOwnProperty.call(row, key))) return;
      const id = keys.map(key => valueId(row[key])).join('\u0001');
      merged.set(id, { ...(merged.get(id) || {}), ...row });
    });
  });

  return Array.from(merged.values());
}
