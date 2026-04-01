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
          // Omit DB `id` so JSON storage preserves its own auto-increment IDs
          const { id: _dbId, ...dataWithoutId } = cleanData(event.data);
          jsonStorage.cardModifications.upsert(origId, dataWithoutId);
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

// ── Full Bulk Sync: Neon → Replit DB + JSON ──────────────────────────────────

interface SyncStatus {
  inProgress: boolean;
  lastRun: Date | null;
  lastResult: {
    tablesOk: string[];
    tablesFailed: string[];
    rowsCopiedToReplit: number;
    rowsCopiedToJson: number;
    errors: string[];
    durationMs: number;
  } | null;
}

const _syncStatus: SyncStatus = {
  inProgress: false,
  lastRun: null,
  lastResult: null,
};

export function getSyncStatus(): SyncStatus {
  return { ..._syncStatus };
}

// Tables that have meaningful JSON representations
const JSON_SYNC_TABLES = new Set([
  'users',
  'custom_cards',
  'card_modifications',
  'card_skins',
  'personaggi',
  'achievements',
  'mission_templates',
  'tutorial_steps',
  'player_skins',
]);

// Extract column name from a "column X does not exist" error message
// Returns the camelCase JS key (e.g. "doubleMosse") from snake_case DB column (e.g. "double_mosse")
function extractMissingColumn(err: any): string | null {
  const msg: string = err?.message ?? '';
  // Postgres: column "double_mosse" does not exist
  const m = msg.match(/column "?([a-z_A-Z0-9]+)"? does not exist/i);
  if (!m) return null;
  const snakeCase = m[1];
  // Convert snake_case → camelCase so we can delete the right JS property
  const camelCase = snakeCase.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());
  return camelCase;
}

// Upsert rows from source DB into destination DB, chunked.
// Automatically strips columns unknown to the destination schema (schema divergence).
async function upsertChunked(destDb: ExtDbType, tableKey: string, rows: any[], chunkSize = 50): Promise<number> {
  const tableSchema = tableMap[tableKey];
  if (!tableSchema || rows.length === 0) return 0;

  // Track columns known to be missing in destDb so we strip them upfront
  const missingColumns = new Set<string>();

  const insertChunk = async (chunk: any[]): Promise<number> => {
    const stripped = missingColumns.size > 0
      ? chunk.map(r => { const c = { ...r }; for (const col of missingColumns) delete c[col]; return c; })
      : chunk;
    try {
      await destDb.insert(tableSchema).values(stripped).onConflictDoNothing();
      return stripped.length;
    } catch (err: any) {
      const missing = extractMissingColumn(err);
      if (missing) {
        missingColumns.add(missing);
        // Retry without the missing column
        return insertChunk(chunk);
      }
      // Fall back to row-by-row on other errors
      let count = 0;
      for (const row of stripped) {
        try {
          await destDb.insert(tableSchema).values(row).onConflictDoNothing();
          count++;
        } catch (_e) { /* row exists or incompatible — skip */ }
      }
      return count;
    }
  };

  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    total += await insertChunk(rows.slice(i, i + chunkSize));
  }
  if (missingColumns.size > 0) {
    console.log(`  ℹ️ [BulkSync] ${tableKey}: stripped unknown columns [${[...missingColumns].join(', ')}] (dest schema older)`);
  }
  return total;
}

