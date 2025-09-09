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
- **Card Return System**: Used cards automatically return to their respective decks
- **Field Management**: Cards must be placed on field before use, maintaining proper game flow

## Audio System
The game features a comprehensive sound effect system using Web Audio API to enhance gameplay experience:
- **Sound Effects**: Game start chimes, player notifications, dice rolls, damage sounds, character-specific audio
- **Character Sounds**: Different audio for animals (bee, dog, cat, bird), robots, magic spells, explosions, and human voices
- **Interactive Audio**: Players can mute/unmute all sound effects with a dedicated control button
- **Synthesized Audio**: Uses Web Audio API to generate various sound effects with precise frequency and timing control

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