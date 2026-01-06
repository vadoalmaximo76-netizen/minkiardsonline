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
  createdBy: text("created_by"), // Player name who created the card
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  createdBy: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;
export type Personaggio = typeof personaggi.$inferSelect;
export type CustomCard = typeof customCards.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertGameEvent = z.infer<typeof insertGameEventSchema>;
export type InsertPersonaggio = z.infer<typeof insertPersonaggioSchema>;
export type InsertCustomCard = z.infer<typeof insertCustomCardSchema>;
