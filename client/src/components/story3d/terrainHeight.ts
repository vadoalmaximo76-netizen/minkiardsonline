/**
 * getGroundY — mirrors the exact height formula used by Terrain3D.tsx.
 * Call this to find the terrain surface Y at any world (x, z) coordinate
 * so that NPCs, players and other objects sit on top of the ground.
 */
export function getGroundY(x: number, z: number): number {
  const h =
    Math.sin(x * 0.015) * Math.cos(z * 0.02) * 1.4 +
    Math.sin(x * 0.04 + 1.3) * Math.sin(z * 0.035) * 0.7 +
    Math.sin(x * 0.08 + 0.7) * Math.cos(z * 0.06 + 0.4) * 0.3;

  const flatSpawn = Math.max(0, 1 - Math.sqrt(x * x + (z - 170) ** 2) / 40);
  const flatCity  = Math.max(0, 1 - Math.sqrt(x * x + (z - 10)  ** 2) / 35);
  const flatBlend = Math.min(1, flatSpawn + flatCity);

  return h * (1 - flatBlend);
}
