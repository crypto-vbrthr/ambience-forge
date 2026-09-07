import { AudioBackend } from "./audio-backend.js";

function cleanPlaybackOptions(options) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value != null));
}

export class FoundryAudioBackend extends AudioBackend {
  constructor({ audioHelper = game.audio, SoundClass = foundry.audio.Sound } = {}) {
    super();
    this.audioHelper = audioHelper;
    this.SoundClass = SoundClass;
  }

  async #unlock() {
    await this.audioHelper.unlock;
  }

  async startLoop({ src, volume = 1, fadeInMs = 0, loopStart = null, loopEnd = null } = {}) {
    if (!src) throw new Error("Loop source is required");
    await this.#unlock();
    const sound = new this.SoundClass(src, {
      context: this.audioHelper.environment,
      forceBuffer: true
    });
    await sound.load();
    if (!sound.isBuffer) throw new Error(`Ambience Forge could not buffer loop source: ${src}`);
    await sound.play(cleanPlaybackOptions({
      loop: true,
      loopStart,
      loopEnd,
      volume,
      fade: fadeInMs
    }));
    return this.#handle(sound, "loop");
  }

  async playOneShot({ src, volume = 1, fadeInMs = 0 } = {}) {
    if (!src) throw new Error("One-shot source is required");
    await this.#unlock();
    const sound = new this.SoundClass(src, {
      context: this.audioHelper.environment
    });
    await sound.load();
    await sound.play({ loop: false, volume, fade: fadeInMs });
    return this.#handle(sound, "one-shot");
  }

  async stop(handle, { fadeOutMs = 0 } = {}) {
    if (!handle?.sound) return;
    await handle.sound.stop({ fade: Math.max(0, fadeOutMs) });
  }

  async setVolume(handle, volume, { durationMs = 0 } = {}) {
    if (!handle?.sound) return;
    const target = Math.min(1, Math.max(0, Number(volume) || 0));
    await handle.sound.fade(target, { duration: Math.max(0, durationMs), type: "linear" });
  }

  async crossfade(handle, { src, volume = 1, durationMs = 3000, loopStart = null, loopEnd = null } = {}) {
    const next = await this.startLoop({ src, volume: 0, fadeInMs: 0, loopStart, loopEnd });
    await Promise.all([
      this.setVolume(next, volume, { durationMs }),
      handle ? this.setVolume(handle, 0, { durationMs }) : Promise.resolve()
    ]);
    if (handle) await this.stop(handle, { fadeOutMs: 0 });
    return next;
  }

  #handle(sound, kind) {
    return {
      id: sound.id,
      kind,
      src: sound.src,
      durationMs: Number.isFinite(sound.duration) ? Math.max(0, sound.duration * 1000) : 0,
      sound
    };
  }
}
