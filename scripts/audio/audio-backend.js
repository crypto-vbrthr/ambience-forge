export class AudioBackend {
  async startLoop(_options) {
    throw new Error("AudioBackend.startLoop must be implemented");
  }

  async playOneShot(_options) {
    throw new Error("AudioBackend.playOneShot must be implemented");
  }

  async stop(_handle, _options = {}) {
    throw new Error("AudioBackend.stop must be implemented");
  }

  async setVolume(_handle, _volume, _options = {}) {
    throw new Error("AudioBackend.setVolume must be implemented");
  }

  async crossfade(_handle, _options) {
    throw new Error("AudioBackend.crossfade must be implemented");
  }
}
