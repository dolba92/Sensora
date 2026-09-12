
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
     * White, pink and brown noise are stored as long MP3 files.
     * They are played directly through HTMLAudioElement so that
     * iOS/WebKit can continue playback while the screen is locked
     * or the app is in the background.
     */
    const noiseUrl = `/audio/${kind}-noise.mp3`;

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

  /*
   * Creates a short WAV Blob.
   * This is still used by the metronome loop.
   */
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
    const safeBpm = Math.min(
      240,
      Math.max(20, bpm),
    );

    if (this.metronomeElement) {
      this.metronomeElement.playbackRate =
        safeBpm / 60;
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
    const length = Math.floor(
      sampleRate * durationSeconds,
    );
    const clickLength = Math.floor(
      sampleRate * 0.09,
    );

    const samples = new Float32Array(length);

    for (let i = 0; i < clickLength; i++) {
      const time = i / sampleRate;
      const envelope = Math.exp(-time * 45);

      const tone =
        Math.sin(2 * Math.PI * 850 * time) * 0.75 +
        Math.sin(2 * Math.PI * 1250 * time) * 0.25;

      samples[i] =
        tone * envelope * 0.65;
    }

    const blob = this.createNoiseWav(
      samples,
      sampleRate,
    );

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

    this.fadeElementTo(
      track,
      0,
      fade,
      () => {
        this.disposeTrack(track);
      },
    );
  }

  stopAll(fade = 0) {
    [...this.tracks.keys()].forEach(
      (id) => this.stop(id, fade),
    );
  }
}