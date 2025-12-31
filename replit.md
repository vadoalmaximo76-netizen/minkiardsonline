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

### CPU Attack System
CPU players now integrate fully with the defense system:
- **Damage Request Dialog**: When CPU attacks, game creator sees CPUDamageDialog showing MOSSE card image and attack details
- **Manual Damage Input**: Game creator inputs damage value for CPU's MOSSE attack
- **Defense Integration**: After damage input, defender receives standard defense:request (can accept/reject like any attack)
- **Auto-Management**: CPU MOSSE cards are automatically returned to deck bottom and replacement drawn synchronously after attack resolution
- **Race-Free Design**: Synchronous card return/draw eliminates timing conflicts between defense resolution and card management
- **Unified Flow**: CPU attacks follow same defense pipeline as human attacks (requiresDefenseResponse check, defense:request emission, processDefenseResponse)

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

### DUELLO (Duel) System
Complete turn-based duel system activated by the DUELLO MOSSE card:
- **Duel Initiation**: Player plays DUELLO card, selects opponent's character, both players forced to draw MOSSE card
- **Turn Management**: Strict alternating turns between two duelists only (other players cannot act during duel)
- **Auto-Activation**: MOSSE cards automatically trigger attacks on opponent's duel character when played
- **Turn Alternation**: Turn switches to opponent after each attack is accepted
- **Defense Integration**: Uses existing defense system where defender can accept or reject incoming MOSSE damage
- **Consecutive Turns**: If defender rejects attack, they gain 2 consecutive bonus turns
- **Auto-End Conditions**: Duel ends automatically when either character dies (PTI reaches 0)
- **Event Tracking**: All duel events logged with complete game state synchronization
- **CPU Duel Participation**: CPU players fully participate in duels with intelligent behavior:
  - **Turn Restriction**: CPU waits (no-op) when in duel but not their turn, preventing out-of-turn actions
  - **Auto-MOSSE Management**: CPU automatically draws and plays MOSSE cards during their duel turn
  - **Forced Targeting**: CPU attacks are forced on the duel opponent's character only (no target selection errors)
  - **Defense Integration**: CPU attacks trigger standard defense:request flow for human defenders
  - **Consistent Logic**: Same duel behavior whether MOSSE played from takeTurn or handleExecutePhase branches

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

## Music Synchronization System
The game features a synchronized music player for all players in the game room:
- **Local Audio Playback**: Music files hosted in client/public/audio/ directory (Dragon Ball Z soundtracks)
- **Real-time Sync**: All players hear the same music at the same time via WebSocket
- **Persistent Player**: Music continues playing when UI panel is closed
- **Remote Control**: Any player can control playback (play, pause, volume, track selection)
- **Socket Events**: Uses music-action and music-control events for synchronization
- **UI Component**: MusicPlayer.tsx with controls positioned bottom-left

## Player Avatar System
Customizable player avatars for personalization:
- **24 Avatar Options**: Emoji-based avatars including dragons, animals, mythical creatures, and symbols
- **Secure Selection**: Server validates avatar IDs against whitelist; player identity derived from socket ID
- **Real-time Updates**: Avatar changes broadcast to all players via game-state-update event
- **UI Integration**: Avatars displayed in PlayerHand, OtherPlayersHands, and game controls toolbar
- **Selection Modal**: AvatarSelector component with grid layout for choosing avatars
- **Files**: client/src/lib/avatars.ts (constants), client/src/components/AvatarSelector.tsx (UI), server/gameManager.ts (setPlayerAvatar)

## Voice Chat System
Real-time WebRTC voice communication between players:
- **Native WebRTC Implementation**: Uses browser's RTCPeerConnection API for peer-to-peer audio
- **Audio Quality**: Echo cancellation, noise suppression, and auto gain control enabled
- **Microphone Control**: Toggle button in game controls to enable/disable voice chat
- **Multi-Peer Support**: Handles multiple simultaneous peer connections (one per player)
- **STUN Servers**: Uses Google STUN servers (stun.l.google.com:19302) for NAT traversal
- **WebSocket Signaling**: Socket.IO handles WebRTC offer/answer/ICE candidate exchange
- **Component**: VoiceChat.tsx manages getUserMedia and peer connections
- **Server Events**: voice-chat-join, voice-chat-leave, webrtc-offer, webrtc-answer, webrtc-ice-candidate

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