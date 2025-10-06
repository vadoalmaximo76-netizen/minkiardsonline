# Overview

MINKIARDS is a real-time multiplayer online card game built with React and Express. The game features four distinct decks of cards (PERSONAGGI, MOSSE, BONUS, PERSONAGGI SPECIALI) that players can draw from and play on a shared game field. Players can interact with cards through various actions like playing, moving between zones, and transferring to other players. The application uses WebSocket communication for real-time multiplayer functionality and features a modern UI built with React and Tailwind CSS.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client is built using React 18 with TypeScript and uses a component-based architecture. The UI is styled with Tailwind CSS and utilizes Radix UI components for accessibility and consistency. The application uses Zustand for state management to handle game state, player information, and selected cards. React Query is used for server state management and caching.

## Backend Architecture
The server uses Express.js with TypeScript running in ES module mode. Socket.IO handles real-time communication between clients for multiplayer functionality. The game logic is centralized in a GameManager class that maintains game state, handles player actions, and broadcasts updates to all connected clients.

## Real-time Communication
WebSocket connections are established using Socket.IO, enabling bidirectional communication between clients and server. The system handles events for joining games, card actions (pick, play, move), player interactions, and game state synchronization across all connected players.

## Game State Management
The game state is managed both on the client (for UI reactivity) and server (as source of truth). The server maintains:
- Deck states for all four card types with remaining card counts
- Player hands and field positions
- Graveyard with cards marked by eliminating player
- Real-time synchronization ensures all players see consistent game state

## CPU Player Intelligence System
Advanced AI-powered CPU players that understand complete MINKIARDS rules:
- **Card Analysis**: Detailed image recognition for PTI, stars, powers, and special effects
- **Strategic Decision Making**: AI evaluates game state and makes optimal plays
- **Rule Compliance**: Follows official MINKIARDS rules including card sequencing and usage
- **Italian Communication**: CPU players chat in Italian explaining their actions
- **Adaptive Learning**: Responds to human player advice and conversation context

### CPU Rule Understanding
- **Character Management**: Knows PTI (life), stars (damage multiplier), and power systems
- **Combat Calculations**: Precise damage calculations (base × attacker stars)
- **Card Usage Sequence**: Must play cards on field before using, then return to deck
- **Power Economics**: Understands "Banca dei poteri" for purchasing character abilities
- **Counter Systems**: Can identify and use counter-attack opportunities
- **Turn Restrictions**: Respects one action per turn (card OR character switch)

## Data Storage
The application uses Drizzle ORM configured for PostgreSQL with Neon Database for user management. Currently implements basic user schema with username/password authentication. Game state is maintained in memory during active sessions.

## Card System
Cards are defined with front/back images, ownership tracking, and custom text annotations. Four deck types each have specific back images and predetermined front image collections. Cards can exist in multiple zones: decks, player hands, game field, or graveyard.

### Automatic Card Mechanics
- **Auto-Draw System (CPU Only)**: When CPU players play a card, they automatically draw a replacement of the same type. Human players must draw manually.
- **Auto-Analysis System**: When any player plays a PERSONAGGI card, it's automatically analyzed using AI to extract PTI (life points), stars (damage multiplier), and special powers. This information is automatically populated in the card's notes.
- **Auto-Death System**: When a PERSONAGGI card's PTI reaches 0 (either manually entered or through damage), the character automatically dies and goes to the graveyard.
- **Card Return System**: Used cards automatically return to their respective decks
- **Field Management**: Cards must be placed on field before use, maintaining proper game flow

### Interactive Defense System
The game features a real-time defense mechanism for MOSSE attacks:
- **Defense Dialog**: When a player is attacked with a MOSSE card, they receive a targeted notification asking if they want to defend
- **Targeted Notifications**: Only the attacked player sees the defense prompt (via socket ID targeting)
- **30-Second Timeout**: Players have 30 seconds to respond; failure to respond auto-accepts the attack
- **CPU Auto-Response**: CPU players automatically accept attacks after a 1-second delay
- **Offline Handling**: Disconnected players automatically accept attacks
- **Atomic Guards**: Prevents race conditions and duplicate defense requests

