import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Function to analyze PERSONAGGI card and auto-populate notes with PTI and stars
async function analyzePersonaggioCard(imageUrl: string): Promise<{ pti: number, stars: number, powers?: string, name?: string } | null> {
  try {
    console.log('Analyzing PERSONAGGI card:', imageUrl);
    
    // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "You are an expert at reading MINKIARDS card game images. Extract the PTI (life points), stars (damage multiplier), and any special powers from the card. Respond with JSON format: {\"pti\": number, \"stars\": number, \"powers\": \"description\", \"name\": \"card name\"}"
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract PTI (life points), stars (damage multiplier), and powers from this MINKIARDS PERSONAGGI card. Look carefully at all numbers and symbols on the card."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    console.log('Card analysis result:', analysis);
    
    return {
      pti: analysis.pti || analysis.points || 1000,
      stars: analysis.stars || analysis.stelle || 1,
      powers: analysis.powers || analysis.poteri || '',
      name: analysis.name || analysis.nome || ''
    };
  } catch (error: any) {
    console.error('Error analyzing PERSONAGGI card:', error);
    // Handle quota exceeded errors gracefully
    if (error.code === 'insufficient_quota') {
      console.log('OpenAI quota exceeded, using default values for card analysis');
    }
    return { pti: 1000, stars: 1 }; // Default values
  }
}

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
      const gameState = gameManager.getSanitizedGameState(gameId);
      socket.emit('game-state-update', gameState);
      
      // Notify other players
      socket.to(gameId).emit('player-joined', { playerName });
    });

    socket.on('add-cpu-player', async ({ gameId }) => {
      try {
        const cpuName = await gameManager.addCPUPlayer(gameId);
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        io.to(gameId).emit('player-joined', { playerName: cpuName });
        
        // CPU sends a greeting message when joining
        setTimeout(() => {
          const game = gameManager.getGameState(gameId);
          const cpuPlayer = game?.players[cpuName];
          if (cpuPlayer?.isCPU && cpuPlayer.cpuInstance) {
            cpuPlayer.cpuInstance.sendChatMessage(cpuPlayer.cpuInstance.getRandomChatResponse('greeting'));
          }
        }, 1500);
        
        // Start CPU turn after a short delay
        setTimeout(async () => {
          const cpuAction = await gameManager.processCPUTurn(gameId, cpuName, io);
          if (cpuAction) {
            // Execute the CPU's action
            // CPU opening sequence handling - continue processing until sequence is complete
            const continueCPUTurn = async (currentAction: any): Promise<void> => {
              if (!currentAction) return;
              
              switch (currentAction.type) {
                case 'pick-opening-cards':
                  console.log(`CPU ${cpuName} picking opening cards:`, currentAction.data.types);
                  const openingSuccess = await gameManager.pickOpeningCards(gameId, currentAction.data.types, currentAction.data.playerName);
                  if (openingSuccess) {
                    const openingGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', openingGameState);
                    
                    // Continue with the next phase of opening sequence
                    setTimeout(async () => {
                      const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                      await continueCPUTurn(nextAction);
                    }, 1000);
                  }
                  break;
                  
                case 'play-card-and-continue':
                  console.log(`CPU ${cpuName} playing character and continuing sequence`);
                  const playResult = await gameManager.playCard(gameId, currentAction.data.cardId, currentAction.data.playerName);
                  const playGameState = gameManager.getSanitizedGameState(gameId);
                  io.to(gameId).emit('game-state-update', playGameState);
                  
                  if (playResult.isPersonaggio && playResult.card) {
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
                    
                    const cardName = getCardNameFromUrl(playResult.card.frontImage);
                    io.to(gameId).emit('personaggio-enters', {
                      cardName,
                      message: 'ENTRA IN SCENA',
                      playerName: cpuName,
                      cardImage: playResult.card.frontImage
                    });
                  }
                  
                  // Continue with the next phase
                  setTimeout(async () => {
                    const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                    await continueCPUTurn(nextAction);
                  }, 1000);
                  break;
                  
                case 'mosse-attack':
                  console.log(`CPU ${cpuName} using MOSSE card for attack`);
                  
                  // Execute the attack using the card
                  io.to(gameId).emit('card-attacked', {
                    mosseCardId: currentAction.data.mosseCardId,
                    targetCardId: currentAction.data.targetCardId,
                    attackerName: currentAction.data.attackerName,
                    targetOwner: currentAction.data.targetOwner,
                    timestamp: Date.now()
                  });
                  
                  // After attack, return the used card to its deck and draw replacement
                  setTimeout(async () => {
                    console.log(`CPU ${cpuName} returning used MOSSE card to deck`);
                    gameManager.returnToDeck(gameId, currentAction.data.mosseCardId, currentAction.data.attackerName);
                    
                    // CPU automatically draws a replacement card of the same type
                    const drawnCard = await gameManager.pickCard(gameId, 'mosse', currentAction.data.attackerName);
                    if (drawnCard) {
                      console.log(`CPU ${cpuName} drew replacement MOSSE card`);
                    }
                    
                    const updatedGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', updatedGameState);
                    
                    setTimeout(async () => {
                      const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                      await continueCPUTurn(nextAction);
                    }, 1000);
                  }, 2000);
                  break;
                  
                case 'pick-card-and-end-opening':
                  console.log(`CPU ${cpuName} picking replacement and ending opening sequence`);
                  const replacementSuccess = await gameManager.pickCard(gameId, currentAction.data.deckType, currentAction.data.playerName);
                  if (replacementSuccess) {
                    const finalGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', finalGameState);
                  }
                  // Opening sequence complete - turn ends naturally
                  break;
                  
                case 'opening-complete':
                  console.log(`CPU ${cpuName} opening sequence completed`);
                  // Turn ends naturally
                  break;
                  
                case 'pick-card':
                  const pickSuccess = await gameManager.pickCard(gameId, currentAction.data.deckType, currentAction.data.playerName);
                  if (pickSuccess) {
                    const pickGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', pickGameState);
                  }
                  break;
                  
                case 'play-card':
                  const result = await gameManager.playCard(gameId, currentAction.data.cardId, currentAction.data.playerName);
                  
                  // According to MINKIARDS rules: when you play a card, you automatically draw a replacement of the same type
                  if (result.card) {
                    const cardType = result.card.type;
                    if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                      const replacementDrawn = await gameManager.pickCard(gameId, cardType, currentAction.data.playerName);
                      if (replacementDrawn) {
                        console.log(`CPU ${cpuName} drew replacement ${cardType} card after playing`);
                      }
                    }
                  }
                  
                  const updatedGameState = gameManager.getSanitizedGameState(gameId);
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
                    mosseCardId: currentAction.data.mosseCardId,
                    targetCardId: currentAction.data.targetCardId,
                    attackerName: currentAction.data.attackerName,
                    targetOwner: currentAction.data.targetOwner,
                    timestamp: Date.now()
                  });
                  break;
              }
            };
            
            await continueCPUTurn(cpuAction);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('pick-card', async ({ deckType, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = await gameManager.pickCard(gameId, deckType, playerName);
        if (success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('choose-specific-card', ({ deckType, cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.chooseSpecificCard(gameId, deckType, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('play-card', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCard(gameId, cardId, playerName);
        
        // According to MINKIARDS rules: when a CPU plays a card, it automatically draws a replacement of the same type
        // Human players must draw manually
        if (result.card && playerName.startsWith('CPU-')) {
          const cardType = result.card.type;
          if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
            const replacementDrawn = await gameManager.pickCard(gameId, cardType, playerName);
            if (replacementDrawn) {
              console.log(`${playerName} drew replacement ${cardType} card after playing`);
            }
          }
        }
        
        const gameState = gameManager.getSanitizedGameState(gameId);
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
          
          // Auto-analyze and populate PTI/Stars for all players (human and CPU)
          try {
            const cardAnalysis = await analyzePersonaggioCard(result.card.frontImage);
            if (cardAnalysis) {
              const notes = `PTI: ${cardAnalysis.pti} | Stelle: ${cardAnalysis.stars}` + 
                          (cardAnalysis.powers ? ` | Poteri: ${cardAnalysis.powers}` : '');
              
              console.log(`Auto-populating notes for ${playerName}'s ${cardName}: ${notes}`);
              
              // Update the card text with extracted information
              gameManager.updateCardText(gameId, result.card.id, notes);
              
              // Send updated game state
              const updatedGameState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedGameState);
            }
          } catch (error) {
            console.error('Error auto-analyzing PERSONAGGI card:', error);
          }
        }
      }
    });

    socket.on('play-card-face-down', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.playCardFaceDown(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('return-to-deck', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.returnToDeck(gameId, cardId, playerName);
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('move-to-graveyard', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.moveToGraveyard(gameId, cardId, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    socket.on('swap-personaggi-cards', ({ player1, card1Id, player2, card2Id }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.swapPersonaggiCards(gameId, player1, card1Id, player2, card2Id);
        const gameState = gameManager.getSanitizedGameState(gameId);
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
        
        // Check for automatic death if PTI reaches 0
        const gameState = gameManager.getSanitizedGameState(gameId);
        const card = gameState?.field?.find((c: any) => c.id === cardId);
        
        if (card && card.type === 'personaggi') {
          // Check if PTI is 0
          const ptiZeroMatch = text.match(/PTI:\s*0(?:\s|$|\/)/);
          if (ptiZeroMatch || text === "0") {
            console.log(`Auto-eliminating ${card.owner}'s personaggio with PTI 0:`, cardId);
            
            // Auto-eliminate the personaggio
            setTimeout(async () => {
              const result = await gameManager.eliminatePersonaggi(gameId, cardId, card.owner);
              if (result.success) {
                const updatedGameState = gameManager.getSanitizedGameState(gameId);
                io.to(gameId).emit('game-state-update', updatedGameState);

                // Get card name from image URL for "Ciao ciao" notification
                if (result.cardImage) {
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
                  
                  const cardName = getCardNameFromUrl(result.cardImage);
                  
                  // Emit "Ciao ciao" notification
                  io.to(gameId).emit('card-to-graveyard', {
                    cardName,
                    playerName: card.owner
                  });
                }
              }
            }, 100); // Small delay to let UI update first
          }
        }
        
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
        
        // Let CPU players respond to human chat messages
        if (!playerName.startsWith('CPU-')) {
          gameManager.processCPUChatResponses(gameId, message, playerName);
        }
        
        // If CPU processed the response and was waiting, try to continue their turn
        if (cpuProcessed) {
          setTimeout(async () => {
            // Find which CPU was waiting and continue their turn
            const waitingCPU = gameManager.getCPUWaitingForResponse(gameId);
            if (!waitingCPU) {
              // CPU is no longer waiting, try to continue their turn
              const gameState = gameManager.getSanitizedGameState(gameId);
              const currentPlayer = gameState?.turnOrder?.[gameState.currentTurnIndex];
              
              if (currentPlayer?.startsWith('CPU-')) {
                const cpuAction = await gameManager.processCPUTurn(gameId, currentPlayer, io);
                if (cpuAction) {
                  // Execute CPU action
                  switch (cpuAction.type) {
                    case 'pick-card':
                      const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                      if (pickSuccess) {
                        const pickGameState = gameManager.getSanitizedGameState(gameId);
                        io.to(gameId).emit('game-state-update', pickGameState);
                      }
                      break;
                      
                    case 'play-card':
                      const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
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
          const gameState = gameManager.getSanitizedGameState(gameId);
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
          const gameState = gameManager.getSanitizedGameState(gameId);
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
          const gameState = gameManager.getSanitizedGameState(gameId);
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
        // Check if the MOSSE card has already been used this turn
        if (gameManager.hasCardBeenUsed(gameId, mosseCardId, attackerName)) {
          console.log(`${attackerName} attempted to reuse MOSSE card ${mosseCardId} - attack blocked`);
          socket.emit('attack-blocked', { 
            message: 'Non puoi riutilizzare la stessa carta MOSSE nello stesso turno!',
            cardId: mosseCardId 
          });
          return;
        }
        
        // Mark the MOSSE card as used this turn
        gameManager.markCardAsUsed(gameId, mosseCardId, attackerName);
        
        // Broadcast the attack to all players so they can see the shaking animation
        io.to(gameId).emit('card-attacked', {
          mosseCardId,
          targetCardId,
          attackerName,
          targetOwner,
          timestamp: Date.now()
        });
        
        // After attack animation, return the MOSSE card to deck (for all players)
        setTimeout(() => {
          console.log(`Returning MOSSE card ${mosseCardId} to deck for ${attackerName}`);
          gameManager.returnToDeck(gameId, mosseCardId, attackerName);
          
          // For CPU players, automatically draw a replacement
          if (attackerName.startsWith('CPU-')) {
            gameManager.pickCard(gameId, 'mosse', attackerName);
            console.log(`CPU ${attackerName} drew replacement MOSSE card`);
          }
          
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', updatedGameState);
        }, 2000); // 2 second delay for attack animation
      }
    });

    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const success = gameManager.removeCardToGraveyard(gameId, deckType, cardId, playerName, section);
        if (success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('eliminate-personaggi', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = await gameManager.eliminatePersonaggi(gameId, cardId, playerName);
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
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
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    socket.on('start-game', ({ gameId, playerName }) => {
      const gameState = gameManager.getSanitizedGameState(gameId);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
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
                  case 'pick-card':
                    const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                    if (pickSuccess) {
                      const pickGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', pickGameState);
                    }
                    break;
                    
                  case 'play-card':
                    const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    const updatedGameState = gameManager.getSanitizedGameState(gameId);
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
                    
                    // After attack, return the used MOSSE card to deck and draw replacement for CPU
                    setTimeout(async () => {
                      console.log(`CPU ${nextPlayer} returning used MOSSE card to deck`);
                      gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.attackerName);
                      
                      // CPU automatically draws a replacement card
                      const drawnCard = await gameManager.pickCard(gameId, 'mosse', cpuAction.data.attackerName);
                      if (drawnCard) {
                        console.log(`CPU ${nextPlayer} drew replacement MOSSE card`);
                      }
                      
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', updatedGameState);
                    }, 2000);
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
        const gameState = gameManager.getSanitizedGameState(gameId);
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
