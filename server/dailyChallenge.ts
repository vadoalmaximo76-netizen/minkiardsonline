import { CARD_DATA } from '../client/src/lib/cardData';

export interface DailyScenario {
  date: string;
  seed: number;
  playerCharacters: string[];
  playerMosse: string[];
  playerBonus: string[];
  cpuOpponents: Array<{
    level: 'easy' | 'medium' | 'hard';
    name: string;
    characters: string[];
    mosse: string[];
    bonus: string[];
  }>;
}

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function dateToSeed(dateStr: string): number {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    const char = dateStr.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) & 0xffffffff;
    return (this.seed >>> 0) / 0xffffffff;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(0, arr.length - 1)];
  }

  sample<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    const result: T[] = [];
    for (let i = 0; i < Math.min(n, copy.length); i++) {
      const idx = this.nextInt(0, copy.length - 1);
      result.push(copy[idx]);
      copy.splice(idx, 1);
    }
    return result;
  }
}

function makeCardId(deckType: string, index: number): string {
  return `${deckType}-${index}`;
}

export function generateDailyScenario(dateStr?: string): DailyScenario {
  const date = dateStr || getTodayDate();
  const seed = dateToSeed(date);
  const rng = new SeededRandom(seed);

  const personaggiUrls = (CARD_DATA as any).personaggi as string[];
  const mosseUrls = (CARD_DATA as any).mosse as string[];
  const bonusUrls = (CARD_DATA as any).bonus as string[];

  const totalPersonaggi = personaggiUrls.length;
  const totalMosse = mosseUrls.length;
  const totalBonus = bonusUrls.length;

  const pickIndices = (total: number, n: number): number[] => {
    const indices: number[] = [];
    const used = new Set<number>();
    while (indices.length < n) {
      const idx = rng.nextInt(0, total - 1);
      if (!used.has(idx)) {
        used.add(idx);
        indices.push(idx);
      }
    }
    return indices;
  };

  const playerCharIndices = pickIndices(totalPersonaggi, 3);
  const playerMosseIndices = pickIndices(totalMosse, 10);
  const playerBonusIndices = pickIndices(totalBonus, 10);

  const playerCharacters = playerCharIndices.map(i => makeCardId('personaggi', i));
  const playerMosse = playerMosseIndices.map(i => makeCardId('mosse', i));
  const playerBonus = playerBonusIndices.map(i => makeCardId('bonus', i));

  const CPU_NAMES = [
    'Avversario Facile',
    'Avversario Medio',
    'Avversario Difficile',
  ];
  const levels: Array<'easy' | 'medium' | 'hard'> = ['easy', 'medium', 'hard'];

  const cpuOpponents = levels.map((level, idx) => {
    const cpuCharIndices = pickIndices(totalPersonaggi, 2);
    const cpuMosseIndices = pickIndices(totalMosse, 8);
    const cpuBonusIndices = pickIndices(totalBonus, 8);
    return {
      level,
      name: CPU_NAMES[idx],
      characters: cpuCharIndices.map(i => makeCardId('personaggi', i)),
      mosse: cpuMosseIndices.map(i => makeCardId('mosse', i)),
      bonus: cpuBonusIndices.map(i => makeCardId('bonus', i)),
    };
  });

  return {
    date,
    seed,
    playerCharacters,
    playerMosse,
    playerBonus,
    cpuOpponents,
  };
}

export function getSecondsUntilReset(): number {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
}

export function getTodayDateString(): string {
  return getTodayDate();
}

export function calculateChallengeScore(params: {
  ptiRemaining: number;
  starsRemaining: number;
  specialMovesUsed: number;
  turnsUsed: number;
}): number {
  const { ptiRemaining, starsRemaining, specialMovesUsed, turnsUsed } = params;
  const score =
    ptiRemaining * 10 +
    starsRemaining * 50 +
    specialMovesUsed * 30 -
    turnsUsed * 5;
  return Math.max(0, score);
}