// Sync a table's rows to JSON storage
function bulkSyncTableToJson(tableKey: string, rows: any[]) {
  if (!JSON_SYNC_TABLES.has(tableKey) || rows.length === 0) return 0;
  let count = 0;
  try {
    if (tableKey === 'card_modifications') {
      for (const row of rows) {
        if (row.originalCardId) {
          // Omit DB `id` so JSON storage preserves its own auto-increment IDs
          const { id: _dbId, ...rowWithoutId } = cleanData(row);
          jsonStorage.cardModifications.upsert(row.originalCardId, rowWithoutId);
          count++;
        }
      }
    } else if (tableKey === 'custom_cards') {
      const existing = jsonStorage.customCards.getAll();
      const existingIds = new Set(existing.map((c: any) => c.id));
      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          try { jsonStorage.customCards.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'users') {
      for (const row of rows) {
        if (!row.email) continue;
        const ex = jsonStorage.users.getByEmail(row.email);
        if (!ex) {
          try {
            jsonStorage.users.create({
              username: row.username,
              email: row.email,
              password: row.password ?? null,
              googleId: row.googleId ?? null,
              avatar: row.avatar ?? '😀',
              puntiRankiard: row.puntiRankiard ?? 0,
              isAdmin: row.isAdmin ?? false,
              resetPasswordToken: null,
              resetPasswordExpires: null,
            });
            count++;
          } catch (_e) {}
        }
      }
    } else if (tableKey === 'card_skins') {
      const existing = jsonStorage.cardSkins.getAll();
      const existingIds = new Set(existing.map((s: any) => s.id));
      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          try { jsonStorage.cardSkins.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'personaggi') {
      const existing = jsonStorage.personaggiCache.getAll();
      const existingNames = new Set(existing.map((p: any) => p.name));
      for (const row of rows) {
        if (!existingNames.has(row.name)) {
          try { jsonStorage.personaggiCache.add(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'achievements') {
      const existing = jsonStorage.achievements.getAll();
      const existingIds = new Set(existing.map((a: any) => a.id));
      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          try { jsonStorage.achievements.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'mission_templates') {
      const existing = jsonStorage.missionTemplates.getAll();
      const existingIds = new Set(existing.map((m: any) => m.id));
      for (const row of rows) {
        if (!existingIds.has(row.id)) {
          try { jsonStorage.missionTemplates.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'tutorial_steps') {
      for (const row of rows) {
        if (!row.stepId) continue;
        const ex = jsonStorage.tutorialSteps.getByStepId(row.stepId);
        if (!ex) {
          try { jsonStorage.tutorialSteps.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    } else if (tableKey === 'player_skins') {
      const existing = jsonStorage.playerSkins.getAll();
      const existingKeys = new Set(existing.map((s: any) => `${s.userId}:${s.skinId}`));
      for (const row of rows) {
        if (!existingKeys.has(`${row.userId}:${row.skinId}`)) {
          try { jsonStorage.playerSkins.create(cleanData(row)); count++; } catch (_e) {}
        }
      }
    }
  } catch (err: any) {
    console.warn(`[BulkSync] JSON sync failed for ${tableKey}:`, err.message);
  }
  return count;
}

/**
 * Full bulk sync: reads ALL rows from Neon (EXTERNAL_DATABASE_URL) and:
 *  1. Upserts them into Replit DB (DATABASE_URL)
 *  2. Writes key tables to JSON files
 *
 * Safe to call at any time — non-destructive (onConflictDoNothing).
 */
export async function fullSync(): Promise<SyncStatus['lastResult']> {
  if (_syncStatus.inProgress) {
    console.log('[BulkSync] Already in progress, skipping');
    return _syncStatus.lastResult;
  }

  const neonUrl = process.env.EXTERNAL_DATABASE_URL;
  const replitUrl = process.env.DATABASE_URL;

  if (!neonUrl) {
    const err = { tablesOk: [], tablesFailed: [], rowsCopiedToReplit: 0, rowsCopiedToJson: 0, errors: ['EXTERNAL_DATABASE_URL not set'], durationMs: 0 };
    _syncStatus.lastResult = err;
    return err;
  }

  _syncStatus.inProgress = true;
  const startTime = Date.now();
  console.log('🔄 [BulkSync] Starting full Neon → Replit DB + JSON sync...');

  let neonDb: ExtDbType | null = null;
  let replitDb: ExtDbType | null = null;
  const tablesOk: string[] = [];
  const tablesFailed: string[] = [];
  const errors: string[] = [];
  let rowsCopiedToReplit = 0;
  let rowsCopiedToJson = 0;

  try {
    neonDb = drizzle(neon(sanitizeDbUrl(neonUrl)), { schema });
    if (replitUrl && replitUrl !== neonUrl) {
      replitDb = drizzle(neon(sanitizeDbUrl(replitUrl)), { schema });
    }
  } catch (err: any) {
    errors.push('Connection error: ' + err.message);
    _syncStatus.inProgress = false;
    const result = { tablesOk, tablesFailed, rowsCopiedToReplit, rowsCopiedToJson, errors, durationMs: Date.now() - startTime };
    _syncStatus.lastResult = result;
    _syncStatus.lastRun = new Date();
    return result;
  }

  // Tables ordered by dependency (parents before children)
  const TABLE_ORDER = [
    'users', 'personaggi', 'matches', 'game_events',
    'custom_cards', 'card_modifications', 'card_skins',
    'achievements', 'mission_templates', 'tutorial_steps',
    'player_skins', 'player_achievements', 'player_daily_missions',
    'friend_requests', 'friendships', 'game_invitations',
    'clans', 'clan_members', 'clan_join_requests',
    'tournaments', 'tournament_participants', 'tournament_matches',
    'seasonal_events', 'seasonal_cards', 'seasonal_passes',
    'pass_rewards', 'player_pass_progress',
    'training_tips', 'conversations', 'private_messages',
    'push_subscriptions', 'card_collection', 'game_states',
  ];

  for (const tableKey of TABLE_ORDER) {
    const tableSchema = tableMap[tableKey];
    if (!tableSchema) continue;
    try {
      const rows: any[] = await neonDb.select().from(tableSchema);
      if (rows.length === 0) {
        tablesOk.push(tableKey);
        continue;
      }

      // Sync to Replit DB
      if (replitDb) {
        try {
          const copied = await upsertChunked(replitDb, tableKey, rows);
          rowsCopiedToReplit += copied;
        } catch (err: any) {
          errors.push(`${tableKey} → Replit: ${err.message}`);
        }
      }

      // Sync to JSON
      const jsonCount = bulkSyncTableToJson(tableKey, rows);
      rowsCopiedToJson += jsonCount;

      tablesOk.push(tableKey);
      console.log(`  ✅ [BulkSync] ${tableKey}: ${rows.length} rows (→Replit: ok, →JSON: ${jsonCount})`);
    } catch (err: any) {
      tablesFailed.push(tableKey);
      errors.push(`${tableKey}: ${err.message}`);
      console.warn(`  ❌ [BulkSync] ${tableKey} failed:`, err.message);
    }
  }

  const durationMs = Date.now() - startTime;
  const result = { tablesOk, tablesFailed, rowsCopiedToReplit, rowsCopiedToJson, errors, durationMs };
  _syncStatus.lastResult = result;
  _syncStatus.lastRun = new Date();
  _syncStatus.inProgress = false;

  console.log(`✅ [BulkSync] Done in ${durationMs}ms — ${tablesOk.length} tables ok, ${tablesFailed.length} failed, ${rowsCopiedToReplit} rows → Replit, ${rowsCopiedToJson} rows → JSON`);
  return result;
}

// ── Startup sync + periodic background sync ──────────────────────────────────

let _periodicSyncTimer: ReturnType<typeof setInterval> | null = null;
const PERIODIC_SYNC_INTERVAL_MS = 30 * 60 * 1000; // every 30 minutes

export function startPeriodicSync(intervalMs = PERIODIC_SYNC_INTERVAL_MS) {
  if (_periodicSyncTimer) clearInterval(_periodicSyncTimer);
  _periodicSyncTimer = setInterval(() => {
    fullSync().catch(err => console.warn('[PeriodicSync] Error:', err.message));
  }, intervalMs);
  console.log(`⏱️ [BulkSync] Periodic sync started — every ${Math.round(intervalMs / 60000)} min`);
}

export function stopPeriodicSync() {
  if (_periodicSyncTimer) {
    clearInterval(_periodicSyncTimer);
    _periodicSyncTimer = null;
  }
}

// Run initial sync after a short delay so server starts up first
setTimeout(() => {
  if (process.env.EXTERNAL_DATABASE_URL && process.env.DATABASE_URL) {
    console.log('🚀 [BulkSync] Running startup sync (Neon → Replit DB + JSON)...');
    fullSync()
      .then(result => {
        if (result) {
          console.log(`🚀 [BulkSync] Startup sync complete: ${result.tablesOk.length} tables, ${result.rowsCopiedToReplit} rows → Replit, ${result.rowsCopiedToJson} rows → JSON`);
          if (result.errors.length > 0) console.warn('  Errors:', result.errors);
        }
      })
      .catch(err => console.warn('[BulkSync] Startup sync error:', err.message));
    startPeriodicSync();
  }
}, 8000); // wait 8 seconds for server to be fully ready
