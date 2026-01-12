import { db } from "./db";
import { achievements, playerAchievements, missionTemplates, playerDailyMissions, users } from "../shared/schema";
import { eq, and, sql } from "drizzle-orm";

const DEFAULT_ACHIEVEMENTS = [
  { code: 'first_win', name: 'Prima Vittoria', description: 'Vinci la tua prima partita', category: 'bronze', icon: '🏆', requirement: 1, rewardPoints: 50 },
  { code: 'wins_10', name: 'Campione', description: 'Vinci 10 partite', category: 'silver', icon: '🥈', requirement: 10, rewardPoints: 100 },
  { code: 'wins_50', name: 'Leggenda', description: 'Vinci 50 partite', category: 'gold', icon: '🥇', requirement: 50, rewardPoints: 250 },
  { code: 'wins_100', name: 'Mito Vivente', description: 'Vinci 100 partite', category: 'legendary', icon: '👑', requirement: 100, rewardPoints: 500 },
  { code: 'cards_played_100', name: 'Giocatore Attivo', description: 'Gioca 100 carte', category: 'bronze', icon: '🃏', requirement: 100, rewardPoints: 50 },
  { code: 'cards_played_500', name: 'Stratega', description: 'Gioca 500 carte', category: 'silver', icon: '♠️', requirement: 500, rewardPoints: 100 },
  { code: 'cards_played_1000', name: 'Maestro delle Carte', description: 'Gioca 1000 carte', category: 'gold', icon: '🎴', requirement: 1000, rewardPoints: 250 },
  { code: 'damage_dealt_5000', name: 'Combattente', description: 'Infliggi 5000 danni totali', category: 'bronze', icon: '⚔️', requirement: 5000, rewardPoints: 50 },
  { code: 'damage_dealt_25000', name: 'Guerriero', description: 'Infliggi 25000 danni totali', category: 'silver', icon: '🗡️', requirement: 25000, rewardPoints: 100 },
  { code: 'damage_dealt_100000', name: 'Distruttore', description: 'Infliggi 100000 danni totali', category: 'gold', icon: '💥', requirement: 100000, rewardPoints: 250 },
  { code: 'eliminations_10', name: 'Cacciatore', description: 'Elimina 10 personaggi', category: 'bronze', icon: '💀', requirement: 10, rewardPoints: 50 },
  { code: 'eliminations_50', name: 'Assassino', description: 'Elimina 50 personaggi', category: 'silver', icon: '☠️', requirement: 50, rewardPoints: 100 },
  { code: 'eliminations_200', name: 'Angelo della Morte', description: 'Elimina 200 personaggi', category: 'gold', icon: '👿', requirement: 200, rewardPoints: 250 },
  { code: 'games_played_25', name: 'Giocatore Abituale', description: 'Gioca 25 partite', category: 'bronze', icon: '🎮', requirement: 25, rewardPoints: 50 },
  { code: 'games_played_100', name: 'Veterano', description: 'Gioca 100 partite', category: 'silver', icon: '🎖️', requirement: 100, rewardPoints: 100 },
  { code: 'mosse_used_50', name: 'Tattico', description: 'Usa 50 carte MOSSE', category: 'bronze', icon: '🎯', requirement: 50, rewardPoints: 50 },
  { code: 'bonus_used_30', name: 'Opportunista', description: 'Usa 30 carte BONUS', category: 'bronze', icon: '✨', requirement: 30, rewardPoints: 50 },
  { code: 'speciali_played_20', name: 'Collezionista Raro', description: 'Gioca 20 PERSONAGGI SPECIALI', category: 'silver', icon: '⭐', requirement: 20, rewardPoints: 100 },
];

