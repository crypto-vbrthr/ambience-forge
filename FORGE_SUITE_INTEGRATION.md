# Ambience Forge Integration Convention

Ambience Forge is designed as the shared audio-environment service for modules in the Forge Suite. Other Forge modules may use it optionally to control the acoustic state of a scene without knowing which audio files, tracks, volumes, random events, or transitions are used internally.

> External modules describe **what is happening**.  
> Ambience Forge decides **how that situation sounds**.

Ambience Forge remains optional. A Forge module integrating with it must continue to function normally when Ambience Forge is not installed or not active.

## Core concept

An Ambience Forge composition may define several independent state groups. Each state group contains mutually exclusive states, while different groups combine.

```text
Composition: Forest

 time-of-day
 ├── dawn
 ├── day
 ├── dusk
 └── night

 weather
 ├── clear
 ├── rain
 ├── heavy-rain
 ├── storm
 ├── snow
 └── fog

 situation
 ├── calm
 ├── busy
 ├── danger
 └── combat
```

A composition can therefore resolve combinations such as:

```text
forest + night + storm + danger
```

## Semantic keys

Integrations use stable API keys instead of display names or world-specific IDs.

```text
Composition Key
Group Key
State Key
```

Example:

```text
Composition
Name: Silberwald
Key: forest

State Group
Name: Wetter
Key: weather

State
Name: Gewitter
Key: storm
```

Display names may be localized or renamed without breaking integrations as long as the keys remain stable.

## Recommended standard keys

These keys are Forge Suite conventions, not requirements.

### Weather

```text
weather

clear
cloudy
fog
rain
heavy-rain
storm
snow
heavy-snow
hail
```

### Time of day

```text
time-of-day

dawn
day
dusk
night
```

### Situation

```text
situation

calm
busy
danger
combat
celebration
disturbance
```

Modules may introduce additional semantic keys where useful. Users may also map custom keys through the integrating module's configuration.

## Discovery

Integrating modules should prefer discovery over hard-coded assumptions.

```js
const api = game.modules.get("ambience-forge")?.api;
const catalog = api?.getStateCatalog();
```

The catalog contains composition, group, and state IDs, keys, and display names so integrations can build user-friendly dropdowns.

Conceptually:

```js
{
  compositions: [
    {
      id: "...",
      key: "forest",
      name: "Silberwald",
      groups: [
        {
          id: "...",
          key: "weather",
          name: "Wetter",
          states: [
            { id: "...", key: "clear", name: "Trocken" },
            { id: "...", key: "rain", name: "Regen" },
            { id: "...", key: "storm", name: "Gewitter" }
          ]
        }
      ]
    }
  ]
}
```

## Composition-specific control

When an integration needs to target a semantic composition rather than a world-specific ID:

```js
await api.setStateByKey({
  ambience: "forest",
  group: "weather",
  state: "storm",
  owner: "weather-forge"
});
```

To clear the state only if it is still owned by the same integration:

```js
await api.clearStateByKey({
  ambience: "forest",
  group: "weather",
  owner: "weather-forge"
});
```

## Persistent provider context

Long-lived environmental providers should normally publish persistent context instead of addressing only the ambiences that happen to be active at that instant.

Weather Forge can announce:

```js
await api.setContextState({
  group: "weather",
  state: "storm",
  owner: "pf2e-weather-forge"
});
```

Ambience Forge applies the state to compatible compositions immediately and remembers it for compatible compositions started later. Compositions without `weather / storm` simply ignore the context. Provider modules should re-publish their current state when Ambience Forge becomes ready.

The same model is appropriate for Calendar Forge:

```js
await api.setContextState({
  group: "time-of-day",
  state: "night",
  owner: "calendar-forge"
});
```

Short-lived, explicitly scoped actions may still use `setStateForActiveAmbiences()`. For example, an encounter module may choose to affect only the ambiences relevant at the moment combat starts.

## User-defined mapping

Forge Suite modules should not require users to adopt the recommended keys. Where appropriate, integrations should allow mappings selected from `getStateCatalog()`.

Example:

```text
Weather Forge event:
Heavy Thunderstorm

Ambience Forge mapping:
Composition: Silberwald [forest]
Group: Wetter [weather]
State: Schweres Gewitter [violent-storm]
```

This keeps Ambience Forge system-agnostic and supports custom naming schemes.

## Ownership

State requests from external modules should include an `owner`, normally the Foundry module ID.

```text
weather-forge
calendar-forge
atmosphere-forge
region-forge
encounter-forge
```

Ownership prevents a module from clearing a state that has since been replaced by another owner.

## Optional dependency

Ambience Forge must remain optional unless a module exists solely as an Ambience Forge extension.

```js
const module = game.modules.get("ambience-forge");
const api = module?.active ? module.api : null;

if (api?.capabilities?.includes("semantic-state-control-v1")) {
  // Optional Ambience Forge integration.
}
```

The calling module must continue its normal behavior if Ambience Forge is unavailable.

## Responsibility boundaries

External Forge modules are responsible for:

- determining the semantic world state;
- deciding when that state changes;
- optionally allowing users to configure mappings;
- sending semantic state requests to Ambience Forge.

Ambience Forge is responsible for:

- selecting the configured audio behavior;
- activating or deactivating tracks;
- applying relative track volumes;
- combining multiple simultaneous state groups;
- handling fades and crossfades;
- scheduling random sounds;
- managing spatial emitters;
- synchronizing playback between Foundry clients.

External modules should not manipulate individual Ambience Forge tracks unless a specific low-level integration requires it.

## Design principle

```text
Weather Forge -------- weather = storm -----┐
Calendar Forge ------- time-of-day = night --┼--> Ambience Forge --> resolved soundscape
Encounter Forge ------ situation = combat ---┘
```

The module producing world state describes **what is happening**. Ambience Forge owns **what that state sounds like**.
