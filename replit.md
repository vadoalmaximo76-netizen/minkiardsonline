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
The game supports a wide range of custom card effects through `[COMPORTAMENTO: ...]` tags, including status effects (Poison, Burn, Freeze, Stun, Protection), combat effects (Shield, Reflect, Counter, Lifesteal, Revenge), and other effects like draw, discard, powerup, and resurrection. Advanced bonus effects include:
- **Conditional Taroccata** (bonus-22): Named characters get taroccata, others get PTI bonus
- **KEBAB Buff** (bonus-25): Doubles next KEBAB move damage (x4 with Mohamed), conditional PTI
- **Inherit to Next** (bonus-48): Current PTI/stars transfer to next played character
- **Block then Evolve** (bonus-33): Freezes character for N turns, then evolves M times
- **Steal Character** (bonus-34): Steals an opponent's character to your field
- **Remove Bombs** (bonus-38): Removes unexploded bomb cards from field
- **Swap Card with Deck** (bonus-43): Return a hand card to deck, draw same type
- **Mirror Effect** (bonus-27): PTI/star changes mirror to a chosen enemy character
- **Dividi** (bonus-41): Halves target enemy's PTI and stars
- **Clone Self** (bonus-26): Duplicates character via "Duplica" function
- **All Attack Target** (bonus-21): Forces all players to attack chosen target

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

## Evolution/Transformation Animation System
Spectacular full-screen animation triggered when characters evolve, transform, or get taroccata'd. The EvolutionAnimation component features a 6-phase sequence with 3D card flip effects: backdrop entry, old character display with energy particles and 3D Y-axis flip-out, lightning bolts and verb text, new character 3D card-flip reveal with spinning conic-gradient aura, PTI/stars badge reveal, and fade out. Type-specific theming: gold for evolution, purple for transformation, red for taroccata. Includes 40 energy particles, 8 lightning bolts, 24 ring particles, shockwave ring, and scanline effects. Server emits 'evolution-animation' socket event; the 'personaggio-enters' event is delayed 5.5s to play after the evolution animation completes.

## Turn Transition Animation
Cinematic full-screen overlay animation when turns change. Different styling for your turn (golden/crown icons, "È IL TUO TURNO!") vs opponent's turn (blue/purple, "Turno di [PLAYER]"). Uses phase-based CSS animations with slide-in, glow pulse, icon spin, and auto-dismiss after 2.5 seconds.

## UI Layout
- **Compact Header**: Single-line header with MINKIARDS logo, room code, primary actions (COMINCIA, CPU), user info badge, and a glassmorphism dropdown menu (MoreVertical icon) containing secondary actions (Regolamento, Invita Amici, Missioni, Trofei, Rankiard, Nuova/Ricomincia Partita).
- **Right-side Game Tools**: Compact glassmorphism toolbar fixed at the bottom-right with game action buttons: Hand, End Turn | Chat, Game Log | Dice, Calculator, Graveyard, Shuffle, VoiceChat. Dividers separate logical groups. Audio/Music/Settings controls moved to header dropdown menu to avoid overlap with other game elements.
- **Animated Background**: CSS gradient background with 3 floating radial gradient orbs (purple, blue, cyan) that drift slowly for subtle depth. No external image dependency.

## Persistent Turn Indicator
A glassmorphism banner at the top of the round table shows whose turn it is ("👑 TOCCA A TE!" or "⏳ Turno di [PLAYER]") with glow animations. Gold-themed for your turn, blue/purple for opponents. Active player name labels glow green with pulsing ring animation.

## Visual Zone Distinction
Game areas are visually differentiated: hand zone has blue gradient border, deck zone has radial purple gradient, field zone has purple border styling. Each zone has subtle background effects to improve spatial clarity.

## 3D Card Interaction System
Cards feature comprehensive 3D CSS effects:
- **3D Tilt/Parallax on Hover**: Cards tilt following mouse position with perspective depth and a dynamic glare/shine overlay that moves with the cursor.
- **3D Card Draw Animation**: Cards entering the hand flip in from the back side with a Y-axis rotation (card-draw-3d keyframe).
- **3D Entry Slam**: Cards played to the field use enhanced 3D perspective animations with translateZ depth, multi-axis rotation, and bounce effects (card-epic-enter, card-slam, card-spin-in keyframes).
- **3D Damage Shake**: Damage flash now includes perspective-based rotateX/rotateZ shake with scale pulses for more impactful feedback.
- **3D Attack Lunge**: Attack animation uses translateZ depth jumps and rotateX tilts for a leaping forward effect.
- **Card Hover Zoom Preview**: Hovering over field cards shows an enlarged preview (250px) using a ReactDOM portal for proper z-index control.

## 3D Animation Components
- **Dice3D** (`Dice3D.tsx`): Pure CSS 3D cube dice with 6 faces, rolling animation on 3 axes, and smooth result rotation. Used in evolution dice roll overlay and super dice.
- **AttackSlash3D** (`AttackSlash3D.tsx`): Full-screen 3D slash effect with three diagonal sweeping slashes, expanding shockwave ring, scattered spark particles, and floating damage number.
- **CardShatter3D** (`CardShatter3D.tsx`): 3D card shattering death effect where the card image breaks into 16 CSS clip-path fragments that fly outward with full 3D rotation, plus a white flash and floating dark particles.

## Combat Feedback System
Damage flash animation (3D red/white filter flash with rotateX/rotateZ shake) triggers when a card takes PTI damage. Cards have smooth CSS transitions for movement. 3D attack lunge animation with depth for combat emphasis. 3D slash overlay on attacks. Floating damage numbers show PTI/star changes with audio feedback.

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