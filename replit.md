# Overview

MINKIARDS is a real-time multiplayer online card game built with React and Express. It features four unique card types (PERSONAGGI, MOSSE, BONUS, PERSONAGGI SPECIALI) and utilizes WebSocket communication for real-time interaction. Players engage in various card actions on a shared game field. The project aims to provide an immersive and strategic card gaming experience with a modern UI and advanced AI for CPU opponents.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend
The client uses React 18 with TypeScript, Tailwind CSS, and Radix UI components. State management is handled by Zustand for local state and React Query for server state.

## Backend
The server is built with Express.js and TypeScript, utilizing Socket.IO for real-time communication. A GameManager class centralizes game logic and state, broadcasting updates to connected clients.

## Real-time Communication
Socket.IO facilitates WebSocket connections for real-time events such as game joining, card actions, player interactions, and game state synchronization.

## Network Performance Optimizations
The game is optimized for slow internet connections with several performance enhancements:
- **Server-side throttling**: Game state updates are throttled to 30ms to batch rapid changes while maintaining responsiveness
- **Message compression**: Socket.IO perMessageDeflate compression with 512-byte threshold and balanced compression level
- **Duplicate detection**: eventCounter-based deduplication prevents sending identical state updates
- **Optimistic UI**: Deck card picks show immediate visual feedback while awaiting server confirmation
- **Pre-calculated counts**: deckCounts and handCount sent in state for quick UI access
- **Socket.IO optimization**: Increased ping timeout (60s), WebSocket priority with upgrade support, faster reconnection (500ms delay)
- **React memoization**: Card, Deck, and RoundTable components use React.memo to prevent unnecessary re-renders
- **requestAnimationFrame**: Client state updates use rAF for smooth 60fps UI rendering

## Game State Management
Game state is managed on both client and server, with the server as the authoritative source. It tracks deck states, player hands, field positions, and the graveyard, ensuring consistent views for all players.

## CPU Player Intelligence
CPU players incorporate advanced AI for strategic decision-making, understanding complete MINKIARDS rules, including card analysis, combat calculations, power economics, and turn restrictions. They communicate actions in Italian and adapt to player input.

## User Authentication
The system supports email/password and Google OAuth authentication. Passwords are bcrypt-hashed, and JWT tokens (7-day expiry) secure authenticated endpoints.

## Data Storage
User management is handled by Drizzle ORM with Neon Database (PostgreSQL). Game state is maintained in memory during active sessions.

## Card System
Cards are defined with images, ownership tracking, and custom annotations. Key features include automatic card mechanics (draw, analysis, death, return to deck), an interactive defense system for MOSSE attacks with targeted notifications and timeouts, a comprehensive CPU attack system integrated with the defense mechanism, a BAMBOLA VOODOO system for character linking and damage reflection, a DUELLO (Duel) system for turn-based combat between two players, and the OSTAGGIO (Hostage) system for capturing enemy characters.

## OSTAGGIO (Hostage) System
The OSTAGGIO MOSSE card captures an enemy character for 3 turns. Features include:
- **Damage & Capture**: Damage is dealt to the target, and if surviving, the character becomes a hostage
- **Field Positioning**: OSTAGGIO card stays on field, and the hostage character moves next to it
- **Incapacitation**: Hostaged characters cannot attack or defend for 3 turns of the captor
- **Vulnerability**: Hostaged characters can receive damage from other attacks without being able to defend
- **Turn Countdown**: Hostage duration counts only the captor's turns, not all players' turns
- **Automatic Release**: After 3 turns, the character returns to original owner with full usability
- **Instant Death**: If target has less than 300 PTI when OSTAGGIO is applied, they die immediately
- **Visual Indicators**: Hostage cards show amber border, turn countdown, and original owner info

## Insurance (Assicurazione) System
The ASSICURAZIONE BONUS card allows players to protect characters from death:
- **PTI Input Panel**: When played, shows a panel for the player to enter a PTI amount to "insure"
- **PTI Subtraction**: The entered PTI amount is subtracted from the character immediately
- **Insurance Storage**: The insured PTI is stored on the character as `insurancePti`
- **Death Prevention**: When a character would die (PTI reaches 0), the insurance triggers instead
- **PTI Restoration**: The character is restored with the insured PTI amount instead of dying
- **One-Time Use**: Insurance is consumed when triggered and must be re-applied
- **Universal Integration**: Insurance check is integrated into `moveToGraveyard`, covering all death paths

## Interactive Effect Panels
Custom card effects can trigger interactive panels for player input:
- **PTI Input Panel**: Blue panel for entering PTI amounts (triggered by `show_pti_input_panel` action)
- **Deck Selection Panel**: Amber panel for selecting from PERSONAGGI/MOSSE/BONUS/SPECIALI decks
- **Graveyard Selection**: Purple panel for choosing cards from the graveyard
- **Socket Events**: `show-pti-input-panel`, `show-deck-selection`, `show-graveyard-selection`
- **Confirmation Events**: `pti-input-confirm`, `deck-selection-confirm`, `resurrect-select`

