import { db, isDatabaseAvailable } from './db';
import { seasonalPasses, passRewards, playerPassProgress, userDraftCredits, users } from '../shared/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { emitSync } from './dbSync';

const XP_PER_LEVEL = 1000;

export async function awardSeasonPassXP(userId: number, xp: number): Promise<void> {
  if (!isDatabaseAvailable() || !userId || xp <= 0) return;

  try {
    const [activePass] = await db.select().from(seasonalPasses)
      .where(eq(seasonalPasses.isActive, true)).limit(1);
    if (!activePass) return;

    let [progress] = await db.select().from(playerPassProgress)
      .where(and(eq(playerPassProgress.userId, userId), eq(playerPassProgress.passId, activePass.id)))
      .limit(1);

    if (!progress) {
      const [inserted] = await db.insert(playerPassProgress)
        .values({ userId, passId: activePass.id })
        .returning();
      progress = inserted;
    }

    const currentXp = (progress.currentXp || 0) + xp;
    const currentLevel = progress.currentLevel || 1;
    const maxLevel = activePass.maxLevel || 30;

    let newXp = currentXp;
    let newLevel = currentLevel;

    while (newXp >= XP_PER_LEVEL && newLevel < maxLevel) {
      newXp -= XP_PER_LEVEL;
      newLevel++;
    }

    if (newLevel >= maxLevel) {
      newXp = Math.min(newXp, XP_PER_LEVEL - 1);
    }

    await db.update(playerPassProgress)
      .set({ currentXp: newXp, currentLevel: newLevel })
      .where(and(eq(playerPassProgress.userId, userId), eq(playerPassProgress.passId, activePass.id)));

  } catch (error) {
    console.error('[SeasonPass] Error awarding XP:', error);
  }
}