const DEFAULT_MISSIONS = [
  { code: 'win_1', name: 'Vittoria del Giorno', description: 'Vinci 1 partita', type: 'wins', requirement: 1, rewardPoints: 30, difficulty: 'easy' },
  { code: 'win_2', name: 'Doppia Vittoria', description: 'Vinci 2 partite', type: 'wins', requirement: 2, rewardPoints: 50, difficulty: 'medium' },
  { code: 'play_cards_10', name: 'Giocatore Attivo', description: 'Gioca 10 carte', type: 'cards_played', requirement: 10, rewardPoints: 20, difficulty: 'easy' },
  { code: 'play_cards_25', name: 'Mano Calda', description: 'Gioca 25 carte', type: 'cards_played', requirement: 25, rewardPoints: 40, difficulty: 'medium' },
  { code: 'deal_damage_500', name: 'Combattente', description: 'Infliggi 500 danni', type: 'damage_dealt', requirement: 500, rewardPoints: 25, difficulty: 'easy' },
  { code: 'deal_damage_1500', name: 'Guerriero Feroce', description: 'Infliggi 1500 danni', type: 'damage_dealt', requirement: 1500, rewardPoints: 45, difficulty: 'medium' },
  { code: 'eliminate_3', name: 'Eliminatore', description: 'Elimina 3 personaggi', type: 'eliminations', requirement: 3, rewardPoints: 35, difficulty: 'medium' },
  { code: 'use_mosse_5', name: 'Tattico del Giorno', description: 'Usa 5 carte MOSSE', type: 'mosse_used', requirement: 5, rewardPoints: 25, difficulty: 'easy' },
  { code: 'use_bonus_3', name: 'Bonus Hunter', description: 'Usa 3 carte BONUS', type: 'bonus_used', requirement: 3, rewardPoints: 25, difficulty: 'easy' },
  { code: 'play_game_3', name: 'Sessione Intensiva', description: 'Gioca 3 partite', type: 'games_played', requirement: 3, rewardPoints: 30, difficulty: 'medium' },
];

