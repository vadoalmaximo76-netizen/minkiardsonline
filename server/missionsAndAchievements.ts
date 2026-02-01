import { db } from "./db";
import { playerAchievements, playerDailyMissions, users } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { jsonStorage } from "./jsonStorage";

export async function initializeMissionsAndAchievements() {
  console.log('🎯 Initializing missions and achievements system from JSON...');
  
  try {
    const allAchievements = jsonStorage.achievements.getAll();
    const allMissions = jsonStorage.missionTemplates.getAll();
    
    console.log(`📋 Loaded ${allAchievements.length} achievements from JSON`);
    console.log(`📋 Loaded ${allMissions.length} mission templates from JSON`);
    console.log('🎯 Missions and achievements system initialized!');
  } catch (error) {
    console.error('Error initializing missions/achievements:', error);
  }
}

function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0];
}

export async function getPlayerDailyMissions(usernameOrEmail: string) {
  const today = getTodayDateString();
  
  const playerMissions = await db.select()
    .from(playerDailyMissions)
    .where(and(
      eq(playerDailyMissions.usernameOrEmail, usernameOrEmail),
      eq(playerDailyMissions.assignedDate, today)
    ));
  
  if (playerMissions.length === 0) {
    await assignDailyMissions(usernameOrEmail);
    return getPlayerDailyMissions(usernameOrEmail);
  }
  
  const allTemplates = jsonStorage.missionTemplates.getAll();
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));
  
  return playerMissions.map(pm => {
    const template = templateMap.get(pm.missionId);
    return {
      id: pm.id,
      progress: pm.progress,
      completed: pm.completed,
      claimed: pm.claimed,
      missionId: pm.missionId,
      name: template?.name || 'Missione',
      description: template?.description || '',
      type: template?.type || '',
      requirement: template?.requirement || 1,
      rewardPoints: template?.rewardPoints || 0,
      difficulty: template?.difficulty || 'easy',
    };
  });
}

async function assignDailyMissions(usernameOrEmail: string) {
  const today = getTodayDateString();
  
  const allTemplates = jsonStorage.missionTemplates.getAll();
  
  const shuffled = [...allTemplates].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 3);
  
  for (const template of selected) {
    await db.insert(playerDailyMissions).values({
      usernameOrEmail,
      missionId: template.id,
      progress: 0,
      completed: false,
      claimed: false,
      assignedDate: today,
    });
  }
  
  console.log(`📋 Assigned 3 daily missions to ${usernameOrEmail}`);
}

export async function getPlayerAchievements(usernameOrEmail: string) {
  const allAchievements = jsonStorage.achievements.getAll();
  
  const playerProgress = await db.select()
    .from(playerAchievements)
    .where(eq(playerAchievements.usernameOrEmail, usernameOrEmail));
  
  const progressMap = new Map(playerProgress.map(p => [p.achievementId, p]));
  
  return allAchievements.map(ach => ({
    ...ach,
    progress: progressMap.get(ach.id)?.progress || 0,
    completed: progressMap.get(ach.id)?.completed || false,
    claimed: progressMap.get(ach.id)?.claimed || false,
  }));
}

export async function updateMissionProgress(usernameOrEmail: string, type: string, amount: number = 1) {
  const today = getTodayDateString();
  
  const playerMissions = await db.select()
    .from(playerDailyMissions)
    .where(and(
      eq(playerDailyMissions.usernameOrEmail, usernameOrEmail),
      eq(playerDailyMissions.assignedDate, today),
      eq(playerDailyMissions.completed, false)
    ));
  
  const allTemplates = jsonStorage.missionTemplates.getAll();
  const templateMap = new Map(allTemplates.map(t => [t.id, t]));
  
  const completedMissions: any[] = [];
  
  for (const mission of playerMissions) {
    const template = templateMap.get(mission.missionId);
    if (!template || template.type !== type) continue;
    
    const newProgress = mission.progress + amount;
    const isCompleted = newProgress >= template.requirement;
    
    await db.update(playerDailyMissions)
      .set({ 
        progress: newProgress, 
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null
      })
      .where(eq(playerDailyMissions.id, mission.id));
    
    if (isCompleted) {
      completedMissions.push({
        ...mission,
        requirement: template.requirement,
        rewardPoints: template.rewardPoints,
      });
    }
  }
  
  return completedMissions;
}

export async function updateAchievementProgress(usernameOrEmail: string, code: string, amount: number = 1, setAbsolute: boolean = false) {
  const achievement = jsonStorage.achievements.getByCode(code);
  if (!achievement) return null;
  
  let playerAch = await db.select()
    .from(playerAchievements)
    .where(and(
      eq(playerAchievements.usernameOrEmail, usernameOrEmail),
      eq(playerAchievements.achievementId, achievement.id)
    ))
    .limit(1);
  
  if (playerAch.length === 0) {
    await db.insert(playerAchievements).values({
      usernameOrEmail,
      achievementId: achievement.id,
      progress: 0,
      completed: false,
      claimed: false,
    });
    playerAch = await db.select()
      .from(playerAchievements)
      .where(and(
        eq(playerAchievements.usernameOrEmail, usernameOrEmail),
        eq(playerAchievements.achievementId, achievement.id)
      ))
      .limit(1);
  }
  
  if (playerAch[0].completed) return null;
  
  const newProgress = setAbsolute ? amount : playerAch[0].progress + amount;
  const isCompleted = newProgress >= achievement.requirement;
  
  await db.update(playerAchievements)
    .set({ 
      progress: newProgress, 
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null
    })
    .where(eq(playerAchievements.id, playerAch[0].id));
  
  if (isCompleted) {
    return { ...achievement, newlyCompleted: true };
  }
  
  return null;
}

