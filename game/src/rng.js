// A tiny seeded random generator (mulberry32) so the city, traffic and the
// screenshot scenes are identical every time the same seed is used.
export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max]. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of the array, uniformly. */
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    /** True with probability p (0..1). */
    chance(p) {
      return next() < p;
    },
  };
}
