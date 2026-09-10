import { MODULE_ID } from "../constants.js";
import { AmbienceRuntime } from "../core/ambience-runtime.js";
import { RandomScheduler } from "../core/random-scheduler.js";
import { cloneData, slugifyKey } from "../data/schema.js";
import {
  EMITTER_FLAG,
  EMITTER_SCHEMA_VERSION,
  EMITTER_OBSTRUCTION_MODES,
  SILENCE_PATH,
  applyEmitterObstruction,
  computeEmitterGain,
  emitterDataFromDocument,
  getEmitterFlag,
  isAmbienceEmitter,
  normalizeEmitterData
} from "./emitter-model.js";

function tokenListenerPosition(token) {
  try {
    const position = token?.document?.getListenerPosition?.();
    if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) return position;
  } catch {}
  if (token?.center && Number.isFinite(token.center.x) && Number.isFinite(token.center.y)) return token.center;
  const width = Number(token?.w ?? token?.width ?? 0) || 0;
  const height = Number(token?.h ?? token?.height ?? 0) || 0;
  return {
    x: (Number(token?.x) || 0) + (width / 2),
    y: (Number(token?.y) || 0) + (height / 2)
  };
}

function defaultListeners(preferredTokenId = null) {
  const controlled = globalThis.canvas?.tokens?.controlled ?? [];
  if (controlled.length) return controlled.map(tokenListenerPosition);

  const placeables = (globalThis.canvas?.tokens?.placeables ?? [])
    .filter((token) => token?.document?.hidden !== true);

  if (globalThis.game?.user?.isGM) {
    // A GM normally previews spatial ambience through a deliberately selected token.
    // Keep following the most recently created/controlled token even after Foundry
    // clears its control state (for example directly after Actor -> Canvas creation).
    if (preferredTokenId) {
      const preferred = placeables.find((token) => (token?.id ?? token?.document?.id) === preferredTokenId);
      if (preferred) return [tokenListenerPosition(preferred)];
    }

    // If player-owned tokens exist, let the GM hear what the players would hear.
    const playerOwned = placeables.filter((token) => token?.actor?.hasPlayerOwner === true);
    if (playerOwned.length) return playerOwned.map(tokenListenerPosition);

    // A single token is unambiguous and makes quick emitter testing intuitive.
    if (placeables.length === 1) return [tokenListenerPosition(placeables[0])];
    return [];
  }

  const owned = placeables.filter((token) => token?.actor?.isOwner);
  return owned.map(tokenListenerPosition);
}

function sceneSounds(scene) {
  const collection = scene?.sounds ?? scene?.ambientSounds ?? [];
  if (Array.isArray(collection)) return collection;
  if (typeof collection?.values === "function") return [...collection.values()];
  if (collection?.contents) return collection.contents;
  return [];
}

function sourceTestsPoint(document, listener) {
  const source = document?.object?.source;
  if (!source?.testPoint) return null;
  try {
    const point = {
      x: Number(listener?.x) || 0,
      y: Number(listener?.y) || 0
    };
    if (Number.isFinite(listener?.elevation)) point.elevation = Number(listener.elevation);
    return Boolean(source.testPoint(point));
  } catch {
    return null;
  }
}

function prospectiveEmitterMode(document, changes = {}) {
  const flatKey = `flags.${MODULE_ID}.${EMITTER_FLAG}`;
  const pendingFlag = changes?.[flatKey] ?? changes?.flags?.[MODULE_ID]?.[EMITTER_FLAG];
  return normalizeEmitterData({
    obstructionMode: pendingFlag?.obstructionMode ?? getEmitterFlag(document)?.obstructionMode
  }).obstructionMode;
}

export class SceneEmitterService {
  constructor({
    getAmbienceService,
    backend,
    schedulerFactory = () => new RandomScheduler(),
    getListeners = null,
    setIntervalFn = globalThis.setInterval?.bind(globalThis),
    clearIntervalFn = globalThis.clearInterval?.bind(globalThis),
    tickMs = 200,
    retryMs = 5000,
    nowFn = () => Date.now(),
    onError = (error, context = {}) => console.error("ambience-forge | scene emitter playback failed", context, error)
  } = {}) {
    this.getAmbienceService = getAmbienceService;
    this.backend = backend;
    this.schedulerFactory = schedulerFactory;
    this.getListeners = getListeners;
    this.preferredListenerTokenId = null;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.tickMs = tickMs;
    this.retryMs = Math.max(this.tickMs, Number(retryMs) || 5000);
    this.nowFn = nowFn;
    this.onError = onError;
    this.scene = null;
    this.runtimes = new Map();
    this.failures = new Map();
    this.timer = null;
    this.previewRuntime = null;
    this.liveControls = new Map();
  }


