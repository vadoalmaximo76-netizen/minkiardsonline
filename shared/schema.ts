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
  tutorialCompleted: boolean("tutorial_completed").notNull().default(false), // Track if user completed the tutorial
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
  youtubeUrl: text("youtube_url"), // YouTube video URL to show when card is played
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
  youtubeUrl: text("youtube_url"), // YouTube video URL to show when card is played
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
  youtubeUrl: true,
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

export const trainingTips = pgTable("training_tips", {
  id: serial("id").primaryKey(),
  cardName: text("card_name").notNull(),
  cardType: text("card_type").notNull(),
  tipTitle: text("tip_title").notNull(),
  tipContent: text("tip_content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTrainingTipSchema = createInsertSchema(trainingTips).pick({
  cardName: true,
  cardType: true,
  tipTitle: true,
  tipContent: true,
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

// Clans table
export const clans = pgTable("clans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  tag: text("tag").notNull().unique(), // Short 3-5 char tag like [DRG]
  description: text("description"),
  emblem: text("emblem"), // Emoji or icon for the clan
  leaderId: integer("leader_id").notNull(), // User who created the clan
  totalPoints: integer("total_points").notNull().default(0), // Combined Rankiard points
  totalWins: integer("total_wins").notNull().default(0),
  memberCount: integer("member_count").notNull().default(1),
  maxMembers: integer("max_members").notNull().default(20),
  isPublic: boolean("is_public").notNull().default(true), // Can anyone join?
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Clan members table
export const clanMembers = pgTable("clan_members", {
  id: serial("id").primaryKey(),
  clanId: integer("clan_id").notNull(),
  userId: integer("user_id").notNull(),
  role: text("role").notNull().default("member"), // leader, officer, member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  contributedPoints: integer("contributed_points").notNull().default(0),
});

// Clan join requests
export const clanJoinRequests = pgTable("clan_join_requests", {
  id: serial("id").primaryKey(),
  clanId: integer("clan_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// Tournaments table
export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("elimination"), // elimination, round_robin
  status: text("status").notNull().default("registration"), // registration, in_progress, completed
  maxParticipants: integer("max_participants").notNull().default(8),
  currentParticipants: integer("current_participants").notNull().default(0),
  prizePool: integer("prize_pool").notNull().default(0), // Rankiard points prize
  entryFee: integer("entry_fee").notNull().default(0), // Entry fee in Rankiard points
  organizerId: integer("organizer_id").notNull(),
  winnerId: integer("winner_id"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Tournament participants
export const tournamentParticipants = pgTable("tournament_participants", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  userId: integer("user_id").notNull(),
  status: text("status").notNull().default("registered"), // registered, eliminated, winner
  placement: integer("placement"),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

// Tournament matches (bracket)
export const tournamentMatches = pgTable("tournament_matches", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id").notNull(),
  round: integer("round").notNull(),
  matchNumber: integer("match_number").notNull(),
  player1Id: integer("player1_id"),
  player2Id: integer("player2_id"),
  winnerId: integer("winner_id"),
  gameId: text("game_id"), // Link to actual game
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
});

// Persistent game state table for server restart recovery
export const gameStates = pgTable("game_states", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull().unique(),
  state: jsonb("state").notNull(), // Full game state as JSON
  playerHands: jsonb("player_hands").notNull(), // Player hands mapped by name
  isActive: boolean("is_active").notNull().default(true),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGameStateSchema = createInsertSchema(gameStates);
export const insertAchievementSchema = createInsertSchema(achievements);
export const insertPlayerAchievementSchema = createInsertSchema(playerAchievements);
export const insertMissionTemplateSchema = createInsertSchema(missionTemplates);
export const insertPlayerDailyMissionSchema = createInsertSchema(playerDailyMissions);
export const insertFriendRequestSchema = createInsertSchema(friendRequests);
export const insertFriendshipSchema = createInsertSchema(friendships);
export const insertGameInvitationSchema = createInsertSchema(gameInvitations);
export const insertClanSchema = createInsertSchema(clans);
export const insertClanMemberSchema = createInsertSchema(clanMembers);
export const insertClanJoinRequestSchema = createInsertSchema(clanJoinRequests);
export const insertTournamentSchema = createInsertSchema(tournaments);
export const insertTournamentParticipantSchema = createInsertSchema(tournamentParticipants);
export const insertTournamentMatchSchema = createInsertSchema(tournamentMatches);

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
export type GameState = typeof gameStates.$inferSelect;
export type InsertFriendRequest = z.infer<typeof insertFriendRequestSchema>;
export type InsertFriendship = z.infer<typeof insertFriendshipSchema>;
export type InsertGameInvitation = z.infer<typeof insertGameInvitationSchema>;
export type InsertGameState = z.infer<typeof insertGameStateSchema>;
export type Clan = typeof clans.$inferSelect;
export type ClanMember = typeof clanMembers.$inferSelect;
export type ClanJoinRequest = typeof clanJoinRequests.$inferSelect;
export type InsertClan = z.infer<typeof insertClanSchema>;
export type InsertClanMember = z.infer<typeof insertClanMemberSchema>;
export type InsertClanJoinRequest = z.infer<typeof insertClanJoinRequestSchema>;
export type Tournament = typeof tournaments.$inferSelect;
export type TournamentParticipant = typeof tournamentParticipants.$inferSelect;
export type TournamentMatch = typeof tournamentMatches.$inferSelect;
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type InsertTournamentParticipant = z.infer<typeof insertTournamentParticipantSchema>;
export type InsertTournamentMatch = z.infer<typeof insertTournamentMatchSchema>;

// Seasonal Events
export const seasonalEvents = pgTable("seasonal_events", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  bannerImage: text("banner_image"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const seasonalCards = pgTable("seasonal_cards", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  deckType: text("deck_type").notNull(),
  imageUrl: text("image_url"),
  pti: integer("pti"),
  stars: integer("stars"),
  effect: text("effect"),
  rarity: text("rarity").default("rare"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSeasonalEventSchema = createInsertSchema(seasonalEvents).omit({ id: true, createdAt: true });
export const insertSeasonalCardSchema = createInsertSchema(seasonalCards).omit({ id: true, createdAt: true });

export type SeasonalEvent = typeof seasonalEvents.$inferSelect;
export type SeasonalCard = typeof seasonalCards.$inferSelect;
export type InsertSeasonalEvent = z.infer<typeof insertSeasonalEventSchema>;
export type InsertSeasonalCard = z.infer<typeof insertSeasonalCardSchema>;

// Card Skins
export const cardSkins = pgTable("card_skins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  borderStyle: text("border_style"),
  backgroundGradient: text("background_gradient"),
  glowColor: text("glow_color"),
  frameImageUrl: text("frame_image_url"),
  rarity: text("rarity").default("common"),
  price: integer("price").default(100),
  isAvailable: boolean("is_available").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const playerSkins = pgTable("player_skins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  skinId: integer("skin_id").notNull(),
  isEquipped: boolean("is_equipped").notNull().default(false),
  purchasedAt: timestamp("purchased_at").notNull().defaultNow(),
});

// Seasonal Pass
export const seasonalPasses = pgTable("seasonal_passes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  maxLevel: integer("max_level").notNull().default(50),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const passRewards = pgTable("pass_rewards", {
  id: serial("id").primaryKey(),
  passId: integer("pass_id").notNull(),
  level: integer("level").notNull(),
  rewardType: text("reward_type").notNull(),
  rewardValue: text("reward_value").notNull(),
  isPremium: boolean("is_premium").notNull().default(false),
});

export const playerPassProgress = pgTable("player_pass_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  passId: integer("pass_id").notNull(),
  currentLevel: integer("current_level").notNull().default(1),
  currentXp: integer("current_xp").notNull().default(0),
  hasPremium: boolean("has_premium").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCardSkinSchema = createInsertSchema(cardSkins).omit({ id: true, createdAt: true });
export const insertPlayerSkinSchema = createInsertSchema(playerSkins).omit({ id: true, purchasedAt: true });
export const insertSeasonalPassSchema = createInsertSchema(seasonalPasses).omit({ id: true, createdAt: true });
export const insertPassRewardSchema = createInsertSchema(passRewards).omit({ id: true });
export const insertPlayerPassProgressSchema = createInsertSchema(playerPassProgress).omit({ id: true, updatedAt: true });

export type CardSkin = typeof cardSkins.$inferSelect;
export type PlayerSkin = typeof playerSkins.$inferSelect;
export type SeasonalPass = typeof seasonalPasses.$inferSelect;
export type PassReward = typeof passRewards.$inferSelect;
export type PlayerPassProgress = typeof playerPassProgress.$inferSelect;
export type InsertCardSkin = z.infer<typeof insertCardSkinSchema>;
export type InsertPlayerSkin = z.infer<typeof insertPlayerSkinSchema>;
export type InsertSeasonalPass = z.infer<typeof insertSeasonalPassSchema>;
export type InsertPassReward = z.infer<typeof insertPassRewardSchema>;
export type InsertPlayerPassProgress = z.infer<typeof insertPlayerPassProgressSchema>;
