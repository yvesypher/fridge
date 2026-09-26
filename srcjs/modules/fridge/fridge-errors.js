export function renderWidgetError(el, message) {
  el.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'fridge-error';
  box.textContent = message;
  el.appendChild(box);
}
