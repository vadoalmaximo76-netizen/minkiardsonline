# Overview

MINKIARDS is a real-time multiplayer online card game built with React and Express, offering an immersive and strategic card gaming experience. It features a modern UI, advanced AI opponents, and utilizes WebSocket communication for dynamic player interaction across four unique card types (PERSONAGGI, MOSSE, BONUS, PERSONAGGI SPECIALI) on a shared game field.

The game supports two play modes: **Classic** (shared central decks) and **Draft** (each player builds and uses a personal 33+33+33 deck using a credit system). A global leaderboard is accessible from the home screen. After a match ends, players can vote for an automatic rematch. An inactivity timer (30s per turn) automatically ends the turn if the active player doesn't act. Players can challenge each other directly from the leaderboard.

The Draft mode includes a **Card Pack System**: players can spend credits to open card packs (Bronzo/Argento/Oro/Diamante) containing random cards sorted by rarity tiers (Comune/Rara/Epica/Leggendaria). Opening a pack triggers a premium FIFA-style full-screen animation with 3D card flips and rarity glow effects. Cards obtained from packs are stored in the user's collection and are free to use in the deck builder.

Draft mode advanced features:
- **Tab Collezione**: visual grid of owned cards with type/rarity filters and sorted by rarity
- **Carta del Giorno**: one free random card claimable every 24h (in Pacchetti tab) with countdown timer
- **Storico Aperture**: collapsible last-10 pack openings history with rarity breakdown and duplicate credits
- **Gestione Duplicati**: duplicate cards auto-award credits (comune=+10, rara=+25, epica=+50, leggendaria=+100) shown in PackOpeningAnimation with a badge
- **Preset Mazzo**: save/load/delete up to 3 deck presets (in Mazzo tab)
- **Offerte Settimanali**: 6 deterministic 50%-off card offers weekly (seeded by ISO week number), shown in Negozio tab
- **Missioni Draft**: 5 draft-specific missions (open packs, complete deck, get epic card, daily card claims) with credit rewards, shown in Mazzo tab
- **Admin Pack Management**: Admin users see a collapsible "Gestione Pacchetti" panel in the Packs tab with full CRUD (create/edit/delete packs). Slot format supports fixed rarities ("comune", "rara") and probabilistic slots ("epica:90/leggendaria:10"). Config persisted in server/data/packs.json via jsonStorage. API: GET/POST/PUT/DELETE /api/admin/packs.
- **Admin Users Panel**: Full user account management panel accessible from Profile > Pannello Admin > "Gestisci Account Utenti". Features: search/list all users (50 per page) with credits and PR counts; inline editing of draft credits (freeCredits + paidCredits) and puntiRankiard; ban user for customizable duration (1/3/7/30/90/3650 days) with reason; unban; delete account. Ban check on login returns HTTP 403 with ban expiry and reason. DB columns added: `users.banned_until` (timestamp) and `users.ban_reason` (text). API routes: GET /api/admin/users, PATCH /api/admin/users/:id/credits, PATCH /api/admin/users/:id/pr, POST /api/admin/users/:id/ban, POST /api/admin/users/:id/unban, DELETE /api/admin/users/:id.

