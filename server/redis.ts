import { Redis } from "@upstash/redis";

// Initialize Redis client if credentials are provided
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken 
  ? new Redis({
      url: redisUrl,
      token: redisToken,
    })
  : null;

/**
 * Check if Redis is configured
 */
export function isRedisConfigured(): boolean {
  return redis !== null;
}

/**
 * Cache utility with TTL - GET
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!redis) return null;
  
  try {
    const value = await redis.get(key);
    if (value === null || value === undefined) return null;
    
    // If it's a JSON string, parse it; otherwise return as is
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as T;
      }
    }
    
    return value as T;
  } catch (error) {
    console.error(`[Redis] Error getting cache key ${key}:`, error);
    return null;
  }
}

/**
 * Cache utility with TTL - SET
 */
export async function cacheSet(key: string, value: any, ttlSeconds?: number): Promise<void> {
  if (!redis) return;
  
  try {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    
    if (ttlSeconds) {
      await redis.set(key, stringValue, { ex: ttlSeconds });
    } else {
      await redis.set(key, stringValue);
    }
  } catch (error) {
    console.error(`[Redis] Error setting cache key ${key}:`, error);
  }
}

/**
 * Cache utility with TTL - DELETE
 */
export async function cacheDel(key: string): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.del(key);
  } catch (error) {
    console.error(`[Redis] Error deleting cache key ${key}:`, error);
  }
}

/**
 * Rate limiting using simple counter with TTL
 * Returns { success, remaining, resetAt }
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number; resetAt: number }> {
  if (!redis) {
    return { success: true, remaining: maxRequests - 1, resetAt: Date.now() + windowSeconds * 1000 };
  }
  
  try {
    const key = `ratelimit:${identifier}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    
    const resetAt = Date.now() + windowSeconds * 1000;
    
    if (current > maxRequests) {
      return { success: false, remaining: 0, resetAt };
    }
    
    return { 
      success: true, 
      remaining: Math.max(0, maxRequests - current), 
      resetAt 
    };
  } catch (error) {
    console.error(`[Redis] Error in rate limiting for ${identifier}:`, error);
    return { 
      success: true, 
      remaining: maxRequests - 1, 
      resetAt: Date.now() + windowSeconds * 1000 
    };
  }
}

/**
 * Update leaderboard - stores player score using simple key-value
 * Leaderboard data is stored as a JSON hash
 */
export async function updateLeaderboard(
  leaderboardName: string,
  playerName: string,
  score: number
): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `leaderboard:${leaderboardName}:${playerName}`;
    await redis.set(key, score.toString());
    
    const listKey = `leaderboard_players:${leaderboardName}`;
    const existingList = await redis.get(listKey) as string | null;
    const players: string[] = existingList ? JSON.parse(existingList) : [];
    if (!players.includes(playerName)) {
      players.push(playerName);
      await redis.set(listKey, JSON.stringify(players));
    }
  } catch (error) {
    console.error(`[Redis] Error updating leaderboard ${leaderboardName}:`, error);
  }
}

/**
 * Get leaderboard entries sorted by score (highest first)
 */
export async function getLeaderboard(
  leaderboardName: string,
  limit: number = 100
): Promise<Array<{ player: string; score: number; rank: number }>> {
  if (!redis) return [];
  
  try {
    const listKey = `leaderboard_players:${leaderboardName}`;
    const existingList = await redis.get(listKey) as string | null;
    if (!existingList) return [];
    
    const players: string[] = JSON.parse(existingList);
    const entries: Array<{ player: string; score: number }> = [];
    
    for (const player of players) {
      const scoreStr = await redis.get(`leaderboard:${leaderboardName}:${player}`) as string | null;
      if (scoreStr !== null) {
        entries.push({ player, score: parseInt(scoreStr, 10) });
      }
    }
    
    entries.sort((a, b) => b.score - a.score);
    
    return entries.slice(0, limit).map((entry, index) => ({
      player: entry.player,
      score: entry.score,
      rank: index + 1,
    }));
  } catch (error) {
    console.error(`[Redis] Error getting leaderboard ${leaderboardName}:`, error);
    return [];
  }
}

/**
 * Get a specific player's rank and score
 */
export async function getPlayerRank(
  leaderboardName: string,
  playerName: string
): Promise<{ rank: number; score: number } | null> {
  if (!redis) return null;
  
  try {
    const scoreStr = await redis.get(`leaderboard:${leaderboardName}:${playerName}`) as string | null;
    if (scoreStr === null) return null;
    
    const score = parseInt(scoreStr, 10);
    const leaderboard = await getLeaderboard(leaderboardName);
    const entry = leaderboard.find(e => e.player === playerName);
    
    return entry ? { rank: entry.rank, score } : { rank: 0, score };
  } catch (error) {
    console.error(`[Redis] Error getting player rank for ${playerName} in ${leaderboardName}:`, error);
    return null;
  }
}

/**
 * Cache game session - stores session data with TTL
 * Default TTL is 24 hours
 */
export async function cacheGameSession(gameId: string, data: any): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `game_session:${gameId}`;
    const ttl = 24 * 60 * 60; // 24 hours
    await cacheSet(key, data, ttl);
  } catch (error) {
    console.error(`[Redis] Error caching game session ${gameId}:`, error);
  }
}

/**
 * Get game session data
 */
export async function getGameSession(gameId: string): Promise<any | null> {
  if (!redis) return null;
  
  try {
    const key = `game_session:${gameId}`;
    return await cacheGet(key);
  } catch (error) {
    console.error(`[Redis] Error getting game session ${gameId}:`, error);
    return null;
  }
}

/**
 * Set a player as online using a simple counter approach
 * Uses individual keys with TTL for each player
 */
export async function setPlayerOnline(playerName: string, ttlSeconds: number = 3600): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `online:${playerName}`;
    await redis.set(key, "1", { ex: ttlSeconds });
    await redis.incr("online_count");
  } catch (error) {
    console.error(`[Redis] Error setting player online ${playerName}:`, error);
  }
}

/**
 * Remove a player from online tracking
 */
export async function setPlayerOffline(playerName: string): Promise<void> {
  if (!redis) return;
  
  try {
    const key = `online:${playerName}`;
    const exists = await redis.get(key);
    if (exists) {
      await redis.del(key);
      await redis.decr("online_count");
    }
  } catch (error) {
    console.error(`[Redis] Error setting player offline ${playerName}:`, error);
  }
}

/**
 * Get count of online players using a simple counter
 */
export async function getOnlinePlayerCount(): Promise<number> {
  if (!redis) return 0;
  
  try {
    const count = await redis.get("online_count");
    return Math.max(0, parseInt(count as string || "0", 10));
  } catch (error) {
    console.error("[Redis] Error getting online player count:", error);
    return 0;
  }
}
