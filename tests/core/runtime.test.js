import test from "node:test";
import assert from "node:assert/strict";
import { AmbienceRuntime } from "../../scripts/core/ambience-runtime.js";
import { createTrackController } from "../../scripts/core/track-controllers.js";
import { RandomScheduler } from "../../scripts/core/random-scheduler.js";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";
import { ManualClock } from "../helpers/manual-clock.js";

test("runtime starts repeating audio tracks as buffered loops and fades them out on stop", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Forest",
    tracks: [{ id: "forest", name: "Forest", type: "audio", source: "forest.ogg", repeat: true, volume: 0.5, fadeInMs: 2000, fadeOutMs: 1500 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  assert.equal(backend.events[0].type, "startLoop");
  assert.equal(backend.events[0].options.src, "forest.ogg");
  await runtime.stop();
  const stop = backend.events.find((event) => event.type === "stop");
  assert.equal(stop.options.fadeOutMs, 1500);
});

test("runtime plays a non-repeating audio track once", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Intro",
    tracks: [{ id: "intro", name: "Intro", type: "audio", source: "intro.ogg", repeat: false, volume: 0.75, fadeInMs: 250 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  const play = backend.events.find((event) => event.type === "playOneShot");
  assert.equal(play.options.src, "intro.ogg");
  assert.equal(play.options.volume, 0.75);
  assert.equal(play.options.fadeInMs, 250);
});

test("random track uses random delays and avoids direct repetition", async () => {
  const backend = new FakeAudioBackend();
  const clock = new ManualClock();
  const schedulerFactory = () => new RandomScheduler({ random: () => 0, clock });
  const ambience = normalizeAmbience({
    name: "Night",
    tracks: [{ id: "animals", name: "Animals", type: "random", sources: ["owl.ogg", "wolf.ogg"], minDelayMs: 100, maxDelayMs: 100, allowOverlap: true }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend, schedulerFactory });
  await runtime.start();
  await clock.advance(100);
  await clock.advance(100);
  const played = backend.events.filter((event) => event.type === "playOneShot").map((event) => event.options.src);
  assert.deepEqual(played, ["owl.ogg", "wolf.ogg"]);
});

test("intensity track crossfades when it selects another variant", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Rain",
    tracks: [{
      id: "rain",
      name: "Rain",
      type: "intensity",
      intensity: 0,
      transitionMs: 4000,
      variants: [
        { source: "light.ogg" },
        { source: "heavy.ogg" }
      ]
    }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  await runtime.setTrackIntensity("rain", 1);
  const fade = backend.events.find((event) => event.type === "crossfade");
  assert.equal(fade.options.src, "heavy.ogg");
  assert.equal(fade.options.durationMs, 4000);
});


test("sequence track plays entries one after another with the configured gap", async () => {
  const backend = new FakeAudioBackend({ durations: { "song1.ogg": 200, "song2.ogg": 200 } });
  const clock = new ManualClock();
  const schedulerFactory = () => new RandomScheduler({ random: () => 0, clock });
  const ambience = normalizeAmbience({
    name: "Tavern Band",
    tracks: [{ id: "band", name: "Band", type: "sequence", sources: ["song1.ogg", "song2.ogg"], order: "sequential", minDelayMs: 100, maxDelayMs: 100 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend, schedulerFactory });
  await runtime.start();
  await clock.advance(0);
  await clock.advance(299);
  let played = backend.events.filter((event) => event.type === "playOneShot").map((event) => event.options.src);
  assert.deepEqual(played, ["song1.ogg"]);
  await clock.advance(1);
  played = backend.events.filter((event) => event.type === "playOneShot").map((event) => event.options.src);
  assert.deepEqual(played, ["song1.ogg", "song2.ogg"]);
});


test("master volume multiplies track volume and can change live", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Quiet Forest",
    masterVolume: 0.5,
    tracks: [{ id: "forest", name: "Forest", type: "audio", source: "forest.ogg", repeat: true, volume: 0.5 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  const start = backend.events.find((event) => event.type === "startLoop");
  assert.equal(start.options.volume, 0.25);

  await runtime.setMasterVolume(0.2, { durationMs: 150 });
  const set = backend.events.find((event) => event.type === "setVolume");
  assert.equal(set.volume, 0.1);
  assert.equal(set.options.durationMs, 150);
});


test("runtime exposes and updates live intensity state", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Storm",
    tracks: [{
      id: "rain",
      name: "Rain",
      type: "intensity",
      intensity: 0,
      variants: [{ source: "light.ogg" }, { source: "heavy.ogg" }]
    }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  assert.equal(runtime.getTrackIntensities().rain, 0);
  await runtime.setTrackIntensity("rain", 1);
  assert.equal(runtime.getTrackIntensities().rain, 1);
});


test("runtime exposes live track volumes and can stop and restart individual tracks", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Layered Forest",
    masterVolume: 0.5,
    tracks: [{ id: "forest", name: "Forest", type: "audio", source: "forest.ogg", repeat: true, volume: 0.8 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  assert.equal(runtime.getTrackVolumes().forest, 0.8);
  assert.equal(runtime.getTrackActiveStates().forest, true);

  await runtime.setTrackVolume("forest", 0.25, { durationMs: 120 });
  assert.equal(runtime.getTrackVolumes().forest, 0.25);
  const set = backend.events.find((event) => event.type === "setVolume");
  assert.equal(set.volume, 0.125);
  assert.equal(set.options.durationMs, 120);

  await runtime.setTrackActive("forest", false);
  assert.equal(runtime.getTrackActiveStates().forest, false);
  await runtime.setTrackActive("forest", true);
  assert.equal(runtime.getTrackActiveStates().forest, true);
  assert.equal(backend.events.filter((event) => event.type === "startLoop").length, 2);
});

test("finished one-shot handles are released from long-running random controllers", async () => {
  const backend = new FakeAudioBackend();
  const clock = new ManualClock();
  const schedulerFactory = () => new RandomScheduler({ random: () => 0, clock });
  const ambience = normalizeAmbience({
    name: "Night",
    tracks: [{ id: "animals", name: "Animals", type: "random", sources: ["owl.ogg"], minDelayMs: 10, maxDelayMs: 10 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend, schedulerFactory });
  await runtime.start();
  await clock.advance(10);
  const controller = runtime.controllers.get("animals");
  const handle = backend.events.find((event) => event.type === "playOneShot").handle;
  assert.equal(controller.handles.size, 1);
  backend.finish(handle);
  await Promise.resolve();
  assert.equal(controller.handles.size, 0);
  await runtime.stop();
});

test("runtime rolls back already-started tracks when a later track fails to start", async () => {
  class FailingBackend extends FakeAudioBackend {
    async startLoop(options) {
      if (options.src === "broken.ogg") throw new Error("broken source");
      return super.startLoop(options);
    }
  }
  const backend = new FailingBackend();
  const runtime = new AmbienceRuntime({
    ambience: normalizeAmbience({
      id: "rollback",
      name: "Rollback",
      tracks: [
        { id: "good", name: "Good", type: "audio", source: "good.ogg", repeat: true, fadeOutMs: 0 },
        { id: "bad", name: "Bad", type: "audio", source: "broken.ogg", repeat: true, fadeOutMs: 0 }
      ]
    }),
    backend
  });

  await assert.rejects(() => runtime.start(), /broken source/);
  assert.equal(runtime.running, false);
  assert.equal(runtime.controllers.size, 0);
  assert.ok(backend.events.some((event) => event.type === "stop" && event.handle.src === "good.ogg"));
});

test("failed live track restart is rolled back so a later retry remains possible", async () => {
  let fail = true;
  class FailingBackend extends FakeAudioBackend {
    async startLoop(options) {
      if (fail) throw new Error("temporary failure");
      return super.startLoop(options);
    }
  }
  const backend = new FailingBackend();
  const runtime = new AmbienceRuntime({
    ambience: normalizeAmbience({
      id: "retry",
      name: "Retry",
      tracks: [{ id: "track", name: "Track", type: "audio", source: "retry.ogg", repeat: true }]
    }),
    backend
  });
  // Start with the track disabled, then exercise the live toggle path.
  runtime.ambience.tracks[0].enabled = false;
  await runtime.start();
  // The disabled track has no controller, so construct this scenario through a
  // normally active track which is stopped before retrying.
  runtime.ambience.tracks[0].enabled = true;
  const controller = createTrackController({
    track: runtime.ambience.tracks[0],
    backend,
    scheduler: undefined,
    masterVolume: 1
  });
  runtime.controllers.set("track", controller);
  await assert.rejects(() => runtime.setTrackActive("track", true), /temporary failure/);
  assert.equal(controller.running, false);
  fail = false;
  assert.equal(await runtime.setTrackActive("track", true), true);
  assert.equal(controller.running, true);
  await runtime.stop();
});
