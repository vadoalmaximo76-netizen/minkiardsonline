import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  password: text("password"), // Can be null for Google OAuth users
  googleId: text("google_id").unique(), // Google OAuth ID
  avatar: text("avatar"), // Avatar ID from predefined list
  puntiRankiard: integer("punti_rankiard").notNull().default(0), // Accumulated Rankiard points
  gamesPlayed: integer("games_played").notNull().default(0), // Total games played
  gamesWon: integer("games_won").notNull().default(0), // Total games won
  minutesPlayed: integer("minutes_played").notNull().default(0), // Total minutes played
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull().unique(),
  players: jsonb("players").notNull(), // Array of player names
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  winnerPlayer: text("winner_player"),
  gameMode: text("game_mode").default("standard"),
  totalEvents: integer("total_events").default(0),
  duration: integer("duration"), // Duration in seconds
});

export const gameEvents = pgTable("game_events", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  eventType: text("event_type").notNull(), // 'play-card', 'move-to-graveyard', 'transfer-card', etc.
  eventData: jsonb("event_data").notNull(), // JSON data containing event details
  playerName: text("player_name").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  eventOrder: integer("event_order").notNull(), // Sequential order within the match
});

export const personaggi = pgTable("personaggi", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  pti: integer("pti"), // Can be null for unknown values (marked with ? in original list)
  stars: integer("stars"), // Can be null for unknown values
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const customCards = pgTable("custom_cards", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  deckType: text("deck_type").notNull(), // 'personaggi', 'mosse', 'bonus', 'personaggi_speciali'
  imageData: text("image_data").notNull(), // Base64 image data
  pti: integer("pti"), // Only for personaggi and personaggi_speciali
  stars: integer("stars"), // Only for personaggi and personaggi_speciali
  effect: text("effect"), // AI-processed effect description (not shown on card)
  audioUrl: text("audio_url"), // URL or base64 audio to play when card is played
  createdBy: text("created_by"), // Player name who created the card
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const cardModifications = pgTable("card_modifications", {
  id: serial("id").primaryKey(),
  originalCardId: text("original_card_id").notNull().unique(), // Card ID from cardData.ts
  deckType: text("deck_type").notNull(), // 'personaggi', 'mosse', 'bonus', 'personaggi_speciali'
  name: text("name"), // Modified name (null = use original)
  imageUrl: text("image_url"), // Modified image URL (null = use original)
  pti: integer("pti"), // Modified PTI (null = use original)
  stars: integer("stars"), // Modified stars (null = use original)
  effect: text("effect"), // AI-processed effect description
  audioUrl: text("audio_url"), // URL or base64 audio to play when card is played
  isDeleted: boolean("is_deleted").default(false), // Hide card from game
  modifiedBy: text("modified_by"), // Admin email who modified
  modifiedAt: timestamp("modified_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  googleId: true,
  avatar: true,
});

export const registerUserSchema = z.object({
  username: z.string().min(2).max(20),
  email: z.string().email(),
  password: z.string().min(6),
  avatar: z.string().optional(),
});

export const loginUserSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const insertMatchSchema = createInsertSchema(matches);
export const insertGameEventSchema = createInsertSchema(gameEvents);
export const insertPersonaggioSchema = createInsertSchema(personaggi).pick({
  name: true,
  pti: true,
  stars: true,
});
export const insertCustomCardSchema = createInsertSchema(customCards).pick({
  name: true,
  deckType: true,
  imageData: true,
  pti: true,
  stars: true,
  effect: true,
  audioUrl: true,
  createdBy: true,
});

export const insertCardModificationSchema = createInsertSchema(cardModifications).pick({
  originalCardId: true,
  deckType: true,
  name: true,
  imageUrl: true,
  pti: true,
  stars: true,
  effect: true,
  audioUrl: true,
  modifiedBy: true,
});

export const achievements = pgTable("achievements", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  icon: text("icon").notNull(),
  requirement: integer("requirement").notNull(),
  rewardPoints: integer("reward_points").notNull().default(50),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerAchievements = pgTable("player_achievements", {
  id: serial("id").primaryKey(),
  usernameOrEmail: text("username_or_email").notNull(),
  achievementId: integer("achievement_id").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  claimed: boolean("claimed").notNull().default(false),
});

export const missionTemplates = pgTable("mission_templates", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  requirement: integer("requirement").notNull(),
  rewardPoints: integer("reward_points").notNull().default(20),
  difficulty: text("difficulty").notNull().default("easy"),
});

export const playerDailyMissions = pgTable("player_daily_missions", {
  id: serial("id").primaryKey(),
  usernameOrEmail: text("username_or_email").notNull(),
  missionId: integer("mission_id").notNull(),
  progress: integer("progress").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  claimed: boolean("claimed").notNull().default(false),
  assignedDate: text("assigned_date").notNull(),
  completedAt: timestamp("completed_at"),
});

// Friend requests table
export const friendRequests = pgTable("friend_requests", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull(), // User who sent the request
  addresseeId: integer("addressee_id").notNull(), // User who received the request
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  message: text("message"), // Optional message with the request
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Friendships table (accepted friendships)
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  userAId: integer("user_a_id").notNull(), // First user (lower ID for uniqueness)
  userBId: integer("user_b_id").notNull(), // Second user (higher ID for uniqueness)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Game invitations table
export const gameInvitations = pgTable("game_invitations", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),
  receiverId: integer("receiver_id").notNull(),
  gameId: text("game_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, declined, expired
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const insertAchievementSchema = createInsertSchema(achievements);
export const insertPlayerAchievementSchema = createInsertSchema(playerAchievements);
export const insertMissionTemplateSchema = createInsertSchema(missionTemplates);
export const insertPlayerDailyMissionSchema = createInsertSchema(playerDailyMissions);
export const insertFriendRequestSchema = createInsertSchema(friendRequests);
export const insertFriendshipSchema = createInsertSchema(friendships);
export const insertGameInvitationSchema = createInsertSchema(gameInvitations);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;
export type Personaggio = typeof personaggi.$inferSelect;
export type CustomCard = typeof customCards.$inferSelect;
export type CardModification = typeof cardModifications.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertGameEvent = z.infer<typeof insertGameEventSchema>;
export type InsertPersonaggio = z.infer<typeof insertPersonaggioSchema>;
export type InsertCustomCard = z.infer<typeof insertCustomCardSchema>;
export type InsertCardModification = z.infer<typeof insertCardModificationSchema>;
export type Achievement = typeof achievements.$inferSelect;
export type PlayerAchievement = typeof playerAchievements.$inferSelect;
export type MissionTemplate = typeof missionTemplates.$inferSelect;
export type PlayerDailyMission = typeof playerDailyMissions.$inferSelect;
export type InsertAchievement = z.infer<typeof insertAchievementSchema>;
export type InsertPlayerAchievement = z.infer<typeof insertPlayerAchievementSchema>;
export type InsertMissionTemplate = z.infer<typeof insertMissionTemplateSchema>;
export type InsertPlayerDailyMission = z.infer<typeof insertPlayerDailyMissionSchema>;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type Friendship = typeof friendships.$inferSelect;
export type GameInvitation = typeof gameInvitations.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type InsertGameInvitation = z.infer<typeof insertGameInvitationSchema>;