**Classic Tournament System** (`ClassicTournamentHub.tsx`): Full-featured competition platform accessible from the HomeScreen "Tornei" menu item. Features:
- **4 Competition Types** (selector before wizard): Torneo Classico (elimination + classic decks), Torneo Draft (elimination + draft decks), Campionato Classico (round-robin + classic), Campionato Draft (round-robin + draft). Each mapped to `type` ('elimination'|'round_robin') + `gameMode` ('classic'|'draft').
- **Creation Wizard** (4-step modal): name/description → format (max participants, players per match [hidden for campionati], entry fee) → CPU bots & prizes → confirm. Admin (lucaforte94@gmail.com) can set custom reward multipliers.
- **CPU Participants**: configurable count + custom names, auto-added at creation. Stored with `is_cpu=true, user_id=null` in `tournament_participants`.
- **Bracket Generation** (elimination): `buildBracketRound()` in `routes.ts` — shuffled participants, padded to next multiple of `playersPerMatch`, bye (null) auto-advance, multi-player match support.
- **Round-Robin Calendar** (campionati): `buildRoundRobinSchedule()` in `routes.ts` — polygon rotation algorithm, all matches pre-generated at start, always 1v1, 2 pts per win.
- **Standings** (campionati): `GET /api/tournaments/:id/standings` endpoint + "Classifica" tab in detail modal. Sorted by points (wins×2), tiebreaker by wins count. Medal icons for top 3.
- **Tournament Detail Modal**: tabs adapt to type — "Tabellone" for elimination, "Calendario" for round_robin, + "Classifica" tab for campionati.
- **Tournament Cards**: show competition type badge (⚔️ Torneo / 📅 Campionato) + gameMode badge (📦 Classico / 🃏 Draft).
- **Delete Tournament**: creator/admin can delete their tournament (confirmation dialog). Also auto-deletes completed tournaments after 3 hours (setInterval every 30 min).
- **"Prosegui torneo" button**: after a tournament match ends, GameEndRewardsPanel shows this button; returns to tournament hub without triggering auto-rejoin.
- **Prize Scaling**: winner gets `winnerRewardMultiplier × totalParticipants` PR, runner-up `runnerUpRewardMultiplier × totalParticipants` PR. Defaults: 20× and 5×.
- **Backend APIs**: GET /api/tournaments, GET /api/tournaments/:id, GET /api/tournaments/:id/standings, POST /api/tournaments, POST /api/tournaments/:id/join, POST /api/tournaments/:id/start, POST /api/tournaments/matches/:matchId/report, POST /api/tournaments/:id/invite, DELETE /api/tournaments/:id. **New**: PUT /api/tournaments/matches/:id/schedule (admin), POST /api/tournaments/:id/disqualify/:participantId (admin), POST /api/tournaments/matches/:id/walkover (admin).
- **Socket events**: tournament-created, tournament-updated, tournament-started, tournament-round-advanced, tournament-match-reported, tournament-completed, tournament-cancelled, tournament-invite.
- **DB Schema**: `tournaments.type` ('elimination'|'round_robin'), `tournaments.game_mode` ('classic'|'draft'), `tournaments.is_official` (BOOLEAN), plus cpu/prize/settings columns. `tournament_participants.is_cpu`, `display_name`, nullable `user_id`, `disqualified_at`, `disqualification_reason`. `tournament_matches.player_ids jsonb`, `scheduled_at`, `note`, `notified_24h/1h/30m`.
- **Official Tournaments**: Admin can mark a tournament as "UFFICIALE" during creation. Official tournaments appear first in the list (sorted before non-official), show a gold ⭐ UFFICIALE badge on both the card and detail modal header, and trigger a push notification broadcast to all subscribed users on creation.
- **Admin Controls in TournamentDetailModal**: When admin views bracket tab, a "Controlli Admin — Partite" section shows all pending matches with "📅 Programma" (schedule date/time, sends notification to players) and "⚖️ A Tavolino" (assign walkover result with reason). In Partecipanti tab, each non-CPU human player has a "Squalifica" button that opens a reason modal. All admin actions show inline toast confirmations.
- **Match Notification Scheduler**: setInterval (60s) in routes.ts checks for matches with `scheduled_at` set and sends push notifications to match participants at 24h, 1h, and 30min before the match (tracked with `notified_24h/1h/30m` flags). Helper `sendPushToAll()` broadcasts to all push subscription rows.
- **isOfficial toggle in CreateWizard**: Admin-only toggle in Step 1 with animated slide switch, amber gradient when active, descriptive copy explaining push notification broadcast.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
Developed with React 18, TypeScript, Tailwind CSS, and Radix UI. State management uses Zustand for local state and React Query for server state.

## Backend
Built with Express.js and TypeScript, utilizing Socket.IO for real-time communication. A central GameManager class handles game logic and state.

## Real-time Communication
Socket.IO enables real-time game events, optimizing network performance with techniques like server-side throttling, message compression, and optimistic UI updates.

## Game State Management
The server acts as the authoritative source for game state, ensuring consistency across all game elements.

## CPU Player Intelligence
Advanced AI CPU players make strategic decisions based on complete game rules, including card analysis, combat calculations, and turn restrictions, communicating actions in Italian.

## Training Mode Tutorial System
A 9-step, event-based tutorial guides new players through game mechanics with in-game action triggers and skip functionality.

## User Authentication
Supports email/password and Google OAuth, with bcrypt-hashed passwords and JWT tokens for secure authentication.

## Data Storage
User management uses Drizzle ORM with Neon Database (PostgreSQL). Active game state is in-memory. An offline mode allows operation without a database, using JSON files for user data and card information.

## Card System
Features four unique card types with images, ownership tracking, and custom annotations. Key mechanics include automatic card actions, an interactive defense system for MOSSE attacks, a CPU attack system, the BAMBOLA VOODOO character linking system, the DUELLO (Duel) turn-based combat system, the OSTAGGIO (Hostage) character capturing system, and the ASSICURAZIONE (Insurance) character protection system.

## Defense BONUS Card System
Specific BONUS cards allow players to defend against attacks with unique behaviors, such as nullifying damage, reflecting damage, or redirecting damage. CPU players intelligently select defense cards.

