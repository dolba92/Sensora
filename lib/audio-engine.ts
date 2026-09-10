export type NoiseKind = 'white' | 'pink' | 'brown';

type Track = {
  element: HTMLAudioElement;
  volume: number;
  fadeTimer?: number;
};

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private tracks = new Map<string, Track>();
  private noiseUrls = new Map<NoiseKind, string>();
  private metronomeUrl?: string;
  private metronomeElement?: HTMLAudioElement;
  private masterValue = 0.7;

  private getOrCreateAudioContext() {
    if (this.context?.state === 'closed') {
      this.context = undefined;
      this.master = undefined;
    }

    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('Web Audio API не поддерживается.');
      }

      this.context = new AudioContextClass();

      this.master = this.context.createGain();
      this.master.gain.value = this.masterValue;
      this.master.connect(this.context.destination);
    }

    return this.context;
  }

  async ensureAudioContextRunning() {
    const context = this.getOrCreateAudioContext();

    if (context.state !== 'running') {
      await context.resume();
    }

    if (context.state !== 'running') {
      throw new Error('Не удалось запустить AudioContext.');
    }

    return context;
  }

  setMaster(value: number) {
    this.masterValue = Math.min(1, Math.max(0, value));

    for (const track of this.tracks.values()) {
      track.element.volume = Math.min(
        1,
        Math.max(0, track.volume * this.masterValue),
      );
    }

    if (this.metronomeElement) {
      this.metronomeElement.volume = Math.min(
        1,
        Math.max(0, this.masterValue * 0.55),
      );
    }
  }

  private configureBackgroundPlayback(element: HTMLAudioElement) {
    element.preload = 'auto';
    element.loop = true;
    element.playsInline = true;

    const navigatorWithAudioSession = navigator as Navigator & {
      audioSession?: { type: string };
    };

    try {
      if (navigatorWithAudioSession.audioSession) {
        navigatorWithAudioSession.audioSession.type = 'playback';
      }
    } catch {}
  }

  private fadeElementTo(
    track: Track,
    target: number,
    durationSeconds: number,
    onComplete?: () => void,
  ) {
    if (track.fadeTimer) {
      window.clearInterval(track.fadeTimer);
      track.fadeTimer = undefined;
    }

    const element = track.element;
    const startVolume = element.volume;
    const safeTarget = Math.min(1, Math.max(0, target));

    if (durationSeconds <= 0) {
      element.volume = safeTarget;
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const durationMs = durationSeconds * 1000;

    track.fadeTimer = window.setInterval(() => {
      const progress = Math.min(
        1,
        (performance.now() - startedAt) / durationMs,
      );

      element.volume =
        startVolume + (safeTarget - startVolume) * progress;

      if (progress >= 1) {
        if (track.fadeTimer) {
          window.clearInterval(track.fadeTimer);
          track.fadeTimer = undefined;
        }
        onComplete?.();
      }
    }, 30);
  }

  async playFile(id: string, url: string, volume: number) {
    if (this.tracks.has(id)) return true;

    const safeVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 0.45;

    const element = new Audio(url);
    this.configureBackgroundPlayback(element);
    element.volume = 0;

    const track: Track = {
      element,
      volume: safeVolume,
    };

    this.tracks.set(id, track);

    try {
      await element.play();

      if (this.tracks.get(id) !== track) {
        this.disposeTrack(track);
        return false;
      }

      this.fadeElementTo(
        track,
        safeVolume * this.masterValue,
        1.2,
      );

      return true;
    } catch (error) {
      if (this.tracks.get(id) === track) {
        this.tracks.delete(id);
      }

      this.disposeTrack(track);
      throw error;
    }
  }

  async playNoise(
    id: string,
    kind: NoiseKind,
    volume: number,
  ) {
    if (this.tracks.has(id)) return true;

    const safeVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 0.45;

    /*
     * Шумы остаются настоящими WAV-файлами в памяти, но теперь
     * воспроизводятся напрямую через HTMLAudioElement.
     * Это не привязывает их к AudioContext, который iOS/WebKit
     * может приостанавливать при блокировке экрана.
     */
    const noiseUrl = this.getNoiseUrl(kind);

    const element = new Audio(noiseUrl);
    this.configureBackgroundPlayback(element);
    element.volume = safeVolume * this.masterValue;

    const track: Track = {
      element,
      volume: safeVolume,
    };

    this.tracks.set(id, track);

    try {
      await element.play();

      if (this.tracks.get(id) !== track) {
        this.disposeTrack(track);
        return false;
      }

      return true;
    } catch (error) {
      if (this.tracks.get(id) === track) {
        this.tracks.delete(id);
      }

      this.disposeTrack(track);
      throw error;
    }
  }

  private getNoiseUrl(kind: NoiseKind) {
    const cached = this.noiseUrls.get(kind);

    if (cached) {
      return cached;
    }

    const sampleRate = 44100;
    const durationSeconds = 120;
    const length = sampleRate * durationSeconds;

    const samples = new Float32Array(length);

    let brown = 0;

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;

    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;

      if (kind === 'white') {
        /*
         * Белый шум:
         * одинаковая энергия по всему спектру.
         */
        samples[i] = white * 0.42;
      } else if (kind === 'brown') {
        /*
         * Коричневый шум:
         * интегрированный белый шум,
         * сильнее выражены низкие частоты.
         */
        brown =
          (brown + 0.02 * white) /
          1.02;

        samples[i] = brown * 3.3;
      } else {
        /*
         * Розовый шум:
         * фильтрация белого шума,
         * уменьшающая энергию высоких частот.
         */
        b0 =
          0.99886 * b0 +
          white * 0.0555179;

        b1 =
          0.99332 * b1 +
          white * 0.0750759;

        b2 =
          0.969 * b2 +
          white * 0.153852;

        b3 =
          0.8665 * b3 +
          white * 0.3104856;

        b4 =
          0.55 * b4 +
          white * 0.5329522;

        b5 =
          -0.7616 * b5 -
          white * 0.016898;

        samples[i] =
          (
            b0 +
            b1 +
            b2 +
            b3 +
            b4 +
            b5 +
            b6 +
            white * 0.5362
          ) *
          0.11;

        b6 = white * 0.115926;
      }
    }

    const blob = this.createNoiseWav(
      samples,
      sampleRate,
    );

    const url = URL.createObjectURL(blob);

    this.noiseUrls.set(kind, url);

    return url;
  }

  private createNoiseWav(
    samples: Float32Array,
    sampleRate: number,
  ) {
    const bytesPerSample = 2;
    const numberOfChannels = 1;

    const dataLength =
      samples.length *
      bytesPerSample *
      numberOfChannels;

    const buffer = new ArrayBuffer(
      44 + dataLength,
    );

    const view = new DataView(buffer);

    const writeString = (
      offset: number,
      value: string,
    ) => {
      for (let i = 0; i < value.length; i++) {
        view.setUint8(
          offset + i,
          value.charCodeAt(i),
        );
      }
    };

    /*
     * WAV / RIFF header
     */

    writeString(0, 'RIFF');

    view.setUint32(
      4,
      36 + dataLength,
      true,
    );

    writeString(8, 'WAVE');

    writeString(12, 'fmt ');

    view.setUint32(
      16,
      16,
      true,
    );

    /*
     * PCM
     */
    view.setUint16(
      20,
      1,
      true,
    );

    /*
     * Mono
     */
    view.setUint16(
      22,
      numberOfChannels,
      true,
    );

    view.setUint32(
      24,
      sampleRate,
      true,
    );

    view.setUint32(
      28,
      sampleRate *
        numberOfChannels *
        bytesPerSample,
      true,
    );

    view.setUint16(
      32,
      numberOfChannels *
        bytesPerSample,
      true,
    );

    /*
     * 16 bit
     */
    view.setUint16(
      34,
      16,
      true,
    );

    writeString(36, 'data');

    view.setUint32(
      40,
      dataLength,
      true,
    );

    let offset = 44;

    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(
        -1,
        Math.min(1, samples[i]),
      );

      const pcm =
        sample < 0
          ? sample * 0x8000
          : sample * 0x7fff;

      view.setInt16(
        offset,
        pcm,
        true,
      );

      offset += 2;
    }

    return new Blob(
      [buffer],
      {
        type: 'audio/wav',
      },
    );
  }

  setVolume(id: string, volume: number) {
    const track = this.tracks.get(id);

    if (!track) return;

    track.volume = Math.min(1, Math.max(0, volume));
    track.element.volume = Math.min(
      1,
      Math.max(0, track.volume * this.masterValue),
    );
  }

  async startMetronome(bpm: number) {
    if (!this.metronomeUrl) {
      this.metronomeUrl = this.createMetronomeLoopUrl();
    }

    if (!this.metronomeElement) {
      const element = new Audio(this.metronomeUrl);
      element.preload = 'auto';
      element.loop = true;
      element.playsInline = true;
      this.metronomeElement = element;
    }

    const element = this.metronomeElement;

    this.setMetronomeBpm(bpm);

    element.volume = Math.min(
      1,
      Math.max(0, this.masterValue * 0.55),
    );

    if (!element.paused) return;

    try {
      element.currentTime = 0;
    } catch {}

    await element.play();
  }

  setMetronomeBpm(bpm: number) {
    const safeBpm = Math.min(240, Math.max(20, bpm));

    if (this.metronomeElement) {
      this.metronomeElement.playbackRate = safeBpm / 60;
    }
  }

  stopMetronome() {
    const element = this.metronomeElement;

    if (!element) return;

    try {
      element.pause();
      element.currentTime = 0;
    } catch {}
  }

  private createMetronomeLoopUrl() {
    const sampleRate = 44100;
    const durationSeconds = 1;
    const length = Math.floor(sampleRate * durationSeconds);
    const clickLength = Math.floor(sampleRate * 0.09);

    const samples = new Float32Array(length);

    for (let i = 0; i < clickLength; i++) {
      const time = i / sampleRate;
      const envelope = Math.exp(-time * 45);

      const tone =
        Math.sin(2 * Math.PI * 850 * time) * 0.75 +
        Math.sin(2 * Math.PI * 1250 * time) * 0.25;

      samples[i] = tone * envelope * 0.65;
    }

    const blob = this.createNoiseWav(samples, sampleRate);

    return URL.createObjectURL(blob);
  }

  private disposeTrack(track: Track) {
    if (track.fadeTimer) {
      window.clearInterval(track.fadeTimer);
      track.fadeTimer = undefined;
    }

    try {
      track.element.pause();
      track.element.removeAttribute('src');
      track.element.load();
    } catch {}
  }

  stop(id: string, fade = 0.12) {
    const track = this.tracks.get(id);

    if (!track) {
      return;
    }

    this.tracks.delete(id);

    if (fade <= 0) {
      this.disposeTrack(track);
      return;
    }

    this.fadeElementTo(track, 0, fade, () => {
      this.disposeTrack(track);
    });
  }

  stopAll(fade = 0) {
    [...this.tracks.keys()].forEach(
      (id) => this.stop(id, fade),
    );
  }
}
