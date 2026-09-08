import test from "node:test";
import assert from "node:assert/strict";
import { RandomScheduler } from "../../scripts/core/random-scheduler.js";
import { ManualClock } from "../helpers/manual-clock.js";

test("scheduler contains asynchronous callback failures instead of leaking unhandled rejections", async () => {
  const clock = new ManualClock();
  const errors = [];
  const scheduler = new RandomScheduler({ clock, onError: (error) => errors.push(error) });
  scheduler.schedule(25, async () => { throw new Error("broken source"); });
  await clock.advance(25);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].message, "broken source");
  assert.equal(scheduler.handles.size, 0);
});
