import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const gameManager = new GameManager();

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join-game', ({ gameId, playerName }) => {
      socket.join(gameId);
      gameManager.addPlayer(gameId, playerName, socket.id);
      
      // Send current game state to the player
      const gameState = gameManager.getGameState(gameId);
      socket.emit('game-state-update', gameState);
      
      // Notify other players
      socket.to(gameId).emit('player-joined', { playerName });
    });

    socket.on('shuffle-deck', ({ deckType }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.shuffleDeck(gameId, deckType);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('pick-card', ({ deckType, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = gameManager.pickCard(gameId, deckType, playerName);
        if (success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('choose-specific-card', ({ deckType, cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.chooseSpecificCard(gameId, deckType, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('play-card', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.playCard(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('return-to-hand', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.returnToHand(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('return-to-deck', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.returnToDeck(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('move-to-graveyard', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.moveToGraveyard(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('transfer-card', ({ cardId, fromPlayer, toPlayer }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.transferCard(gameId, cardId, fromPlayer, toPlayer);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('update-card-text', ({ cardId, text }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.updateCardText(gameId, cardId, text);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('send-chat-message', ({ message, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const chatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerName,
          message,
          timestamp: Date.now()
        };
        io.to(gameId).emit('chat-message', chatMessage);
      }
    });

    socket.on('show-card-to-player', ({ cardId, fromPlayer, toPlayer, cardImage }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Find the target player's socket
        const gameState = gameManager.getGameState(gameId);
        if (gameState && gameState.players[toPlayer]) {
          const targetSocketId = gameState.players[toPlayer].socketId;
          
          // Send card to specific player
          io.to(targetSocketId).emit('card-shown', {
            cardId,
            fromPlayer,
            cardImage,
            message: `${fromPlayer} ti ha mostrato una carta`
          });
          
          // Confirm to sender
          socket.emit('card-show-confirmed', {
            message: `Carta mostrata a ${toPlayer}`
          });
        }
      }
    });

    socket.on('reset-game', ({ gameId }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        gameManager.resetGame(gameId);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        // Notify all players that the game has been reset
        io.to(gameId).emit('game-reset', { message: 'La partita è stata riavviata!' });
      }
    });

    socket.on('roll-dice', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Generate random number between 1 and 6
        const result = Math.floor(Math.random() * 6) + 1;
        
        // Broadcast dice result to all players in the game
        io.to(gameId).emit('dice-rolled', {
          result,
          playerName,
          timestamp: Date.now()
        });
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      gameManager.removePlayer(socket.id);
    });
  });

  return httpServer;
}
