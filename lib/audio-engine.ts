export type NoiseKind = 'white' | 'pink' | 'brown';

type Track = {
  element: HTMLAudioElement;
  volume: number;
  fadeTimer?: number;

  /*
   * Used only for the experimental rain hybrid.
   *
   * element = direct/background HTMLAudioElement
   * foregroundElement = visible-page media element routed through Web Audio
   */
  hybrid?: boolean;
  foregroundElement?: HTMLAudioElement;
  foregroundSource?: MediaElementAudioSourceNode;
  foregroundGain?: GainNode;
};

export class AudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private tracks = new Map<string, Track>();
  private metronomeUrl?: string;
  private metronomeElement?: HTMLAudioElement;
  private masterValue = 0.7;

  constructor() {
    document.addEventListener(
      'visibilitychange',
      this.handleVisibilityChange,
    );
  }

  private handleVisibilityChange = () => {
    for (const track of this.tracks.values()) {
      if (!track.hybrid) {
        continue;
      }

      if (document.hidden) {
        this.switchHybridToBackground(track);
      } else {
        void this.switchHybridToForeground(track);
      }
    }
  };

  private getOrCreateAudioContext() {
    if (this.context?.state === 'closed') {
      this.context = undefined;
      this.master = undefined;
    }

    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

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
    this.masterValue = Math.min(
      1,
      Math.max(0, value),
    );

    for (const track of this.tracks.values()) {
      if (
        track.hybrid &&
        track.foregroundGain
      ) {
        track.foregroundGain.gain.value =
          Math.min(
            1,
            Math.max(
              0,
              track.volume * this.masterValue,
            ),
          );

        /*
         * Keep this value updated too.
         * iOS may ignore it for the direct background element,
         * but other browsers can still honour it.
         */
        track.element.volume =
          Math.min(
            1,
            Math.max(
              0,
              track.volume * this.masterValue,
            ),
          );

        continue;
      }

      track.element.volume = Math.min(
        1,
        Math.max(
          0,
          track.volume * this.masterValue,
        ),
      );
    }

    if (this.metronomeElement) {
      this.metronomeElement.volume =
        Math.min(
          1,
          Math.max(
            0,
            this.masterValue * 0.55,
          ),
        );
    }
  }

  private configureBackgroundPlayback(
    element: HTMLAudioElement,
  ) {
    element.preload = 'auto';
    element.loop = true;
    element.playsInline = true;

    const navigatorWithAudioSession =
      navigator as Navigator & {
        audioSession?: {
          type: string;
        };
      };

    try {
      if (
        navigatorWithAudioSession.audioSession
      ) {
        navigatorWithAudioSession.audioSession.type =
          'playback';
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
    const safeTarget = Math.min(
      1,
      Math.max(0, target),
    );

    if (durationSeconds <= 0) {
      element.volume = safeTarget;
      onComplete?.();
      return;
    }

    const startedAt = performance.now();
    const durationMs =
      durationSeconds * 1000;

    track.fadeTimer =
      window.setInterval(() => {
        const progress = Math.min(
          1,
          (performance.now() - startedAt) /
            durationMs,
        );

        element.volume =
          startVolume +
          (safeTarget - startVolume) *
            progress;

        if (progress >= 1) {
          if (track.fadeTimer) {
            window.clearInterval(
              track.fadeTimer,
            );

            track.fadeTimer =
              undefined;
          }

          onComplete?.();
        }
      }, 30);
  }

  private isExperimentalRain(
    url: string,
  ) {
    try {
      const parsed = new URL(
        url,
        window.location.href,
      );

      return (
        parsed.pathname ===
        '/audio/rain.mp3'
      );
    } catch {
      return url.includes(
        '/audio/rain.mp3',
      );
    }
  }

  async playFile(
    id: string,
    url: string,
    volume: number,
  ) {
    if (this.tracks.has(id)) {
      return true;
    }

    if (this.isExperimentalRain(url)) {
      return this.playHybridRain(
        id,
        url,
        volume,
      );
    }

    const safeVolume =
      Number.isFinite(volume)
        ? Math.min(
            1,
            Math.max(0, volume),
          )
        : 0.45;

    const element = new Audio(url);

    this.configureBackgroundPlayback(
      element,
    );

    element.volume = 0;

    const track: Track = {
      element,
      volume: safeVolume,
    };

    this.tracks.set(id, track);

    try {
      await element.play();

      if (
        this.tracks.get(id) !== track
      ) {
        this.disposeTrack(track);
        return false;
      }

      this.fadeElementTo(
        track,
        safeVolume *
          this.masterValue,
        1.2,
      );

      return true;
    } catch (error) {
      if (
        this.tracks.get(id) === track
      ) {
        this.tracks.delete(id);
      }

      this.disposeTrack(track);
      throw error;
    }
  }

  private async playHybridRain(
    id: string,
    url: string,
    volume: number,
  ) {
    const safeVolume =
      Number.isFinite(volume)
        ? Math.min(
            1,
            Math.max(0, volume),
          )
        : 0.45;

    /*
     * Direct element:
     * keeps playing while the page is visible,
     * but stays muted until the page goes
     * into the background.
     */
    const backgroundElement =
      new Audio(url);

    this.configureBackgroundPlayback(
      backgroundElement,
    );

    backgroundElement.muted = true;
    backgroundElement.volume =
      safeVolume *
      this.masterValue;

    /*
     * Foreground element:
     * routed through Web Audio so that the
     * in-app volume slider works while the
     * page is visible.
     */
    const foregroundElement =
      new Audio(url);

    foregroundElement.preload = 'auto';
    foregroundElement.loop = true;
    foregroundElement.playsInline = true;

    const context =
      await this.ensureAudioContextRunning();

    const foregroundSource =
      context.createMediaElementSource(
        foregroundElement,
      );

    const foregroundGain =
      context.createGain();

    foregroundGain.gain.value = Math.min(
      1,
      Math.max(
        0,
        safeVolume *
          this.masterValue,
      ),
    );

    foregroundSource.connect(
      foregroundGain,
    );

    foregroundGain.connect(
      context.destination,
    );

    const track: Track = {
      element: backgroundElement,
      volume: safeVolume,
      hybrid: true,
      foregroundElement,
      foregroundSource,
      foregroundGain,
    };

    this.tracks.set(id, track);

    try {
      /*
       * Both are started from the original
       * user gesture.
       *
       * The direct copy is already alive
       * before iOS locks the screen, but is
       * muted while the page is visible.
       */
      await Promise.all([
        backgroundElement.play(),
        foregroundElement.play(),
      ]);

      if (
        this.tracks.get(id) !== track
      ) {
        this.disposeTrack(track);
        return false;
      }

      if (document.hidden) {
        this.switchHybridToBackground(
          track,
        );
      }

      return true;
    } catch (error) {
      if (
        this.tracks.get(id) === track
      ) {
        this.tracks.delete(id);
      }

      this.disposeTrack(track);

      throw error;
    }
  }

  private switchHybridToBackground(
    track: Track,
  ) {
    const foreground =
      track.foregroundElement;

    if (!foreground) {
      return;
    }

    try {
      /*
       * Synchronise the direct player
       * with the Web Audio player before
       * making it audible.
       */
      if (
        Number.isFinite(
          foreground.currentTime,
        )
      ) {
        const difference = Math.abs(
          track.element.currentTime -
            foreground.currentTime,
        );

        if (difference > 0.15) {
          track.element.currentTime =
            foreground.currentTime;
        }
      }
    } catch {}

    /*
     * The direct element has already been
     * playing muted, so this does not need
     * a new play() call after screen lock.
     */
    track.element.muted = false;

    try {
      foreground.pause();
    } catch {}
  }

  private async switchHybridToForeground(
    track: Track,
  ) {
    const foreground =
      track.foregroundElement;

    if (!foreground) {
      return;
    }

    /*
     * Mute the direct/background copy first
     * to avoid two audible copies.
     */
    track.element.muted = true;

    try {
      if (
        Number.isFinite(
          track.element.currentTime,
        )
      ) {
        foreground.currentTime =
          track.element.currentTime;
      }
    } catch {}

    try {
      const context =
        this.getOrCreateAudioContext();

      if (
        context.state !== 'running'
      ) {
        await context.resume();
      }
    } catch {}

    try {
      if (foreground.paused) {
        await foreground.play();
      }
    } catch {
      /*
       * Some iOS versions may demand another
       * user gesture after returning from
       * background. If that happens, the
       * experiment has failed cleanly rather
       * than affecting other tracks.
       */
    }
  }

  async playNoise(
    id: string,
    kind: NoiseKind,
    volume: number,
  ) {
    if (this.tracks.has(id)) {
      return true;
    }

    const safeVolume =
      Number.isFinite(volume)
        ? Math.min(
            1,
            Math.max(0, volume),
          )
        : 0.45;

    const noiseUrl =
      `/audio/${kind}-noise.mp3`;

    const element =
      new Audio(noiseUrl);

    this.configureBackgroundPlayback(
      element,
    );

    element.volume =
      safeVolume *
      this.masterValue;

    const track: Track = {
      element,
      volume: safeVolume,
    };

    this.tracks.set(id, track);

    try {
      await element.play();

      if (
        this.tracks.get(id) !== track
      ) {
        this.disposeTrack(track);
        return false;
      }

      return true;
    } catch (error) {
      if (
        this.tracks.get(id) === track
      ) {
        this.tracks.delete(id);
      }

      this.disposeTrack(track);
      throw error;
    }
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

    const buffer =
      new ArrayBuffer(
        44 + dataLength,
      );

    const view =
      new DataView(buffer);

    const writeString = (
      offset: number,
      value: string,
    ) => {
      for (
        let i = 0;
        i < value.length;
        i++
      ) {
        view.setUint8(
          offset + i,
          value.charCodeAt(i),
        );
      }
    };

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

    view.setUint16(
      20,
      1,
      true,
    );

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

    view.setUint16(
      34,
      16,
      true,
    );

    writeString(
      36,
      'data',
    );

    view.setUint32(
      40,
      dataLength,
      true,
    );

    let offset = 44;

    for (
      let i = 0;
      i < samples.length;
      i++
    ) {
      const sample = Math.max(
        -1,
        Math.min(
          1,
          samples[i],
        ),
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

  setVolume(
    id: string,
    volume: number,
  ) {
    const track =
      this.tracks.get(id);

    if (!track) {
      return;
    }

    track.volume =
      Math.min(
        1,
        Math.max(0, volume),
      );

    const effectiveVolume =
      Math.min(
        1,
        Math.max(
          0,
          track.volume *
            this.masterValue,
        ),
      );

    if (
      track.hybrid &&
      track.foregroundGain
    ) {
      track.foregroundGain.gain.value =
        effectiveVolume;

      track.element.volume =
        effectiveVolume;

      return;
    }

    track.element.volume =
      effectiveVolume;
  }

  async startMetronome(
    bpm: number,
  ) {
    if (!this.metronomeUrl) {
      this.metronomeUrl =
        this.createMetronomeLoopUrl();
    }

    if (!this.metronomeElement) {
      const element =
        new Audio(
          this.metronomeUrl,
        );

      element.preload = 'auto';
      element.loop = true;
      element.playsInline = true;

      this.metronomeElement =
        element;
    }

    const element =
      this.metronomeElement;

    this.setMetronomeBpm(bpm);

    element.volume = Math.min(
      1,
      Math.max(
        0,
        this.masterValue * 0.55,
      ),
    );

    if (!element.paused) {
      return;
    }

    try {
      element.currentTime = 0;
    } catch {}

    await element.play();
  }

  setMetronomeBpm(
    bpm: number,
  ) {
    const safeBpm =
      Math.min(
        240,
        Math.max(20, bpm),
      );

    if (
      this.metronomeElement
    ) {
      this.metronomeElement.playbackRate =
        safeBpm / 60;
    }
  }

  stopMetronome() {
    const element =
      this.metronomeElement;

    if (!element) {
      return;
    }

    try {
      element.pause();
      element.currentTime = 0;
    } catch {}
  }

  private createMetronomeLoopUrl() {
    const sampleRate = 44100;
    const durationSeconds = 1;

    const length =
      Math.floor(
        sampleRate *
          durationSeconds,
      );

    const clickLength =
      Math.floor(
        sampleRate * 0.09,
      );

    const samples =
      new Float32Array(length);

    for (
      let i = 0;
      i < clickLength;
      i++
    ) {
      const time =
        i / sampleRate;

      const envelope =
        Math.exp(
          -time * 45,
        );

      const tone =
        Math.sin(
          2 *
            Math.PI *
            850 *
            time,
        ) *
          0.75 +
        Math.sin(
          2 *
            Math.PI *
            1250 *
            time,
        ) *
          0.25;

      samples[i] =
        tone *
        envelope *
        0.65;
    }

    const blob =
      this.createNoiseWav(
        samples,
        sampleRate,
      );

    return URL.createObjectURL(
      blob,
    );
  }

  private disposeTrack(
    track: Track,
  ) {
    if (track.fadeTimer) {
      window.clearInterval(
        track.fadeTimer,
      );

      track.fadeTimer =
        undefined;
    }

    try {
      track.element.pause();
      track.element.muted = true;
      track.element.removeAttribute(
        'src',
      );
      track.element.load();
    } catch {}

    if (
      track.foregroundElement
    ) {
      try {
        track.foregroundElement.pause();

        track.foregroundElement.removeAttribute(
          'src',
        );

        track.foregroundElement.load();
      } catch {}
    }

    try {
      track.foregroundSource?.disconnect();
    } catch {}

    try {
      track.foregroundGain?.disconnect();
    } catch {}
  }

  stop(
    id: string,
    fade = 0.12,
  ) {
    const track =
      this.tracks.get(id);

    if (!track) {
      return;
    }

    this.tracks.delete(id);

    /*
     * Hybrid rain has two playback paths,
     * so dispose both together.
     */
    if (track.hybrid) {
      const gain =
        track.foregroundGain;

      if (
        fade > 0 &&
        gain &&
        this.context
      ) {
        try {
          const now =
            this.context.currentTime;

          gain.gain.cancelScheduledValues(
            now,
          );

          gain.gain.setValueAtTime(
            gain.gain.value,
            now,
          );

          gain.gain.linearRampToValueAtTime(
            0,
            now + fade,
          );

          window.setTimeout(
            () => {
              this.disposeTrack(
                track,
              );
            },
            fade * 1000 + 30,
          );

          return;
        } catch {}
      }

      this.disposeTrack(track);
      return;
    }

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
    [
      ...this.tracks.keys(),
    ].forEach(
      (id) =>
        this.stop(id, fade),
    );
  }
}
