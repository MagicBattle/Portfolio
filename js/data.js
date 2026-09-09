// Stops along the route. `pos` is [x, z] on the island; y is ground level.
// `cam` is the camera offset from the town for that stop; `mon` is the National Dex id
// of the Pokémon that guards it (animated Gen 5 sprites exist for all 649).
export const STOPS = [
  { id: 'nuvema', name: 'Nuvema Town', kind: 'start', pos: [23, 20], cam: [9, 6, 13], mon: 495, monName: 'Snivy',
    track: 'Disc 1/07 - Nuvema Town.mp3' },

  { id: 'accumula', name: 'Accumula Town', kind: 'gym', pos: [20, 11], ground: 0.7, cam: [8, 6, 10], mon: 563, monName: 'Cofagrigus',
    track: 'Disc 1/18 - Accumula Town.mp3', badge: 'trio',
    project: { name: 'PokeVault', blurb: 'A Pokémon card vault. Scan, catalogue and track the value of a physical collection from your pocket.',
      demo: 'https://pocket-epto7uuu0-rata3.vercel.app/', code: null } },

  { id: 'striaton', name: 'Striaton City', kind: 'gym', pos: [14, 3], cam: [-7, 6, 11], mon: 561, monName: 'Sigilyph',
    track: 'Disc 1/32 - Striaton City.mp3', badge: 'basic',
    project: { name: 'SignFlow', blurb: 'Computer vision that translates American Sign Language into text, live, in the browser. Built at Sac Hacks VII.',
      demo: 'https://magicbattle.github.io/SAC-HACKS-VII/', code: 'https://github.com/MagicBattle/SAC-HACKS-VII' } },

  { id: 'nacrene', name: 'Nacrene City', kind: 'gym', pos: [-4, 1], cam: [-6, 6, 12], mon: 523, monName: 'Zebstrika',
    track: 'Disc 1/43 - Nacrene City.mp3', badge: 'insect',
    project: { name: 'The Commute Tax', blurb: 'A D3 scrollytelling story about rising commute times across all 50 states, 2010 to 2024. Parallel coordinates, one line per state.',
      demo: 'https://magicbattle.github.io/ECS-163-Project/', code: 'https://github.com/MagicBattle/ECS-163-Project' } },

  { id: 'castelia', name: 'Castelia City', kind: 'gym', pos: [7, 17], cam: [6, 9, 16], mon: 609, monName: 'Chandelure',
    track: 'Disc 1/53 - Castelia City.mp3', badge: 'bolt',
    project: { name: 'Graveyard Shift', blurb: 'A first-person 3D horror game in Godot. Inspect playrooms on the night shift while an animatronic named Willie hunts you.',
      demo: 'https://magicbattle.itch.io/graveyard-shift', code: 'https://github.com/MagicBattle/Graveyard-Shift' } },

  { id: 'nimbasa', name: 'Nimbasa City', kind: 'gym', pos: [6, 6], cam: [9, 7, 12], mon: 581, monName: 'Swanna',
    track: 'Disc 1/57 - Nimbasa City.mp3', badge: 'quake',
    project: { name: 'Swimly', blurb: 'A HackDavis 2025 build for swimmers: log sessions, track pace and keep the streak alive.',
      demo: 'https://magicbattle.github.io/HackDavis25/', code: 'https://github.com/MagicBattle/HackDavis25' } },

  { id: 'driftveil', name: 'Driftveil City', kind: 'gym', pos: [-15, 10], cam: [-9, 7, 12], mon: 587, monName: 'Emolga',
    track: 'Disc 2/02 - Driftveil City.mp3', badge: 'jet',
    project: { name: 'FlipIt', blurb: 'Flip a food label, know what you are eating. React + FastAPI + Claude read the ingredients and flag the ones to watch. HackDavis 2026.',
      demo: 'https://magicbattle.github.io/hackDavis2026/', code: 'https://github.com/MagicBattle/hackDavis2026' } },

  { id: 'chargestone', name: 'Chargestone Cave', kind: 'gym', pos: [-19, -2], cam: [-10, 8, 10], mon: 497, monName: 'Serperior',
    track: 'Disc 2/08 - Chargestone Cave.mp3', badge: 'freeze',
    project: { name: 'Green Checker', blurb: 'Paste a URL, get a sustainability report card for the website. Built at sacHacks 6.',
      demo: 'https://magicbattle.github.io/sacHacks/', code: 'https://github.com/MagicBattle/sacHacks' } },

  { id: 'mistralton', name: 'Mistralton City', kind: 'gym', pos: [-16, -12], cam: [-8, 7, -12], mon: 584, monName: 'Vanilluxe',
    track: 'Disc 2/09 - Mistralton City.mp3', badge: 'legend',
    project: { name: 'Recipe Generator', blurb: 'Tell it what is in the fridge. AI suggests a meal and pulls a YouTube walkthrough to cook it.',
      demo: 'https://magicbattle.github.io/RecipeGenerator/', code: 'https://github.com/MagicBattle/RecipeGenerator' } },

  { id: 'icirrus', name: 'Icirrus City', kind: 'gym', pos: [-6, -18], cam: [2, 7, -12], mon: 526, monName: 'Gigalith',
    track: 'Disc 2/14 - Icirrus City.mp3', badge: 'wave',
    project: { name: 'Rock Paper Scissors', blurb: 'The first thing I ever built in JavaScript. Best of five against the machine. Still undefeated (the machine).',
      demo: 'https://magicbattle.github.io/rock-paper-scissors/', code: 'https://github.com/MagicBattle/rock-paper-scissors' } },

  { id: 'opelucid', name: 'Opelucid City', kind: 'gym', pos: [11, -14], cam: [10, 8, -10], mon: 601, monName: 'Klinklang',
    track: 'Disc 2/24 - Opelucid City (Black).mp3', badge: 'toxic',
    project: { name: 'Watch Landing Page', blurb: 'A landing page for a watch brand. Pure HTML and CSS, the project where layout finally clicked.',
      demo: 'https://magicbattle.github.io/Landing-page/', code: 'https://github.com/MagicBattle/Landing-page' } },

  { id: 'league', name: 'Pokémon League', kind: 'end', pos: [20, -23], ground: 2.3, cam: [8, 7, -10], mon: 643, monName: 'Reshiram',
    track: 'Disc 2/29 - Pokémon League.mp3' },
];

export const PROJECT_STOPS = STOPS.filter(s => s.kind === 'gym');

export const AUDIO_BASE = 'https://archive.org/download/pkmn-black-white-soundtrack/';
export const TRACKS = {
  gym: 'Disc 1/46 - Battle! (Gym Leader).mp3',
  badge: 'Disc 1/49 - Obtained a Badge!.mp3',
};

export const SPRITE_BASE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/';
export const spriteGif = id => `${SPRITE_BASE}animated/${id}.gif`;
export const spritePng = id => `${SPRITE_BASE}${id}.png`;

// Gen 5 season rule: the season advances every real month and cycles every four.
export function currentSeason(d = new Date()) {
  return ['spring', 'summer', 'autumn', 'winter'][d.getMonth() % 4];
}
export function currentPhase(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 9) return 'morning';
  if (h >= 9 && h < 17) return 'day';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}
