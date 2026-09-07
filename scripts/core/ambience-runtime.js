import { RandomScheduler } from "./random-scheduler.js";
import { createTrackController } from "./track-controllers.js";

export class AmbienceRuntime {
  constructor({ ambience, backend, schedulerFactory = () => new RandomScheduler() }) {
    this.ambience = ambience;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.controllers = new Map();
    this.masterVolume = Math.min(1, Math.max(0, Number(ambience.masterVolume ?? 1) || 0));
    this.running = false;
  }

  async start() {
    if (this.running) return;
    this.running = true;
    for (const track of this.ambience.tracks.filter((candidate) => candidate.enabled !== false)) {
      const controller = createTrackController({
        track,
        backend: this.backend,
        scheduler: this.schedulerFactory(track),
        masterVolume: this.masterVolume
      });
      this.controllers.set(track.id, controller);
      await controller.start();
    }
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    await Promise.all([...this.controllers.values()].map((controller) => controller.stop()));
    this.controllers.clear();
  }

  async setMasterVolume(volume, options = {}) {
    this.masterVolume = Math.min(1, Math.max(0, Number(volume) || 0));
    await Promise.all([...this.controllers.values()].map((controller) => controller.setMasterVolume(this.masterVolume, options)));
    return true;
  }

  async setTrackVolume(trackId, volume, options = {}) {
    const controller = this.controllers.get(trackId);
    if (!controller) return false;
    await controller.setVolume(volume, options);
    return true;
  }

  getTrackIntensities() {
    return Object.fromEntries([...this.controllers.entries()]
      .filter(([, controller]) => typeof controller.setIntensity === "function")
      .map(([trackId, controller]) => [trackId, controller.track.intensity ?? 0]));
  }

  async setTrackIntensity(trackId, intensity) {
    const controller = this.controllers.get(trackId);
    if (!controller?.setIntensity) return false;
    await controller.setIntensity(intensity);
    return true;
  }
}
