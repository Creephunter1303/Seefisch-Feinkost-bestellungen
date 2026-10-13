// Kleiner DOM-Baukasten ohne Framework.
//   h('div', { class: 'x', onclick: fn }, 'Text', kindElement, [weitere, kinder])
// Texte werden immer als Text eingefügt, nie als HTML – Kundeneingaben können so
// nichts an der Oberfläche kaputt machen.

export function h(tag, attrs, ...kinder) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  anhaengen(el, kinder);
  return el;
}

function anhaengen(el, kinder) {
  for (const k of kinder) {
    if (k === null || k === undefined || k === false || k === '') continue;
    if (Array.isArray(k)) anhaengen(el, k);
    else if (k instanceof Node) el.appendChild(k);
    else el.appendChild(document.createTextNode(String(k)));
  }
}

/** Kurze Vibration als Tipp-Rückmeldung (wo das Gerät es kann). */
export function vibrieren(muster) {
  try { if (navigator.vibrate) navigator.vibrate(muster); } catch (e) { /* egal */ }
}

// ---------- Einblendung unten („Toast") mit optionaler Aktion, z. B. „Rückgängig" ----------

let toastTimer = null;

export function toast(text, { aktion = null, dauer = 4000, art = '' } = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(toastTimer);
  el.className = 'toast' + (art ? ' toast-' + art : '');
  el.replaceChildren(h('span', { class: 'toast-text' }, text));
  if (aktion) {
    el.appendChild(h('button', {
      type: 'button',
      class: 'toast-knopf',
      onclick: () => { toastAusblenden(); aktion.fn(); },
    }, aktion.text));
  }
  el.hidden = false;
  toastTimer = setTimeout(toastAusblenden, dauer);
}

export function toastAusblenden() {
  const el = document.getElementById('toast');
  clearTimeout(toastTimer);
  if (el) el.hidden = true;
}
