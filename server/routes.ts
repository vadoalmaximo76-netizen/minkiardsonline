import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";
import OpenAI from "openai";

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Local database of MINKIARDS card values (DISABLED - values were incorrect)
// TODO: Get real values from user and populate this database accurately
const MINKIARDS_CARD_DATA: Record<string, { pti: number, stars: number, powers?: string }> = {
  // Disabled until we get accurate values from the user
  // 'card-name': { pti: 0, stars: 0, powers: '' },
};

// Extract card name from image URL
function getCardNameFromImageUrl(imageUrl: string): string {
  try {
    const urlParts = imageUrl.split('/');
    const filename = urlParts[urlParts.length - 1];
    return filename.toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, '-');
  } catch {
    return '';
  }
}

// Get card data from local database
function getLocalCardData(imageUrl: string): { pti: number, stars: number, powers?: string, name?: string } | null {
  const cardName = getCardNameFromImageUrl(imageUrl);
  const cardData = MINKIARDS_CARD_DATA[cardName];
  
  if (cardData) {
    console.log(`Found local data for ${cardName}:`, cardData);
    return {
      ...cardData,
      name: cardName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    };
  }
  
  // If not found, try to guess based on common patterns
  if (cardName.includes('saiyan') || cardName.includes('vegeta') || cardName.includes('goku')) {
    return { pti: 1500, stars: 5, powers: 'Guerriero Saiyan' };
  }
  if (cardName.includes('robot') || cardName.includes('cyber')) {
    return { pti: 1200, stars: 4, powers: 'Tecnologia avanzata' };
  }
  if (cardName.includes('mago') || cardName.includes('wizard')) {
    return { pti: 800, stars: 3, powers: 'Magia' };
  }
  
  return null;
}

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
          content: `You are an expert at reading MINKIARDS card game images. MINKIARDS cards display specific numeric values that you must extract accurately:

PTI (Punti Totali Iniziali): The character's life points - this is usually a large number prominently displayed (e.g., 250, 500, 750, 1000, 1250, etc.)
STELLE (Stars): The damage multiplier - usually shown as small star symbols or numbers ranging from 1-5
POTERI (Powers): Any special abilities or powers written on the card

Look for these specific elements:
- PTI is often displayed as a large number in a circle or prominent area
- Stars are typically small symbols (★) or numbers near the character image
- Character names are usually at the top or bottom of the card
- Powers/abilities are described in text boxes

Respond with accurate JSON format: {"pti": number, "stars": number, "powers": "description", "name": "card name"}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this MINKIARDS PERSONAGGI card carefully. Extract the exact numeric values:

1. PTI (life points) - look for the largest number on the card, often in a circle or prominent display
2. STELLE (stars) - count star symbols (★) or look for a number from 1-5 indicating damage multiplier
3. Character name - usually clearly displayed at top or bottom
4. Any special powers or abilities described in text

Be very precise with the numbers. PTI values are typically: 250, 500, 750, 1000, 1250, 1500, etc.
Star values are typically: 1, 2, 3, 4, or 5.

Return accurate values, not defaults.`
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
      max_tokens: 500,
      temperature: 0.1 // Lower temperature for more consistent results
    });

    const analysis = JSON.parse(response.choices[0].message.content || '{}');
    console.log('Card analysis result:', analysis);
    
    // More thorough parsing with validation
    let pti = 1000; // default
    let stars = 1; // default
    
    // Try multiple possible field names for PTI
    if (analysis.pti && typeof analysis.pti === 'number') {
      pti = analysis.pti;
    } else if (analysis.PTI && typeof analysis.PTI === 'number') {
      pti = analysis.PTI;
    } else if (analysis.points && typeof analysis.points === 'number') {
      pti = analysis.points;
    } else if (analysis.life && typeof analysis.life === 'number') {
      pti = analysis.life;
    } else if (analysis.hp && typeof analysis.hp === 'number') {
      pti = analysis.hp;
    }
    
    // Try multiple possible field names for stars
    if (analysis.stars && typeof analysis.stars === 'number') {
      stars = Math.max(1, Math.min(5, analysis.stars));
    } else if (analysis.stelle && typeof analysis.stelle === 'number') {
      stars = Math.max(1, Math.min(5, analysis.stelle));
    } else if (analysis.star && typeof analysis.star === 'number') {
      stars = Math.max(1, Math.min(5, analysis.star));
    } else if (analysis.damage && typeof analysis.damage === 'number') {
      stars = Math.max(1, Math.min(5, analysis.damage));
    }
    
    console.log(`Parsed values: PTI=${pti}, Stars=${stars}`);
    
    return {
      pti: pti,
      stars: stars,
      powers: analysis.powers || analysis.poteri || analysis.abilities || '',
      name: analysis.name || analysis.nome || analysis.character || ''
    };
  } catch (error: any) {
    console.error('Error analyzing PERSONAGGI card:', error);
    // Handle quota exceeded errors gracefully
    if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
      console.log('OpenAI quota exceeded, trying local card database...');
      
      // Try to get data from local database
      const localData = getLocalCardData(imageUrl);
      if (localData) {
        console.log('Using local card data:', localData);
        return localData;
      }
    }
    
    // Final fallback: try to guess from image URL
    const cardName = getCardNameFromImageUrl(imageUrl);
    console.log(`Falling back to intelligent defaults for: ${cardName}`);
    
    // Intelligent defaults based on card name patterns
    let pti = 1000;
    let stars = 2;
    let powers = '';
    
    if (cardName.includes('morte') || cardName.includes('death')) {
      pti = 2000; stars = 5; powers = 'Potere letale';
    } else if (cardName.includes('spencer') || cardName.includes('bud')) {
      pti = 1500; stars = 5; powers = 'Forza devastante';
    } else if (cardName.includes('bear') || cardName.includes('orso')) {
      pti = 1250; stars = 4; powers = 'Forza bestiale';
    } else if (cardName.includes('vegeta') || cardName.includes('saiyan')) {
      pti = 1800; stars = 5; powers = 'Potere Saiyan';
    } else if (cardName.includes('amadeus') || cardName.includes('mozart')) {
      pti = 750; stars = 3; powers = 'Genio artistico';
    } else if (cardName.includes('crash') || cardName.includes('bandicoot')) {
      pti = 800; stars = 3; powers = 'Agilità';
    }
    
    return { 
      pti, 
      stars, 
      powers,
      name: cardName.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    };
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

    socket.on('rejoin-game', ({ gameId, playerName, sessionId }) => {
      console.log(`Player ${playerName} attempting to rejoin game ${gameId} with session ${sessionId}`);
      
      try {
        const game = gameManager.getGameState(gameId);
        
        if (!game) {
          console.log(`Game ${gameId} not found`);
          socket.emit('join-game-error', { message: 'Game not found' });
          return;
        }

        const player = game.players[playerName];
        if (!player) {
          console.log(`Player ${playerName} not found in game ${gameId}`);
          socket.emit('join-game-error', { message: 'Player not found in game' });
          return;
        }

        // Rejoin the room and update socket ID
        socket.join(gameId);
        const oldSocketId = player.socketId;
        player.socketId = socket.id;
        player.disconnectedAt = undefined; // Clear disconnection timestamp
        
        // Update player-to-game mapping and clean up old mapping
        gameManager.setPlayerToGame(socket.id, gameId);
        if (oldSocketId) {
          gameManager.cleanupOldSocketMapping(oldSocketId);
        }
        
        console.log(`Player ${playerName} successfully rejoined game ${gameId} (was disconnected: ${player.disconnectedAt ? 'yes' : 'no'})`);
        
        // Send current game state to the reconnected player
        const gameState = gameManager.getSanitizedGameState(gameId);
        socket.emit('game-state-update', gameState);
        
        // Notify other players about the reconnection
        socket.to(gameId).emit('player-reconnected', { playerName });
        
      } catch (error) {
        console.error('Error during rejoin-game:', error);
        socket.emit('join-game-error', { message: 'Failed to rejoin game' });
      }
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
                  
                  // MANUAL RETURN: CPU must manually return MOSSE cards like humans
                  setTimeout(async () => {
                    console.log(`CPU ${cpuName} manually returning used MOSSE card to deck bottom`);
                    gameManager.returnToDeck(gameId, currentAction.data.mosseCardId, currentAction.data.attackerName);
                    
                    const updatedGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', updatedGameState);
                    
                    // CPU announces the manual return
                    io.to(gameId).emit('chat-message', {
                      id: `${Date.now()}-cpu-return`,
                      playerName: cpuName,
                      message: 'Rimetto la carta MOSSE in fondo al mazzo.',
                      timestamp: Date.now()
                    });
                    
                    setTimeout(async () => {
                      const nextAction = await gameManager.processCPUTurn(gameId, cpuName, io);
                      await continueCPUTurn(nextAction);
                    }, 1000);
                  }, 3000); // 3 seconds for manual return
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
        
        // FIXED: CPU should maintain only 1 card of each type (PERSONAGGI, MOSSE, BONUS)
        // Removed automatic replacement draw that caused duplicates
        if (result.card && playerName.startsWith('CPU-')) {
          console.log(`CPU ${playerName} played ${result.card.type} card - maintaining hand limit (1 card per type)`);
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
          
          // Auto-analysis disabled - OpenAI API quota exceeded and local values are incorrect
          // Leave notes empty for manual entry by players
          console.log(`PERSONAGGI card ${cardName} played by ${playerName} - please enter PTI and stars manually in card notes`);
          
          // Send notification to user to enter values manually
          io.to(gameId).emit('manual-entry-required', {
            playerName,
            cardName,
            cardId: result.card.id,
            message: `Per favore inserisci manualmente PTI e stelle nelle note della carta ${cardName}`
          });
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
        // Use the instruction system to transfer the card
        gameManager.processGameInstruction(gameId, fromPlayer, `Trasferisci la carta ${cardId} a ${toPlayer}`).then(() => {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }).catch(error => {
          console.error('Error transferring card:', error);
        });
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
        console.log(`Chat message received: ${playerName}: ${message}`);
        
        // Check if this is a response to a CPU question
        const cpuProcessed = gameManager.processCPUResponse(gameId, message, playerName);
        console.log(`CPU processed response: ${cpuProcessed}`);
        
        const chatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          playerName,
          message,
          timestamp: Date.now()
        };
        io.to(gameId).emit('chat-message', chatMessage);
        
        // Let CPU players respond to human chat messages
        if (!playerName.startsWith('CPU-')) {
          console.log(`Processing CPU chat responses for: ${message}`);
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

    socket.on('game-instruction', async ({ gameId, playerName, instruction }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      if (playerGameId === gameId) {
        try {
          // Process the game instruction using AI
          const result = await gameManager.processGameInstruction(gameId, playerName, instruction);
          
          // Check if it's a conversational question
          if (result && typeof result === 'object' && 'isQuestion' in result && result.isQuestion) {
            // Send as conversational prompt, not error
            socket.emit('instruction-question', {
              playerName,
              instruction,
              question: result.message,
              timestamp: Date.now()
            });
            
            // Also broadcast to all players so they can see the conversation
            io.to(gameId).emit('instruction-dialogue', {
              playerName,
              instruction,
              question: result.message,
              timestamp: Date.now()
            });
            return;
          }
          
          // Get updated game state after instruction
          const updatedGameState = gameManager.getSanitizedGameState(gameId);
          
          // Broadcast updated game state to all players
          io.to(gameId).emit('game-state-update', updatedGameState);
          
          // Broadcast instruction execution notification to all players
          io.to(gameId).emit('instruction-executed', {
            playerName,
            instruction,
            result: result?.message || `Istruzione eseguita: ${instruction}`,
            timestamp: Date.now()
          });
          
          // Send success message to the instructor
          socket.emit('instruction-success', {
            message: result?.message || `Istruzione eseguita con successo: ${instruction}`
          });
        } catch (error) {
          console.error('Error processing game instruction:', error);
          socket.emit('instruction-error', {
            message: (error instanceof Error ? error.message : String(error)) || 'Errore nell\'esecuzione dell\'istruzione. Riprova o fornisci maggiori dettagli.'
          });
        }
      }
    });

    socket.on('mosse-attack', ({ mosseCardId, targetCardId, attackerName, targetOwner }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Get the card to check its frontImage
        const gameState = gameManager.getSanitizedGameState(gameId);
        const mosseCard = gameState?.field?.find((c: any) => c.id === mosseCardId);
        
        if (!mosseCard) {
          console.log(`MOSSE card ${mosseCardId} not found on field`);
          return;
        }

        // CALCULATE DAMAGE ACCORDING TO MINKIARDS RULES: Damage = Move Base Value × Attacker Stars
        let calculatedDamage = 0;
        
        // 1. Get attacker's character card to extract stars
        const attackerCharacter = gameState?.field?.find((c: any) => 
          c.owner === attackerName && c.type === 'personaggi' && !c.faceDown
        );
        
        let attackerStars = 1; // Default to 1 if no stars found
        if (attackerCharacter && attackerCharacter.text) {
          const starsMatch = attackerCharacter.text.match(/Stelle:\s*(\d+)/i);
          if (starsMatch) {
            attackerStars = parseInt(starsMatch[1]) || 1;
          }
        }
        
        // 2. Get MOSSE card base damage value (will be analyzed from image)
        // For now, try to extract from card notes if available
        let baseDamage = 80; // Default fallback value
        if (mosseCard.text) {
          const damageMatch = mosseCard.text.match(/[-]?\d+/);
          if (damageMatch) {
            baseDamage = Math.abs(parseInt(damageMatch[0]));
          }
        }
        
        // Calculate final damage according to MINKIARDS rules
        calculatedDamage = baseDamage * attackerStars;
        
        console.log(`MINKIARDS Damage Calculation: ${attackerName} attacks with ${baseDamage} base damage × ${attackerStars} stars = ${calculatedDamage} total damage`);
        
        const damageValue = calculatedDamage;
        
        // Check if player is CPU - only CPU players have reuse restrictions
        const gameStateForCPUCheck = gameManager.getSanitizedGameState(gameId);
        const playerData = gameStateForCPUCheck?.players?.[attackerName];
        const isCPUPlayer = playerData?.isCPU || attackerName.startsWith('CPU-');
        
        // Only block reuse for CPU players
        if (isCPUPlayer && gameManager.hasCardTypeBeenUsed(gameId, mosseCard.frontImage, attackerName)) {
          console.log(`${attackerName} attempted to reuse MOSSE card type ${mosseCard.frontImage} - attack blocked (CPU restriction)`);
          socket.emit('attack-blocked', { 
            message: 'I CPU non possono riutilizzare la stessa carta MOSSE nello stesso turno!',
            cardId: mosseCardId 
          });
          return;
        }
        
        // Mark this type of MOSSE card as used this turn (only for CPU players)
        if (isCPUPlayer) {
          gameManager.markCardTypeAsUsed(gameId, mosseCard.frontImage, attackerName);
        }
        
        // Broadcast the attack to all players so they can see the shaking animation
        io.to(gameId).emit('card-attacked', {
          mosseCardId,
          targetCardId,
          attackerName,
          targetOwner,
          damageValue,
          timestamp: Date.now()
        });

        // NEW: Automatic PTI calculation and damage application
        if (damageValue && targetCardId) {
          const targetCard = gameState?.field?.find((c: any) => c.id === targetCardId);
          if (targetCard && targetCard.type === 'personaggi') {
            // Extract current PTI from card notes
            const currentNotes = targetCard.text || '';
            const ptiMatch = currentNotes.match(/PTI:\s*(\d+)/i);
            let currentPTI = ptiMatch ? parseInt(ptiMatch[1]) : 0;

            // Calculate new PTI after damage
            const newPTI = Math.max(0, currentPTI - damageValue);

            // Update card notes with new PTI
            let updatedNotes = currentNotes;
            if (ptiMatch) {
              // Replace existing PTI value
              updatedNotes = currentNotes.replace(/PTI:\s*\d+/i, `PTI: ${newPTI}`);
            } else {
              // Add PTI if not present
              updatedNotes = currentNotes ? `${currentNotes}\nPTI: ${newPTI}` : `PTI: ${newPTI}`;
            }

            // Update the card in the game state
            gameManager.updateCardText(gameId, targetCardId, updatedNotes);
            
            console.log(`${targetCard.owner}'s ${targetCard.frontImage} took ${damageValue} damage: ${currentPTI} → ${newPTI} PTI`);
            
            // Broadcast the damage calculation with details
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-damage`,
              playerName: 'Sistema',
              message: `⚔️ ${attackerName} attacca! Danno: ${baseDamage} × ${attackerStars} stelle = ${damageValue} | ${targetCard.owner}: PTI ${currentPTI} → ${newPTI}`,
              timestamp: Date.now()
            });

            // Check if character dies (PTI: 0)
            if (newPTI <= 0) {
              setTimeout(() => {
                // Auto-eliminate dead character
                const eliminateSuccess = gameManager.moveToGraveyard(gameId, targetCardId, targetCard.owner);
                if (eliminateSuccess) {
                  console.log(`${targetCard.owner}'s character automatically eliminated (PTI: 0)`);
                  
                  io.to(gameId).emit('chat-message', {
                    id: `${Date.now()}-death`,
                    playerName: 'Sistema', 
                    message: `💀 ${targetCard.owner} è morto! (PTI: 0)`,
                    timestamp: Date.now()
                  });

                  // Send updated game state
                  const updatedGameState = gameManager.getSanitizedGameState(gameId);
                  io.to(gameId).emit('game-state-update', updatedGameState);
                }
              }, 1000);
            } else {
              // Send updated game state for PTI change
              const updatedGameState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedGameState);
            }
          }
        }
        
        // MANUAL RETURN SYSTEM: Players must manually return MOSSE cards to deck
        console.log(`MOSSE card ${mosseCardId} used by ${attackerName} - awaiting manual return to deck bottom`);
        
        // Notify all players that the card needs to be manually returned
        setTimeout(() => {
          io.to(gameId).emit('mosse-return-required', {
            cardId: mosseCardId,
            playerName: attackerName,
            cardType: 'mosse',
            message: `${attackerName} deve rimettere manualmente la carta MOSSE nel mazzo (in fondo)`
          });
          
          // For CPU players, automatically trigger manual return after a delay
          if (attackerName.startsWith('CPU-')) {
            setTimeout(() => {
              console.log(`CPU ${attackerName} manually returning MOSSE card to deck bottom`);
              gameManager.returnToDeck(gameId, mosseCardId, attackerName);
              
              // Send updated game state
              const updatedGameState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedGameState);
              
              // CPU says they returned the card
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-cpu-return`,
                playerName: attackerName,
                message: 'Ho rimesso la carta MOSSE in fondo al mazzo.',
                timestamp: Date.now()
              });
            }, 3000); // CPU returns card 3 seconds after attack
          }
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
    
    // Manual return of MOSSE cards to deck bottom
    socket.on('return-mosse-to-deck', ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`${playerName} manually returning MOSSE card ${cardId} to bottom of deck`);
        
        // Return the card to the bottom of the deck
        gameManager.returnToDeck(gameId, cardId, playerName);
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        // Notify players about the manual return
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-manual-return`,
          playerName: 'Sistema',
          message: `${playerName} ha rimesso la carta MOSSE in fondo al mazzo.`,
          timestamp: Date.now()
        });
        
        console.log(`Successfully returned MOSSE card ${cardId} to deck for ${playerName}`);
      }
    });
    
    // NEW: Handle draw-and-play action for enhanced CPU turns
    socket.on('draw-and-play-card', async ({ deckType, playerName, cardIdToPlay }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`${playerName} drawing from ${deckType} and immediately playing card ${cardIdToPlay || 'next drawn'}`);
        
        // First, draw the card
        const drawnCard = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (drawnCard && typeof drawnCard === 'object') {
          console.log(`${playerName} drew ${deckType} card: ${drawnCard.id}`);
          
          // Determine which card to play (if specified or the just-drawn one)
          const cardToPlay = cardIdToPlay || drawnCard.id;
          
          // Play the card immediately (same turn activation)
          setTimeout(async () => {
            const playResult = await gameManager.playCard(gameId, cardToPlay, playerName);
            if (playResult && playResult.card) {
              console.log(`${playerName} immediately played card: ${cardToPlay}`);
              
              // Send updated game state
              const gameState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', gameState);
              
              // NEW RULE: Turn ends after using a card
              setTimeout(() => {
                const nextPlayer = gameManager.endTurn(gameId, playerName);
                if (nextPlayer) {
                  io.to(gameId).emit('next-turn', { nextPlayer });
                  console.log(`Turn ended for ${playerName}, next: ${nextPlayer}`);
                }
              }, 1000);
            }
          }, 500); // Brief delay for smooth UX
        }
        
        // Send immediate game state update after drawing
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      }
    });
    
    // NEW: Handle CPU orders from human players
    socket.on('cpu-show-card-order', ({ cardType, fromPlayer, toPlayer, orderMessage }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && fromPlayer.startsWith('CPU-')) {
        console.log(`Processing show card order: ${fromPlayer} showing ${cardType} to ${toPlayer}`);
        
        // Get CPU's hand to find the requested card type
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[fromPlayer];
        
        if (cpuPlayer && cpuPlayer.hand) {
          const requestedCard = cpuPlayer.hand.find((card: any) => card.type === cardType);
          
          if (requestedCard) {
            // Find target player's socket ID
            const targetPlayer = gameState.players[toPlayer];
            if (targetPlayer && targetPlayer.socketId) {
              
              // Send card to specific player
              io.to(targetPlayer.socketId).emit('card-shown', {
                cardId: requestedCard.id,
                fromPlayer: fromPlayer,
                cardImage: requestedCard.frontImage,
                message: `${fromPlayer} ti ha mostrato la sua carta ${cardType.toUpperCase()} su tua richiesta`
              });
              
              // Notify all players about the action
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-show-order`,
                playerName: 'Sistema',
                message: orderMessage,
                timestamp: Date.now()
              });
              
              console.log(`CPU ${fromPlayer} showed ${cardType} card to ${toPlayer}`);
            }
          } else {
            // CPU doesn't have the requested card type
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-card`,
              playerName: fromPlayer,
              message: `Mi dispiace ${toPlayer}, non ho carte di tipo ${cardType.toUpperCase()} in mano!`,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    socket.on('cpu-pick-card-order', async ({ deckType, playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing pick card order: ${playerName} picking ${deckType} ordered by ${orderedBy}`);
        
        const pickedCard = await gameManager.pickCard(gameId, deckType, playerName);
        if (pickedCard) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pick-order`,
            playerName: 'Sistema',
            message: `${playerName} ha pescato una carta ${deckType.toUpperCase()} su richiesta di ${orderedBy}`,
            timestamp: Date.now()
          });
        }
      }
    });
    
    socket.on('cpu-play-card-order', async ({ cardType, playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing play card order: ${playerName} playing ${cardType || 'any'} ordered by ${orderedBy}`);
        
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[playerName];
        
        if (cpuPlayer && cpuPlayer.hand && cpuPlayer.hand.length > 0) {
          let cardToPlay;
          
          if (cardType) {
            // Find specific card type
            cardToPlay = cpuPlayer.hand.find((card: any) => card.type === cardType);
          } else {
            // Play any card
            cardToPlay = cpuPlayer.hand[0];
          }
          
          if (cardToPlay) {
            const result = await gameManager.playCard(gameId, cardToPlay.id, playerName);
            if (result && result.card) {
              const updatedGameState = gameManager.getSanitizedGameState(gameId);
              io.to(gameId).emit('game-state-update', updatedGameState);
              
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-play-order`,
                playerName: 'Sistema',
                message: `${playerName} ha giocato una carta su richiesta di ${orderedBy}`,
                timestamp: Date.now()
              });
              
              // NEW RULE: Turn ends after playing a card
              setTimeout(() => {
                const nextPlayer = gameManager.endTurn(gameId, playerName);
                if (nextPlayer) {
                  io.to(gameId).emit('next-turn', { nextPlayer });
                  console.log(`Turn ended for ${playerName} after ordered card play, next: ${nextPlayer}`);
                }
              }, 1500);
            }
          } else {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-card-type`,
              playerName: playerName,
              message: `Mi dispiace ${orderedBy}, non ho carte di tipo ${cardType ? cardType.toUpperCase() : 'disponibili'} da giocare!`,
              timestamp: Date.now()
            });
          }
        }
      }
    });
    
    socket.on('cpu-attack-order', async ({ playerName, orderedBy }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId && playerName.startsWith('CPU-')) {
        console.log(`Processing attack order: ${playerName} attacking ordered by ${orderedBy}`);
        
        const gameState = gameManager.getSanitizedGameState(gameId);
        const cpuPlayer = gameState?.players[playerName];
        
        if (cpuPlayer && cpuPlayer.hand) {
          const mosseCard = cpuPlayer.hand.find((card: any) => card.type === 'mosse');
          const enemies = gameState.field.filter((card: any) => card.owner !== playerName && card.type === 'personaggi');
          
          if (mosseCard && enemies.length > 0) {
            const target = enemies[0]; // Attack first enemy
            
            // First play the MOSSE card
            const playResult = await gameManager.playCard(gameId, mosseCard.id, playerName);
            if (playResult && playResult.card) {
              
              // Then execute attack
              setTimeout(() => {
                io.to(gameId).emit('card-attacked', {
                  mosseCardId: mosseCard.id,
                  targetCardId: target.id,
                  attackerName: playerName,
                  targetOwner: target.owner,
                  timestamp: Date.now()
                });
                
                io.to(gameId).emit('chat-message', {
                  id: `${Date.now()}-attack-order`,
                  playerName: 'Sistema',
                  message: `${playerName} ha attaccato ${target.owner} su richiesta di ${orderedBy}!`,
                  timestamp: Date.now()
                });
                
                // Manual return of MOSSE card
                setTimeout(() => {
                  gameManager.returnToDeck(gameId, mosseCard.id, playerName);
                  const updatedGameState = gameManager.getSanitizedGameState(gameId);
                  io.to(gameId).emit('game-state-update', updatedGameState);
                  
                  // Turn ends after attack
                  setTimeout(() => {
                    const nextPlayer = gameManager.endTurn(gameId, playerName);
                    if (nextPlayer) {
                      io.to(gameId).emit('next-turn', { nextPlayer });
                      console.log(`Turn ended for ${playerName} after ordered attack, next: ${nextPlayer}`);
                    }
                  }, 1000);
                }, 2000);
              }, 1000);
            }
          } else {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-no-attack`,
              playerName: playerName,
              message: `Mi dispiace ${orderedBy}, non posso attaccare! ${!mosseCard ? 'Non ho carte MOSSE' : 'Non ci sono nemici'}`,
              timestamp: Date.now()
            });
          }
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
                    
                    // NEW RULE: Turn ends automatically after playing a card
                    setTimeout(() => {
                      const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                      if (nextAfterCPU) {
                        io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        console.log(`Turn ended for ${nextPlayer} after playing card, next: ${nextAfterCPU}`);
                      }
                    }, 1500);
                    return; // Return early to prevent generic end-turn
                    
                  case 'mosse-attack':
                    io.to(gameId).emit('card-attacked', {
                      mosseCardId: cpuAction.data.mosseCardId,
                      targetCardId: cpuAction.data.targetCardId,
                      attackerName: cpuAction.data.attackerName,
                      targetOwner: cpuAction.data.targetOwner,
                      timestamp: Date.now()
                    });
                    
                    // MANUAL RETURN: CPU manually returns MOSSE card to deck bottom
                    setTimeout(async () => {
                      console.log(`CPU ${nextPlayer} manually returning used MOSSE card to deck bottom`);
                      gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.attackerName);
                      
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', updatedGameState);
                      
                      // CPU announces the manual return
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-return`,
                        playerName: nextPlayer,
                        message: 'Ho rimesso la mia carta MOSSE in fondo al mazzo.',
                        timestamp: Date.now()
                      });
                      
                      // NEW RULE: Turn ends after MOSSE attack
                      setTimeout(() => {
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          console.log(`Turn ended for ${nextPlayer} after MOSSE attack, next: ${nextAfterCPU}`);
                        }
                      }, 1000);
                    }, 3000); // 3 seconds for manual return
                    return; // Return early to prevent generic end-turn
                    
                  case 'eliminate-dead-character':
                    // NEW: CPU eliminates character with PTI: 0
                    console.log(`CPU ${nextPlayer} eliminating dead character: ${cpuAction.data.cardId}`);
                    const eliminateResult = gameManager.moveToGraveyard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    
                    if (eliminateResult.success) {
                      const updatedGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', updatedGameState);
                      
                      // Notify about the elimination
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-eliminate`,
                        playerName: nextPlayer,
                        message: 'Il mio personaggio è morto (PTI: 0) ed è stato eliminato.',
                        timestamp: Date.now()
                      });
                      
                      console.log(`CPU ${nextPlayer} successfully eliminated dead character`);
                    }
                    
                    // Turn continues after elimination (can still act)
                    setTimeout(async () => {
                      // Process another CPU action if available
                      const followUpAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
                      if (!followUpAction) {
                        // No more actions, end turn
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          console.log(`Turn ended for ${nextPlayer} after elimination, next: ${nextAfterCPU}`);
                        }
                      }
                    }, 1500);
                    return; // Return early to prevent generic end-turn
                    
                  case 'show-card-to-player':
                    // NEW: CPU shows card to specific player
                    console.log(`CPU ${nextPlayer} showing card to player: ${cpuAction.data.toPlayer}`);
                    const showGameState = gameManager.getSanitizedGameState(gameId);
                    const targetPlayer = showGameState?.players[cpuAction.data.toPlayer];
                    
                    if (targetPlayer && targetPlayer.socketId) {
                      // Send card to specific player
                      io.to(targetPlayer.socketId).emit('card-shown', {
                        cardId: cpuAction.data.cardId,
                        fromPlayer: cpuAction.data.fromPlayer,
                        cardImage: cpuAction.data.cardImage,
                        message: `${cpuAction.data.fromPlayer} ti ha mostrato la sua carta su tua richiesta`
                      });
                      
                      // Notify all players about the action
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-show-order`,
                        playerName: 'Sistema',
                        message: cpuAction.data.orderMessage,
                        timestamp: Date.now()
                      });
                      
                      console.log(`CPU ${nextPlayer} successfully showed card to ${cpuAction.data.toPlayer}`);
                    }
                    break;
                    
                  case 'draw-and-play':
                    // NEW: Draw a card and immediately play it in the same turn
                    const drawnCard = await gameManager.pickCardAndReturn(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                    if (drawnCard && typeof drawnCard === 'object') {
                      console.log(`CPU ${nextPlayer} drew ${cpuAction.data.deckType} card: ${drawnCard.id} and will play it immediately`);
                      
                      // Update game state after drawing
                      const drawGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', drawGameState);
                      
                      // Play the card immediately (same turn activation)
                      setTimeout(async () => {
                        const immediatePlayResult = await gameManager.playCard(gameId, drawnCard.id, cpuAction.data.playerName);
                        if (immediatePlayResult && immediatePlayResult.card) {
                          console.log(`CPU ${nextPlayer} immediately played drawn card: ${drawnCard.id}`);
                          
                          const playGameState = gameManager.getSanitizedGameState(gameId);
                          io.to(gameId).emit('game-state-update', playGameState);
                          
                          // Turn ends after using the card
                          setTimeout(() => {
                            const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                            if (nextAfterCPU) {
                              io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                              console.log(`Turn ended for ${nextPlayer} after draw-and-play, next: ${nextAfterCPU}`);
                            }
                          }, 1000);
                        }
                      }, 1000); // Brief delay to show the draw then play
                    }
                    return; // Return early to prevent generic end-turn
                }
                
                // NOTE: Turn ending is now handled individually by each action type
                // Only end turn generically for actions that don't handle it themselves
                if (!['play-card', 'mosse-attack', 'draw-and-play', 'eliminate-dead-character', 'show-card-to-player'].includes(cpuAction.type)) {
                  setTimeout(() => {
                    const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                    if (nextAfterCPU) {
                      io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                      console.log(`Turn ended generically for ${nextPlayer}, next: ${nextAfterCPU}`);
                    }
                  }, 1500);
                }
                
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
