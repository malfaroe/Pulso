import { Metronome } from './metronome.js';
import { parseList, formatList, SIGNATURES, MIN_BPM, MAX_BPM } from './lista.js';

const KEY = 'pulso.v1';
const $ = (id) => document.getElementById(id);
const app = $('app');
const metronome = new Metronome();

const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.4 5.4 14 4l-8 8 8 8 1.4-1.4L8.8 12z"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.2V21h3.8L17.9 9.9l-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z"/></svg>',
  grip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v2H4zm0 4h16v2H4zm0 4h16v2H4z"/></svg>',
  play: '<svg class="i-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8z"/></svg>',
  stop: '<svg class="i-stop" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z"/></svg>',
};

/* ---------- Datos ---------- */

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? { setlists: [] };
  } catch {
    return { setlists: [] };
  }
}

const state = load();
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const newId = () => crypto.randomUUID();
const makeSong = ({ name, bpm = null, sig = '4/4' }) => ({ id: newId(), name, bpm, sig });
const beatsOf = (song) => parseInt(song.sig, 10);
const findSetlist = (id) => state.setlists.find((s) => s.id === id);

let playingId = null;
let current = null; // setlist abierto

const esc = (text) =>
  String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const countSongs = (n) => (n === 1 ? '1 canción' : `${n} canciones`);

let toastTimer;
function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Vistas ---------- */

