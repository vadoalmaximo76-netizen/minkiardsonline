import type { GymLeader } from '../../types/gym';

export type BuildingType = 'house' | 'shop' | 'inn' | 'tower' | 'ruin' | 'church' | 'arcade' | 'farm' | 'barn';

export interface OtherPlayer {
  userId: number;
  username: string;
  avatar: string | null;
  x: number;
  z: number;
}

export interface StoryWorldBuildingDatum {
  x: number; z: number; type: BuildingType; w: number; h: number;
}

export interface StoryWorldTreeDatum {
  x: number; z: number; h: number; r: number;
}

export interface StoryWorldRoadDatum {
  x1: number; z1: number; x2: number; z2: number; w: number;
}

export interface StoryWorldCollectible {
  id: number;
  type: string;
  posX: number;
  posZ: number;
  creditValue?: number;
  cardId?: string | null;
}

export interface StoryWorld3DProps {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  otherPlayersRef: React.MutableRefObject<Map<number, OtherPlayer>>;
  leaders: GymLeader[];
  arenaPositions: [number, number][];
  getLeaderStatus: (leader: GymLeader) => 'completed' | 'available' | 'locked';
  visibleCollectibles: StoryWorldCollectible[];
  buildingData: StoryWorldBuildingDatum[];
  treeData: StoryWorldTreeDatum[];
  roadData?: StoryWorldRoadDatum[];
  onChallengeLeader: (leader: GymLeader) => void;
  onClickCollectible: (c: StoryWorldCollectible) => void;
}
