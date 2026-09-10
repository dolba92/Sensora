export type NoiseKind = 'white' | 'pink' | 'brown';

type Track = {
  gain: GainNode;
  source: AudioBufferSourceNode | MediaElementAudioSourceNode;
  element?: HTMLAudioElement;
};

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private tracks = new Map<string, Track>();
  private noiseUrls = new Map<NoiseKind, string>();
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
    this.masterValue = value;

    if (this.context) {
      this.master?.gain.setTargetAtTime(
        value,
        this.context.currentTime,
        0.08,
      );
    }
  }

  async playFile(id: string, url: string, volume: number) {
    if (this.tracks.has(id)) return true;

    const ctx = await this.ensureAudioContextRunning();

    const element = new Audio(url);
    element.loop = true;
    element.preload = 'auto';

    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(
      volume,
      ctx.currentTime + 1.2,
    );

    source.connect(gain).connect(this.master!);

    this.tracks.set(id, {
      gain,
      source,
      element,
    });

    try {
      await element.play();

      if (this.tracks.get(id)?.source !== source) {
        this.disposeTrack({
          gain,
          source,
          element,
        });

        return false;
      }

      return true;
    } catch (error) {
      if (this.tracks.get(id)?.source === source) {
        this.tracks.delete(id);
      }

      this.disposeTrack({
        gain,
        source,
        element,
      });

      throw error;
    }
  }

  async playNoise(
    id: string,
    kind: NoiseKind,
    volume: number,
  ) {
    if (this.tracks.has(id)) return true;

    const ctx = await this.ensureAudioContextRunning();

    /*
     * На мобильных устройствах программно созданный
     * AudioBufferSourceNode может вести себя нестабильно.
     *
     * Поэтому генерируем настоящий WAV-файл в памяти приложения
     * и воспроизводим его через HTMLAudioElement —
     * тем же путём, которым воспроизводятся обычные звуки Sensora.
     */

    const noiseUrl = this.getNoiseUrl(kind);

    const element = new Audio(noiseUrl);
    element.loop = true;
    element.preload = 'auto';

    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();

    const safeVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 0.45;

    gain.gain.setValueAtTime(
      safeVolume,
      ctx.currentTime,
    );

    source.connect(gain).connect(this.master!);

    const track: Track = {
      gain,
      source,
      element,
    };

    this.tracks.set(id, track);

    try {
      await element.play();

      if (this.tracks.get(id)?.source !== source) {
        this.disposeTrack(track);
        return false;
      }

      return true;
    } catch (error) {
      if (this.tracks.get(id)?.source === source) {
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
    const durationSeconds = 4;
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

    if (track && this.context) {
      track.gain.gain.setTargetAtTime(
        volume,
        this.context.currentTime,
        0.06,
      );
    }
  }

  async playClick() {
    const ctx =
      await this.ensureAudioContextRunning();

    const oscillator =
      ctx.createOscillator();

    const gain =
      ctx.createGain();

    oscillator.frequency.value = 330;

    gain.gain.setValueAtTime(
      0.12,
      ctx.currentTime,
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.09,
    );

    oscillator
      .connect(gain)
      .connect(this.master!);

    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      {
        once: true,
      },
    );

    oscillator.start();

    oscillator.stop(
      ctx.currentTime + 0.1,
    );
  }

  private disposeTrack(track: Track) {
    try {
      if (track.element) {
        track.element.pause();
        track.element.removeAttribute('src');
        track.element.load();
      } else {
        (
          track.source as AudioBufferSourceNode
        ).stop();
      }
    } catch {}

    try {
      track.source.disconnect();
    } catch {}

    try {
      track.gain.disconnect();
    } catch {}
  }

  stop(id: string, fade = 0.12) {
    const track =
      this.tracks.get(id);

    if (!track) {
      return;
    }

    this.tracks.delete(id);

    if (!this.context || fade <= 0) {
      this.disposeTrack(track);
      return;
    }

    const now =
      this.context.currentTime;

    track.gain.gain.cancelScheduledValues(now);

    track.gain.gain.setValueAtTime(
      track.gain.gain.value,
      now,
    );

    track.gain.gain.linearRampToValueAtTime(
      0,
      now + fade,
    );

    window.setTimeout(
      () => this.disposeTrack(track),
      fade * 1000 + 30,
    );
  }

  stopAll(fade = 0) {
    [...this.tracks.keys()].forEach(
      (id) => this.stop(id, fade),
    );
  }
}
