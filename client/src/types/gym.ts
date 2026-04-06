import { StarterDeckOption } from '../components/StarterDeckSelection';

export interface CpuConfig {
  name: string;
  imageUrl: string;
  cpuLevel: string;
  customDeck: string[];
  leaderMessages: Record<string, string[]>;
}

export interface GymLeader {
  id: number;
  orderIndex: number;
  name: string;
  gymName: string;
  description: string | null;
  specialty: string | null;
  leaderImageUrl: string | null;
  badgeImageUrl: string | null;
  backgroundImageUrl: string | null;
  cpuLevel: string;
  deckBias: { personaggi: number; mosse: number; bonus: number };
  customDeck: string[];
  livesCount: number;
  playerStartingDeck: string[];
  starterDeckOptions?: StarterDeckOption[];
  rewardCredits: number;
  rewardDescription: string | null;
  youtubeMusicUrl: string | null;
  leaderMessages: Record<string, string[]> | null;
  cpuCount: number;
  cpuConfigs: CpuConfig[];
  attackMode: 'free_for_all' | 'hunt_human';
  isActive?: boolean;
  isHidden?: boolean;
  requiredFaction?: string | null;
}
