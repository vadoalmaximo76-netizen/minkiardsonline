# Overview

MINKIARDS is a real-time multiplayer online card game built with React and Express, offering an immersive and strategic card gaming experience. It features a modern UI, advanced AI opponents, and utilizes WebSocket communication for dynamic player interaction across four unique card types (PERSONAGGI, MOSSE, BONUS, PERSONAGGI SPECIALI) on a shared game field.

The game supports two play modes: **Classic** (shared central decks) and **Draft** (each player builds and uses a personal 33+33+33 deck using a credit system). A global leaderboard is accessible from the home screen. After a match ends, players can vote for an automatic rematch. An inactivity timer (30s per turn) automatically ends the turn if the active player doesn't act. Players can challenge each other directly from the leaderboard.

The Draft mode includes a **Card Pack System**: players can spend credits to open card packs (Bronzo/Argento/Oro/Diamante) containing random cards sorted by rarity tiers (Comune/Rara/Epica/Leggendaria). Opening a pack triggers a premium FIFA-style full-screen animation with 3D card flips and rarity glow effects. Cards obtained from packs are stored in the user's collection and are free to use in the deck builder.

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

## Visual Systems
- **Card Animation System**: Twenty-eight unique full-screen animations with synchronized audio for specific cards.
- **Music Synchronization System**: Synchronized music player for all players in a game room with remote control.
- **Player Avatar System**: 24 emoji-based avatars with server-side validation.
- **Voice Chat System**: Real-time WebRTC peer-to-peer voice communication using Socket.IO for signaling.
- **Evolution/Transformation Animation System**: A multi-phase, full-screen animation with 3D card flips, particles, and theming for character evolutions, transformations, or taroccata.
- **Turn Transition Animation**: Cinematic full-screen overlay animation for turn changes with distinct styling for player's turn vs. opponent's turn.

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