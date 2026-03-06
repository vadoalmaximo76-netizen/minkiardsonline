export type AttackEffectType = 'physical' | 'fire' | 'lightning' | 'energy' | 'critical' | 'death';

const fireKeywords = ['fuoco', 'fire', 'fiamma', 'flame', 'burn', 'brucia', 'inferno', 'blazing', 'incendio', 'vulcano', 'fiammata'];
const lightningKeywords = ['fulmine', 'elettr', 'lightning', 'thunder', 'tuono', 'scarica', 'shock', 'voltio', 'lampo', 'folgore'];
const energyKeywords = ['energia', 'energy', 'beam', 'raggio', 'kamehameha', 'hadoken', 'laser', 'onda', 'spirito', 'aura', 'cosmo', 'potere', 'power', 'blast', 'burst'];

export function getDamageEffectType(damage: number, moveName?: string): AttackEffectType {
  const name = (moveName || '').toLowerCase();

  if (name) {
    for (const kw of fireKeywords) {
      if (name.includes(kw)) return damage > 80 ? 'critical' : 'fire';
    }
    for (const kw of lightningKeywords) {
      if (name.includes(kw)) return damage > 80 ? 'critical' : 'lightning';
    }
    for (const kw of energyKeywords) {
      if (name.includes(kw)) return damage > 80 ? 'critical' : 'energy';
    }
  }

  if (damage > 80) return 'critical';
  if (damage > 50) return 'energy';
  if (damage > 30) return 'lightning';
  if (damage > 10) return 'fire';
  return 'physical';
}
