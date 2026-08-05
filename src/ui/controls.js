/**
 * controls.js
 * Reusable UI control components.
 * Minimal scientific instrument style.
 */

export function createSlider(id, label, min, max, value, step = 1, unit = '') {
  const wrapper = document.createElement('div');
  wrapper.style.marginBottom = '12px';

  const lab = document.createElement('label');
  lab.textContent = label;
  lab.style.display = 'block';
  lab.style.fontSize = '11px';
  lab.style.color = '#6b7d6b';
  lab.style.marginBottom = '4px';

  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '8px';

  const input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = min;
  input.max = max;
  input.step = step;
  input.value = value;
  input.style.flex = '1';
  input.style.accentColor = '#2f8a52';

  const val = document.createElement('span');
  val.style.fontSize = '12px';
  val.style.color = '#5cf28c';
  val.style.minWidth = '48px';
  val.textContent = value + unit;

  input.addEventListener('input', () => {
    val.textContent = input.value + unit;
  });

  row.appendChild(input);
  row.appendChild(val);
  wrapper.appendChild(lab);
  wrapper.appendChild(row);

  return { wrapper, input, val };
}

export function createSelect(id, label, options, selected) {
  const wrapper = document.createElement('div');
  wrapper.style.marginBottom = '14px';

  const lab = document.createElement('label');
  lab.textContent = label.toUpperCase();
  lab.style.fontSize = '10px';
  lab.style.letterSpacing = '0.08em';
  lab.style.color = '#6b7d6b';
  lab.style.display = 'block';
  lab.style.marginBottom = '4px';

  const sel = document.createElement('select');
  sel.id = id;
  sel.style.width = '100%';
  sel.style.background = '#080b08';
  sel.style.border = '1px solid #1c2b1c';
  sel.style.color = '#c9d6c9';
  sel.style.padding = '8px 10px';
  sel.style.fontFamily = 'inherit';

  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === selected) o.selected = true;
    sel.appendChild(o);
  });

  wrapper.appendChild(lab);
  wrapper.appendChild(sel);
  return { wrapper, select: sel };
}

export function createButton(text, variant = 'action') {
  const btn = document.createElement('button');
  btn.textContent = text;
  if (variant === 'action') {
    btn.className = 'action';
  } else {
    btn.className = 'ghost';
  }
  return btn;
}
