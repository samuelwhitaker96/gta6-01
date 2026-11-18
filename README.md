# Solmarina — an open-world crime game

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/samuelwhitaker96/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/samuelwhitaker96/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmarina** is a complete original 2D top-down open-world crime game that runs offline in a
desktop browser from static files — no libraries, no network requests, no build step. Serve
`game/` with any static server and open `game/index.html`.

You are **Marco Solis**, a driver for hire in the sun-soaked coastal city of Solmarina. Rosa
Delgado has three jobs for you — a getaway pickup, a hot courier run across town, and a final
showdown with the Coral Crew at the harbor. Between jobs, steal cars, take taxi fares, and find
cash stashes hidden around the city.

## What is in the game

- **An open city to explore** — a road grid with intersections, distinct districts (Old Town,
  Downtown, Portside, North Hills, Marina Bay), a park, and a beach promenade, with a camera
  that follows you.
- **On foot and by car** — walk, run, punch, and shoot; enter and steal parked and traffic
  cars; drive with acceleration, braking, steering, and collisions.
- **Traffic and pedestrians** — cars follow the roads and turn at intersections; pedestrians
  walk the sidewalks and scatter when danger comes close.
- **Wanted level** — stealing cars, hitting pedestrians, and shooting raise your stars; police
  cars chase and ram you, foot cops chase you down and arrest you, and the heat decays when you
  lie low.
- **Combat** — fists and a pistol with ammo (mouse aim, click to shoot).
- **Three story missions** with objectives, timers, and payouts, plus taxi fares and eight cash
  stashes as side activities.
- **HUD with a minimap** — health, money, wanted stars, mission objective, and a canvas-drawn
  minimap with roads, the player arrow, the mission marker, and police dots.
- **Screens and save** — title screen, pause, mission complete/failed, busted/wasted game
  over, and a win screen after the final mission; progress saves to localStorage.
- **Sound** — WebAudio-synthesised engine hum, sirens, gunshots, and jingles; no audio files.
- **Deterministic screenshots** — `?shot=start|foot|mission|chase&seed=1` stages reproducible
  scenes for screenshots.

## Controls

| Keys | Action |
| --- | --- |
| WASD / arrows | Walk / drive (W accelerate, S brake/reverse, A/D steer) |
| Shift | Run on foot |
| E | Enter / exit a car |
| Mouse + click / F | Aim and shoot the pistol |
| J | Punch |
| T | Accept a taxi fare while driving |
| P / Esc | Pause |
| M | Mute |

## Layout

```
game/
  index.html        the page
  src/
    config.js       tuning, city layout, districts, missions, palette
    random.js       seeded RNG (mulberry32) — reproducible cities and shots
    world.js        city generation, game state, geometry, bullets, wanted
    input.js        keyboard and mouse input
    player.js       walking, driving, stealing cars, punching, shooting
    traffic.js      traffic cars and pedestrians
    police.js       police chases, rams, arrests, bullet hits
    missions.js     the three story missions, taxi fares, saving
    render.js       camera and drawing the city, cars, people and screens
    hud.js          health, money, wanted stars, objective, minimap
    audio.js        WebAudio-synthesised sound effects
    shots.js        deterministic ?shot= screenshot staging
    main.js         boot, the fixed-step loop, screens
```

Everything — the city, the names, the characters, the story, the art, and the sounds — is
original. Nothing is taken from any commercial game.

## License

MIT — see `LICENSE`.
