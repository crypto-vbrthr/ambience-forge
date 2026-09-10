import test from "node:test";
import assert from "node:assert/strict";
import { AmbienceRuntime } from "../../scripts/core/ambience-runtime.js";
import { RandomScheduler } from "../../scripts/core/random-scheduler.js";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";
import { ManualClock } from "../helpers/manual-clock.js";

function runtimeWithClock(ambience, backend = new FakeAudioBackend(), clock = new ManualClock()) {
  return {
    backend,
    clock,
    runtime: new AmbienceRuntime({
      ambience: normalizeAmbience(ambience),
      backend,
      schedulerFactory: () => new RandomScheduler({ random: () => 0, clock })
    })
  };
}

test("audio loop runtime status exposes source and current loop progress", async () => {
  const { runtime, clock } = runtimeWithClock({
    id: "forest",
    name: "Forest",
    tracks: [{ id: "bed", name: "Bed", type: "audio", source: "forest.ogg", repeat: true }]
  }, new FakeAudioBackend({ durations: { "forest.ogg": 10000 } }));

  await runtime.start();
  let status = runtime.getTrackRuntimeStatus("bed");
  assert.equal(status.phase, "playing");
  assert.equal(status.source, "forest.ogg");
  assert.equal(status.loop, true);
  assert.equal(status.durationMs, 10000);
  assert.equal(status.progress, 0);

  await clock.advance(2500);
  status = runtime.getTrackRuntimeStatus("bed");
  assert.equal(status.elapsedMs, 2500);
  assert.equal(status.remainingMs, 7500);
  assert.equal(status.progress, 0.25);

  await clock.advance(10000);
  status = runtime.getTrackRuntimeStatus("bed");
  assert.equal(status.elapsedMs, 2500);
  assert.equal(status.remainingMs, 7500);
  await runtime.stop();
});

test("one-shot audio becomes finished when its handle ends", async () => {
  const backend = new FakeAudioBackend({ durations: { "sting.ogg": 4000 } });
  const { runtime } = runtimeWithClock({
    id: "sting",
    name: "Sting",
    tracks: [{ id: "one", name: "One", type: "audio", source: "sting.ogg", repeat: false }]
  }, backend);
  await runtime.start();
  const handle = backend.events.find((event) => event.type === "playOneShot").handle;
  assert.equal(runtime.getTrackRuntimeStatus("one").phase, "playing");
  backend.finish(handle);
  await Promise.resolve();
  assert.equal(runtime.getTrackRuntimeStatus("one").phase, "finished");
  await runtime.stop();
});

test("random runtime status distinguishes waiting and playback", async () => {
  const backend = new FakeAudioBackend({ durations: { "owl.ogg": 5000 } });
  const { runtime, clock } = runtimeWithClock({
    id: "night",
    name: "Night",
    tracks: [{
      id: "owls",
      name: "Owls",
      type: "random",
      sources: ["owl.ogg"],
      minDelayMs: 10000,
      maxDelayMs: 10000,
      allowOverlap: true
    }]
  }, backend);

  await runtime.start();
  let status = runtime.getTrackRuntimeStatus("owls");
  assert.equal(status.phase, "waiting");
  assert.equal(status.durationMs, 10000);
  assert.equal(status.remainingMs, 10000);
  assert.equal(status.nextEventInMs, 10000);

  await clock.advance(4000);
  status = runtime.getTrackRuntimeStatus("owls");
  assert.equal(status.remainingMs, 6000);
  assert.equal(status.progress, 0.4);

  await clock.advance(6000);
  status = runtime.getTrackRuntimeStatus("owls");
  assert.equal(status.phase, "playing");
  assert.equal(status.source, "owl.ogg");
  assert.equal(status.activeSoundCount, 1);
  assert.equal(status.nextEventInMs, 10000);

  const handle = backend.events.find((event) => event.type === "playOneShot").handle;
  backend.finish(handle);
  await Promise.resolve();
  status = runtime.getTrackRuntimeStatus("owls");
  assert.equal(status.phase, "waiting");
  assert.equal(status.nextEventInMs, 10000);
  await runtime.stop();
});

