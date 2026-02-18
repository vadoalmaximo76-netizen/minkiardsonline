import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../shared/schema';
import { eq } from 'drizzle-orm';
import { jsonStorage } from './jsonStorage';
import { EventEmitter } from 'events';

type ExtDbType = ReturnType<typeof drizzle<typeof schema>>;

let _extDb: ExtDbType | null = null;
let _extDbAvailable = false;

function sanitizeDbUrl(url: string): string {
  return url.replace(/#/g, '%23');
}

function initExtDb() {
  const extUrl = process.env.EXTERNAL_DATABASE_URL;
  if (!extUrl) return;

  try {
    const sql = neon(sanitizeDbUrl(extUrl));
    _extDb = drizzle(sql, { schema });
    _extDbAvailable = true;
    console.log('📡 External database sync service initialized');
  } catch (error) {
    console.warn('⚠️ External database sync unavailable:', error);
    _extDb = null;
    _extDbAvailable = false;
  }
}

initExtDb();

const syncEmitter = new EventEmitter();
syncEmitter.setMaxListeners(50);

interface SyncEvent {
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  where?: any;
}

const syncQueue: SyncEvent[] = [];
let isSyncing = false;

async function processSyncQueue() {
  if (isSyncing || syncQueue.length === 0) return;
  isSyncing = true;

  while (syncQueue.length > 0) {
    const event = syncQueue.shift()!;
    try {
      await syncToExternal(event);
    } catch (err) {
      console.warn(`[Sync] External DB failed for ${event.table}.${event.operation}:`, (err as Error).message);
    }
    try {
      syncToJson(event);
    } catch (err) {
      console.warn(`[Sync] JSON failed for ${event.table}.${event.operation}:`, (err as Error).message);
    }
  }

  isSyncing = false;
}

function cleanData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  const cleaned: any = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '_syncId') continue;
    if (value !== null && typeof value === 'object' && 'queryChunks' in (value as any)) continue;
    if (typeof value === 'object' && value !== null && 'toISOString' in (value as any)) {
      cleaned[key] = value;
      continue;
    }
    cleaned[key] = value;
  }
  return cleaned;
}

const tableMap: Record<string, any> = {
  users: schema.users,
  personaggi: schema.personaggi,
  card_modifications: schema.cardModifications,
  custom_cards: schema.customCards,
  card_skins: schema.cardSkins,
  achievements: schema.achievements,
  mission_templates: schema.missionTemplates,
  tutorial_steps: schema.tutorialSteps,
  player_skins: schema.playerSkins,
  player_achievements: schema.playerAchievements,
  player_daily_missions: schema.playerDailyMissions,
  matches: schema.matches,
  game_events: schema.gameEvents,
  friend_requests: schema.friendRequests,
  friendships: schema.friendships,
  game_invitations: schema.gameInvitations,
  clans: schema.clans,
  clan_members: schema.clanMembers,
  clan_join_requests: schema.clanJoinRequests,
  tournaments: schema.tournaments,
  tournament_participants: schema.tournamentParticipants,
  tournament_matches: schema.tournamentMatches,
  seasonal_events: schema.seasonalEvents,
  seasonal_cards: schema.seasonalCards,
  seasonal_passes: schema.seasonalPasses,
  pass_rewards: schema.passRewards,
  player_pass_progress: schema.playerPassProgress,
  training_tips: schema.trainingTips,
  game_states: schema.gameStates,
  conversations: schema.conversations,
  private_messages: schema.privateMessages,
  push_subscriptions: schema.pushSubscriptions,
  card_collection: schema.cardCollection,
};

function buildWhereFromData(table: any, whereData: any): any {
  if (!whereData || typeof whereData !== 'object') return null;
  if (typeof whereData === 'object' && 'queryChunks' in whereData) return whereData;
  if (typeof whereData === 'object' && 'toSQL' in whereData) return whereData;

  if (whereData.id !== undefined && table.id) {
    return eq(table.id, whereData.id);
  }
  if (whereData.originalCardId !== undefined && table.originalCardId) {
    return eq(table.originalCardId, whereData.originalCardId);
  }
  if (whereData.gameId !== undefined && table.gameId) {
    return eq(table.gameId, whereData.gameId);
  }
  if (whereData.code !== undefined && table.code) {
    return eq(table.code, whereData.code);
  }
  if (whereData.stepId !== undefined && table.stepId) {
    return eq(table.stepId, whereData.stepId);
  }

  return null;
}

