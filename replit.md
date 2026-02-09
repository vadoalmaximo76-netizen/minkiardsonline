# Overview

MINKIARDS is a real-time multiplayer online card game built with React and Express, featuring a modern UI and advanced AI for CPU opponents. The game incorporates four unique card types (PERSONAGGI, MOSSE, BONUS, PERSONAGGI SPECIALI) and utilizes WebSocket communication for dynamic player interaction on a shared game field. The project aims to deliver an immersive and strategic card gaming experience.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The client is developed with React 18, TypeScript, Tailwind CSS, and Radix UI. State management uses Zustand for local state and React Query for server state.

## Backend
The server is built using Express.js and TypeScript, with Socket.IO for real-time communication. A central GameManager class manages game logic and state, broadcasting updates to clients.

## Real-time Communication
Socket.IO facilitates WebSocket connections for all real-time game events, including joining, card actions, player interactions, and state synchronization. Network performance is optimized with server-side throttling, message compression, duplicate detection, optimistic UI updates, and React memoization.

## Game State Management
Game state is managed on both client and server, with the server acting as the authoritative source, tracking all game elements (decks, hands, field, graveyard) for consistency.

## CPU Player Intelligence
CPU players are equipped with advanced AI, capable of strategic decision-making based on complete MINKIARDS rules, including card analysis, combat calculations, and turn restrictions. They communicate actions in Italian and adapt to player input.

## Training Mode Tutorial System
A 9-step, event-based tutorial guides new players through game mechanics, triggered by in-game actions and offering skip functionality.

## User Authentication
The system supports email/password and Google OAuth authentication. Passwords are bcrypt-hashed, and JWT tokens secure authenticated endpoints.

## Data Storage
User management uses Drizzle ORM with Neon Database (PostgreSQL). Active game state is maintained in memory.

## Offline Mode (No Database)
The game supports running without a database connection. When DATABASE_URL is missing or the database is unreachable:
- **Authentication**: Users can register/login using JSON-based storage (server/data/users.json). Admin fallback (lucaforte94@gmail.com) always works with ADMIN_FALLBACK_PASSWORD.
- **Card System**: All card data, modifications, custom cards, and skins are read from JSON files in server/data/ (cardModifications.json, customCards.json, personaggiCache.json, etc.).
- **Gameplay**: All game logic, effects, and mechanics work fully offline since game state is in-memory.
- **Rankiard Points**: Managed per-session from JSON user storage. Points are tracked but not permanently saved to a DB.
- **Unavailable Features**: Admin panel routes for seasonal events, tournaments, clans, friends, private messages, and push notifications return 503 errors.
- **Security**: JWT_SECRET is auto-generated randomly per server restart if not set as env variable.

## Card System
Cards feature images, ownership tracking, and custom annotations. Key mechanics include automatic card actions, an interactive defense system for MOSSE attacks, a CPU attack system, the BAMBOLA VOODOO system for character linking, the DUELLO (Duel) system for turn-based combat, and the OSTAGGIO (Hostage) system for capturing enemy characters. The ASSICURAZIONE (Insurance) system allows players to protect characters from death by insuring them with PTI.

## Defense BONUS Card System
When attacked, players can use specific BONUS cards to defend. Each has unique behavior:
- **ALTA SALVA**: Nullifies damage only if > 200 PTI (hidden from selection when damage <= 200)
- **BOOMERANG / RESPINTA**: Reflects full damage back to attacker
- **CONTRO SKRAZZKOOM**: Reflects DOUBLE damage to attacker
- **CONVERSIONE**: Nullifies damage and adds it as PTI to defender's character
- **DIFESA VIGLIACCA**: Redirects damage to a chosen opponent's character (not the attacker) - shows target selection panel
- **E NN T MITT SCUORN / E NN T MITT SSCUORN**: Simply nullifies damage
- **E TAGG TRATTAT**: Halves the damage (defender takes half)
- **FOLATA DI VENTO**: Nullifies damage, rolls dice (visible to all), even = next player takes damage, odd = previous player takes damage
CPU players intelligently select appropriate defense cards and handle special behaviors (e.g., skip ALTA SALVA for low damage, auto-select redirect target for DIFESA VIGLIACCA).

## Interactive Effect Panels
Custom card effects can trigger interactive panels for player input, such as PTI input, deck selection, and graveyard selection.

## Custom Card Effect System
The game supports a wide range of custom card effects through `[COMPORTAMENTO: ...]` tags, including status effects (Poison, Burn, Freeze, Stun, Protection), combat effects (Shield, Reflect, Counter, Lifesteal, Revenge), and other effects like draw, discard, powerup, and resurrection.

## Audio System
A comprehensive sound effect system uses the Web Audio API for in-game events, character actions, and special card animations. Features per-category sound toggles (turn change, attack, defense, death, card play, bonus, dice, chat, my turn) with localStorage persistence and a dedicated SoundSettings panel. Global mute and per-category toggles work together.

## Card Animation System
Twenty-eight unique full-screen animations with synchronized audio are triggered by specific cards to enhance visual feedback.

## Music Synchronization System
A synchronized music player allows all players in a game room to listen to the same music (Dragon Ball Z soundtracks) in real-time with remote control.

## Player Avatar System
Players can select from 24 emoji-based avatars, with server-side validation and real-time updates.

## Voice Chat System
Real-time WebRTC peer-to-peer voice communication with STUN servers for NAT traversal, using Socket.IO for signaling.

## Turn Transition Animation
Cinematic full-screen overlay animation when turns change. Different styling for your turn (golden/crown icons, "È IL TUO TURNO!") vs opponent's turn (blue/purple, "Turno di [PLAYER]"). Uses phase-based CSS animations with slide-in, glow pulse, icon spin, and auto-dismiss after 2.5 seconds.

## Persistent Turn Indicator
A persistent banner at the top of the game table shows whose turn it is ("👑 TOCCA A TE!" or "⏳ Turno di [PLAYER]"). Active player name labels glow green with pulsing ring animation. CARTE IN CAMPO section highlights the active player with green text and 🟢 indicator.

## Visual Zone Distinction
Game areas are visually differentiated: hand zone has blue gradient border, deck zone has radial purple gradient, field zone has purple border styling. Each zone has subtle background effects to improve spatial clarity.

## Card Hover Zoom Preview
Hovering over field cards shows an enlarged preview (250px) using a ReactDOM portal for proper z-index control. Smart positioning prevents viewport overflow. Shows card image and text details.

## Combat Feedback System
Damage flash animation (red/white filter flash) triggers when a card takes PTI damage. Cards have smooth CSS transitions for movement. Attack lunge animation available for combat emphasis. Floating damage numbers already show PTI/star changes with audio feedback.

## Game Log Panel
A slide-out panel (GameLog component) showing all game events with category filtering (Tutti/Azioni/Carte/Sistema), auto-categorized entries with emoji icons, color-coded by event type, and auto-scroll to latest entry. Loads existing messages from localStorage.

## Development Tools
Vite is used for frontend bundling with React plugin, and ESBuild handles server-side bundling.

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