### BAMBOLA VOODOO System
Special BONUS card that links two characters to share damage and death:
- **Damage Reflection**: When a linked character takes damage, the same damage is reflected to the other linked character
- **Shared Death**: When one linked character dies (PTI reaches 0), both characters die simultaneously
- **Auto-Removal**: Links are automatically removed when either character dies or leaves the field
- **Security Validation**: 
  - Requires bonus card on field and owned by activator
  - Both characters must be PERSONAGGI or PERSONAGGI_SPECIALI types
  - Both characters must be actively on the field (not in hand or graveyard)
  - Each character can only have one voodoo link at a time
- **Loop Prevention**: Damage reflection happens only once per attack (no infinite loops)
- **Stale Link Cleanup**: Automatically removes invalid links when linked cards are not found

## Audio System
The game features a comprehensive sound effect system using Web Audio API to enhance gameplay experience:
- **Sound Effects**: Game start chimes, player notifications, dice rolls, damage sounds, character-specific audio
- **Character Sounds**: Different audio for animals (bee, dog, cat, bird), robots, magic spells, explosions, and human voices
- **Card Animation Sounds**: Themed audio effects for 28 special cards including explosions, gunshots, mystical sounds, musical melodies, and impact effects
- **Interactive Audio**: Players can mute/unmute all sound effects with a dedicated control button
- **Synthesized Audio**: Uses Web Audio API to generate various sound effects with precise frequency and timing control

## Card Animation System
The game features immersive full-screen animations triggered by specific cards:
- **28 Unique Animations**: Each special card triggers a 3-second centered screen animation with themed visual effects
- **Automatic Triggering**: Animations activate when cards are played on the field (detected by server)
- **Synchronized Audio**: Each animation plays a themed sound effect using Web Audio API oscillators
- **Visual Effects**: Includes explosions, lightning, storms, flames, impacts, mystical circles, and character-specific animations
- **Cards with Animations**: BAMBOLA VOODOO, UNA TEMPESTA BABY, ACCETTATA, ACCHIAPPT CHESSA, AGO DI PINO, ATTACCO KAMIKAZE, BOMBA SENZA DETONATORE, BOMBA, CANZONE NEOMELODICA, CIAVATTA, DUELLO, ESPLOSIONE ATOMICA, FUCILE A POMPA, FURTO, INFLUENZA, LU TRATTORE, MAZZA DA BASEBALL, MINA VAGANTE, MOTOSEGA, OMBELICO LANCIAFIAMME, ONDA ENERGETICA, PADELLATA IN FACCIA, PARTITA DI TENNIS, PIOGGIA DI METEORITI, PRETA, PUGNO, ROULETTE RUSSA, SAETTA
- **Animation Components**: CardAnimation.tsx handles visual rendering, useAudio.tsx manages sound effects, server/gameManager.ts detects trigger cards
- **CSS Animations**: Custom keyframe animations for special effects like axe swings, explosions, meteor falls, and energy beams

## Development Tools
Vite is used for the build system with React plugin and GLSL shader support. ESBuild handles server-side bundling for production. The development setup includes hot module replacement and runtime error overlays.

# External Dependencies

## Database
- **Neon Database**: PostgreSQL-compatible serverless database
- **Drizzle ORM**: Type-safe database toolkit for schema management and queries

## Real-time Communication
- **Socket.IO**: WebSocket library for bidirectional real-time communication between clients and server

## UI Framework
- **Radix UI**: Comprehensive component library providing accessible, unstyled UI primitives
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Lucide React**: Icon library for consistent iconography

## State Management
- **Zustand**: Lightweight state management solution for client-side application state
- **React Query**: Server state management and caching library

## Build Tools
- **Vite**: Fast build tool and development server with React plugin
- **ESBuild**: Fast JavaScript bundler for production builds
- **TypeScript**: Type checking and enhanced development experience

## Fonts and Assets
- **Inter**: Web font for consistent typography
- **PostImg/Imgur**: External image hosting for card assets and backgrounds