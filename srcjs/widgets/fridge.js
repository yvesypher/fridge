import { buildFridge } from '../modules/fridge/fridge-platform.js';

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
