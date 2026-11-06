// Convierte entre texto plano y canciones. El texto es el formato para compartir:
// viaja bien por WhatsApp y funciona igual en cualquier teléfono.
//
//   Setlist: Show del viernes
//   1. Canción uno | 120 | 4/4
//   2. Canción dos

export const SIGNATURES = ['4/4', '3/4', '2/4', '5/4', '6/8', '7/8', '9/8', '12/8'];
export const MIN_BPM = 20;
export const MAX_BPM = 300;

const validBpm = (n) => (n >= MIN_BPM && n <= MAX_BPM ? n : null);

function parseLine(raw) {
  // Solo se quita la numeración con separador: "99 Problems" y "1979" son nombres.
  let line = raw.trim().replace(/^(?:[-*•]\s+|\d{1,3}\s*[.)]\s+)/, '');
  let bpm = null;
  let sig = '4/4';

  const parts = line.split(/\s*[|\t;]\s*/);
  if (parts.length > 1) {
    line = parts[0];
    for (const part of parts.slice(1)) {
      if (SIGNATURES.includes(part)) sig = part;
      else if (/^\d{2,3}(\s*bpm)?$/i.test(part)) bpm = validBpm(parseInt(part, 10));
    }
  } else {
    const match = line.match(/^(.*?)[\s,:(-]+(\d{2,3})\s*bpm\)?$/i);
    if (match) {
      line = match[1];
      bpm = validBpm(parseInt(match[2], 10));
    }
  }

  const name = line.trim();
  return name ? { name, bpm, sig } : null;
}

export function parseList(text) {
  let title = '';
  const songs = [];
  for (const raw of text.split(/\r?\n/)) {
    const titleMatch = raw.match(/^\s*setlist\s*:\s*(.+)$/i);
    if (titleMatch) {
      title ||= titleMatch[1].trim();
      continue;
    }
    const song = parseLine(raw);
    if (song) songs.push(song);
  }
  return { title, songs };
}

export function formatList(setlist) {
  const lines = setlist.songs.map((song, i) => {
    const pulse = song.bpm ? ` | ${song.bpm} | ${song.sig}` : '';
    return `${i + 1}. ${song.name}${pulse}`;
  });
  return [`Setlist: ${setlist.name}`, ...lines].join('\n');
}
