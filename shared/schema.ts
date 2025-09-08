import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
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

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertMatchSchema = createInsertSchema(matches);
export const insertGameEventSchema = createInsertSchema(gameEvents);

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type GameEvent = typeof gameEvents.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type InsertGameEvent = z.infer<typeof insertGameEventSchema>;