export async function claimMissionReward(usernameOrEmail: string, missionId: number) {
  const mission = await db.select()
    .from(playerDailyMissions)
    .where(and(
      eq(playerDailyMissions.id, missionId),
      eq(playerDailyMissions.usernameOrEmail, usernameOrEmail)
    ))
    .limit(1);
  
  if (mission.length === 0 || !mission[0].completed || mission[0].claimed) {
    return { success: false, error: 'Missione non disponibile o già riscattata' };
  }
  
  const template = jsonStorage.missionTemplates.getById(mission[0].missionId);
  const rewardPoints = template?.rewardPoints || 0;
  
  await db.update(playerDailyMissions)
    .set({ claimed: true })
    .where(eq(playerDailyMissions.id, missionId));
  
  await db.update(users)
    .set({ puntiRankiard: sql`${users.puntiRankiard} + ${rewardPoints}` })
    .where(eq(users.email, usernameOrEmail));
  
  return { success: true, pointsAwarded: rewardPoints };
}

export async function claimAchievementReward(usernameOrEmail: string, achievementId: number) {
  const playerAch = await db.select()
    .from(playerAchievements)
    .where(and(
      eq(playerAchievements.achievementId, achievementId),
      eq(playerAchievements.usernameOrEmail, usernameOrEmail)
    ))
    .limit(1);
  
  if (playerAch.length === 0 || !playerAch[0].completed || playerAch[0].claimed) {
    return { success: false, error: 'Achievement non disponibile o già riscattato' };
  }
  
  const achievement = jsonStorage.achievements.getById(achievementId);
  const rewardPoints = achievement?.rewardPoints || 0;
  
  await db.update(playerAchievements)
    .set({ claimed: true })
    .where(eq(playerAchievements.id, playerAch[0].id));
  
  await db.update(users)
    .set({ puntiRankiard: sql`${users.puntiRankiard} + ${rewardPoints}` })
    .where(eq(users.email, usernameOrEmail));
  
  return { success: true, pointsAwarded: rewardPoints };
}

export async function trackGameEvent(usernameOrEmail: string, eventType: string, data: any = {}) {
  const completedAchievements: any[] = [];
  const completedMissions: any[] = [];
  
  switch (eventType) {
    case 'game_won':
      completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'wins', 1));
      const winAchs = ['first_win', 'wins_10', 'wins_50', 'wins_100'];
      for (const code of winAchs) {
        const result = await updateAchievementProgress(usernameOrEmail, code, 1);
        if (result) completedAchievements.push(result);
      }
      break;
      
    case 'game_played':
      completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'games_played', 1));
      const gameAchs = ['games_played_25', 'games_played_100'];
      for (const code of gameAchs) {
        const result = await updateAchievementProgress(usernameOrEmail, code, 1);
        if (result) completedAchievements.push(result);
      }
      break;
      
    case 'card_played':
      completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'cards_played', 1));
      const cardAchs = ['cards_played_100', 'cards_played_500', 'cards_played_1000'];
      for (const code of cardAchs) {
        const result = await updateAchievementProgress(usernameOrEmail, code, 1);
        if (result) completedAchievements.push(result);
      }
      
      if (data.cardType === 'mosse') {
        completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'mosse_used', 1));
        const mosseAch = await updateAchievementProgress(usernameOrEmail, 'mosse_used_50', 1);
        if (mosseAch) completedAchievements.push(mosseAch);
      }
      if (data.cardType === 'bonus') {
        completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'bonus_used', 1));
        const bonusAch = await updateAchievementProgress(usernameOrEmail, 'bonus_used_30', 1);
        if (bonusAch) completedAchievements.push(bonusAch);
      }
      if (data.cardType === 'personaggi_speciali') {
        const specialAch = await updateAchievementProgress(usernameOrEmail, 'speciali_played_20', 1);
        if (specialAch) completedAchievements.push(specialAch);
      }
      break;
      
    case 'damage_dealt':
      const amount = data.amount || 0;
      completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'damage_dealt', amount));
      const dmgAchs = ['damage_dealt_5000', 'damage_dealt_25000', 'damage_dealt_100000'];
      for (const code of dmgAchs) {
        const result = await updateAchievementProgress(usernameOrEmail, code, amount);
        if (result) completedAchievements.push(result);
      }
      break;
      
    case 'elimination':
      completedMissions.push(...await updateMissionProgress(usernameOrEmail, 'eliminations', 1));
      const elimAchs = ['eliminations_10', 'eliminations_50', 'eliminations_200'];
      for (const code of elimAchs) {
        const result = await updateAchievementProgress(usernameOrEmail, code, 1);
        if (result) completedAchievements.push(result);
      }
      break;
  }
  
  return { completedAchievements, completedMissions };
}