test("random overlap status reports multiple active sounds", async () => {
  const backend = new FakeAudioBackend({ durations: { "bird.ogg": 30000 } });
  const { runtime, clock } = runtimeWithClock({
    id: "birds",
    name: "Birds",
    tracks: [{
      id: "calls",
      name: "Calls",
      type: "random",
      sources: ["bird.ogg"],
      minDelayMs: 5000,
      maxDelayMs: 5000,
      allowOverlap: true
    }]
  }, backend);

  await runtime.start();
  await clock.advance(5000);
  await clock.advance(5000);
  const status = runtime.getTrackRuntimeStatus("calls");
  assert.equal(status.phase, "playing");
  assert.equal(status.activeSoundCount, 2);
  assert.equal(status.activeSounds.length, 2);
  await runtime.stop();
});

test("sequence runtime status exposes entry position and the following gap", async () => {
  const backend = new FakeAudioBackend({ durations: { "one.ogg": 2000, "two.ogg": 2000 } });
  const { runtime, clock } = runtimeWithClock({
    id: "sequence",
    name: "Sequence",
    tracks: [{
      id: "music",
      name: "Music",
      type: "sequence",
      sources: ["one.ogg", "two.ogg"],
      order: "sequential",
      minDelayMs: 1000,
      maxDelayMs: 1000
    }]
  }, backend);

  await runtime.start();
  await clock.advance(0);
  let status = runtime.getTrackRuntimeStatus("music");
  assert.equal(status.phase, "playing");
  assert.equal(status.source, "one.ogg");
  assert.equal(status.sequencePosition, 1);
  assert.equal(status.sequenceLength, 2);

  await clock.advance(2000);
  const first = backend.events.find((event) => event.type === "playOneShot").handle;
  backend.finish(first);
  await Promise.resolve();
  status = runtime.getTrackRuntimeStatus("music");
  assert.equal(status.phase, "waiting");
  assert.equal(status.remainingMs, 1000);
  assert.equal(status.nextEventInMs, 1000);

  await clock.advance(1000);
  status = runtime.getTrackRuntimeStatus("music");
  assert.equal(status.phase, "playing");
  assert.equal(status.source, "two.ogg");
  assert.equal(status.sequencePosition, 2);
  await runtime.stop();
});

test("intensity runtime status reports crossfade timing and selected variant", async () => {
  const backend = new FakeAudioBackend({ durations: { "light.ogg": 10000, "heavy.ogg": 10000 } });
  const { runtime, clock } = runtimeWithClock({
    id: "rain",
    name: "Rain",
    tracks: [{
      id: "rain-track",
      name: "Rain",
      type: "intensity",
      intensity: 0,
      transitionMs: 4000,
      variants: [
        { id: "light", name: "Light", source: "light.ogg" },
        { id: "heavy", name: "Heavy", source: "heavy.ogg" }
      ]
    }]
  }, backend);

  await runtime.start();
  await runtime.setTrackIntensity("rain-track", 1);
  let status = runtime.getTrackRuntimeStatus("rain-track");
  assert.equal(status.phase, "crossfading");
  assert.equal(status.variantName, "Heavy");
  assert.equal(status.transition.fromSource, "light.ogg");
  assert.equal(status.transition.toSource, "heavy.ogg");
  assert.equal(status.remainingMs, 4000);

  await clock.advance(2000);
  status = runtime.getTrackRuntimeStatus("rain-track");
  assert.equal(status.phase, "crossfading");
  assert.equal(status.progress, 0.5);

  await clock.advance(2000);
  status = runtime.getTrackRuntimeStatus("rain-track");
  assert.equal(status.phase, "playing");
  assert.equal(status.source, "heavy.ogg");
  assert.equal(status.variantPosition, 2);
  await runtime.stop();
});

test("runtime status returns all track statuses without exposing controller handles", async () => {
  const { runtime } = runtimeWithClock({
    id: "mixed",
    name: "Mixed",
    tracks: [
      { id: "a", name: "A", type: "audio", source: "a.ogg", repeat: true },
      { id: "b", name: "B", type: "random", sources: ["b.ogg"], minDelayMs: 1000, maxDelayMs: 1000 }
    ]
  });
  await runtime.start();
  const status = runtime.getRuntimeStatus();
  assert.equal(status.running, true);
  assert.equal(status.tracks.a.phase, "playing");
  assert.equal(status.tracks.b.phase, "waiting");
  assert.equal(JSON.stringify(status).includes("_resolveEnded"), false);
  await runtime.stop();
});
