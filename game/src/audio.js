// Procedural sound: every effect is synthesised with WebAudio oscillators and
// filtered noise, so the game ships no audio files and makes no network request.
// The context is created on the first user gesture; until then everything is a no-op.
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let muted = false;
  let musicTimer = 0;
  let musicStep = 0;

  // A lazy bass line in A minor, one soft note every half second while playing.
  const BASS_LINE = [55, 0, 55, 65.41, 0, 49, 0, 55, 0, 65.41, 73.42, 0, 82.41, 73.42, 65.41, 49];

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
    } catch {
      context = null;
      return false;
    }
    return true;
  }

  function noiseBurst(duration, volume, filterFreq) {
    if (!context) return;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start();
  }

  function tone(freq, duration, type, volume, slideTo) {
    if (!context) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, context.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, context.currentTime + duration);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  return {
    ensure,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() { return muted; },
    /** Engine hum follows how fast the player's car is going (0..1). */
    engine(speed01, active) {
      if (!context || muted) return;
      const target = active ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, context.currentTime, 0.1);
    },
    /** Two-tone police siren while any cop is chasing; call every frame. */
    siren(active, dt) {
      if (!context) return;
      if (!active) {
        sirenGain.gain.setTargetAtTime(0, context.currentTime, 0.1);
        return;
      }
      sirenTimer += dt;
      const high = Math.floor(sirenTimer / 0.45) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(high ? 880 : 660, context.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(muted ? 0 : 0.035, context.currentTime, 0.1);
    },
    shot() { tone(180, 0.12, 'square', 0.22, 60); noiseBurst(0.08, 0.25, 3000); },
    enemyShot() { tone(140, 0.1, 'square', 0.1, 50); },
    hit() { noiseBurst(0.12, 0.3, 900); },
    pickup() { tone(660, 0.09, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2); },
    cash() { tone(880, 0.08, 'triangle', 0.2); setTimeout(() => tone(1320, 0.16, 'triangle', 0.2), 90); },
    doorSlam() { noiseBurst(0.1, 0.35, 500); },
    explosion() { noiseBurst(0.7, 0.5, 400); tone(70, 0.6, 'sine', 0.4, 30); },
    busted() { tone(440, 0.5, 'sawtooth', 0.15, 220); },
    /** The bass line ticks along while the game is playing. */
    music(dt) {
      if (!context || muted) return;
      musicTimer += dt;
      if (musicTimer < 0.5) return;
      musicTimer = 0;
      const note = BASS_LINE[musicStep % BASS_LINE.length];
      musicStep += 1;
      if (note > 0) tone(note, 0.42, 'triangle', 0.07);
    },
  };
}
