// A small seeded random generator (mulberry32): the same seed gives the same city, the same
// traffic and the same screenshot scenes, which is what makes ?shot= reproducible.
export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item from an array with the seeded generator. */
export function pickRandom(random, array) {
  return array[Math.floor(random() * array.length)];
}

/** A number between min (inclusive) and max (exclusive) from the seeded generator. */
export function rangeRandom(random, min, max) {
  return min + random() * (max - min);
}
