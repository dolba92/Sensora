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
  private masterValue = 0.7;
  private ensure() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.masterValue;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') void this.context.resume();
    return this.context;
  }
  setMaster(value: number) {
    this.masterValue = value;
    if (this.context)
      this.master?.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
  }
  async playFile(id: string, url: string, volume: number) {
    if (this.tracks.has(id)) return;
    const ctx = this.ensure();
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
    } catch (error) {
      this.tracks.delete(id);
      throw error;
    }
  }
  playNoise(id: string, kind: NoiseKind, volume: number) {
    if (this.tracks.has(id)) return;
    const ctx = this.ensure(),
      length = ctx.sampleRate * 8,
      buffer = ctx.createBuffer(1, length, ctx.sampleRate),
      data = buffer.getChannelData(0);
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
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
    source.connect(gain).connect(this.master!);
    source.start();
    this.tracks.set(id, { gain, source });
  }
  setVolume(id: string, volume: number) {
    const track = this.tracks.get(id);
    if (track && this.context)
      track.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.06);
  }
  stop(id: string, fade = 0.7) {
    const track = this.tracks.get(id);
    if (!track || !this.context) return;
    const end = this.context.currentTime + fade;
    track.gain.gain.cancelScheduledValues(this.context.currentTime);
    track.gain.gain.linearRampToValueAtTime(0, end);
    window.setTimeout(
      () => {
        track.element?.pause();
        if (!track.element) (track.source as AudioBufferSourceNode).stop();
        track.source.disconnect();
        track.gain.disconnect();
      },
      fade * 1000 + 80,
    );
    this.tracks.delete(id);
  }
  stopAll(fade = 1.2) {
    [...this.tracks.keys()].forEach((id) => this.stop(id, fade));
  }
}
