import test from "node:test";
import assert from "node:assert/strict";
import { FoundryAudioBackend } from "../../scripts/audio/foundry-audio-backend.js";

function makeParam() {
  return {
    value: 1,
    calls: [],
    setValueAtTime(value, time) { this.value = value; this.calls.push(["set", value, time]); },
    linearRampToValueAtTime(value, time) { this.value = value; this.calls.push(["ramp", value, time]); },
    cancelScheduledValues(time) { this.calls.push(["cancel", time]); }
  };
}

function makeContext() {
  const created = [];
  const connections = [];
  const context = {
    currentTime: 2,
    destination: { id: "native-destination" },
    gainNode: { id: "environment-master" },
    decoded: 0,
    async decodeAudioData() { this.decoded += 1; return { duration: 12.5 }; },
    createBufferSource() {
      const listeners = new Map();
      const node = {
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        started: false,
        stopped: false,
        connect(target) { connections.push(["source", target]); },
        disconnect() {},
        addEventListener(type, fn) { listeners.set(type, fn); },
        start() { this.started = true; },
        stop() { this.stopped = true; listeners.get("ended")?.(); }
      };
      created.push(node);
      return node;
    },
    createGain() {
      return { gain: makeParam(), connect(target) { connections.push(["gain", target]); }, disconnect() {} };
    },
    created,
    connections
  };
  return context;
}

test("repeating audio is decoded to one Web Audio buffer source and looped directly", async () => {
  const context = makeContext();
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context, buffers: new Map() },
    fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(16) })
  });
  const handle = await backend.startLoop({ src: "Sounds/rain%20loop.ogg", volume: 0.5, loopStart: 1, loopEnd: 10 });
  assert.equal(handle.sourceNode.loop, true);
  assert.equal(handle.sourceNode.loopStart, 1);
  assert.equal(handle.sourceNode.loopEnd, 10);
  assert.equal(handle.sourceNode.started, true);
  assert.equal(handle.durationMs, 12500);
  assert.equal(context.decoded, 1);
});

test("loop buffers use Foundry's shared audio buffer cache when available", async () => {
  const context = makeContext();
  let fetches = 0;
  const buffers = new Map();
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context, buffers },
    fetchFn: async () => { fetches += 1; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }
  });
  await backend.startLoop({ src: "rain.ogg" });
  await backend.startLoop({ src: "rain.ogg" });
  assert.equal(fetches, 1);
  assert.equal(context.decoded, 1);
  assert.equal(buffers.has("rain.ogg"), true);
});

test("loop output connects through Foundry's Environment master gain", async () => {
  const context = makeContext();
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context, buffers: new Map() },
    fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  });
  await backend.startLoop({ src: "forest.ogg" });
  const gainConnection = context.connections.find(([kind]) => kind === "gain");
  assert.equal(gainConnection?.[1], context.gainNode);
});

test("one-shot playback uses Foundry Sound so long sequence files may stream", async () => {
  const context = makeContext();
  const calls = [];
  let endedCallback = null;
  const sound = {
    duration: 180,
    async load() { calls.push(["load"]); return this; },
    async play(options) { calls.push(["play", options]); endedCallback = options.onended; return this; },
    async stop(options) { calls.push(["stop", options]); endedCallback?.(); return this; },
    async fade(volume, options) { calls.push(["fade", volume, options]); }
  };
  const audioHelper = {
    unlock: Promise.resolve(),
    environment: context,
    buffers: new Map(),
    create(options) { calls.push(["create", options]); return sound; }
  };
  const backend = new FoundryAudioBackend({ audioHelper, fetchFn: async () => { throw new Error("one-shots should not fetch directly"); } });
  const handle = await backend.playOneShot({ src: "long-song.ogg", volume: 0.4, fadeInMs: 250 });
  assert.equal(handle.kind, "foundry-sound");
  assert.equal(handle.durationMs, 180000);
  assert.equal(calls[0][0], "create");
  assert.equal(calls[0][1].context, context);
  assert.equal(calls[0][1].singleton, false);
  assert.deepEqual(calls.find(([type]) => type === "play")[1].volume, 0.4);
  await backend.setVolume(handle, 0.2, { durationMs: 100 });
  assert.deepEqual(calls.find(([type]) => type === "fade").slice(1), [0.2, { duration: 100 }]);
  await backend.stop(handle, { fadeOutMs: 300 });
  assert.equal(handle.stopped, true);
  await handle.ended;
});

test("failed crossfade cleans up the newly-created loop source", async () => {
  const context = makeContext();
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context, buffers: new Map() },
    fetchFn: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })
  });
  const previous = await backend.startLoop({ src: "light.ogg", volume: 1 });
  const originalSetVolume = backend.setVolume.bind(backend);
  backend.setVolume = async (handle, volume, options) => {
    if (handle?.src === "heavy.ogg") throw new Error("transition gain failure");
    return originalSetVolume(handle, volume, options);
  };

  await assert.rejects(
    () => backend.crossfade(previous, { src: "heavy.ogg", volume: 1, durationMs: 1000 }),
    /transition gain failure/
  );

  assert.equal(context.created.length, 2);
  const newlyCreatedSource = context.created[1];
  assert.equal(newlyCreatedSource.stopped, true);
  assert.equal(previous.stopped, false);
});