## Custom Card Effect System
The Wizard panel allows creating cards with custom effects via `[COMPORTAMENTO: ...]` tags. Effects are actively processed and integrated into gameplay:

### Status Effects (processed at end of turn)
- **Poison**: Deals damage each turn, decrements turns remaining, removed when expired
- **Burn**: Deals continuous damage each turn
- **Freeze**: Prevents actions, decrements countdown, removed when expired
- **Stun**: Prevents actions for one turn, automatically removed
- **Protection**: Prevents attacks on character, decrements countdown, removed when expired

### Combat Effects (processed during attack resolution)
- **Shield**: Absorbs incoming damage up to shield amount, removed when depleted
- **Reflect**: Reflects percentage of damage back to attacker
- **Counter**: Deals counter damage to attacker when hit
- **Lifesteal**: Heals attacker for percentage of damage dealt
- **Revenge**: Deals damage to attacker when character dies
- **Freeze/Stun Prevention**: Frozen or stunned characters cannot attack

### Other Effect Types
Draw, discard, powerup, weaken, aura, modify stars, extra turn, skip turn, nullify, resurrect, steal, execute, silence, taunt, halve/double PTI/stars, clone, inherit from dead, and more are supported via `parseEffectKeywords` and `applyParsedEffect` functions

## Audio System
A comprehensive sound effect system using Web Audio API provides in-game audio for various events, character actions, and 28 special card animations, with user control for muting.

## Card Animation System
Twenty-eight unique full-screen animations with synchronized audio are triggered by specific cards when played, enhancing visual feedback with custom CSS keyframe animations.

## Music Synchronization System
A synchronized music player allows all players in a game room to listen to the same music (Dragon Ball Z soundtracks) in real-time, with remote control capabilities.

## Player Avatar System
Players can select from 24 emoji-based avatars, with server-side validation and real-time updates broadcast to all players.

## Voice Chat System
Real-time WebRTC voice communication is implemented using peer-to-peer connections, STUN servers for NAT traversal, and Socket.IO for signaling, including echo cancellation and noise suppression.

## Development Tools
Vite is used for frontend building with React plugin, and ESBuild handles server-side bundling.

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

# Social & Competitive Features (Phase 2-4)

## Spectator Mode
Players can watch live games without participating:
- **Socket Events**: `join-as-spectator`, `leave-spectator`, `spectator-joined`, `spectator-left-notification`
- **SpectatorView Component**: Read-only game field visualization
- **Integration**: "Guarda" button in ActiveRooms panel
- **Disconnect Cleanup**: Automatic spectator removal on socket disconnect

## Emoji Reactions
Quick in-game communication with emoji reactions:
- **12 Quick Emojis**: Thumbs up, applause, fire, laughing, crying, thinking, etc.
- **Server-side Rate Limiting**: 1 emoji per second per socket to prevent spam
- **Floating Animations**: Emojis float up with player name labels
- **Integration**: EmojiReactions component in GameBoard

## Clan/Guild System
Organized groups of players:
- **Database Tables**: clans, clanMembers, clanJoinRequests
- **Features**: Create/join clans, clan tags, member management, join requests
- **ClanPanel Component**: Full UI for clan management in ProfileSection

## Tournament System
Competitive organized play:
- **Database Tables**: tournaments, tournamentParticipants, tournamentMatches
- **Bracket Generation**: Automatic first-round pairing on tournament start
- **Status Checks**: Registration phase validation before start
- **TournamentPanel Component**: Browse, create, join tournaments from HomeScreen

## Replay System
Review past games:
- **Database Tables**: matches, gameEvents
- **ReplayPanel Component**: Playback controls, speed options (0.5x-4x), event timeline
- **Search**: Find matches by player name or game ID
- **Integration**: "Replay" button on HomeScreen

## Seasonal Events
Time-limited special content:
- **Database Tables**: seasonalEvents, seasonalCards
- **SeasonalEventsPanel Component**: Browse active/past events and exclusive cards
- **Card Rarity System**: Common, rare, epic, legendary cards
- **Integration**: "Eventi" button on HomeScreen

## Card Skins System
Visual customization for cards:
- **Database Tables**: cardSkins, playerSkins
- **Features**: Purchase skins with Rankiard points, equip/unequip skins
- **Rarity Tiers**: Common, rare, epic, legendary with different visual styles
- **CardSkinsPanel Component**: Browse and manage skins in ProfileSection

## Seasonal Pass System
Progressive reward system:
- **Database Tables**: seasonalPasses, passRewards, playerPassProgress
- **Features**: Free and premium reward tracks, level progression, XP system
- **Claim Rewards**: API endpoint for claiming unlocked rewards
- **SeasonalPassPanel Component**: View progress and rewards in ProfileSection