## OCR Card Effect Extraction
Server-side OCR using Tesseract.js (`server/ocrBonusCards.ts`) extracts text from BONUS card images. Low-quality OCR results are stored in `ocrText` field with `ocrPendingReview=true` and don't affect gameplay until admin approves via the OCR Review Panel in CardAdminPanel. Admin endpoints: `POST /api/admin/ocr-bonus-cards` (run OCR), `GET /api/admin/ocr-pending-review` (list pending), `POST /api/admin/ocr-approve` (approve with optional text override).

## Custom Card Effect System
Supports a wide range of custom card effects via `[COMPORTAMENTO: ...]` tags, including status effects, combat effects, and advanced bonus effects like conditional taroccata, KEBAB buff, character inheritance, block and evolve, character stealing, bomb removal, card swapping, mirror effects, dividing stats, and self-cloning.

## Audio System
A comprehensive sound effect system using the Web Audio API provides in-game event feedback with per-category toggles and localStorage persistence.

## FantaMinkiards
Pre-tournament auction system where players bid on cards to build decks, then compete in a bracket tournament. Key components:
- **Auction**: Real-time blind auction for all cards (personaggi/mosse/bonus). Cards sorted alphabetically, 15s initial timer, 3s reset timer on new bids. Players start with 1000 credits. CPU players auto-bid. Disqualification if credits run out before completing deck.
- **FantaTorney**: Configurable bracket (elimination) or campionato (round-robin) tournament with the auctioned decks. CPU match simulation. Rankiard prizes awarded (winner×N, runner-up×N). Match auto-starts for 1 human + CPUs.
- **Deck Viewer**: Full-screen overlay showing each participant's deck with card images, rarity badges, PTI stats, auction price stamps.
- **Nome Squadra + Colore** (T001): Each player can set a custom team name (up to 30 chars) and color in the lobby (`fanta:set-team-info`). Displayed in lobby participant list, bracket match cards, campionato standings. `FantaParticipant.teamName/teamColor` persisted in JSON.
- **Formazione Pre-partita** (T002): Before starting a match, the player sees a formation picker overlay — pick 1 personaggio + 1 mossa + 1 bonus to guarantee in opening hand. Formation sent with `fanta:start-fanta-match` payload; server moves selected cards to end of `playerDraftDecks` arrays (since `pop()` draws from end).
- **Statistiche Cumulative** (T003): After each fanta match completes, `recordMatchStats()` extracts per-player stats (matchesPlayed, wins, totalDamageDealt, totalCardsPlayed, totalTurns) from `game.playerStats` and accumulates in `FantaSession.tournamentStats`. "📊 Stats" button in bracket header opens stats panel. `fanta:stats-update` event broadcasts updates.
- **Mercato tra i round** (T004): `FantaSession.market.listings` tracks cards for sale. Sellers list cards (removed from their deck, added to market); buyers spend credits to buy (card added to buyer deck, credits transferred). Socket events: `fanta:list-card`, `fanta:buy-card`, `fanta:remove-listing`. "🛒 Mercato" button in bracket header opens market panel.
- **Key files**: `server/fantaManager.ts` (FantaManager class, all interfaces), `server/routes.ts` (all `fanta:*` socket handlers), `client/src/components/FantaMinkiardsSection.tsx`, `client/src/components/FantaAuctionRoom.tsx`.
- **Data persistence**: `server/data/fantaSessions.json`.
- **Admin**: `lucaforte94@gmail.com` can delete sessions.

## Visual Systems
- **Card Animation System**: Twenty-eight unique full-screen animations with synchronized audio for specific cards.
- **Background Music Player**: YouTube IFrame API player (playlist `PLX6i-6a7orEU-L1GdfUDtepT-pW4tYl4j`). "Avvia musica" button starts music; player iframe is hidden off-screen. A small volume button (bottom-right) reveals a vertical slider on hover. A slide-in banner (bottom-left, 5s) shows track title/artist on song change. State persists across section navigation via `window.__minkYT` singleton. Component: `client/src/components/SpotifyPlayer.tsx` (export: `SpotifyPlayer`).
- **Player Avatar System**: 24 emoji-based avatars with server-side validation.
- **Voice Chat System**: Real-time WebRTC peer-to-peer voice communication using Socket.IO for signaling.
- **Evolution/Transformation Animation System**: A multi-phase, full-screen animation with 3D card flips, particles, and theming for character evolutions, transformations, or taroccata.
- **Turn Transition Animation**: Cinematic full-screen overlay animation for turn changes with distinct styling for player's turn vs. opponent's turn.

