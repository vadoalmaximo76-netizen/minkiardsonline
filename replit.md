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
- **Server-side throttling**: Game state updates are throttled to 100ms to batch rapid changes
- **Message compression**: Socket.IO perMessageDeflate compression reduces payload size (threshold 1KB)
- **Smart update batching**: Client uses server's eventCounter to detect meaningful changes; only redundant broadcasts are debounced
- **Optimistic UI**: Deck card picks show immediate visual feedback while awaiting server confirmation
- **Pre-calculated counts**: deckCounts and handCount sent in state for quick UI access

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