  setPreferredListenerToken(tokenOrId) {
    const id = typeof tokenOrId === "string"
      ? tokenOrId
      : (tokenOrId?.id ?? tokenOrId?.document?.id ?? null);
    this.preferredListenerTokenId = id ? String(id) : null;
  }

  clearPreferredListenerToken(id = null) {
    if (id && this.preferredListenerTokenId !== String(id)) return;
    this.preferredListenerTokenId = null;
  }

  resolveScene(sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    if (sceneOrId && typeof sceneOrId === "object") return sceneOrId;
    const id = String(sceneOrId ?? "");
    if (!id) return this.scene ?? globalThis.canvas?.scene ?? null;
    const current = this.scene ?? globalThis.canvas?.scene;
    if (String(current?.id ?? current?._id ?? "") === id) return current;
    return globalThis.game?.scenes?.get?.(id) ?? null;
  }

  #liveControlKey(id, scene = this.scene ?? globalThis.canvas?.scene) {
    const sceneId = String(scene?.id ?? scene?._id ?? "");
    return `${sceneId}:${String(id ?? "")}`;
  }

  async activateScene(scene, { monitor = true } = {}) {
    await this.deactivateScene();
    this.scene = scene ?? null;
    if (monitor && this.scene && this.setIntervalFn) {
      this.timer = this.setIntervalFn(() => {
        void this.tick().catch((error) => this.#reportError(error, { phase: "tick" }));
      }, this.tickMs);
    }
    return this.tick();
  }

  async deactivateScene() {
    if (this.timer != null && this.clearIntervalFn) this.clearIntervalFn(this.timer);
    this.timer = null;
    const runtimes = [...this.runtimes.values()].map((entry) => entry.runtime);
    this.runtimes.clear();
    this.failures.clear();
    await Promise.all(runtimes.map((runtime) => runtime.stop()));
    await this.stopPreview();
    this.scene = null;
  }

  getEmitters(scene = this.scene ?? globalThis.canvas?.scene) {
    return sceneSounds(scene)
      .filter(isAmbienceEmitter)
      .map(emitterDataFromDocument)
      .filter(Boolean)
      .map(cloneData);
  }

  getEmitter(id, scene = this.scene ?? globalThis.canvas?.scene) {
    return this.getEmitters(scene).find((emitter) => emitter.id === id) ?? null;
  }

  getEmittersByKey(key, scene = this.scene ?? globalThis.canvas?.scene) {
    const target = slugifyKey(key, "");
    if (!target) return [];
    return this.getEmitters(scene).filter((emitter) => emitter.key === target);
  }

  getEmitterLiveState(id, sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    const scene = this.resolveScene(sceneOrId);
    const emitter = this.getEmitter(id, scene);
    if (!emitter) return null;
    const controls = this.liveControls.get(this.#liveControlKey(id, scene)) ?? {};
    return {
      id: emitter.id,
      key: emitter.key,
      sceneId: String(scene?.id ?? scene?._id ?? ""),
      active: controls.activeOverride == null ? emitter.enabled !== false : Boolean(controls.activeOverride),
      volume: controls.volumeOverride == null ? emitter.volume : Math.min(1, Math.max(0, Number(controls.volumeOverride) || 0)),
      activeOverride: controls.activeOverride == null ? null : Boolean(controls.activeOverride),
      volumeOverride: controls.volumeOverride == null ? null : Math.min(1, Math.max(0, Number(controls.volumeOverride) || 0)),
      baseEnabled: emitter.enabled !== false,
      baseVolume: emitter.volume
    };
  }

  getEmitterLiveStates(sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    const scene = this.resolveScene(sceneOrId);
    return this.getEmitters(scene).map((emitter) => this.getEmitterLiveState(emitter.id, scene)).filter(Boolean);
  }

  async setEmitterLiveVolume(id, volume, sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    const scene = this.resolveScene(sceneOrId);
    const emitter = this.getEmitter(id, scene);
    if (!emitter) return null;
    const key = this.#liveControlKey(id, scene);
    const controls = this.liveControls.get(key) ?? {};
    controls.volumeOverride = Math.min(1, Math.max(0, Number(volume) || 0));
    this.liveControls.set(key, controls);
    if (scene === (this.scene ?? globalThis.canvas?.scene)) await this.tick();
    return this.getEmitterLiveState(id, scene);
  }

  async setEmitterLiveActive(id, active, sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    const scene = this.resolveScene(sceneOrId);
    const emitter = this.getEmitter(id, scene);
    if (!emitter) return null;
    const key = this.#liveControlKey(id, scene);
    const controls = this.liveControls.get(key) ?? {};
    controls.activeOverride = Boolean(active);
    this.liveControls.set(key, controls);
    if (scene === (this.scene ?? globalThis.canvas?.scene)) await this.tick();
    return this.getEmitterLiveState(id, scene);
  }

  async resetEmitterLiveState(id, sceneOrId = this.scene ?? globalThis.canvas?.scene) {
    const scene = this.resolveScene(sceneOrId);
    const emitter = this.getEmitter(id, scene);
    if (!emitter) return null;
    this.liveControls.delete(this.#liveControlKey(id, scene));
    if (scene === (this.scene ?? globalThis.canvas?.scene)) await this.tick();
    return this.getEmitterLiveState(id, scene);
  }

  #document(id, scene = this.scene ?? globalThis.canvas?.scene) {
    const sounds = scene?.sounds ?? scene?.ambientSounds;
    return sounds?.get?.(id) ?? sceneSounds(scene).find((doc) => (doc.id ?? doc._id) === id) ?? null;
  }

  async createEmitter(input, scene = globalThis.canvas?.scene) {
    if (!globalThis.game?.user?.isGM) throw new Error("Ambience Forge scene emitters can only be created by a GM");
    if (!scene?.createEmbeddedDocuments) throw new Error("No active Scene is available for Ambience Forge emitter creation");
    const ambienceId = String(input?.ambienceId ?? "");
    if (!ambienceId) throw new Error("Ambience Forge emitter ambienceId is required");
    const ambience = this.getAmbienceService()?.getAmbience(ambienceId);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${ambienceId}`);
    const emitter = normalizeEmitterData({
      ...input,
      ambienceId,
      key: input?.key || input?.name || ambience.name
    });
    const [document] = await scene.createEmbeddedDocuments("AmbientSound", [{
      x: emitter.x,
      y: emitter.y,
      radius: emitter.radius,
      volume: emitter.volume,
      easing: emitter.easing,
      walls: emitter.obstructionMode !== EMITTER_OBSTRUCTION_MODES.IGNORE,
      path: SILENCE_PATH,
      flags: {
        [MODULE_ID]: {
          [EMITTER_FLAG]: {
            schemaVersion: EMITTER_SCHEMA_VERSION,
            ambienceId: emitter.ambienceId,
            name: emitter.name || ambience.name,
            key: emitter.key,
            enabled: emitter.enabled !== false,
            obstructionMode: emitter.obstructionMode,
            obstructionAttenuation: emitter.obstructionAttenuation
          }
        }
      }
    }]);
    await this.tick();
    return emitterDataFromDocument(document);
  }

  async updateEmitter(id, input, scene = globalThis.canvas?.scene) {
    if (!globalThis.game?.user?.isGM) throw new Error("Ambience Forge scene emitters can only be updated by a GM");
    const document = this.#document(id, scene);
    if (!document) return null;
    const current = emitterDataFromDocument(document);
    const ambienceId = String(input?.ambienceId ?? current?.ambienceId ?? "");
    if (!ambienceId) throw new Error("Ambience Forge emitter ambienceId is required");
    const ambience = this.getAmbienceService()?.getAmbience(ambienceId);
    if (!ambience) throw new Error(`Unknown Ambience Forge ambience: ${ambienceId}`);
    const merged = { ...current, ...input, id, ambienceId };
    const emitter = normalizeEmitterData({
      ...merged,
      key: input?.key === "" && input?.name === ""
        ? ambience.name
        : (merged.key || merged.name || ambience.name)
    });
    await document.update({
      x: emitter.x,
      y: emitter.y,
      radius: emitter.radius,
      volume: emitter.volume,
      easing: emitter.easing,
      walls: emitter.obstructionMode !== EMITTER_OBSTRUCTION_MODES.IGNORE,
      path: SILENCE_PATH,
      [`flags.${MODULE_ID}.${EMITTER_FLAG}`]: {
        schemaVersion: EMITTER_SCHEMA_VERSION,
        ambienceId: emitter.ambienceId,
        name: emitter.name || ambience.name,
        key: emitter.key,
        enabled: emitter.enabled !== false,
        obstructionMode: emitter.obstructionMode,
        obstructionAttenuation: emitter.obstructionAttenuation
      }
    });
    await this.#restartEmitter(id);
    await this.tick();
    return this.getEmitter(id, scene);
  }

  async deleteEmitter(id, scene = globalThis.canvas?.scene) {
    if (!globalThis.game?.user?.isGM) throw new Error("Ambience Forge scene emitters can only be deleted by a GM");
    const entry = this.runtimes.get(id);
    if (entry) {
      await entry.runtime.stop();
      this.runtimes.delete(id);
    }
    this.failures.delete(id);
    this.liveControls.delete(this.#liveControlKey(id, scene));
    if (scene?.deleteEmbeddedDocuments) await scene.deleteEmbeddedDocuments("AmbientSound", [id]);
    return true;
  }

  async setEmitterEnabled(id, enabled, scene = globalThis.canvas?.scene) {
    return this.updateEmitter(id, { enabled: Boolean(enabled) }, scene);
  }

  async previewEmitter(id, scene = this.scene ?? globalThis.canvas?.scene) {
    const emitter = this.getEmitter(id, scene);
    if (!emitter) return false;
    const ambience = this.getAmbienceService()?.getAmbience(emitter.ambienceId);
    if (!ambience) return false;
    await this.stopPreview();
    const preview = cloneData(ambience);
    preview.masterVolume = (ambience.masterVolume ?? 1) * emitter.volume;
    this.previewRuntime = new AmbienceRuntime({
      ambience: preview,
      backend: this.backend,
      schedulerFactory: this.schedulerFactory,
      stateSelections: this.getAmbienceService()?.getDesiredStateSelections?.(emitter.ambienceId) ?? {}
    });
    await this.previewRuntime.start();
    return true;
  }

  async stopPreview() {
    if (!this.previewRuntime) return false;
    const runtime = this.previewRuntime;
    this.previewRuntime = null;
    await runtime.stop();
    return true;
  }

  async tick() {
    const scene = this.scene ?? globalThis.canvas?.scene;
    if (!scene) return;
    const ambienceService = this.getAmbienceService?.();
    if (!ambienceService) return;
    const listeners = this.getListeners
      ? (this.getListeners() ?? [])
      : defaultListeners(this.preferredListenerTokenId);
    const documents = sceneSounds(scene).filter(isAmbienceEmitter);
    const present = new Set(documents.map((doc) => doc.id ?? doc._id));

    for (const [id, entry] of [...this.runtimes.entries()]) {
      if (!present.has(id)) {
        await entry.runtime.stop();
        this.runtimes.delete(id);
      }
    }

    for (const document of documents) {
      const emitter = emitterDataFromDocument(document);
      if (!emitter) continue;
      const liveState = this.getEmitterLiveState(emitter.id, scene);
      if (!liveState?.active) {
        await this.#stopEmitter(emitter.id);
        continue;
      }
      const effectiveEmitter = { ...emitter, enabled: true, volume: liveState.volume };
      const ambience = ambienceService.getAmbience(emitter.ambienceId);
      if (!ambience) {
        await this.#stopEmitter(emitter.id);
        continue;
      }
      let gain = 0;
      for (const listener of listeners) {
        const distanceGain = computeEmitterGain({ emitter: effectiveEmitter, listener, scene });
        if (!(distanceGain > 0)) continue;
        let obstructed = false;
        if (emitter.obstructionMode !== EMITTER_OBSTRUCTION_MODES.IGNORE) {
          const audibleThroughNativeSource = sourceTestsPoint(document, listener);
          obstructed = audibleThroughNativeSource === false;
        }
        const listenerGain = applyEmitterObstruction(distanceGain, effectiveEmitter, obstructed);
        gain = Math.max(gain, listenerGain);
      }
      const effectiveMaster = (ambience.masterVolume ?? 1) * gain;
      if (effectiveMaster <= 0.0001) {
        await this.#stopEmitter(emitter.id);
        continue;
      }
      let entry = this.runtimes.get(emitter.id);
      const revision = ambienceService.getAmbienceRevision?.(emitter.ambienceId) ?? 0;
      const stateRevision = ambienceService.getAmbienceStateRevision?.(emitter.ambienceId) ?? 0;
      const desiredStates = ambienceService.getDesiredStateSelections?.(emitter.ambienceId) ?? {};
      const failure = this.failures.get(emitter.id);
      if (failure && (failure.ambienceId !== emitter.ambienceId || failure.revision !== revision)) {
        this.failures.delete(emitter.id);
      } else if (failure && this.nowFn() < failure.retryAt) {
        continue;
      }

      try {
        if (!entry || entry.ambienceId !== emitter.ambienceId || entry.revision !== revision) {
          if (entry) {
            await entry.runtime.stop();
            this.runtimes.delete(emitter.id);
          }
          const runtimeAmbience = cloneData(ambience);
          runtimeAmbience.masterVolume = effectiveMaster;
          const runtime = new AmbienceRuntime({
            ambience: runtimeAmbience,
            backend: this.backend,
            schedulerFactory: this.schedulerFactory,
            stateSelections: desiredStates
          });
          await runtime.start();
          entry = { ambienceId: emitter.ambienceId, revision, stateRevision, runtime };
          this.runtimes.set(emitter.id, entry);
        } else {
          if (entry.stateRevision !== stateRevision) {
            for (const group of ambience.stateGroups ?? []) {
              if (!Object.prototype.hasOwnProperty.call(desiredStates, group.key)) continue;
              const stateKey = desiredStates[group.key];
              if (stateKey) await entry.runtime.setState(group.key, stateKey);
              else await entry.runtime.clearState(group.key);
            }
            entry.stateRevision = stateRevision;
          }
          await entry.runtime.setMasterVolume(effectiveMaster, { durationMs: this.tickMs });
        }
        this.failures.delete(emitter.id);
      } catch (error) {
        if (entry) {
          try { await entry.runtime.stop(); } catch {}
          this.runtimes.delete(emitter.id);
        }
        this.failures.set(emitter.id, {
          ambienceId: emitter.ambienceId,
          revision,
          retryAt: this.nowFn() + this.retryMs,
          error
        });
        this.#reportError(error, { emitterId: emitter.id, ambienceId: emitter.ambienceId, retryMs: this.retryMs });
      }
    }
  }

  async #stopEmitter(id) {
    const entry = this.runtimes.get(id);
    if (!entry) return;
    this.runtimes.delete(id);
    await entry.runtime.stop();
  }

  async #restartEmitter(id) {
    this.failures.delete(id);
    await this.#stopEmitter(id);
  }

  #reportError(error, context = {}) {
    try { this.onError?.(error, context); } catch {}
  }

  enforceProxyPath(document, changes) {
    if (!isAmbienceEmitter(document)) return;
    if ("path" in changes && changes.path !== SILENCE_PATH) changes.path = SILENCE_PATH;
    if ("walls" in changes) {
      const mode = prospectiveEmitterMode(document, changes);
      changes.walls = mode !== EMITTER_OBSTRUCTION_MODES.IGNORE;
    }
  }
}

export function registerEmitterHooks(getEmitterService) {
  Hooks.on("canvasReady", (canvasInstance) => {
    const service = getEmitterService();
    if (!service) return;
    const scene = canvasInstance?.scene ?? globalThis.canvas?.scene;
    void service.activateScene(scene);
  });

  Hooks.on("canvasTearDown", () => {
    const service = getEmitterService();
    if (service) void service.deactivateScene();
  });

  Hooks.on("preUpdateAmbientSound", (document, changes) => {
    getEmitterService()?.enforceProxyPath(document, changes);
  });

  for (const hook of ["createAmbientSound", "updateAmbientSound", "deleteAmbientSound"]) {
    Hooks.on(hook, () => {
      const service = getEmitterService();
      if (service) void service.tick();
    });
  }

  for (const hook of ["createWall", "updateWall", "deleteWall"]) {
    Hooks.on(hook, () => {
      const service = getEmitterService();
      if (service) globalThis.setTimeout?.(() => { void service.tick(); }, 0);
    });
  }

  Hooks.on("controlToken", (token, controlled) => {
    const service = getEmitterService();
    if (!service) return;
    if (controlled && globalThis.game?.user?.isGM) service.setPreferredListenerToken(token);
    void service.tick();
  });

  Hooks.on("createToken", (document) => {
    const service = getEmitterService();
    if (!service) return;
    // Token creation is a natural GM preview action. Foundry does not guarantee
    // that a freshly placed Token remains in canvas.tokens.controlled.
    if (globalThis.game?.user?.isGM) service.setPreferredListenerToken(document?.id ?? document?._id);
    void service.tick();
  });

  Hooks.on("updateToken", () => {
    const service = getEmitterService();
    if (service) void service.tick();
  });

  Hooks.on("deleteToken", (document) => {
    const service = getEmitterService();
    if (!service) return;
    service.clearPreferredListenerToken(document?.id ?? document?._id);
    void service.tick();
  });
}