export async function initializeMissionsAndAchievements() {
  console.log('🎯 Initializing missions and achievements system...');
  
  try {
    for (const ach of DEFAULT_ACHIEVEMENTS) {
      const existing = await db.select().from(achievements).where(eq(achievements.code, ach.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(achievements).values(ach);
        console.log(`✅ Created achievement: ${ach.name}`);
      }
    }
    
    for (const mission of DEFAULT_MISSIONS) {
      const existing = await db.select().from(missionTemplates).where(eq(missionTemplates.code, mission.code)).limit(1);
      if (existing.length === 0) {
        await db.insert(missionTemplates).values(mission);
        console.log(`✅ Created mission template: ${mission.name}`);
      }
    }
    
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
  
  let missions = await db.select({
    id: playerDailyMissions.id,
    progress: playerDailyMissions.progress,
    completed: playerDailyMissions.completed,
    claimed: playerDailyMissions.claimed,
    missionId: playerDailyMissions.missionId,
    name: missionTemplates.name,
    description: missionTemplates.description,
    type: missionTemplates.type,
    requirement: missionTemplates.requirement,
    rewardPoints: missionTemplates.rewardPoints,
    difficulty: missionTemplates.difficulty,
  })
  .from(playerDailyMissions)
  .innerJoin(missionTemplates, eq(playerDailyMissions.missionId, missionTemplates.id))
  .where(and(
    eq(playerDailyMissions.usernameOrEmail, usernameOrEmail),
    eq(playerDailyMissions.assignedDate, today)
  ));
  
  if (missions.length === 0) {
    await assignDailyMissions(usernameOrEmail);
    missions = await db.select({
      id: playerDailyMissions.id,
      progress: playerDailyMissions.progress,
      completed: playerDailyMissions.completed,
      claimed: playerDailyMissions.claimed,
      missionId: playerDailyMissions.missionId,
      name: missionTemplates.name,
      description: missionTemplates.description,
      type: missionTemplates.type,
      requirement: missionTemplates.requirement,
      rewardPoints: missionTemplates.rewardPoints,
      difficulty: missionTemplates.difficulty,
    })
    .from(playerDailyMissions)
    .innerJoin(missionTemplates, eq(playerDailyMissions.missionId, missionTemplates.id))
    .where(and(
      eq(playerDailyMissions.usernameOrEmail, usernameOrEmail),
      eq(playerDailyMissions.assignedDate, today)
    ));
  }
  
  return missions;
}

async function assignDailyMissions(usernameOrEmail: string) {
  const today = getTodayDateString();
  
  const allTemplates = await db.select().from(missionTemplates);
  
  const shuffled = allTemplates.sort(() => Math.random() - 0.5);
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
  const allAchievements = await db.select().from(achievements);
  
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
  
  const missions = await db.select({
    id: playerDailyMissions.id,
    progress: playerDailyMissions.progress,
    completed: playerDailyMissions.completed,
    missionId: playerDailyMissions.missionId,
    type: missionTemplates.type,
    requirement: missionTemplates.requirement,
    rewardPoints: missionTemplates.rewardPoints,
  })
  .from(playerDailyMissions)
  .innerJoin(missionTemplates, eq(playerDailyMissions.missionId, missionTemplates.id))
  .where(and(
    eq(playerDailyMissions.usernameOrEmail, usernameOrEmail),
    eq(playerDailyMissions.assignedDate, today),
    eq(missionTemplates.type, type),
    eq(playerDailyMissions.completed, false)
  ));
  
  const completedMissions: any[] = [];
  
  for (const mission of missions) {
    const newProgress = mission.progress + amount;
    const isCompleted = newProgress >= mission.requirement;
    
    await db.update(playerDailyMissions)
      .set({ 
        progress: newProgress, 
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null
      })
      .where(eq(playerDailyMissions.id, mission.id));
    
    if (isCompleted) {
      completedMissions.push(mission);
    }
  }
  
  return completedMissions;
}

export async function updateAchievementProgress(usernameOrEmail: string, code: string, amount: number = 1, setAbsolute: boolean = false) {
  const achievement = await db.select().from(achievements).where(eq(achievements.code, code)).limit(1);
  if (achievement.length === 0) return null;
  
  const ach = achievement[0];
  
  let playerAch = await db.select()
    .from(playerAchievements)
    .where(and(
      eq(playerAchievements.usernameOrEmail, usernameOrEmail),
      eq(playerAchievements.achievementId, ach.id)
    ))
    .limit(1);
  
  if (playerAch.length === 0) {
    await db.insert(playerAchievements).values({
      usernameOrEmail,
      achievementId: ach.id,
      progress: 0,
      completed: false,
      claimed: false,
    });
    playerAch = await db.select()
      .from(playerAchievements)
      .where(and(
        eq(playerAchievements.usernameOrEmail, usernameOrEmail),
        eq(playerAchievements.achievementId, ach.id)
      ))
      .limit(1);
  }
  
  if (playerAch[0].completed) return null;
  
  const newProgress = setAbsolute ? amount : playerAch[0].progress + amount;
  const isCompleted = newProgress >= ach.requirement;
  
  await db.update(playerAchievements)
    .set({ 
      progress: newProgress, 
      completed: isCompleted,
      completedAt: isCompleted ? new Date() : null
    })
    .where(eq(playerAchievements.id, playerAch[0].id));
  
  if (isCompleted) {
    return { ...ach, newlyCompleted: true };
  }
  
  return null;
}

export async function claimMissionReward(usernameOrEmail: string, missionId: number) {
  const mission = await db.select({
    id: playerDailyMissions.id,
    completed: playerDailyMissions.completed,
    claimed: playerDailyMissions.claimed,
    rewardPoints: missionTemplates.rewardPoints,
  })
  .from(playerDailyMissions)
  .innerJoin(missionTemplates, eq(playerDailyMissions.missionId, missionTemplates.id))
  .where(and(
    eq(playerDailyMissions.id, missionId),
    eq(playerDailyMissions.usernameOrEmail, usernameOrEmail)
  ))
  .limit(1);
  
  if (mission.length === 0 || !mission[0].completed || mission[0].claimed) {
    return { success: false, error: 'Missione non disponibile o già riscattata' };
  }
  
  await db.update(playerDailyMissions)
    .set({ claimed: true })
    .where(eq(playerDailyMissions.id, missionId));
  
  await db.update(users)
    .set({ puntiRankiard: sql`${users.puntiRankiard} + ${mission[0].rewardPoints}` })
    .where(eq(users.email, usernameOrEmail));
  
  return { success: true, pointsAwarded: mission[0].rewardPoints };
}

export async function claimAchievementReward(usernameOrEmail: string, achievementId: number) {
  const playerAch = await db.select({
    id: playerAchievements.id,
    completed: playerAchievements.completed,
    claimed: playerAchievements.claimed,
    rewardPoints: achievements.rewardPoints,
  })
  .from(playerAchievements)
  .innerJoin(achievements, eq(playerAchievements.achievementId, achievements.id))
  .where(and(
    eq(playerAchievements.achievementId, achievementId),
    eq(playerAchievements.usernameOrEmail, usernameOrEmail)
  ))
  .limit(1);
  
  if (playerAch.length === 0 || !playerAch[0].completed || playerAch[0].claimed) {
    return { success: false, error: 'Achievement non disponibile o già riscattato' };
  }
  
  await db.update(playerAchievements)
    .set({ claimed: true })
    .where(eq(playerAchievements.id, playerAch[0].id));
  
  await db.update(users)
    .set({ puntiRankiard: sql`${users.puntiRankiard} + ${playerAch[0].rewardPoints}` })
    .where(eq(users.email, usernameOrEmail));
  
  return { success: true, pointsAwarded: playerAch[0].rewardPoints };
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