async function syncToExternal(event: SyncEvent) {
  if (!_extDbAvailable || !_extDb) return;

  const table = tableMap[event.table];
  if (!table) return;

  const cleaned = cleanData(event.data);

  switch (event.operation) {
    case 'insert':
      try {
        await _extDb.insert(table).values(cleaned);
      } catch (err: any) {
        if (!err.message?.includes('duplicate') && !err.message?.includes('unique')) {
          throw err;
        }
      }
      break;

    case 'update': {
      let whereClause = event.where;
      if (whereClause && typeof whereClause === 'object' && !('queryChunks' in whereClause) && !('toSQL' in whereClause)) {
        whereClause = buildWhereFromData(table, whereClause);
      }
      if (whereClause) {
        try {
          await _extDb.update(table).set(cleaned).where(whereClause);
        } catch (err: any) {
          if (!err.message?.includes('column')) {
            throw err;
          }
        }
      }
      break;
    }

    case 'delete': {
      let whereClause = event.where;
      if (whereClause && typeof whereClause === 'object' && !('queryChunks' in whereClause) && !('toSQL' in whereClause)) {
        whereClause = buildWhereFromData(table, whereClause);
      }
      if (whereClause) {
        await _extDb.delete(table).where(whereClause);
      }
      break;
    }
  }
}

function syncToJson(event: SyncEvent) {
  const syncId = event.data?._syncId;

  const jsonSyncHandlers: Record<string, () => void> = {
    users: () => {
      if (event.operation === 'insert') {
        const existing = jsonStorage.users.getByEmail(event.data.email);
        if (!existing) {
          jsonStorage.users.create({
            username: event.data.username,
            email: event.data.email ?? null,
            password: event.data.password ?? null,
            googleId: event.data.googleId ?? null,
            avatar: event.data.avatar ?? '😀',
            puntiRankiard: typeof event.data.puntiRankiard === 'number' ? event.data.puntiRankiard : 0,
            isAdmin: event.data.isAdmin ?? false,
            resetPasswordToken: null,
            resetPasswordExpires: null,
          });
        }
      } else if (event.operation === 'update' && syncId) {
        const safeData: any = {};
        for (const [k, v] of Object.entries(event.data)) {
          if (k === '_syncId') continue;
          if (typeof v !== 'object' || v === null || v instanceof Date) {
            safeData[k] = v;
          }
        }
        jsonStorage.users.update(syncId, safeData);
      }
    },
    custom_cards: () => {
      if (event.operation === 'insert') {
        const existing = jsonStorage.customCards.getAll().find(c => c.name === event.data.name);
        if (!existing) {
          jsonStorage.customCards.create(event.data);
        }
      } else if (event.operation === 'update' && syncId) {
        jsonStorage.customCards.update(syncId, cleanData(event.data));
      } else if (event.operation === 'delete' && syncId) {
        jsonStorage.customCards.delete(syncId);
      }
    },
    card_modifications: () => {
      if (event.operation === 'insert' || event.operation === 'update') {
        const origId = event.data.originalCardId;
        if (origId) {
          jsonStorage.cardModifications.upsert(origId, cleanData(event.data));
        }
      }
    },
    card_skins: () => {
      if (event.operation === 'insert') {
        const existing = jsonStorage.cardSkins.getAll().find(s => s.name === event.data.name);
        if (!existing) {
          jsonStorage.cardSkins.create(event.data);
        }
      } else if (event.operation === 'update' && syncId) {
        jsonStorage.cardSkins.update(syncId, cleanData(event.data));
      } else if (event.operation === 'delete' && syncId) {
        jsonStorage.cardSkins.delete(syncId);
      }
    },
    personaggi: () => {
      if (event.operation === 'insert') {
        const existing = jsonStorage.personaggiCache.getAll().find(p => p.name === event.data.name);
        if (!existing) {
          jsonStorage.personaggiCache.add(event.data);
        }
      }
    },
    player_skins: () => {
      if (event.operation === 'insert') {
        jsonStorage.playerSkins.create({
          userId: event.data.userId,
          skinId: event.data.skinId,
          isEquipped: event.data.isEquipped ?? false,
        });
      } else if (event.operation === 'update' && syncId) {
        jsonStorage.playerSkins.update(syncId, cleanData(event.data));
      }
    },
    tutorial_steps: () => {
      if (event.operation === 'insert') {
        const existing = jsonStorage.tutorialSteps.getByStepId(event.data.stepId);
        if (!existing) {
          jsonStorage.tutorialSteps.create(event.data);
        }
      } else if (event.operation === 'update' && syncId) {
        jsonStorage.tutorialSteps.update(syncId, cleanData(event.data));
      } else if (event.operation === 'delete' && syncId) {
        jsonStorage.tutorialSteps.delete(syncId);
      }
    },
  };

  const handler = jsonSyncHandlers[event.table];
  if (handler) {
    handler();
  }
}

syncEmitter.on('write', (event: SyncEvent) => {
  syncQueue.push(event);
  setImmediate(() => processSyncQueue());
});

export function emitSync(table: string, operation: 'insert' | 'update' | 'delete', data: any, where?: any) {
  syncEmitter.emit('write', { table, operation, data, where });
}

export function isExtDbAvailable(): boolean {
  return _extDbAvailable;
}
