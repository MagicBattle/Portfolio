# Portfolio

My portfolio as a 3D Pokémon Unova region built with Three.js. Each town is a project, shown as a Pokémon Black/White gym battle intro. Fly from town to town with the scroll wheel or arrow keys, and beat the Pokémon League to reach the contact page.

Plain HTML, CSS, and JavaScript. No build step.

**Live:** https://magicbattle.github.io/Portfolio/

## Run locally

```bash
python3 -m http.server 8321
```

Then open http://localhost:8321. It has to be served over HTTP rather than opened as a file because the site uses ES modules.

## Edit the projects

Everything about the towns and projects is in `js/data.js`. The rest:

- `js/region.js`: builds the island and towns
- `js/main.js`: camera, lighting, and the gym battle screens
- `js/audio.js`: town music
- `css/style.css`: the UI

Test a time of day or season with `?time=night&season=winter` in the URL.

## Credits

Sprites and music belong to Nintendo, Game Freak, and The Pokémon Company. Sprites come from the [PokeAPI sprite repo](https://github.com/PokeAPI/sprites), music from archive.org. This is fan work.
