import test from "node:test";
import assert from "node:assert/strict";
import { AmbienceRuntime } from "../../scripts/core/ambience-runtime.js";
import { RandomScheduler } from "../../scripts/core/random-scheduler.js";
import { normalizeAmbience } from "../../scripts/data/schema.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";
import { ManualClock } from "../helpers/manual-clock.js";

test("runtime starts loop tracks and fades them out on stop", async () => {
  const backend = new FakeAudioBackend();
  const ambience = normalizeAmbience({
    name: "Forest",
    tracks: [{ id: "forest", name: "Forest", type: "loop", source: "forest.ogg", volume: 0.5, fadeInMs: 2000, fadeOutMs: 1500 }]
  });
  const runtime = new AmbienceRuntime({ ambience, backend });
  await runtime.start();
  assert.equal(backend.events[0].type, "startLoop");
  assert.equal(backend.events[0].options.src, "forest.ogg");
  await runtime.stop();
  const stop = backend.events.find((event) => event.type === "stop");
  assert.equal(stop.options.fadeOutMs, 1500);
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
