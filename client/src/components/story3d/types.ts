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

/* ── NPC figure types (ghost ambush + wizard reward + avenger) ─── */
export interface GhostFig {
  id: number;
  x: number;
  z: number;
}

export type WizardState = 'walking-to' | 'dialogue' | 'walking-away' | 'done';

export interface WizardFig {
  x: number;
  z: number;
  state: WizardState;
  dialogueTimer: number;
}

/** Avenger Borbonico dark figure — moves toward the player once spawned */
export interface DarkFig {
  x: number;
  z: number;
}

export interface StoryWorld3DProps {
  playerRef: React.MutableRefObject<{ x: number; z: number }>;
  otherPlayersRef: React.MutableRefObject<Map<number, OtherPlayer>>;
  selfUserId?: number;
  /** Shared day-time ref (0..1) written by DayNight3D and readable outside the Canvas */
  dayTimeRef?: React.MutableRefObject<number>;
  /** Shared ref written by PlayerCamera3D, read by tick for camera-relative movement */
  cameraYawRef?: React.MutableRefObject<number>;
  /** When true, single-touch drag on the 3D canvas rotates the camera (mobile cam-mode) */
  mobileCamRotateRef?: React.MutableRefObject<boolean>;
  /** Quadrato ghost-ambush figure positions (updated by game tick) */
  ghostFigsRef?: React.MutableRefObject<GhostFig[]>;
  /** Wizard reward NPC state (null when not active) */
  wizardFigRef?: React.MutableRefObject<WizardFig | null>;
  /** Avenger Borbonico dark figure (null when not active) */
  darkFigRef?: React.MutableRefObject<DarkFig | null>;
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
