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
  private noiseBuffers = new Map<NoiseKind, AudioBuffer>();
  private masterValue = 0.7;
  private getOrCreateAudioContext() {
    if (this.context?.state === 'closed') {
      this.context = undefined;
      this.master = undefined;
      this.noiseBuffers.clear();
    }
    if (!this.context) {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioContextClass) throw new Error('Web Audio API не поддерживается.');
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.masterValue;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }
  async ensureAudioContextRunning() {
    const context = this.getOrCreateAudioContext();
    if (context.state !== 'running') await context.resume();
    if (context.state !== 'running')
      throw new Error('Не удалось запустить AudioContext.');
    return context;
  }
  setMaster(value: number) {
    this.masterValue = value;
    if (this.context)
      this.master?.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
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
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
    source.connect(gain).connect(this.master!);
    this.tracks.set(id, { gain, source, element });
    try {
      await element.play();
      if (this.tracks.get(id)?.source !== source) {
        this.disposeTrack({ gain, source, element });
        return false;
      }
      return true;
    } catch (error) {
      if (this.tracks.get(id)?.source === source) this.tracks.delete(id);
      this.disposeTrack({ gain, source, element });
      throw error;
    }
  }
  async playNoise(id: string, kind: NoiseKind, volume: number) {
    if (this.tracks.has(id)) return true;
    const ctx = this.getOrCreateAudioContext();
    const resumePromise =
      ctx.state === 'running' ? Promise.resolve() : ctx.resume();
    const source = ctx.createBufferSource();
    source.buffer = this.getNoiseBuffer(ctx, kind);
    source.loop = true;
    const gain = ctx.createGain();
    const safeVolume = Number.isFinite(volume)
      ? Math.min(1, Math.max(0, volume))
      : 0.45;
    gain.gain.setValueAtTime(safeVolume, ctx.currentTime);
    source.connect(gain).connect(this.master!);
    const track = { gain, source };
    this.tracks.set(id, track);
    this.logNoise('before resume', ctx, gain);
    try {
      await resumePromise;
      if (ctx.state !== 'running')
        throw new Error('Не удалось запустить AudioContext.');
      if (this.tracks.get(id)?.source !== source) return false;
      this.logNoise('after resume', ctx, gain);
      source.start();
      this.logNoise('source started', ctx, gain);
      return true;
    } catch (error) {
      if (this.tracks.get(id)?.source === source) this.tracks.delete(id);
      this.disposeTrack(track);
      throw error;
    }
  }
  private getNoiseBuffer(ctx: AudioContext, kind: NoiseKind) {
    const cached = this.noiseBuffers.get(kind);
    if (cached) return cached;
    const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0,
      b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = white * 0.42;
      else if (kind === 'brown') {
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = brown * 3.3;
      } else {
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] =
          (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    this.noiseBuffers.set(kind, buffer);
    return buffer;
  }
  private logNoise(label: string, ctx: AudioContext, gain: GainNode) {
    if (!import.meta.env.DEV) return;
    console.debug(`[Sensora noise] ${label}`, {
      contextState: ctx.state,
      sampleRate: ctx.sampleRate,
      masterGain: this.master?.gain.value,
      individualGain: gain.gain.value,
    });
  }
  setVolume(id: string, volume: number) {
    const track = this.tracks.get(id);
    if (track && this.context)
      track.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.06);
  }
  async playClick() {
    const ctx = await this.ensureAudioContextRunning(),
      oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.frequency.value = 330;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    oscillator.connect(gain).connect(this.master!);
    oscillator.addEventListener(
      'ended',
      () => {
        oscillator.disconnect();
        gain.disconnect();
      },
      { once: true },
    );
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.1);
  }
  private disposeTrack(track: Track) {
    try {
      if (track.element) {
        track.element.pause();
        track.element.removeAttribute('src');
        track.element.load();
      } else {
        (track.source as AudioBufferSourceNode).stop();
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
    const track = this.tracks.get(id);
    if (!track) return;
    this.tracks.delete(id);
    if (!this.context || fade <= 0) {
      this.disposeTrack(track);
      return;
    }
    const now = this.context.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(track.gain.gain.value, now);
    track.gain.gain.linearRampToValueAtTime(0, now + fade);
    window.setTimeout(() => this.disposeTrack(track), fade * 1000 + 30);
  }
  stopAll(fade = 0) {
    [...this.tracks.keys()].forEach((id) => this.stop(id, fade));
  }
}
