// Solmarina — every tuning number, colour and name in one place.
// A sun-soaked coastal city 3200 x 2400, built on a road grid. Nothing here comes from any
// commercial game: the city, districts, people and story are all invented for this game.
export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;
export const ROAD_WIDTH = 96;
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const BEACH_TOP = 2280; // sand and sea along the south edge
export const PARK = { x: 1000, y: 1000, w: 400, h: 400 }; // one city block is a park

export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 2000, w: 3200, h: 400, tint: '#e8d9a8' },
  { name: 'Old Town', x: 0, y: 0, w: 800, h: 2000, tint: '#e6d3b3' },
  { name: 'Downtown', x: 800, y: 0, w: 1200, h: 2000, tint: '#d9dde2' },
  { name: 'Portside', x: 2000, y: 0, w: 1200, h: 1200, tint: '#cfd8d3' },
  { name: 'North Hills', x: 2000, y: 1200, w: 1200, h: 800, tint: '#d8e2c8' },
];

export const PLAYER = {
  walkSpeed: 230, runSpeed: 350, radius: 14, health: 100,
  punchDamage: 12, punchRange: 42, punchCooldown: 0.45,
  shootCooldown: 0.28, startAmmo: 24, pistolDamage: 34, bulletSpeed: 900,
};

export const CAR = {
  length: 64, width: 32, accel: 420, brake: 700, reverse: 220,
  maxSpeed: 560, maxReverse: 180, grip: 2.6, drag: 0.55,
};

export const CAR_COLORS = ['#c0392b', '#2e86c1', '#f1c40f', '#7d3c98', '#16a085', '#e67e22', '#ecf0f1', '#2c3e50', '#e84393', '#00b894'];
export const CAR_NAMES = ['Comet', 'Sandpiper', 'Marlin', 'Dune Buggy', 'Harbor Van', 'Sunset Coupe', 'Palm Sedan', 'Coral Hatch'];

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const POLICE_CAR_COLOR = '#1a3a8f';
export const WANTED_DECAY_SECONDS = 14;
export const MAX_WANTED = 5;

export const MISSIONS = [
  {
    id: 1, title: 'The Pickup', giver: 'Rosa Delgado',
    intro: 'Rosa needs a driver. Pick up her cousin at the Marina and get him to the safehouse in Old Town — fast.',
    reward: 500, timeLimit: 150,
  },
  {
    id: 2, title: 'Hot Courier', giver: 'Rosa Delgado',
    intro: 'A package for the Portside docks. The harbour police are already watching — expect heat.',
    reward: 800, timeLimit: 180,
  },
  {
    id: 3, title: 'Harbor Showdown', giver: 'Marco Solis',
    intro: 'The Coral Crew moved on the docks. Take down their four enforcers, then lose the heat and get home.',
    reward: 1500, timeLimit: 0,
  },
];

export const TAXI_FARE_MIN = 50;
export const TAXI_FARE_MAX = 120;
export const CASH_BAG_VALUE = 100;
export const CASH_BAG_COUNT = 8;

export const PALETTE = {
  sky: '#f7e8c8', grass: '#7fb069', parkGreen: '#5d9b4a', sand: '#eed9a4', sea: '#2e86c1',
  seaDeep: '#1f618d', road: '#3d4450', roadEdge: '#2c313a', sidewalk: '#b9bec7',
  lane: '#f5d76e', building: '#c98f5f', roof: '#8e5b3a', window: '#bfe3f0',
  panel: 'rgba(12,18,28,0.82)', text: '#f4f1e8', muted: '#c9c2b2', gold: '#f2c94c',
  health: '#58d68d', healthLow: '#e74c3c', wanted: '#ffd700', police: '#3b6cff',
  marker: '#ffe14d', markerGreen: '#2ecc71', markerRed: '#ff5a4e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const SAVE_KEY = 'solmarina.save.v1';
export const BEST_KEY = 'solmarina.best.v1';
