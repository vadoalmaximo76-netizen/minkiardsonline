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

## Card System
Cards feature images, ownership tracking, and custom annotations. Key mechanics include automatic card actions, an interactive defense system for MOSSE attacks, a CPU attack system, the BAMBOLA VOODOO system for character linking, the DUELLO (Duel) system for turn-based combat, and the OSTAGGIO (Hostage) system for capturing enemy characters. The ASSICURAZIONE (Insurance) system allows players to protect characters from death by insuring them with PTI.

## Interactive Effect Panels
Custom card effects can trigger interactive panels for player input, such as PTI input, deck selection, and graveyard selection.

## Custom Card Effect System
The game supports a wide range of custom card effects through `[COMPORTAMENTO: ...]` tags, including status effects (Poison, Burn, Freeze, Stun, Protection), combat effects (Shield, Reflect, Counter, Lifesteal, Revenge), and other effects like draw, discard, powerup, and resurrection.

## Audio System
A comprehensive sound effect system uses the Web Audio API for in-game events, character actions, and special card animations, with user muting control.

## Card Animation System
Twenty-eight unique full-screen animations with synchronized audio are triggered by specific cards to enhance visual feedback.

## Music Synchronization System
A synchronized music player allows all players in a game room to listen to the same music (Dragon Ball Z soundtracks) in real-time with remote control.

## Player Avatar System
Players can select from 24 emoji-based avatars, with server-side validation and real-time updates.

## Voice Chat System
Real-time WebRTC peer-to-peer voice communication with STUN servers for NAT traversal, using Socket.IO for signaling.

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