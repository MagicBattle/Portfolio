# Unova Diorama

My portfolio as a floating, low-poly Unova region built in Three.js. Scroll to fly the camera across the island; every town is a project, presented as a Pokémon Black/White gym-battle intro with an animated Gen 5 sprite. Ten stops, ten badges, and the Pokémon League is the contact page.

**Live:** GitHub Pages (static, no build step).

## Run locally

```bash
python3 -m http.server 8321
```

Then open http://localhost:8321. Any static server works; the site needs to be served over HTTP (not `file://`) because it uses ES modules.

## How it works

- `js/region.js` builds the whole island from primitives: coastline, bay, routes, instanced trees, towns, Skyarrow Bridge, the Nimbasa Ferris wheel, the Driftveil drawbridge, Chargestone crystals, Mistralton's circling plane, Dragonspiral Tower, Opelucid, and the League.
- `js/main.js` runs the scene: bloom post-processing, a Catmull-Rom camera rail driven by scroll, fireflies, stars, and the Pokémon billboards.
- `js/gif.js` decodes the official animated GIF sprites into crisp nearest-neighbour textures.
- `js/audio.js` streams Black/White town themes from archive.org with crossfades and a chiptune fallback.
- `js/data.js` is the only file you edit to change projects, towns, or Pokémon.

Time of day and season follow the visitor's clock, using the Gen 5 rule (the season advances every real month). Override for testing with query params: `?time=morning|day|evening|night&season=spring|summer|autumn|winter`. Add `&debug=1` to keep rendering in a hidden tab.

## Credits

Sprites and music are Nintendo / Game Freak / The Pokémon Company. Sprites come from the [PokeAPI sprite repo](https://github.com/PokeAPI/sprites), music from archive.org. This is fan work.
