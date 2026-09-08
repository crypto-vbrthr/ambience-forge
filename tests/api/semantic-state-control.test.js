import test from "node:test";
import assert from "node:assert/strict";
import { createPublicApi } from "../../scripts/api/public-api.js";
import { AmbienceService } from "../../scripts/core/ambience-service.js";
import { FakeAudioBackend } from "../helpers/fake-audio-backend.js";

class MemoryStore {
  constructor(items = []) { this.items = items; }
  async loadAll() { return this.items; }
  async saveAll(items) { this.items = items; }
}

function composition(id, key, groupKey, stateKey) {
  return {
    id,
    key,
    name: id,
    tracks: [],
    stateGroups: groupKey ? [{
      id: `${id}-group`, key: groupKey, name: groupKey,
      states: [{ id: `${id}-state`, key: stateKey, name: stateKey }]
    }] : []
  };
}

async function setup() {
  const service = new AmbienceService({
    store: new MemoryStore([
      composition("forest-a", "forest", "weather", "storm"),
      composition("forest-b", "forest", "weather", "rain"),
      composition("tavern", "tavern", "situation", "combat")
    ]),
    backend: new FakeAudioBackend()
  });
  await service.initialize();
  return service;
}

test("service discovers semantic composition, group, and state keys", async () => {
  const service = await setup();
  assert.deepEqual(service.getAmbiencesByKey("forest").map((entry) => entry.id), ["forest-a", "forest-b"]);
  assert.deepEqual(service.getCompatibleAmbienceIds("weather", "storm"), ["forest-a"]);
  const catalog = service.getStateCatalog();
  const forest = catalog.compositions.find((entry) => entry.id === "forest-a");
  assert.equal(forest.key, "forest");
  assert.equal(forest.groups[0].key, "weather");
  assert.equal(forest.groups[0].states[0].key, "storm");
  assert.equal(forest.groups[0].states[0].trackOverrides, undefined);
});

test("setStateByKey targets only matching compatible compositions", async () => {
  const service = await setup();
  const api = createPublicApi({ getService: () => service, getModuleVersion: () => "test" });
  const ids = await api.setStateByKey({
    ambience: "forest",
    group: "weather",
    state: "storm",
    owner: "weather-forge",
    broadcast: false
  });
  assert.deepEqual(ids, ["forest-a"]);
  assert.deepEqual(service.getDesiredStateSelections("forest-a"), { weather: "storm" });
  assert.deepEqual(service.getDesiredStateSelections("forest-b"), {});
});

test("active semantic state control includes enabled scene emitter compositions", async () => {
  const service = await setup();
  await service.playAmbience("forest-a");
  const emitterService = {
    getEmitters: () => [
      { id: "e1", ambienceId: "tavern", enabled: true },
      { id: "e2", ambienceId: "forest-b", enabled: false }
    ]
  };
  const api = createPublicApi({
    getService: () => service,
    getEmitterService: () => emitterService,
    getModuleVersion: () => "test"
  });

  const weatherIds = await api.setStateForActiveAmbiences({
    group: "weather",
    state: "storm",
    owner: "weather-forge",
    broadcast: false
  });
  assert.deepEqual(weatherIds, ["forest-a"]);

  const situationIds = await api.setStateForActiveAmbiences({
    group: "situation",
    state: "combat",
    owner: "encounter-forge",
    broadcast: false
  });
  assert.deepEqual(situationIds, ["tavern"]);
  assert.deepEqual(service.getDesiredStateSelections("tavern"), { situation: "combat" });
});
