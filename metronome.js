// Metrónomo con Web Audio. Los clicks se agendan por adelantado en el reloj de
// audio, así el pulso no depende de los timers de JavaScript. El timer corre en
// un Worker porque el navegador frena los del hilo principal en segundo plano.

const LOOKAHEAD = 0.12; // segundos agendados por adelantado
const TICK_MS = 25;

const WORKER_SRC = `
  let id = null;
  onmessage = (e) => {
    clearInterval(id);
    if (e.data === 'start') id = setInterval(() => postMessage(0), ${TICK_MS});
  };
`;

function makeClick(ctx, freq, gain) {
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    const t = i / ctx.sampleRate;
    const tone = Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2.71 * t);
    data[i] = (gain / 1.3) * tone * Math.exp(-t / 0.009);
  }
  return buffer;
}

export class Metronome {
  bpm = 120;
  beats = 4;
  running = false;
  #ctx = null;
  #worker = null;
  #bus = null;
  #accent = null;
  #normal = null;
  #beat = 0;
  #next = 0;
  #wakeLock = null;

  constructor() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.running) {
        this.#ctx.resume();
        this.#keepAwake();
      }
    });
  }

  // Debe llamarse dentro del gesto del usuario para que el audio se desbloquee.
  start({ bpm, beats }) {
    this.#ensureAudio();
    this.#ctx.resume();
    this.#cutScheduled();
    this.bpm = bpm;
    this.beats = beats;
    this.#beat = 0;
    this.#next = this.#ctx.currentTime + 0.06;
    this.running = true;
    this.#worker.postMessage('start');
    this.#keepAwake();
  }

  update({ bpm, beats }) {
    this.bpm = bpm;
    this.beats = beats;
    this.#beat %= beats;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.#worker.postMessage('stop');
    this.#cutScheduled();
    this.#wakeLock?.release().catch(() => {});
    this.#wakeLock = null;
  }

  #ensureAudio() {
    if (this.#ctx) return;
    // En iPhone esto evita que el interruptor de silencio apague el click.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    this.#ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    this.#accent = makeClick(this.#ctx, 2000, 1);
    this.#normal = makeClick(this.#ctx, 1200, 0.7);
    this.#worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
    this.#worker.onmessage = () => this.#schedule();
  }

  // Cada arranque usa un bus propio: desconectarlo silencia al instante los
  // clicks ya agendados, y no quedan golpes sueltos al parar o cambiar de canción.
  #cutScheduled() {
    this.#bus?.disconnect();
    this.#bus = this.#ctx.createGain();
    this.#bus.connect(this.#ctx.destination);
  }

  #schedule() {
    if (!this.running) return;
    const now = this.#ctx.currentTime;
    // Si el audio estuvo interrumpido, retoma sin disparar los clicks perdidos.
    if (this.#next < now) this.#next = now + 0.05;
    while (this.#next < now + LOOKAHEAD) {
      const source = this.#ctx.createBufferSource();
      source.buffer = this.#beat === 0 ? this.#accent : this.#normal;
      source.connect(this.#bus);
      source.start(this.#next);
      this.#beat = (this.#beat + 1) % this.beats;
      this.#next += 60 / this.bpm;
    }
  }

  async #keepAwake() {
    if (this.#wakeLock && !this.#wakeLock.released) return;
    try {
      const lock = await navigator.wakeLock?.request('screen');
      if (this.running) this.#wakeLock = lock;
      else lock?.release();
    } catch {
      // Sin Wake Lock el click sigue funcionando; solo puede apagarse la pantalla.
    }
  }
}