function route() {
  stopClick();
  const match = location.hash.match(/^#\/s\/(.+)$/);
  current = match ? findSetlist(match[1]) ?? null : null;
  render();
  scrollTo(0, 0);
}

function render() {
  app.innerHTML = current ? setlistView(current) : homeView();
  syncPlaying();
}

function homeView() {
  const rows = state.setlists
    .map((s) => {
      const missing = s.songs.filter((song) => !song.bpm).length;
      const detail = countSongs(s.songs.length);
      return `<li class="setlist-row" data-id="${s.id}">
        <a href="#/s/${s.id}"><strong>${esc(s.name)}</strong>
          <small>${detail}${missing ? ` · ${missing} sin pulso` : ''}</small></a>
        <button class="icon-btn" data-action="duplicate" aria-label="Duplicar ${esc(s.name)}">${ICON.copy}</button>
        <button class="icon-btn" data-action="delete-setlist" aria-label="Eliminar ${esc(s.name)}">${ICON.trash}</button>
      </li>`;
    })
    .join('');
  return `<header class="top"><h1>Pulso</h1></header>
    <div class="toolbar">
      <button class="btn primary" data-action="new-setlist">Nuevo setlist</button>
      <button class="btn" data-action="import-new">Importar lista</button>
    </div>
    ${rows ? `<ul class="list">${rows}</ul>` : `<p class="empty"><strong>Aún no hay setlists</strong>Crea uno o importa la lista que te enviaron.</p>`}`;
}

function songRow(song) {
  const bpm = song.bpm
    ? `<span class="song-bpm"><b>${song.bpm}</b><span>BPM</span></span>`
    : `<span class="song-bpm missing">Agregar pulso</span>`;
  return `<li class="song" data-id="${song.id}">
    <button class="handle" aria-label="Arrastrar ${esc(song.name)}">${ICON.grip}</button>
    <button class="song-info" data-action="edit-song">
      <span class="song-text"><span class="song-name">${esc(song.name)}</span>
        <span class="song-sig">${song.sig}</span></span>
      ${bpm}
    </button>
    <button class="play" data-action="toggle" ${song.bpm ? '' : 'disabled'} aria-label="Tocar pulso de ${esc(song.name)}">${ICON.play}${ICON.stop}</button>
  </li>`;
}

function setlistView(setlist) {
  const rows = setlist.songs.map(songRow).join('');
  return `<header class="top">
      <a class="icon-btn" href="#/" aria-label="Volver a setlists">${ICON.back}</a>
      <h1>${esc(setlist.name)}</h1>
      <button class="icon-btn" data-action="rename" aria-label="Cambiar nombre">${ICON.pencil}</button>
    </header>
    <div class="toolbar">
      <button class="btn primary" data-action="add-song">Agregar canción</button>
      <button class="btn" data-action="import-here">Importar</button>
      <button class="btn" data-action="share">Compartir</button>
    </div>
    ${rows ? `<ul class="list" id="songs">${rows}</ul>` : `<p class="empty"><strong>Setlist vacío</strong>Agrega canciones o importa una lista.</p>`}`;
}

function syncPlaying() {
  for (const row of app.querySelectorAll('.song')) {
    const on = row.dataset.id === playingId;
    row.classList.toggle('playing', on);
    const button = row.querySelector('.play');
    const name = row.querySelector('.song-name').textContent;
    button.setAttribute('aria-label', `${on ? 'Detener' : 'Tocar'} pulso de ${name}`);
  }
}

/* ---------- Click ---------- */

function stopClick() {
  metronome.stop();
  playingId = null;
}

function toggle(song) {
  if (playingId === song.id) stopClick();
  else {
    metronome.start({ bpm: song.bpm, beats: beatsOf(song) });
    playingId = song.id;
  }
  syncPlaying();
}

/* ---------- Canción ---------- */

let editing = null; // canción en edición; null si es nueva

function openSong(song = null) {
  editing = song;
  $('song-title').textContent = song ? 'Editar canción' : 'Nueva canción';
  $('song-name').value = song?.name ?? '';
  $('song-bpm').value = song?.bpm ?? '';
  $('song-sig').value = song?.sig ?? '4/4';
  $('song-another').hidden = !!song;
  $('song-delete').hidden = !song;
  $('song-dialog').showModal();
  // Una canción importada solo necesita su pulso: el foco parte ahí.
  if (song && !song.bpm) $('song-bpm').focus();
}

function saveSong(another) {
  const name = $('song-name').value.trim();
  const raw = $('song-bpm').value;
  const bpm = raw === '' ? null : Number(raw);
  const sig = $('song-sig').value;
  if (!name) return;

  if (editing) {
    Object.assign(editing, { name, bpm, sig });
    if (editing.id === playingId) {
      if (bpm) metronome.update({ bpm, beats: beatsOf(editing) });
      else stopClick();
    }
  } else {
    current.songs.push(makeSong({ name, bpm, sig }));
  }
  save();
  render();
  if (another) {
    $('song-form').reset();
    $('song-name').focus();
  } else {
    $('song-dialog').close();
  }
}

function deleteSong() {
  if (!confirm(`¿Eliminar "${editing.name}"?`)) return;
  if (editing.id === playingId) stopClick();
  current.songs = current.songs.filter((s) => s !== editing);
  save();
  $('song-dialog').close();
  render();
}

/* ---------- Setlists ---------- */

let renaming = false;

function openName(rename) {
  renaming = rename;
  $('name-title').textContent = rename ? 'Cambiar nombre' : 'Nuevo setlist';
  $('name-input').value = rename ? current.name : '';
  $('name-dialog').showModal();
}

function saveName() {
  const name = $('name-input').value.trim();
  if (!name) return;
  if (renaming) {
    current.name = name;
    save();
    render();
  } else {
    const setlist = { id: newId(), name, songs: [] };
    state.setlists.unshift(setlist);
    save();
    location.hash = `#/s/${setlist.id}`;
  }
}

function duplicate(setlist) {
  const copy = {
    id: newId(),
    name: `${setlist.name} (copia)`,
    songs: setlist.songs.map(makeSong),
  };
  state.setlists.splice(state.setlists.indexOf(setlist) + 1, 0, copy);
  save();
  render();
}

function deleteSetlist(setlist) {
  if (!confirm(`¿Eliminar el setlist "${setlist.name}"?`)) return;
  state.setlists = state.setlists.filter((s) => s !== setlist);
  save();
  render();
}

/* ---------- Importar y compartir ---------- */

function openImport() {
  $('import-form').reset();
  $('import-name-field').hidden = !!current;
  refreshImport();
  $('import-dialog').showModal();
}

function refreshImport() {
  const { title, songs } = parseList($('import-text').value);
  if (!current && title && !$('import-name').value) $('import-name').value = title;
  const needsName = !current && !$('import-name').value.trim();
  $('import-count').textContent = songs.length
    ? `${countSongs(songs.length)} para importar`
    : '';
  $('import-go').disabled = !songs.length || needsName;
}

function runImport() {
  const { songs } = parseList($('import-text').value);
  if (current) {
    current.songs.push(...songs.map(makeSong));
    save();
    render();
  } else {
    const setlist = { id: newId(), name: $('import-name').value.trim(), songs: songs.map(makeSong) };
    state.setlists.unshift(setlist);
    save();
    location.hash = `#/s/${setlist.id}`;
  }
}

async function share() {
  const text = formatList(current);
  if (navigator.share) {
    try {
      await navigator.share({ title: current.name, text });
    } catch (error) {
      if (error.name !== 'AbortError') toast('No se pudo compartir');
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Lista copiada');
  } catch {
    toast('No se pudo copiar la lista');
  }
}

/* ---------- Arrastrar ---------- */

function startDrag(handle, event) {
  const row = handle.closest('.song');
  const list = row.parentElement;
  const grab = event.clientY - row.getBoundingClientRect().top;
  let y = event.clientY;
  let frame;

  handle.setPointerCapture(event.pointerId);
  row.classList.add('dragging');

  const place = () => {
    let next;
    while ((next = row.nextElementSibling)) {
      const r = next.getBoundingClientRect();
      if (y <= r.top + r.height / 2) break;
      list.insertBefore(next, row);
    }
    let prev;
    while ((prev = row.previousElementSibling)) {
      const r = prev.getBoundingClientRect();
      if (y >= r.top + r.height / 2) break;
      list.insertBefore(row, prev);
    }
    const top = y - list.getBoundingClientRect().top - grab;
    row.style.transform = `translateY(${top - row.offsetTop}px)`;
  };

  // Mantener el dedo cerca del borde desplaza la lista, para setlists largos.
  const autoScroll = () => {
    const edge = 90;
    if (y < edge) scrollBy(0, -8);
    else if (y > innerHeight - edge) scrollBy(0, 8);
    place();
    frame = requestAnimationFrame(autoScroll);
  };
  frame = requestAnimationFrame(autoScroll);

  const move = (e) => { y = e.clientY; };
  const end = () => {
    cancelAnimationFrame(frame);
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
    const order = [...list.children].map((li) => li.dataset.id);
    current.songs.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    save();
    render();
  };
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

/* ---------- Eventos ---------- */

app.addEventListener('pointerdown', (event) => {
  const handle = event.target.closest('.handle');
  if (!handle) return;
  event.preventDefault();
  startDrag(handle, event);
});

app.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.closest('[data-id]')?.dataset.id;
  const song = current?.songs.find((s) => s.id === id);
  const setlist = findSetlist(id);

  switch (button.dataset.action) {
    case 'toggle': toggle(song); break;
    case 'edit-song': openSong(song); break;
    case 'add-song': openSong(); break;
    case 'new-setlist': openName(false); break;
    case 'rename': openName(true); break;
    case 'duplicate': duplicate(setlist); break;
    case 'delete-setlist': deleteSetlist(setlist); break;
    case 'import-new':
    case 'import-here': openImport(); break;
    case 'share': share(); break;
  }
});

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-close]')) dialog.close();
  });
}

$('song-sig').innerHTML = SIGNATURES.map((s) => `<option>${s}</option>`).join('');
$('song-bpm').min = MIN_BPM;
$('song-bpm').max = MAX_BPM;

$('song-form').addEventListener('submit', (event) => {
  event.preventDefault(); // "Guardar y agregar otra" deja el diálogo abierto
  saveSong(event.submitter?.value === 'another');
});
$('song-delete').addEventListener('click', deleteSong);
document.querySelector('.stepper').addEventListener('click', (event) => {
  const step = Number(event.target.dataset.step);
  if (!step) return;
  const input = $('song-bpm');
  const value = input.value === '' ? 120 : Number(input.value) + step;
  input.value = Math.min(MAX_BPM, Math.max(MIN_BPM, value));
});

$('name-form').addEventListener('submit', saveName);

$('import-form').addEventListener('submit', runImport);
$('import-text').addEventListener('input', refreshImport);
$('import-name').addEventListener('input', refreshImport);
$('import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  $('import-text').value = await file.text();
  refreshImport();
});

window.addEventListener('hashchange', route);

navigator.storage?.persist?.();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

route();
