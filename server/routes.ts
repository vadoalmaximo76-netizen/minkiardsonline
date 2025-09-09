import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";

// Function to determine sound type based on character name
function getCharacterSoundType(cardName: string): string | null {
  const name = cardName.toLowerCase();
  
  // Animal sounds - use dedicated bee sound for ape/bee cards, fallback to bee sound in character system
  if (name.includes('ape') || name.includes('bee')) return 'bee';
  if (name.includes('cane') || name.includes('dog') || name.includes('bull')) return 'animal_dog';
  if (name.includes('gatto') || name.includes('cat')) return 'animal_cat';
  if (name.includes('uccello') || name.includes('bird') || name.includes('pollo') || name.includes('gallo')) return 'animal_bird';
  
  // Robot/mechanical sounds
  if (name.includes('robot') || name.includes('cyber') || name.includes('meccanico') || name.includes('terminator')) return 'robot_mechanical';
  
  // Magic/spell sounds
  if (name.includes('mago') || name.includes('strega') || name.includes('wizard') || name.includes('magic') || name.includes('fatata')) return 'magic_spell';
  
  // Explosion sounds
  if (name.includes('bomba') || name.includes('esplosivo') || name.includes('dynamite') || name.includes('cannone')) return 'explosion';
  
  // Human voice for most other characters
  return 'human_voice';
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    maxHttpBufferSize: 10e6 // 10MB limit for large images
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

    socket.on('add-cpu-player', async ({ gameId }) => {
      try {
        const cpuName = await gameManager.addCPUPlayer(gameId);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        io.to(gameId).emit('player-joined', { playerName: cpuName });
        
        // Start CPU turn after a short delay
        setTimeout(async () => {
          const cpuAction = await gameManager.processCPUTurn(gameId, cpuName, io);
          if (cpuAction) {
            // Execute the CPU's action
            switch (cpuAction.type) {
              case 'play-card':
                const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                const updatedGameState = gameManager.getGameState(gameId);
                io.to(gameId).emit('game-state-update', updatedGameState);
                
                if (result.isPersonaggio && result.card) {
                  const getCardNameFromUrl = (url: string) => {
                    const parts = url.split('/');
                    const filename = parts[parts.length - 1];
                    return filename
                      .toLowerCase()
                      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                      .replace(/[-_]/g, ' ')
                      .split(' ')
                      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                      .join(' ');
                  };
                  
                  const cardName = getCardNameFromUrl(result.card.frontImage);
                  io.to(gameId).emit('personaggio-enters', {
                    cardName,
                    message: 'SI UNISCE ALLA ZUFFA',
                    playerName: cpuName,
                    cardImage: result.card.frontImage
                  });
                }
                break;
                
              case 'mosse-attack':
                io.to(gameId).emit('card-attacked', {
                  mosseCardId: cpuAction.data.mosseCardId,
                  targetCardId: cpuAction.data.targetCardId,
                  attackerName: cpuAction.data.attackerName,
                  targetOwner: cpuAction.data.targetOwner,
                  timestamp: Date.now()
                });
                break;
            }
          }
        }, 2000); // 2 second delay for CPU thinking
        
      } catch (error) {
        socket.emit('error', { message: 'Failed to add CPU player' });
      }
    });

    socket.on('shuffle-deck', ({ deckType }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.shuffleDeck(gameId, deckType);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('pick-card', async ({ deckType, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = await gameManager.pickCard(gameId, deckType, playerName);
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

    socket.on('play-card', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCard(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        // If a PERSONAGGI card was played, emit special notification
        if (result.isPersonaggio && result.card) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          const cardName = getCardNameFromUrl(result.card.frontImage);
          
          // Random dramatic messages
          const messages = [
            "È PRONTO A FARE BRUTTO",
            "ENTRA IN SCENA", 
            "ARRIVA PER SPACCARVI IL CULO",
            "SI UNISCE ALLA ZUFFA"
          ];
          
          const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
          
          io.to(gameId).emit('personaggio-enters', {
            cardName,
            message: selectedMessage,
            playerName,
            cardImage: result.card.frontImage
          });

          // Determine sound type based on card name and emit character sound event
          const soundType = getCharacterSoundType(cardName);
          if (soundType) {
            io.to(gameId).emit('character-sound', {
              cardName,
              playerName,
              soundType
            });
          }
        }
      }
    });

    socket.on('play-card-face-down', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCardFaceDown(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        if (result.card) {
          io.to(gameId).emit('card-played-face-down', {
            cardId: result.card.id,
            playerName,
            message: `${playerName} ha giocato una carta coperta`
          });
        }
      }
    });

    socket.on('reveal-card', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.revealCard(gameId, cardId, playerName);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        if (result.card) {
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename
              .toLowerCase()
              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
              .replace(/[-_]/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
          };
          
          const cardName = getCardNameFromUrl(result.card.frontImage);
          
          io.to(gameId).emit('card-revealed', {
            cardId: result.card.id,
            cardName,
            playerName,
            cardImage: result.card.frontImage,
            message: `${playerName} ha scoperto: ${cardName}!`
          });

          // If it's a PERSONAGGI card, also emit the entrance notification and sound
          if (result.isPersonaggio) {
            const messages = [
              "È PRONTO A FARE BRUTTO",
              "ENTRA IN SCENA", 
              "ARRIVA PER SPACCARVI IL CULO",
              "SI UNISCE ALLA ZUFFA"
            ];
            
            const selectedMessage = messages[Math.floor(Math.random() * messages.length)];
            
            io.to(gameId).emit('personaggio-enters', {
              cardName,
              message: selectedMessage,
              playerName,
              cardImage: result.card.frontImage
            });

            // Determine sound type based on card name and emit character sound event
            const soundType = getCharacterSoundType(cardName);
            if (soundType) {
              io.to(gameId).emit('character-sound', {
                cardName,
                playerName,
                soundType
              });
            }
          }
        }
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
        const result = gameManager.moveToGraveyard(gameId, cardId, playerName);
        if (result.success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);

          // Get card name from image URL for "Ciao ciao" notification
          if (result.cardImage) {
            const getCardNameFromUrl = (url: string) => {
              const parts = url.split('/');
              const filename = parts[parts.length - 1];
              // Remove file extension and replace hyphens/underscores with spaces
              return filename
                .toLowerCase()
                .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            };
            
            const cardName = getCardNameFromUrl(result.cardImage);
            
            // Emit "Ciao ciao" notification
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName
            });
          }

          // Check for milestone achievements
          if (result.graveyardCount === 3 || result.graveyardCount === 5) {
            const titles = [
              "UH LÀ LÀ!",
              "ATTENZIONE ATTENZIONE", 
              "MANNEGGIA QUIGL PUORC",
              "🐷 2⃣"
            ];
            
            // Select ONE random title on server side so all players see the same
            const selectedTitle = titles[Math.floor(Math.random() * titles.length)];
            
            io.to(gameId).emit('graveyard-milestone', {
              playerName,
              cardCount: result.graveyardCount,
              title: selectedTitle,
              timestamp: Date.now()
            });
          }
        }
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

    socket.on('swap-personaggi-cards', ({ player1, card1Id, player2, card2Id }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.swapPersonaggiCards(gameId, player1, card1Id, player2, card2Id);
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        // Emit notification to all players about the swap
        io.to(gameId).emit('cards-swapped', {
          player1,
          player2,
          message: `${player1} e ${player2} hanno scambiato delle carte PERSONAGGI!`,
          timestamp: Date.now()
        });
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
        // Check if this is a response to a CPU question
        const cpuProcessed = gameManager.processCPUResponse(gameId, message, playerName);
        
        const chatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerName,
          message,
          timestamp: Date.now()
        };
        io.to(gameId).emit('chat-message', chatMessage);
        
        // If CPU processed the response and was waiting, try to continue their turn
        if (cpuProcessed) {
          setTimeout(async () => {
            // Find which CPU was waiting and continue their turn
            const waitingCPU = gameManager.getCPUWaitingForResponse(gameId);
            if (!waitingCPU) {
              // CPU is no longer waiting, try to continue their turn
              const gameState = gameManager.getGameState(gameId);
              const currentPlayer = gameState?.turnOrder?.[gameState.currentTurnIndex];
              
              if (currentPlayer?.startsWith('CPU-')) {
                const cpuAction = await gameManager.processCPUTurn(gameId, currentPlayer, io);
                if (cpuAction) {
                  // Execute CPU action
                  switch (cpuAction.type) {
                    case 'play-card':
                      const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                      const updatedGameState = gameManager.getGameState(gameId);
                      io.to(gameId).emit('game-state-update', updatedGameState);
                      
                      if (result.isPersonaggio && result.card) {
                        const getCardNameFromUrl = (url: string) => {
                          const parts = url.split('/');
                          const filename = parts[parts.length - 1];
                          return filename
                            .toLowerCase()
                            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const cardName = getCardNameFromUrl(result.card.frontImage);
                        io.to(gameId).emit('personaggio-enters', {
                          cardName,
                          message: 'SI UNISCE ALLA ZUFFA',
                          playerName: currentPlayer,
                          cardImage: result.card.frontImage
                        });
                      }
                      break;
                  }
                  
                  // End CPU turn after action
                  setTimeout(() => {
                    const nextAfterCPU = gameManager.endTurn(gameId, currentPlayer);
                    if (nextAfterCPU) {
                      io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                    }
                  }, 1500);
                }
              }
            }
          }, 2000); // Give time for CPU to process response
        }
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

    socket.on('open-dice-window', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast dice window open to all players in the game
        io.to(gameId).emit('dice-window-opened', {
          playerName,
          timestamp: Date.now()
        });
      }
    });

    // Super Dice Events
    socket.on('open-super-dice', ({ gameId, playerName }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast super dice window open to all players in the game
        io.to(gameId).emit('super-dice-opened', {
          playerName,
          timestamp: Date.now()
        });
      }
    });

    socket.on('super-dice-rolled', ({ gameId, playerName, rolledCard }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Broadcast super dice result to all players in the game
        io.to(gameId).emit('super-dice-rolled', {
          playerName,
          rolledCard,
          timestamp: Date.now()
        });
      }
    });

    socket.on('place-super-dice-card', async ({ gameId, playerName, cardData }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        // Create a card object for the rolled card and place it on the field
        const result = await gameManager.placeSuperDiceCard(gameId, playerName, cardData);
        
        if (result.success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Emit notification that the super dice card was placed
          io.to(gameId).emit('super-dice-card-placed', {
            playerName,
            cardName: cardData.name,
            cardImage: cardData.image,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('add-custom-cards', ({ gameId, playerName, deckType, images }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      
      if (playerGameId === gameId) {
        const result = gameManager.addCustomCards(gameId, deckType, images);
        
        if (result.success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the new cards
          io.to(gameId).emit('cards-added', {
            playerName,
            deckType,
            count: images.length,
            deckLabel: deckType.toUpperCase().replace('_', ' ')
          });
        }
      }
    });

    socket.on('toggle-scenario-cards', ({ gameId, active }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        const success = gameManager.toggleScenarioCards(gameId, active);
        if (success) {
          const gameState = gameManager.getGameState(gameId);
          // Broadcast updated game state and scenario card state to all players
          io.to(gameId).emit('game-state-update', gameState);
          io.to(gameId).emit('scenario-cards-toggled', { 
            active,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('mosse-attack', ({ mosseCardId, targetCardId, attackerName, targetOwner }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Broadcast the attack to all players so they can see the shaking animation
        io.to(gameId).emit('card-attacked', {
          mosseCardId,
          targetCardId,
          attackerName,
          targetOwner,
          timestamp: Date.now()
        });
      }
    });

    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = gameManager.removeCardToGraveyard(gameId, deckType, cardId, playerName, section);
        if (success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('eliminate-personaggi', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.eliminatePersonaggi(gameId, cardId, playerName);
        if (result.success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);

          // Get card name from image URL for "Ciao ciao" notification
          if (result.cardImage) {
            const getCardNameFromUrl = (url: string) => {
              const parts = url.split('/');
              const filename = parts[parts.length - 1];
              // Remove file extension and replace hyphens/underscores with spaces
              return filename
                .toLowerCase()
                .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                .replace(/[-_]/g, ' ')
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            };
            
            const cardName = getCardNameFromUrl(result.cardImage);
            
            // Emit "Ciao ciao" notification
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName
            });
          }
        }
      }
    });

    socket.on('move-card-position', ({ cardId, direction, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = gameManager.moveCardPosition(gameId, cardId, direction);
        if (success) {
          const gameState = gameManager.getGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('start-game', ({ gameId, playerName }) => {
      const gameState = gameManager.getGameState(gameId);
      if (gameState) {
        const playerOrder = gameManager.startGame(gameId);
        if (playerOrder) {
          io.to(gameId).emit('game-started', { playerOrder });
        }
      }
    });

    socket.on('end-turn', async ({ gameId, playerName }) => {
      const nextPlayer = gameManager.endTurn(gameId, playerName);
      if (nextPlayer) {
        io.to(gameId).emit('next-turn', { nextPlayer });
        
        // Check if next player is CPU and automatically process their turn
        const gameState = gameManager.getGameState(gameId);
        const nextPlayerData = gameState?.players[nextPlayer];
        
        if (nextPlayerData && nextPlayer.startsWith('CPU-')) {
          // Give a moment for UI to update, then process CPU turn
          setTimeout(async () => {
            try {
              console.log(`Processing automated turn for CPU: ${nextPlayer}`);
              
              const cpuAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
              if (cpuAction) {
                // Execute the CPU's action
                switch (cpuAction.type) {
                  case 'play-card':
                    const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    const updatedGameState = gameManager.getGameState(gameId);
                    io.to(gameId).emit('game-state-update', updatedGameState);
                    
                    if (result.isPersonaggio && result.card) {
                      const getCardNameFromUrl = (url: string) => {
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        return filename
                          .toLowerCase()
                          .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      const cardName = getCardNameFromUrl(result.card.frontImage);
                      io.to(gameId).emit('personaggio-enters', {
                        cardName,
                        message: 'SI UNISCE ALLA ZUFFA',
                        playerName: nextPlayer,
                        cardImage: result.card.frontImage
                      });
                    }
                    break;
                    
                  case 'mosse-attack':
                    io.to(gameId).emit('card-attacked', {
                      mosseCardId: cpuAction.data.mosseCardId,
                      targetCardId: cpuAction.data.targetCardId,
                      attackerName: cpuAction.data.attackerName,
                      targetOwner: cpuAction.data.targetOwner,
                      timestamp: Date.now()
                    });
                    break;
                }
                
                // After CPU action, automatically end their turn
                setTimeout(() => {
                  const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                  if (nextAfterCPU) {
                    io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                  }
                }, 1500); // Give time to see CPU's action
                
              } else {
                // CPU had no valid actions, just end turn
                const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                if (nextAfterCPU) {
                  io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                }
              }
            } catch (error) {
              console.error(`Error processing CPU turn for ${nextPlayer}:`, error);
              // If CPU fails, just end their turn
              const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
              if (nextAfterCPU) {
                io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
              }
            }
          }, 3000); // 3 second delay to show "TOCCA A TE" message for CPU
        }
      }
    });

    socket.on('leave-game', ({ gameId, playerName }) => {
      const success = gameManager.leaveGame(gameId, playerName);
      if (success) {
        const gameState = gameManager.getGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        io.to(gameId).emit('player-left', { playerName });
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      gameManager.removePlayer(socket.id);
    });
  });

  return httpServer;
}
