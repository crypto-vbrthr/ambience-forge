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
  const context = {
    currentTime: 2,
    destination: {},
    decoded: 0,
    async decodeAudioData() { this.decoded += 1; return { duration: 12.5 }; },
    createBufferSource() {
      const node = {
        loop: false,
        loopStart: 0,
        loopEnd: 0,
        started: false,
        stopped: false,
        connect() {},
        disconnect() {},
        addEventListener() {},
        start() { this.started = true; },
        stop() { this.stopped = true; }
      };
      created.push(node);
      return node;
    },
    createGain() {
      return { gain: makeParam(), connect() {}, disconnect() {} };
    },
    created
  };
  return context;
}

test("repeating audio is decoded to one Web Audio buffer source and looped directly", async () => {
  const context = makeContext();
  let fetches = 0;
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context },
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

test("decoded buffers are cached by source path", async () => {
  const context = makeContext();
  let fetches = 0;
  const backend = new FoundryAudioBackend({
    audioHelper: { unlock: Promise.resolve(), environment: context },
    fetchFn: async () => { fetches += 1; return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }
  });
  await backend.playOneShot({ src: "owl.ogg" });
  await backend.playOneShot({ src: "owl.ogg" });
  assert.equal(fetches, 1);
  assert.equal(context.decoded, 1);
});