## Pre-Game Lobby Panel
When a player creates or joins a room (before the game starts), a full-screen "SALA D'ATTESA" (waiting room) panel shows instead of the game board. The creator can: invite players by searching usernames (reuses `/api/users/search` + `/api/friends/invite`), set the "morti" (character limit: 1/2/3/5/unlimited, default 3), and click COMINCIA to start. Other players see a read-only view with the selected settings and a "waiting for host" message. The morti setting syncs in real-time via `set-lobby-settings` / `lobby-settings-updated` socket events. The old character-limit dialog (post-COMINCIA) is bypassed; the value is set in the lobby. Component: `client/src/components/PreGameLobbyPanel.tsx`. Server: `set-lobby-settings` socket event in `server/routes.ts`. `isPlaying` is now included in `getSanitizedGameState()` output.

## UI/UX Design
- **Layout**: Compact header with essential actions and a glassmorphism dropdown menu for secondary actions. A compact glassmorphism toolbar at the bottom-right provides game action buttons.
- **Background**: Animated CSS gradient background with floating radial gradient orbs.
- **Turn Indicator**: Persistent glassmorphism banner showing whose turn it is, with glow animations and color-coding.
- **Visual Zone Distinction**: Game areas (hand, deck, field) are visually differentiated with gradients and borders.
- **3D Card Interaction System**: Cards feature 3D CSS effects like tilt/parallax on hover, 3D draw animation, 3D entry slam, 3D damage shake, 3D attack lunge, and hover zoom preview via ReactDOM portal.
- **3D Animation Components**: Includes `Dice3D` (pure CSS 3D dice), `AttackSlash3D` (full-screen 3D slash effect), and `CardShatter3D` (3D card shattering death effect).
- **Combat Feedback System**: Damage flash animation, smooth CSS transitions for card movement, 3D attack lunge, 3D slash overlay, and floating damage numbers with audio feedback.
- **Duel Battle Overlay**: Full-screen Pokémon-style battle overlay (`DuelBattleOverlay.tsx`) for DUELLO combat with animated HP bars (green/yellow/red), VS intro animation, typewriter battle messages, hit/shake effects, damage flash, spectator support, victory screen, and YouTube battle music. Uses `safeTimeout` pattern for cleanup-safe animations. CPU players can both participate in and initiate duels autonomously. Duel damage is fully automatic based on `mosseDamageValue * attackerStars` (no manual damage input).
- **Game Log Panel**: Slide-out panel for game events with category filtering, emoji icons, color-coding, and auto-scroll, persisting messages in localStorage.
- **Draft Tournament System**: Full "Torneo Draft" mode in DraftSection (tab "Torneo" + tab "Classifica"). Entry cost 100 credits, max 7 wins / 3 losses. Results auto-recorded by server: `gameManager.updateDraftTournamentMatch()` hooks into `completeMatch` and detects Draft PvP games — winner/loser draft tournament records updated automatically, no manual input needed. Draft Rating (+30 win, -20 loss, floor 0) only reward. Public leaderboard. DB: `draftTournaments` table + `draftRating`/`draftBestRun` on users.

# External Dependencies

## Database
- **Neon Database**: PostgreSQL-compatible serverless database.
- **Drizzle ORM**: Type-safe database toolkit.

## Real-time Communication
- **Socket.IO**: WebSocket library for real-time communication.

## UI Framework
- **Radix UI**: Accessible, unstyled UI primitives.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

## State Management
- **Zustand**: Client-side state management.
- **React Query**: Server state management and caching.

## Build Tools
- **Vite**: Fast build tool and development server.
- **ESBuild**: Fast JavaScript bundler.
- **TypeScript**: Language for type checking.

## Fonts and Assets
- **Inter**: Web font.
- **PostImg/Imgur**: External image hosting.

## Unified Notification Inbox
- **DB table**: `notifications` (id, userId, type, title, body, data jsonb, isRead, createdAt)
- **Types**: `fanta_invite`, `friend_request`, `game_invite`, `clan_request`, `message`, `market_sale`, `achievement`, `tournament`, `general`
- **Backend helper**: `createNotification(userId, type, title, body, data?, sendPush?)` in `server/routes.ts` — inserts to DB and optionally fires a Web Push
- **Trigger points**: fanta:create (invited users), fanta:invite socket, POST /api/friends/requests, POST /api/friends/invite, POST /api/clans/:id/join, POST /api/messages/send, POST marketplace buy
- **API**: GET /api/notifications, PATCH /api/notifications/:id/read, PATCH /api/notifications/read-all, DELETE /api/notifications/:id, DELETE /api/notifications
- **Frontend**: `NotificationInbox.tsx` — fixed bell icon (top-right, z=11000) with red unread badge, slide-in panel, poll 30s + window focus. Integrated in all App.tsx sections alongside NotificationPromptBanner.