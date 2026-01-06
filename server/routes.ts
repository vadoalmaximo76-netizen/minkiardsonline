import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketServer } from "socket.io";
import { GameManager } from "./gameManager";
import OpenAI from "openai";
import { db } from "./db";
import { personaggi, customCards } from "../shared/schema";
import { eq, ilike } from "drizzle-orm";

// Initialize OpenAI
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Track voice chat participants: gameId -> Set of playerNames
const voiceChatRooms = new Map<string, Map<string, string>>(); // gameId -> Map(playerName -> socketId)

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

// Look up PERSONAGGI data from database
async function getPersonaggioFromDatabase(cardName: string): Promise<{ pti: number | null, stars: number | null } | null> {
  try {
    console.log(`🔍 Looking up ${cardName} in PERSONAGGI database...`);
    
    // First try exact match
    let result = await db.select().from(personaggi).where(eq(personaggi.name, cardName.toUpperCase())).limit(1);
    
    // If no exact match, try fuzzy search
    if (result.length === 0) {
      result = await db.select().from(personaggi).where(ilike(personaggi.name, `%${cardName.toUpperCase()}%`)).limit(1);
    }
    
    // If still no match, try parts of the name
    if (result.length === 0) {
      const nameParts = cardName.toUpperCase().split(' ');
      for (const part of nameParts) {
        if (part.length > 3) { // Only search meaningful parts
          result = await db.select().from(personaggi).where(ilike(personaggi.name, `%${part}%`)).limit(1);
          if (result.length > 0) break;
        }
      }
    }
    
    if (result.length > 0) {
      console.log(`✅ Found in database: ${result[0].name} - PTI: ${result[0].pti}, Stelle: ${result[0].stars}`);
      return {
        pti: result[0].pti,
        stars: result[0].stars
      };
    }
    
    console.log(`❌ Not found in database: ${cardName}`);
    return null;
  } catch (error) {
    console.error('Error querying PERSONAGGI database:', error);
    return null;
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

    socket.on('join-game', async ({ gameId, playerName, avatarId, userId }) => {
      socket.join(gameId);
      
      // Wait for player to be added and permanent cards to be loaded
      await gameManager.addPlayer(gameId, playerName, socket.id);
      
      // Set avatar if provided
      if (avatarId) {
        gameManager.setPlayerAvatar(gameId, playerName, avatarId);
      }
      
      // Set user ID for Rankiard points tracking
      if (userId) {
        gameManager.setPlayerUserId(gameId, playerName, userId);
      }
      
      // Send current game state to the player (now includes permanent cards)
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
                    // Look up PTI/stars from database for newly picked PERSONAGGI cards
                    const game = gameManager.getGameState(gameId);
                    const cpuHand = game?.players[currentAction.data.playerName]?.hand || [];
                    for (const card of cpuHand) {
                      if ((card.type === 'personaggi' || card.type === 'personaggi_speciali') && !card.text) {
                        try {
                          const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
                          const dbData = await getPersonaggioFromDatabase(cardName);
                          if (dbData && dbData.pti !== null && dbData.stars !== null) {
                            card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                            console.log(`✅ CPU ${cpuName} opening card: ${cardName} - PTI: ${dbData.pti} | Stelle: ${dbData.stars}`);
                          } else {
                            card.text = 'PTI: 1000 | Stelle: 1';
                          }
                        } catch (error) {
                          card.text = 'PTI: 1000 | Stelle: 1';
                        }
                      }
                    }
                    
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
                    
                    const cardName = playResult.card.name || getCardNameFromUrl(playResult.card.frontImage);
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
                    
                    const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
                    io.to(gameId).emit('personaggio-enters', {
                      cardName,
                      message: 'SI UNISCE ALLA ZUFFA',
                      playerName: cpuName,
                      cardImage: result.card.frontImage
                    });
                  }
                  
                  // CRITICAL FIX: If CPU played a MOSSE card, automatically attack an enemy
                  if (result.card && result.card.type === 'mosse') {
                    console.log(`🎯 CPU ${cpuName} played MOSSE card - automatically triggering attack`);
                    
                    // Find enemy characters on field to attack
                    const currentGameState = gameManager.getSanitizedGameState(gameId);
                    const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                      c.owner !== cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                    ) || [];
                    
                    if (enemyCharacters.length > 0) {
                      // Select a target (prefer lowest PTI for strategic advantage)
                      const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                        const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                        const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                        return currentPti < bestPti ? current : best;
                      });
                      
                      const getMosseName = (url: string) => {
                        const parts = url.split('/');
                        const filename = parts[parts.length - 1];
                        return filename
                          .toLowerCase()
                          .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                          .replace(/[-_]/g, ' ')
                          .split(' ')
                          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                          .join(' ');
                      };
                      
                      const mosseName = getMosseName(result.card.frontImage);
                      const targetName = getMosseName(targetCard.frontImage);
                      
                      // Send chat message about attack
                      io.to(gameId).emit('chat-message', {
                        id: `${Date.now()}-cpu-mosse-attack`,
                        playerName: cpuName,
                        message: `Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}!`,
                        timestamp: Date.now()
                      });
                      
                      // Execute the attack after a short delay
                      setTimeout(async () => {
                        try {
                          const attackResult = await gameManager.executeMossaAttack(
                            gameId,
                            cpuName,
                            result.card!.id,
                            targetCard.id,
                            100, // Base damage, will be calculated properly by the attack system
                            false, // Not a hand target
                            (data: any) => io.to(gameId).emit('defense-request', data)
                          );
                          
                          if (attackResult.success) {
                            console.log(`✅ CPU ${cpuName} MOSSE attack executed successfully`);
                          } else {
                            console.log(`❌ CPU ${cpuName} MOSSE attack failed: ${attackResult.error}`);
                          }
                          
                          // Return MOSSE card to deck and draw replacement
                          setTimeout(() => {
                            gameManager.returnToDeck(gameId, result.card!.id, cpuName);
                            console.log(`🔄 CPU ${cpuName} returned MOSSE card to deck`);
                            
                            const finalState = gameManager.getSanitizedGameState(gameId);
                            io.to(gameId).emit('game-state-update', finalState);
                          }, 2000);
                        } catch (err) {
                          console.error(`Error in CPU MOSSE attack:`, err);
                        }
                      }, 1500);
                    } else {
                      console.log(`⚠️ CPU ${cpuName} has MOSSE card but no enemy targets on field`);
                    }
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

    // NEW: CPU instruction handler for natural language commands
    socket.on('cpu-instruction', async ({ gameId, instruction }) => {
      try {
        const socketGameId = gameManager.getPlayerGameId(socket.id);
        if (!socketGameId || socketGameId !== gameId) {
          socket.emit('instruction-error', { message: 'Accesso non autorizzato a questo gioco' });
          return;
        }

        console.log(`Processing CPU instruction in game ${gameId}: "${instruction}"`);
        
        // Find player name from socket
        const game = gameManager.getGameState(gameId);
        if (!game) {
          socket.emit('instruction-error', { message: 'Gioco non trovato' });
          return;
        }
        
        const playerName = Object.values(game.players).find(p => p.socketId === socket.id)?.name;
        if (!playerName) {
          socket.emit('instruction-error', { message: 'Giocatore non trovato' });
          return;
        }

        // Process the instruction using GameManager's natural language processing
        const result = await gameManager.processGameInstruction(gameId, playerName, instruction);
        
        if (result && result.message) {
          // Broadcast the result to all players in the game
          io.to(gameId).emit('chat-message', {
            playerName: 'Sistema',
            message: result.message,
            timestamp: Date.now()
          });
          
          // Update game state 
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Send success response to the instructor
          socket.emit('instruction-success', {
            message: `✅ Istruzione eseguita: "${instruction}"`
          });
        } else {
          socket.emit('instruction-error', {
            message: `❌ Istruzione non riconosciuta: "${instruction}". Prova con comandi più specifici come "CPU-Nome pesca PERSONAGGI" o "CPU-Nome gioca carta".`
          });
        }
        
      } catch (error) {
        console.error('Error processing CPU instruction:', error);
        socket.emit('instruction-error', {
          message: `❌ Errore nell'esecuzione dell'istruzione: ${error instanceof Error ? error.message : 'Errore sconosciuto'}`
        });
      }
    });

    socket.on('shuffle-deck', ({ deckType }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.shuffleDeck(gameId, deckType);
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        io.to(gameId).emit('deck-shuffled', { deckType });
      }
    });

    // Notify other players when someone is choosing a card from a deck
    socket.on('player-choosing-card', ({ playerName, deckName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Broadcast to all OTHER players in the game (not the one choosing)
        socket.to(gameId).emit('player-choosing-notification', {
          playerName,
          deckName,
          message: `L'utente ${playerName} sta scegliendo una carta dal mazzo ${deckName}`
        });
      }
    });

    socket.on('set-avatar', ({ avatarId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) return;
      
      // Get player name from socket ID (don't trust client-supplied playerName)
      const playerName = gameManager.getPlayerNameFromSocket(socket.id);
      if (!playerName) return;
      
      // setPlayerAvatar validates avatarId against whitelist internally
      const success = gameManager.setPlayerAvatar(gameId, playerName, avatarId);
      if (success) {
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        io.to(gameId).emit('avatar-changed', { playerName, avatarId });
      }
    });

    socket.on('pick-card', async ({ deckType, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const card = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (card) {
          // Look up PERSONAGGI data from database when picked (to get PTI and stars in hand)
          if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
            try {
              const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
              console.log(`Querying database for PERSONAGGI card when picked: ${cardName}`);
              const dbData = await getPersonaggioFromDatabase(cardName);
              if (dbData && dbData.pti !== null && dbData.stars !== null) {
                card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                console.log(`✅ Database lookup successful: PTI: ${dbData.pti} | Stelle: ${dbData.stars}`);
              }
            } catch (error) {
              console.error('Error querying database for card on pick:', error);
            }
          }
          
          // Emit to all players to update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Emit the picked card ONLY to the player who picked it
          const playerSocketId = gameManager.getPlayerSocketId(gameId, playerName);
          if (playerSocketId) {
            const cardDisplayName = getCardNameFromImageUrl(card.frontImage);
            io.to(playerSocketId).emit('card-picked-private', {
              card,
              message: `Hai pescato: ${cardDisplayName || 'Carta'}`
            });
          }
        }
      }
    });

    // CRITICAL FIX: Handle CPU drawing replacement cards after playing
    socket.on('cpu-draw-replacement', async ({ deckType, playerName }) => {
      console.log(`CPU ${playerName} requesting replacement ${deckType} card`);
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // Use pickCardAndReturn to get the card reference for PTI/stars assignment
        const card = await gameManager.pickCardAndReturn(gameId, deckType, playerName);
        if (card) {
          // Look up PERSONAGGI data from database when picked (to get PTI and stars in hand)
          if (card.type === 'personaggi' || card.type === 'personaggi_speciali') {
            try {
              const cardName = getCardNameFromImageUrl(card.frontImage).replace(/-/g, ' ');
              console.log(`CPU ${playerName}: Querying database for PERSONAGGI card: ${cardName}`);
              const dbData = await getPersonaggioFromDatabase(cardName);
              if (dbData && dbData.pti !== null && dbData.stars !== null) {
                card.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                console.log(`✅ CPU ${playerName} card database lookup successful: PTI: ${dbData.pti} | Stelle: ${dbData.stars}`);
              } else {
                card.text = 'PTI: 1000 | Stelle: 1';
                console.log(`CPU ${playerName}: Card not in database, using defaults`);
              }
            } catch (error) {
              console.error('Error querying database for CPU card on pick:', error);
              card.text = 'PTI: 1000 | Stelle: 1';
            }
          }
          
          console.log(`CPU ${playerName} drew replacement ${deckType} card successfully`);
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Send chat message to notify players
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-cpu-replacement`,
            playerName: 'Sistema',
            message: `${playerName} ha pescato una carta ${deckType.toUpperCase()} di ricambio`,
            timestamp: Date.now()
          });
        } else {
          console.log(`❌ CPU ${playerName} failed to draw replacement ${deckType} card`);
        }
      }
    });

    socket.on('choose-specific-card', async ({ deckType, cardId, playerName }) => {
      console.log(`CHOOSE-SPECIFIC-CARD event received:`, { deckType, cardId, playerName });
      const gameId = gameManager.getPlayerGameId(socket.id);
      console.log(`GameId for player ${playerName}:`, gameId);
      
      if (gameId) {
        const success = gameManager.chooseSpecificCard(gameId, deckType, cardId, playerName);
        console.log(`ChooseSpecificCard result for ${playerName}:`, success);
        
        if (success) {
          // Look up PERSONAGGI data from database when picked (to get PTI and stars in hand)
          if (deckType === 'personaggi' || deckType === 'personaggi_speciali') {
            const game = gameManager.getGameState(gameId);
            const pickedCard = game?.players[playerName]?.hand.find((c: any) => c.id === cardId);
            if (pickedCard) {
              try {
                const cardName = getCardNameFromImageUrl(pickedCard.frontImage).replace(/-/g, ' ');
                console.log(`Querying database for PERSONAGGI card when chosen: ${cardName}`);
                const dbData = await getPersonaggioFromDatabase(cardName);
                if (dbData && dbData.pti !== null && dbData.stars !== null) {
                  pickedCard.text = `PTI: ${dbData.pti} | Stelle: ${dbData.stars}`;
                  console.log(`✅ Database lookup successful: PTI: ${dbData.pti} | Stelle: ${dbData.stars}`);
                }
              } catch (error) {
                console.error('Error querying database for card on choose:', error);
              }
            }
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          console.log(`Emitting game-state-update to room ${gameId}`);
          io.to(gameId).emit('game-state-update', gameState);
          console.log(`Game state updated after ${playerName} picked card ${cardId}`);
          
          // Log the updated player hand count from sanitized game state
          const playerHandCount = gameState?.players[playerName]?.hand.length || 0;
          console.log(`${playerName} now has ${playerHandCount} cards in hand (from sanitized state)`);
        } else {
          console.log(`FAILED to choose specific card for ${playerName}`);
          socket.emit('error', { message: 'Failed to pick card' });
        }
      } else {
        console.log(`No gameId found for player ${playerName} (socketId: ${socket.id})`);
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
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          
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
        
        // Check if card has special animation
        if (result.card && result.card.triggerAnimation) {
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
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          console.log(`🎬 Emitting card-animation-trigger for: ${cardName}`);
          
          io.to(gameId).emit('card-animation-trigger', {
            cardName,
            playerName,
            cardId: result.card.id
          });
        }
        
        // DUELLO: Auto-activate MOSSE attack during duel
        if (result.duelAutoAttack && result.card) {
          const duelState = gameManager.getDuelState(gameId);
          if (duelState && duelState.active) {
            console.log(`⚔️ DUELLO: Auto-activating MOSSE attack for ${playerName}`);
            
            // Determine opponent's character
            const opponentCharacterId = playerName === duelState.player1 ? duelState.character2Id : duelState.character1Id;
            
            // Emit auto-attack notification to client
            io.to(gameId).emit('duel-auto-attack', {
              attackerName: playerName,
              mosseCardId: result.card.id,
              targetCardId: opponentCharacterId,
              message: `⚔️ DUELLO: ${playerName} attacca automaticamente!`
            });
            
            console.log(`⚔️ DUELLO: Auto-attack will target ${opponentCharacterId}`);
          }
        }
        
        // PARASITIC CARDS: Check if PARASSITA or SAIBAIM was played
        if (result.card && (result.card.type === 'personaggi' || result.card.type === 'personaggi_speciali')) {
          const parasiticType = gameManager.isParasiticCard(result.card);
          if (parasiticType && result.card.canReattach !== false) {
            console.log(`🦠 ${parasiticType} played by ${playerName} - requesting target selection`);
            
            const targets = gameManager.getParasiticTargets(gameId, playerName);
            
            if (targets.length > 0) {
              if (playerName.startsWith('CPU-')) {
                // CPU auto-selects target (highest stars)
                const target = gameManager.getCPUParasiticTarget(gameId, playerName);
                if (target) {
                  console.log(`🦠 CPU ${playerName} auto-targeting ${target.id} with ${parasiticType}`);
                  const attachResult = await gameManager.attachParasiticCard(gameId, result.card.id, target.id, playerName);
                  
                  if (attachResult.success) {
                    const getCardNameFromUrl = (url: string) => {
                      const parts = url.split('/');
                      const filename = parts[parts.length - 1];
                      return filename.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    };
                    const targetName = target.name || getCardNameFromUrl(target.frontImage);
                    
                    io.to(gameId).emit('parasitic-attached', {
                      parasiticCardId: result.card.id,
                      parasiticType,
                      targetCardId: target.id,
                      targetName,
                      ownerPlayer: playerName,
                      targetPlayer: target.owner
                    });
                    
                    io.to(gameId).emit('chat-message', {
                      id: `${Date.now()}-parasitic-attach`,
                      playerName: 'SISTEMA',
                      message: `🦠 ${parasiticType} di ${playerName} si è agganciato a ${targetName}!`,
                      timestamp: Date.now()
                    });
                    
                    const updatedState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', updatedState);
                  }
                }
              } else {
                // Human player - show target selection panel
                io.to(gameId).emit('parasitic-target-select', {
                  parasiticCardId: result.card.id,
                  parasiticType,
                  ownerPlayer: playerName,
                  targets: targets.map(t => ({
                    id: t.id,
                    frontImage: t.frontImage,
                    owner: t.owner,
                    text: t.text
                  }))
                });
              }
            } else {
              console.log(`🦠 ${parasiticType} played but no valid targets available`);
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-parasitic-no-target`,
                playerName: 'SISTEMA',
                message: `🦠 ${parasiticType} non ha bersagli validi a cui agganciarsi!`,
                timestamp: Date.now()
              });
            }
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
          
          const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
          
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
          // Check for player elimination from character limit
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via manual move-to-graveyard - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
          }
          
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
            
            // Emit "Ciao ciao" notification with cardType for animation triggering
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName,
              cardType: result.cardType || 'personaggi'
            });
          }

          // Check for SOROS activation
          if (result.sorosActivated) {
            io.to(gameId).emit('soros-activated', {
              activator: result.sorosActivator,
              cardImage: result.sorosImage,
              timestamp: Date.now()
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

    // Remove card from deck (when using "ELIMINA CARTA" button)
    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }: any) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const game = gameManager.getGameState(gameId);
        if (!game) return;
        const normalizedDeckType = deckType as keyof typeof game.decks;
        if (game.decks[normalizedDeckType]) {
          // Find and remove card from deck
          const cardIndex = game.decks[normalizedDeckType].findIndex((card: any) => card.id === cardId);
          if (cardIndex !== -1) {
            const removedCard = game.decks[normalizedDeckType].splice(cardIndex, 1)[0];
            
            // Add to graveyard with special section
            removedCard.section = section || 'CARTE CANCELLATE';
            removedCard.owner = playerName;
            game.graveyard.push(removedCard);
            
            console.log(`Card ${cardId} removed from ${deckType} deck and added to graveyard with section: ${section}`);
            
            // Emit game state update
            const gameState = gameManager.getSanitizedGameState(gameId);
            io.to(gameId).emit('game-state-update', gameState);
          }
        }
      }
    });

    socket.on('transfer-card', ({ cardId, fromPlayer, toPlayer }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const game = gameManager.getGameState(gameId);
        if (!game) return;

        // Find card in all possible locations (hand, field, graveyard)
        let cardToTransfer: any = null;
        let sourceLocation: 'hand' | 'field' | 'graveyard' | null = null;

        // Check player's hand
        if (game.players[fromPlayer]) {
          const handIndex = game.players[fromPlayer].hand.findIndex((c: any) => c.id === cardId);
          if (handIndex !== -1) {
            cardToTransfer = game.players[fromPlayer].hand.splice(handIndex, 1)[0];
            sourceLocation = 'hand';
          }
        }

        // Check field
        if (!cardToTransfer) {
          const fieldIndex = game.field.findIndex((c: any) => c.id === cardId && c.owner === fromPlayer);
          if (fieldIndex !== -1) {
            cardToTransfer = game.field.splice(fieldIndex, 1)[0];
            sourceLocation = 'field';
          }
        }

        // Check graveyard
        if (!cardToTransfer) {
          const graveyardIndex = game.graveyard.findIndex((c: any) => c.id === cardId && c.owner === fromPlayer);
          if (graveyardIndex !== -1) {
            cardToTransfer = game.graveyard.splice(graveyardIndex, 1)[0];
            sourceLocation = 'graveyard';
          }
        }

        if (!cardToTransfer) {
          console.error(`Card ${cardId} not found for player ${fromPlayer}`);
          return;
        }

        // Transfer card to recipient's hand
        if (game.players[toPlayer]) {
          cardToTransfer.owner = toPlayer; // Update owner
          game.players[toPlayer].hand.push(cardToTransfer);
          
          console.log(`✅ Card ${cardId} transferred from ${fromPlayer} to ${toPlayer}`);
          
          // Notify all players
          io.to(gameId).emit('chat-message', {
            playerName: 'Sistema',
            message: `✅ ${fromPlayer} ha ceduto una carta a ${toPlayer}`,
            timestamp: Date.now()
          });
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
    });

    // Accept transfer request
    socket.on('accept-transfer', ({ requestId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        try {
          // Get request details before accepting
          const game = gameManager.getGameState(gameId);
          const request = game?.pendingTransferRequests.find(req => req.id === requestId);
          
          if (!request) {
            socket.emit('transfer-error', { message: 'Richiesta di trasferimento non trovata' });
            return;
          }

          // SECURITY: Verify that the socket belongs to the intended recipient
          const recipientPlayer = game?.players[request.toPlayer];
          if (!recipientPlayer || recipientPlayer.socketId !== socket.id) {
            socket.emit('transfer-error', { message: 'Non autorizzato ad accettare questa richiesta' });
            return;
          }

          gameManager.acceptTransferRequest(gameId, requestId);
            
            // Notify all players about the successful transfer
            io.to(gameId).emit('chat-message', {
              playerName: 'Sistema',
              message: `✅ ${request.fromPlayer} ha trasferito una carta a ${request.toPlayer}`,
              timestamp: Date.now()
            });
            
            // Update game state
            const gameState = gameManager.getSanitizedGameState(gameId);
            io.to(gameId).emit('game-state-update', gameState);
            
            // Notify sender that transfer was accepted
            const fromPlayerData = game?.players[request.fromPlayer];
            if (fromPlayerData?.socketId) {
              io.to(fromPlayerData.socketId).emit('transfer-accepted', {
                message: `${request.toPlayer} ha accettato il trasferimento`
              });
            }
        } catch (error) {
          console.error('Error accepting transfer:', error);
          socket.emit('transfer-error', { 
            message: error instanceof Error ? error.message : 'Errore nell\'accettazione del trasferimento' 
          });
        }
      }
    });

    // Decline transfer request
    socket.on('decline-transfer', ({ requestId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        try {
          // Get request details before declining
          const game = gameManager.getGameState(gameId);
          const request = game?.pendingTransferRequests.find(req => req.id === requestId);
          
          if (!request) {
            socket.emit('transfer-error', { message: 'Richiesta di trasferimento non trovata' });
            return;
          }

          // SECURITY: Verify that the socket belongs to the intended recipient
          const recipientPlayer = game?.players[request.toPlayer];
          if (!recipientPlayer || recipientPlayer.socketId !== socket.id) {
            socket.emit('transfer-error', { message: 'Non autorizzato a rifiutare questa richiesta' });
            return;
          }
          
          gameManager.declineTransferRequest(gameId, requestId);
            
            // Notify sender that transfer was declined
            const fromPlayerData = game?.players[request.fromPlayer];
            if (fromPlayerData?.socketId) {
              io.to(fromPlayerData.socketId).emit('transfer-declined', {
                message: `${request.toPlayer} ha rifiutato il trasferimento`
              });
            }
        } catch (error) {
          console.error('Error declining transfer:', error);
          socket.emit('transfer-error', { 
            message: error instanceof Error ? error.message : 'Errore nel rifiuto del trasferimento' 
          });
        }
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

    socket.on('swap-cards', ({ player1, card1Id, player2, card2Id }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.swapCardsBetweenPlayers(gameId, player1, card1Id, player2, card2Id);
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        // Emit notification to all players about the swap
        io.to(gameId).emit('cards-swapped', {
          player1,
          player2,
          message: `${player1} e ${player2} hanno scambiato delle carte!`,
          timestamp: Date.now()
        });
      }
    });

    // POTERI - Copy special power from another character
    socket.on('copy-power', ({ cardId, playerName, powerSource }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`✨ POTERI: ${playerName} copying power of ${powerSource} to card ${cardId}`);
        
        const result = gameManager.copyPowerToCard(gameId, cardId, playerName, powerSource);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-power-copy`,
            playerName: 'Sistema',
            message: `✨ ${result.cardName} ha acquisito il potere di ${powerSource}!`,
            timestamp: Date.now()
          });
        }
      }
    });

    socket.on('update-card-text', ({ cardId, text }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        gameManager.updateCardText(gameId, cardId, text);
        
        // Check for automatic death if PTI reaches 0
        const gameState = gameManager.getSanitizedGameState(gameId);
        const card = gameState?.field?.find((c: any) => c.id === cardId);
        
        if (card && (card.type === 'personaggi' || card.type === 'personaggi_speciali')) {
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
                  
                  // Emit "Ciao ciao" notification with cardType for death animation
                  io.to(gameId).emit('card-to-graveyard', {
                    cardName,
                    playerName: card.owner,
                    cardType: card.type || 'personaggi'
                  });
                }
              }
            }, 100); // Small delay to let UI update first
          }
        }
        
        io.to(gameId).emit('game-state-update', gameState);
      }
    });

    // FUSION SYSTEM HANDLERS
    socket.on('fuse-cards', async ({ leaderCardId, targetCardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Fusion request: ${playerName} wants to fuse ${leaderCardId} with ${targetCardId}`);
        
        const result = await gameManager.fuseCards(gameId, leaderCardId, targetCardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the fusion
          io.to(gameId).emit('cards-fused', {
            playerName,
            leaderCardId,
            targetCardId,
            message: `${playerName} ha fuso due PERSONAGGI!`,
            timestamp: Date.now()
          });
          
          console.log(`Cards successfully fused by ${playerName}`);
        } else {
          // Send error back to the requesting player
          socket.emit('fusion-error', {
            message: result.message || 'Errore durante la fusione',
            timestamp: Date.now()
          });
          
          console.log(`Fusion failed: ${result.message}`);
        }
      }
    });

    socket.on('separate-cards', async ({ cardId, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Separation request: ${playerName} wants to separate card ${cardId}`);
        
        const result = await gameManager.separateCards(gameId, cardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the separation
          io.to(gameId).emit('cards-separated', {
            playerName,
            cardId,
            message: `${playerName} ha separato i PERSONAGGI fusi!`,
            timestamp: Date.now()
          });
          
          console.log(`Cards successfully separated by ${playerName}`);
        } else {
          // Send error back to the requesting player
          socket.emit('separation-error', {
            message: result.message || 'Errore durante la separazione',
            timestamp: Date.now()
          });
          
          console.log(`Separation failed: ${result.message}`);
        }
      }
    });

    socket.on('duplicate-card', async ({ cardId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        // SECURITY: Derive player name from socket ID to prevent spoofing
        const playerName = gameManager.getPlayerNameFromSocket(socket.id);
        if (!playerName) {
          socket.emit('duplication-error', {
            message: 'Player not found or not authenticated',
            timestamp: Date.now()
          });
          return;
        }
        
        console.log(`Duplicate request: ${playerName} wants to duplicate card ${cardId}`);
        
        const result = await gameManager.duplicateCard(gameId, cardId, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the duplication
          io.to(gameId).emit('card-duplicated', {
            playerName,
            originalCardId: cardId,
            duplicatedCardId: result.duplicatedCardId,
            message: `${playerName} ha duplicato una carta PERSONAGGI!`,
            timestamp: Date.now()
          });
          
          console.log(`Card successfully duplicated by ${playerName}: ${cardId} -> ${result.duplicatedCardId}`);
        } else {
          // Send error back to the requesting player
          socket.emit('duplication-error', {
            message: result.message || 'Errore durante la duplicazione',
            timestamp: Date.now()
          });
          
          console.log(`Duplication failed: ${result.message}`);
        }
      }
    });

    // Add PTI to a character
    socket.on('add-pti', ({ cardId, ptiAmount, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Add PTI request: ${playerName} wants to add ${ptiAmount} PTI to card ${cardId}`);
        
        const result = gameManager.addPTIToCard(gameId, cardId, ptiAmount, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the PTI addition
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pti-add`,
            playerName: 'Sistema',
            message: `${playerName} ha aggiunto ${ptiAmount} PTI al personaggio! (Totale: ${result.newPTI} PTI)`,
            timestamp: Date.now()
          });
          
          console.log(`PTI successfully added by ${playerName}: +${ptiAmount} = ${result.newPTI}`);
        } else {
          socket.emit('pti-error', {
            message: result.message || 'Errore durante l\'aggiunta dei PTI',
            timestamp: Date.now()
          });
          
          console.log(`Add PTI failed: ${result.message}`);
        }
      }
    });

    // Modify character stats (PTI and Stars) - can add or subtract
    socket.on('modify-stats', ({ cardId, ptiAmount, stelleAmount, playerName }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Modify stats request: ${playerName} wants to modify card ${cardId} - PTI: ${ptiAmount}, Stelle: ${stelleAmount}`);
        
        const result = gameManager.modifyCardStats(gameId, cardId, ptiAmount, stelleAmount, playerName);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Build message parts
          const messageParts = [];
          if (ptiAmount !== 0) {
            messageParts.push(`${ptiAmount > 0 ? '+' : ''}${ptiAmount} PTI`);
          }
          if (stelleAmount !== 0) {
            messageParts.push(`${stelleAmount > 0 ? '+' : ''}${stelleAmount} Stelle`);
          }
          
          // Notify all players about the stat change
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-stats-modify`,
            playerName: 'Sistema',
            message: `${playerName} ha modificato le statistiche del personaggio: ${messageParts.join(', ')}! (Nuovo: PTI ${result.newPTI}, Stelle ${result.newStelle})`,
            timestamp: Date.now()
          });
          
          console.log(`Stats successfully modified by ${playerName}: PTI=${result.newPTI}, Stelle=${result.newStelle}`);
        } else {
          socket.emit('stats-error', {
            message: result.message || 'Errore durante la modifica delle statistiche',
            timestamp: Date.now()
          });
          
          console.log(`Modify stats failed: ${result.message}`);
        }
      }
    });

    // Add PR (Rankiard Points) to a character - subtracts from player's points for this game only
    socket.on('add-pr', ({ cardId, prAmount, playerName, userTotalPoints }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`Add PR request: ${playerName} wants to convert ${prAmount} PR to PTI for card ${cardId}`);
        
        const result = gameManager.addPRToCard(gameId, cardId, prAmount, playerName, userTotalPoints);
        
        if (result.success) {
          // Update game state for all players
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // Notify all players about the PR conversion
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-pr-add`,
            playerName: 'Sistema',
            message: `${playerName} ha convertito ${prAmount} Punti Rankiard in PTI! (Totale PTI: ${result.newPTI})`,
            timestamp: Date.now()
          });
          
          // Send PR spent update to the player
          socket.emit('pr-spent-update', {
            prSpent: result.prSpent,
            timestamp: Date.now()
          });
          
          console.log(`PR successfully converted by ${playerName}: ${prAmount} PR -> PTI (total spent: ${result.prSpent})`);
        } else {
          socket.emit('pr-error', {
            message: result.message || 'Errore durante la conversione dei PR',
            timestamp: Date.now()
          });
          
          console.log(`Add PR failed: ${result.message}`);
        }
      }
    });

    // BAMBOLA VOODOO: Activate voodoo link between two characters
    socket.on('voodoo:activate', ({ bonusCardId, card1Id, card2Id, activatedBy, gameId: clientGameId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      if (!gameId) {
        socket.emit('voodoo:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🔮 BAMBOLA VOODOO activation request: ${card1Id} <-> ${card2Id} by ${activatedBy}`);
      
      const result = gameManager.activateVoodooLink(gameId, bonusCardId, card1Id, card2Id, activatedBy);
      
      if (result.success) {
        // Broadcast to all players
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-voodoo-activate`,
          playerName: 'Sistema',
          message: result.message,
          timestamp: Date.now()
        });
        
        // Send updated game state with voodoo links
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        console.log(`🔮 BAMBOLA VOODOO activated successfully`);
      } else {
        socket.emit('voodoo:error', { message: result.message });
        console.log(`🔮 BAMBOLA VOODOO activation failed: ${result.message}`);
      }
    });
    
    // BAMBOLA VOODOO: Remove voodoo link
    socket.on('voodoo:remove', ({ cardId, gameId: clientGameId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      if (!gameId) {
        socket.emit('voodoo:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`🔮 BAMBOLA VOODOO removal request for card: ${cardId}`);
      
      const success = gameManager.removeVoodooLink(gameId, cardId);
      
      if (success) {
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-voodoo-remove`,
          playerName: 'Sistema',
          message: '🔮 Collegamento BAMBOLA VOODOO rimosso!',
          timestamp: Date.now()
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        console.log(`🔮 BAMBOLA VOODOO link removed successfully`);
      } else {
        socket.emit('voodoo:error', { message: 'No voodoo link found for this card' });
      }
    });

    // DUELLO: Start a duel between two characters
    socket.on('duel:start', async ({ duelCardId, initiatorPlayer, opponentCharacterId }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        socket.emit('duel:error', { message: 'Game not found' });
        return;
      }
      
      console.log(`⚔️ DUELLO start request: ${initiatorPlayer} vs opponent character ${opponentCharacterId}`);
      
      const result = await gameManager.startDuel(gameId, duelCardId, initiatorPlayer, opponentCharacterId);
      
      if (result.success) {
        // Get the duel state to send details to players
        const duelState = gameManager.getDuelState(gameId);
        
        // Broadcast to all players
        io.to(gameId).emit('chat-message', {
          id: `${Date.now()}-duel-start`,
          playerName: 'Sistema',
          message: result.message,
          timestamp: Date.now()
        });
        
        // Send duel started event with duel details
        io.to(gameId).emit('duel:started', {
          duelState,
          message: result.message
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
        
        console.log(`⚔️ DUELLO started successfully`);
      } else {
        socket.emit('duel:error', { message: result.message });
        console.log(`⚔️ DUELLO start failed: ${result.message}`);
      }
    });

    // CPU DAMAGE REQUEST: Handle damage submission from game creator for CPU attacks
    socket.on('cpu-damage-submit', async ({ cpuName, mosseCardId, targetCardId, targetOwner, damageValue }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (!gameId) {
        console.log(`cpu-damage-submit: gameId not found for socket ${socket.id}`);
        return;
      }
      
      console.log(`🎯 Received damage ${damageValue} from game creator for CPU ${cpuName} attacking ${targetCardId}`);
      
      // Execute the attack with the provided damage
      const attackResult = await gameManager.executeMossaAttack(
        gameId,
        cpuName,
        mosseCardId,
        targetCardId,
        damageValue
      );

      if (!attackResult.success) {
        console.log(`CPU attack failed: ${attackResult.error}`);
        socket.emit('attack-error', { message: attackResult.error });
        return;
      }

      // Broadcast attack animation to all players
      io.to(gameId).emit('card-attacked', {
        mosseCardId,
        targetCardId,
        attackerName: cpuName,
        targetOwner,
        damageValue,
        timestamp: Date.now()
      });

      // NEW: Use defense system like all other attacks
      if (attackResult.result?.requiresDefenseResponse) {
        console.log(`🛡️ CPU attack requires defense - emitting defense:request to ${targetOwner}`);
        
        // Store damage value and attack details for later processing
        const pendingDefense = gameManager.getPendingDefense(gameId);
        if (pendingDefense) {
          pendingDefense.damage = damageValue;
          pendingDefense.mosseCardId = mosseCardId;
          console.log(`📝 Stored damage value ${damageValue} for pending defense ${pendingDefense.attackId}`);
        }
        
        // Emit defense request to the defender
        const emissionSuccess = await gameManager.emitDefenseRequest(gameId, io);
        if (!emissionSuccess) {
          console.log(`⚠️ Failed to emit defense request - proceeding with damage`);
          await gameManager.processMosseDamage(gameId, cpuName, targetCardId, damageValue, mosseCardId, io);
        }
        
        // Attack is pending defense response - processing will continue in defense:response handler
        return;
      }

      // If no defense required, process damage immediately
      await gameManager.processMosseDamage(gameId, cpuName, targetCardId, damageValue, mosseCardId, io);
      
      // NEW: Notify CPU that attack is resolved and immediately continue their turn
      const game = gameManager.getGameState(gameId);
      if (game && game.players[cpuName]?.cpuInstance) {
        const cpuInstance = game.players[cpuName].cpuInstance;
        cpuInstance.resolveAttack();
        console.log(`🎯 CPU ${cpuName}: Notified that attack is resolved - continuing turn...`);
        
        // CRITICAL: Immediately continue CPU turn after attack resolution
        setTimeout(async () => {
          try {
            const updatedState = gameManager.getSanitizedGameState(gameId);
            const nextAction = await cpuInstance.takeTurn(updatedState);
            
            if (nextAction) {
              console.log(`🎯 CPU ${cpuName}: Continuing turn with action:`, nextAction.type);
              await gameManager.processCPUTurn(gameId, cpuName, io);
            }
          } catch (error) {
            console.error(`Error continuing CPU ${cpuName} turn:`, error);
          }
        }, 100); // Small delay to ensure state is updated
      }
      
      console.log(`🎯 CPU ${cpuName} attack completed successfully`);
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
                      
                    case 'play-and-draw':
                      // MINKIARDS RULE: Play card and immediately draw replacement of same type
                      const playResult = await gameManager.playCard(gameId, cpuAction.data.playCardId, cpuAction.data.playerName);
                      
                      if (playResult.card) {
                        // Draw replacement of same type
                        const drawSuccess = await gameManager.pickCard(gameId, cpuAction.data.drawType, cpuAction.data.playerName);
                        if (drawSuccess) {
                          console.log(`CPU ${cpuAction.data.playerName} successfully played and drew replacement ${cpuAction.data.drawType}`);
                        }
                      }
                      
                      const playAndDrawGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', playAndDrawGameState);
                      
                      // SPECIAL RULE: If it's a MOSSE card, automatically attack
                      if (cpuAction.data.drawType === 'mosse' && playResult.card) {
                        console.log(`CPU ${cpuAction.data.playerName} played MOSSE - triggering automatic attack`);
                        
                        // Find enemy to attack
                        const currentGameState = gameManager.getSanitizedGameState(gameId);
                        const enemies = currentGameState?.field.filter((card: any) => 
                          card.owner !== cpuAction.data.playerName && 
                          (card.type === 'personaggi' || card.type === 'personaggi_speciali')
                        );
                        
                        if (enemies && enemies.length > 0) {
                          const target = enemies[0]; // Attack first enemy
                          
                          // Get card name for chat message
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
                          
                          const mosseName = getCardNameFromUrl(playResult.card.frontImage);
                          const targetName = getCardNameFromUrl(target.frontImage);
                          
                          // Emit chat message and attack
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-cpu-attack`,
                            playerName: cpuAction.data.playerName,
                            message: `Attacco automaticamente con "${mosseName}" contro ${targetName}!`,
                            timestamp: Date.now()
                          });
                          
                          // Trigger automatic attack
                          setTimeout(() => {
                            io.to(gameId).emit('mosse-attack', {
                              attackingCard: playResult.card,
                              targetCard: target,
                              playerName: cpuAction.data.playerName,
                              automatic: true
                            });
                          }, 800);
                        }
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
                        
                        const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
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

    socket.on('chat-message', async (data) => {
      const { playerName, message } = data;
      const gameId = gameManager.getPlayerGameId(socket.id);
      
      if (gameId) {
        // Broadcast the message to all players in the game
        io.to(gameId).emit('chat-message', {
          playerName,
          message,
          timestamp: Date.now()
        });

        // Check if any CPU players should respond to this message
        const game = gameManager.getGameState(gameId);
        if (game) {
          for (const pName in game.players) {
            const player = game.players[pName];
            if (player.isCPU && player.cpuInstance && pName !== playerName) {
              // Check if message is directed to this CPU or is a general command
              const isDirectedToCPU = message.toLowerCase().includes(pName.toLowerCase()) || 
                                     message.toLowerCase().includes('cpu');
              
              if (isDirectedToCPU) {
                console.log(`Processing CPU chat responses for: ${message}`);
                // First, check for special command functions (number generator, stars inquiry)
                const handled = await player.cpuInstance.handlePlayerMessage(message, playerName, game);
                
                if (handled) {
                  console.log(`CPU ${pName} handled command successfully via handlePlayerMessage`);
                  continue; // Skip AI processing if handled by special function
                }
                
                // If not handled by special function, fall back to AI/instruction processing
                console.log(`CPU ${pName} processing human chat: "${message}" from ${playerName}`);
                const response = await player.cpuInstance.processHumanChat(message, playerName);
                if (response) {
                  console.log(`CPU ${pName} responded via AI/Instruction`);
                }
              }
            }
          }
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

    socket.on('add-custom-cards', async ({ gameId, playerName, deckType, cards }) => {
      const playerGameId = gameManager.getPlayerGameId(socket.id);
      
      if (playerGameId === gameId) {
        const result = await gameManager.addCustomCards(gameId, deckType, cards, playerName);
        
        if (result.success) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          io.to(gameId).emit('cards-added', {
            playerName,
            deckType,
            count: cards.length,
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
          
          // Check for player elimination from character limit (PTI modifications)
          if (result && typeof result === 'object' && 'eliminationCheck' in result && result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via game instruction - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
          }
          
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
          
          // NEW: Handle show card instruction
          if (result && typeof result === 'object' && 'showCard' in result && result.showCard) {
            const showData: any = result.showCard;
            
            // Emit card-shown event to target player
            if (showData.targetSocketId) {
              io.to(showData.targetSocketId).emit('card-shown', {
                cardId: showData.cardId,
                fromPlayer: showData.showingPlayer,
                cardImage: showData.cardImage,
                message: `${showData.showingPlayer} ti ha mostrato la sua carta su richiesta`
              });
              
              console.log(`${showData.showingPlayer} showed card to ${showData.targetPlayer} via instruction`);
            }
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

    socket.on('mosse-attack', async ({ mosseCardId, targetCardId, attackerName, targetOwner, damageValue, isHandTarget, isFurtoAttack }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        console.log(`🗡️  DEFENSE-ENABLED MOSSE ATTACK: ${attackerName} → ${targetOwner} (damage: ${damageValue})`);
        
        // Get the card to check its frontImage for CPU restrictions
        const gameState = gameManager.getSanitizedGameState(gameId);
        const mosseCard = gameState?.field?.find((c: any) => c.id === mosseCardId);
        
        if (!mosseCard) {
          console.log(`MOSSE card ${mosseCardId} not found on field`);
          return;
        }

        // Validate damage input (preserve legacy validation)
        if (!damageValue || damageValue <= 0) {
          console.log(`Invalid damage value: ${damageValue}. Attack cancelled.`);
          socket.emit('attack-error', { 
            message: 'Inserisci un valore di danno valido!'
          });
          return;
        }
        
        // PRESERVE: CPU reuse restrictions (exactly as before)
        const playerData = gameState?.players?.[attackerName];
        const isCPUPlayer = playerData?.isCPU || attackerName.startsWith('CPU-');
        
        if (isCPUPlayer && gameManager.hasCardTypeBeenUsed(gameId, mosseCard.frontImage, attackerName)) {
          console.log(`${attackerName} attempted to reuse MOSSE card type ${mosseCard.frontImage} - attack blocked (CPU restriction)`);
          socket.emit('attack-blocked', { 
            message: 'I CPU non possono riutilizzare la stessa carta MOSSE nello stesso turno!',
            cardId: mosseCardId 
          });
          return;
        }
        
        // PRESERVE: Mark card type as used for CPU players
        if (isCPUPlayer) {
          gameManager.markCardTypeAsUsed(gameId, mosseCard.frontImage, attackerName);
        }
        
        // NEW: Execute defense-enabled MOSSE attack (unified emission)
        const attackResult = await gameManager.executeMossaAttack(
          gameId, 
          attackerName, 
          mosseCardId, 
          targetCardId,
          damageValue,
          isHandTarget || false  // NEW: Pass isHandTarget flag
        );

        if (!attackResult.success) {
          console.log(`Attack failed: ${attackResult.error}`);
          socket.emit('attack-error', { message: attackResult.error });
          return;
        }

        // PRESERVE: Broadcast attack animation to all players
        io.to(gameId).emit('card-attacked', {
          mosseCardId,
          targetCardId,
          attackerName,
          targetOwner,
          damageValue,
          timestamp: Date.now()
        });

        if (attackResult.result?.requiresDefenseResponse) {
          console.log(`🛡️ Defense system activated - waiting for ${targetOwner}'s response to attack ${attackResult.result.attackId}`);
          
          // Store damage value and attack details for later processing
          const pendingDefense = gameManager.getPendingDefense(gameId);
          if (pendingDefense) {
            pendingDefense.damage = damageValue; // Store the manually input damage
            pendingDefense.mosseCardId = mosseCardId; // Store MOSSE card for return
            (pendingDefense as any).isFurtoAttack = isFurtoAttack || false; // Store FURTO flag
            console.log(`📝 Stored damage value ${damageValue} for pending defense ${pendingDefense.attackId}${isFurtoAttack ? ' (FURTO - star stealing)' : ''}`);
          }
          
          // UNIFIED DEFENSE EMISSION: Use GameManager.emitDefenseRequest instead of direct emission
          const emissionSuccess = await gameManager.emitDefenseRequest(gameId, io);
          if (!emissionSuccess) {
            console.log(`⚠️ Failed to emit defense request - proceeding with damage`);
            await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false);
          }
          
          // Attack is pending defense response - processing will continue in defense:response handler
          return;
        }

        // If no defense required, process damage immediately
        await gameManager.processMosseDamage(gameId, attackerName, targetCardId, damageValue, mosseCardId, io, false, isHandTarget || false, isFurtoAttack || false);
        
        // NEW: If CPU attacked without defense, continue their turn
        const gameStateAfterAttack = gameManager.getGameState(gameId);
        if (gameStateAfterAttack && gameStateAfterAttack.players[attackerName]?.cpuInstance) {
          const cpuInstance = gameStateAfterAttack.players[attackerName].cpuInstance;
          cpuInstance.resolveAttack();
          console.log(`🎯 CPU ${attackerName}: Attack resolved - continuing turn...`);
          
          // CRITICAL: Immediately continue CPU turn after attack resolution
          setTimeout(async () => {
            try {
              const updatedState = gameManager.getSanitizedGameState(gameId);
              const nextAction = await cpuInstance.takeTurn(updatedState);
              
              if (nextAction) {
                console.log(`🎯 CPU ${attackerName}: Continuing turn with action:`, nextAction.type);
                await gameManager.processCPUTurn(gameId, attackerName, io);
              }
            } catch (error) {
              console.error(`Error continuing CPU ${attackerName} turn:`, error);
            }
          }, 100);
        }
      }
    });

    // PRODUCTION-READY DEFENSE RESPONSE: Enhanced security and validation
    socket.on('defense:response', async ({ attackId, defends, gameId: clientGameId }) => {
      const startTime = Date.now();
      const gameId = gameManager.getPlayerGameId(socket.id) || clientGameId;
      
      // SECURITY: Basic game validation
      if (!gameId) {
        console.warn(`[DEFENSE-RESPONSE] No game found for defense response`, {
          socketId: socket.id, attackId, defends, timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Game not found or you are not in a game', 
          code: 'NO_GAME_FOUND' 
        });
        return;
      }

      // SECURITY: Validate pending defense exists and matches attackId
      const pendingDefense = gameManager.getPendingDefense(gameId);
      if (!pendingDefense || pendingDefense.attackId !== attackId) {
        console.warn(`[DEFENSE-RESPONSE] Invalid or expired defense request`, {
          gameId, socketId: socket.id, attackId, defends, 
          hasPending: !!pendingDefense, 
          expectedAttackId: pendingDefense?.attackId,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Invalid or expired defense request', 
          code: 'INVALID_ATTACK_ID' 
        });
        return;
      }

      // SECURITY: Authorization - verify socket belongs to the defender
      const defenderSocketId = gameManager.getPlayerSocketId(gameId, pendingDefense.defender);
      if (socket.id !== defenderSocketId) {
        console.error(`[DEFENSE-RESPONSE] SECURITY VIOLATION: Unauthorized defense response`, {
          gameId, attackId, defends, socketId: socket.id, 
          expectedSocketId: defenderSocketId, defender: pendingDefense.defender,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'You are not authorized to respond to this defense request', 
          code: 'UNAUTHORIZED_DEFENDER' 
        });
        return;
      }

      // STRUCTURED LOGGING: Log successful validation
      console.log(`[DEFENSE-RESPONSE] Processing authorized defense response`, {
        gameId, attackId, defends, defender: pendingDefense.defender, 
        attacker: pendingDefense.attacker, socketId: socket.id,
        processingTime: Date.now() - startTime, timestamp: new Date().toISOString()
      });

      // Process using enhanced GameManager method with 'client' resolve source
      const success = await gameManager.processDefenseResponse(gameId, attackId, defends, io, 'client');
      
      if (!success) {
        console.warn(`[DEFENSE-RESPONSE] Failed to process defense response`, {
          gameId, attackId, defends, defender: pendingDefense.defender,
          timestamp: new Date().toISOString()
        });
        socket.emit('defense:error', { 
          message: 'Failed to process defense response', 
          code: 'PROCESSING_FAILED' 
        });
      } else {
        console.log(`[DEFENSE-RESPONSE] Defense response processed successfully`, {
          gameId, attackId, defends, defender: pendingDefense.defender,
          totalTime: Date.now() - startTime, timestamp: new Date().toISOString()
        });
      }
    });


    socket.on('remove-card-to-graveyard', ({ deckType, cardId, playerName, section }) => {
      const gameId = gameManager.getPlayerGameId(socket.id);
      if (gameId) {
        const result = gameManager.moveToGraveyard(gameId, cardId, playerName);
        if (result.success) {
          // ENHANCED ELIMINATION SYSTEM: Automatic elimination when limit reached
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit - automatically eliminating`);
            
            // Automatically eliminate player when they reach the character limit  
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Send message about elimination
              io.to(gameId).emit('chat-message', {
                id: `${Date.now()}-auto-elimination`,
                playerName: 'Sistema',
                message: `${playerName} è stato eliminato! Ha raggiunto il limite di personaggi nel cimitero.`,
                timestamp: Date.now()
              });
            }
          }
          
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
          
          // ALWAYS check for game victory after any graveyard change
          const winner = gameManager.checkForGameVictory(gameId);
          if (winner) {
            console.log(`Game victory detected! Winner: ${winner}`);
            io.to(gameId).emit('game-victory', { winner });
            // Award Rankiard points
            gameManager.completeMatch(gameId, winner);
          }
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
          const enemies = gameState.field.filter((card: any) => card.owner !== playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali'));
          
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
            
            // Emit "Ciao ciao" notification with cardType for death animation
            io.to(gameId).emit('card-to-graveyard', {
              cardName,
              playerName,
              cardType: result.cardType || 'personaggi'
            });
          }
          
          // CRITICAL FIX: Check if this elimination causes player elimination
          if (result.eliminationCheck) {
            console.log(`Player ${playerName} has reached character limit via eliminate-personaggi - automatically eliminating`);
            
            const eliminationSuccess = gameManager.markPlayerEliminated(gameId, playerName);
            if (eliminationSuccess) {
              console.log(`Player ${playerName} automatically eliminated due to character limit`);
              io.to(gameId).emit('player-eliminated', { playerName });
              
              // Check for game victory
              const winner = gameManager.checkForGameVictory(gameId);
              if (winner) {
                console.log(`Game won by: ${winner}`);
                io.to(gameId).emit('game-victory', { winner });
                // Award Rankiard points
                gameManager.completeMatch(gameId, winner);
              }
            }
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

    socket.on('remove-player', ({ gameId, playerToRemove, removedBy }) => {
      console.log(`[remove-player] ${removedBy} is removing ${playerToRemove} from game ${gameId}`);
      
      const success = gameManager.removePlayerFromGame(gameId, playerToRemove);
      
      if (success) {
        console.log(`[remove-player] Successfully removed ${playerToRemove} from game`);
        
        // Notify all players
        io.to(gameId).emit('player-removed', { 
          playerName: playerToRemove,
          removedBy 
        });
        
        // Send updated game state
        const gameState = gameManager.getSanitizedGameState(gameId);
        io.to(gameId).emit('game-state-update', gameState);
      } else {
        console.error(`[remove-player] Failed to remove ${playerToRemove} from game`);
      }
    });

    socket.on('start-game', ({ gameId, playerName, characterLimit }) => {
      const gameState = gameManager.getSanitizedGameState(gameId);
      if (gameState) {
        const playerOrder = gameManager.startGame(gameId, characterLimit);
        if (playerOrder) {
          io.to(gameId).emit('game-started', { playerOrder });
        }
      }
    });

    // PARASITIC CARD: Human player selects target for attachment
    socket.on('parasitic-attach-target', async ({ gameId, parasiticCardId, targetCardId, playerName }) => {
      try {
        console.log(`🦠 ${playerName} selecting target ${targetCardId} for parasitic card ${parasiticCardId}`);
        
        const attachResult = await gameManager.attachParasiticCard(gameId, parasiticCardId, targetCardId, playerName);
        
        if (attachResult.success && attachResult.attachment) {
          const gameState = gameManager.getSanitizedGameState(gameId);
          const targetCard = gameState?.field.find((c: any) => c.id === targetCardId);
          
          const getCardNameFromUrl = (url: string) => {
            const parts = url.split('/');
            const filename = parts[parts.length - 1];
            return filename.toLowerCase().replace(/\.(png|jpg|jpeg|gif|webp)$/i, '').replace(/[-_]/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          };
          const targetName = targetCard?.name || getCardNameFromUrl(targetCard?.frontImage || '');
          
          io.to(gameId).emit('parasitic-attached', {
            parasiticCardId,
            parasiticType: attachResult.attachment.parasiticCardName,
            targetCardId,
            targetName,
            ownerPlayer: playerName,
            targetPlayer: attachResult.attachment.targetPlayer
          });
          
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-parasitic-attach`,
            playerName: 'SISTEMA',
            message: `🦠 ${attachResult.attachment.parasiticCardName} di ${playerName} si è agganciato a ${targetName}!`,
            timestamp: Date.now()
          });
          
          const updatedState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', updatedState);
        } else {
          socket.emit('parasitic-attach-error', { message: attachResult.message || 'Attachment failed' });
        }
      } catch (error) {
        console.error('Error in parasitic-attach-target:', error);
        socket.emit('parasitic-attach-error', { message: 'Error attaching parasitic card' });
      }
    });

    socket.on('end-turn', async ({ gameId, playerName }) => {
      const nextPlayer = gameManager.endTurn(gameId, playerName);
      if (nextPlayer) {
        io.to(gameId).emit('next-turn', { nextPlayer });
        
        // Process parasitic card turn effects (PARASSITA drain, SAIBAIM explosion)
        const parasiticResults = await gameManager.processParasiticTurnEffects(
          gameId, 
          nextPlayer,
          (event, data) => io.to(gameId).emit(event, data)
        );
        
        // Handle SAIBAIM explosions
        if (parasiticResults.explosions.length > 0) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-saibaim-explosion`,
            playerName: 'SISTEMA',
            message: `💥 SAIBAIM è esploso! Due personaggi sono stati eliminati!`,
            timestamp: Date.now()
          });
        }
        
        // Handle PARASSITA drains
        for (const drain of parasiticResults.drains) {
          io.to(gameId).emit('chat-message', {
            id: `${Date.now()}-parassita-drain-${drain.cardId}`,
            playerName: 'SISTEMA',
            message: `🦠 PARASSITA ha drenato ${drain.ptiDrained} PTI dal bersaglio!`,
            timestamp: Date.now()
          });
        }
        
        // Send updated game state after parasitic effects
        if (parasiticResults.explosions.length > 0 || parasiticResults.drains.length > 0) {
          io.to(gameId).emit('game-state-update', gameManager.getSanitizedGameState(gameId));
        }
        
        // Process persistent damages at the START of the next player's turn
        // This applies recurring damage from cards like VIRUS, INFLUENZA, PUOZZA
        gameManager.processPersistentDamages(gameId, nextPlayer, io);
        
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
                    
                  case 'play-and-draw':
                    // MINKIARDS RULE: Play card and immediately draw replacement of same type
                    console.log(`CPU ${nextPlayer} play-and-draw: ${cpuAction.data.playCardId} -> draw ${cpuAction.data.drawType}`);
                    const playDrawResult = await gameManager.playCard(gameId, cpuAction.data.playCardId, cpuAction.data.playerName);
                    
                    if (playDrawResult.card) {
                      // Draw replacement of same type
                      const drawSuccess = await gameManager.pickCard(gameId, cpuAction.data.drawType, cpuAction.data.playerName);
                      if (drawSuccess) {
                        console.log(`CPU ${nextPlayer} successfully played and drew replacement ${cpuAction.data.drawType}`);
                      }
                    }
                    
                    const playDrawGameState = gameManager.getSanitizedGameState(gameId);
                    io.to(gameId).emit('game-state-update', playDrawGameState);
                    
                    if (playDrawResult.isPersonaggio && playDrawResult.card) {
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
                      
                      const cardName = playDrawResult.card.name || getCardNameFromUrl(playDrawResult.card.frontImage);
                      io.to(gameId).emit('personaggio-enters', {
                        cardName,
                        message: 'SI UNISCE ALLA ZUFFA',
                        playerName: nextPlayer,
                        cardImage: playDrawResult.card.frontImage
                      });
                    }
                    
                    // SPECIAL RULE: If it's a MOSSE card, automatically attack
                    if (cpuAction.data.drawType === 'mosse' && playDrawResult.card) {
                      console.log(`CPU ${nextPlayer} played MOSSE - triggering automatic attack`);
                      
                      // Find enemy to attack
                      const currentGameState = gameManager.getSanitizedGameState(gameId);
                      const enemies = currentGameState?.field.filter((card: any) => 
                        card.owner !== nextPlayer && 
                        (card.type === 'personaggi' || card.type === 'personaggi_speciali')
                      );
                      
                      if (enemies && enemies.length > 0) {
                        const target = enemies[0]; // Attack first enemy
                        
                        // Get card name for chat message
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
                        
                        const mosseName = getCardNameFromUrl(playDrawResult.card.frontImage);
                        const targetName = getCardNameFromUrl(target.frontImage);
                        
                        // Emit chat message and attack
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-cpu-attack`,
                          playerName: nextPlayer,
                          message: `Attacco automaticamente con "${mosseName}" contro ${targetName}!`,
                          timestamp: Date.now()
                        });
                        
                        // Trigger automatic attack
                        setTimeout(() => {
                          io.to(gameId).emit('mosse-attack', {
                            attackingCard: playDrawResult.card,
                            targetCard: target,
                            playerName: nextPlayer,
                            automatic: true
                          });
                        }, 800);
                      }
                    }
                    
                    // Turn ends automatically after playing a card
                    setTimeout(() => {
                      const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                      if (nextAfterCPU) {
                        io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        console.log(`Turn ended for ${nextPlayer} after play-and-draw, next: ${nextAfterCPU}`);
                      }
                    }, 1500);
                    return; // Return early to prevent generic end-turn
                    
                  case 'play-card':
                    const result = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    
                    // Draw replacement card of same type
                    if (result.card) {
                      const cardType = result.card.type;
                      if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                        const replacementDrawn = await gameManager.pickCard(gameId, cardType, cpuAction.data.playerName);
                        if (replacementDrawn) {
                          console.log(`CPU ${nextPlayer} drew replacement ${cardType} card after playing`);
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
                      
                      const cardName = result.card.name || getCardNameFromUrl(result.card.frontImage);
                      io.to(gameId).emit('personaggio-enters', {
                        cardName,
                        message: 'SI UNISCE ALLA ZUFFA',
                        playerName: nextPlayer,
                        cardImage: result.card.frontImage
                      });
                    }
                    
                    // CRITICAL FIX: If CPU played a MOSSE card, announce attack and wait for master to input damage
                    if (result.card && result.card.type === 'mosse') {
                      console.log(`🎯 CPU ${nextPlayer} played MOSSE card - announcing attack for master to input damage`);
                      
                      // Find enemy characters on field to attack
                      const currentGameState = gameManager.getSanitizedGameState(gameId);
                      const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                        c.owner !== nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                      ) || [];
                      
                      if (enemyCharacters.length > 0) {
                        // Select a target (prefer lowest PTI for strategic advantage)
                        const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                          const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                          const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                          return currentPti < bestPti ? current : best;
                        });
                        
                        const getMosseName = (url: string) => {
                          const parts = url.split('/');
                          const filename = parts[parts.length - 1];
                          return filename
                            .toLowerCase()
                            .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                            .replace(/[-_]/g, ' ')
                            .split(' ')
                            .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                            .join(' ');
                        };
                        
                        const mosseName = getMosseName(result.card.frontImage);
                        const targetName = getMosseName(targetCard.frontImage);
                        
                        // Send chat message about attack
                        io.to(gameId).emit('chat-message', {
                          id: `${Date.now()}-cpu-mosse-attack`,
                          playerName: nextPlayer,
                          message: `🎯 Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}! Master, inserisci il danno.`,
                          timestamp: Date.now()
                        });
                        
                        // Emit cpu-damage-request event to trigger the CPUDamageDialog
                        setTimeout(() => {
                          // Get the CPU's character on field for the attacker info
                          const cpuCharacter = currentGameState?.field?.find((c: any) => 
                            c.owner === nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                          );
                          
                          // Find the game creator (first human player)
                          const gameCreator = gameManager.getGameCreator(gameId);
                          
                          io.to(gameId).emit('cpu-damage-request', {
                            cpuName: nextPlayer,
                            cpuCharacterName: cpuCharacter ? getMosseName(cpuCharacter.frontImage) : nextPlayer,
                            mosseCardId: result.card!.id,
                            mosseCardName: mosseName,
                            mosseCardImage: result.card!.frontImage,
                            targetCardId: targetCard.id,
                            targetCardName: targetName,
                            targetOwner: targetCard.owner,
                            gameCreator: gameCreator || '',
                            timestamp: Date.now(),
                            attackerCharacter: cpuCharacter ? {
                              id: cpuCharacter.id,
                              name: getMosseName(cpuCharacter.frontImage),
                              image: cpuCharacter.frontImage,
                              notes: cpuCharacter.text || ''
                            } : null,
                            defenderCharacter: {
                              id: targetCard.id,
                              name: targetName,
                              image: targetCard.frontImage,
                              notes: targetCard.text || ''
                            },
                            isHandTarget: false
                          });
                          
                          console.log(`📢 CPU ${nextPlayer} cpu-damage-request emitted - waiting for master to input damage`);
                        }, 500);
                        
                        // Don't end turn or return card - wait for the attack resolution flow
                        return; // Return early, don't end turn yet
                      } else {
                        console.log(`⚠️ CPU ${nextPlayer} has MOSSE card but no enemy targets on field`);
                      }
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
                    }, 3000); // 3 seconds for manual return
                    break;
                    
                  case 'eliminate-dead-character':
                    // NEW: CPU eliminates character with PTI: 0
                    console.log(`CPU ${nextPlayer} eliminating dead character: ${cpuAction.data.cardId}`);
                    const eliminateResult = gameManager.moveToGraveyard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                    
                    if (eliminateResult.success) {
                      // Check for player elimination from character limit
                      if (eliminateResult.eliminationCheck) {
                        console.log(`Player ${cpuAction.data.playerName} has reached character limit via CPU elimination - automatically eliminating`);
                        
                        const eliminationSuccess = gameManager.markPlayerEliminated(gameId, cpuAction.data.playerName);
                        if (eliminationSuccess) {
                          console.log(`Player ${cpuAction.data.playerName} automatically eliminated due to character limit`);
                          io.to(gameId).emit('player-eliminated', { playerName: cpuAction.data.playerName });
                          
                          // Check for game victory
                          const winner = gameManager.checkForGameVictory(gameId);
                          if (winner) {
                            console.log(`Game won by: ${winner}`);
                            io.to(gameId).emit('game-victory', { winner });
                            // Award Rankiard points
                            gameManager.completeMatch(gameId, winner);
                          }
                        }
                      }
                      
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
                    break;
                    
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
                        }
                      }, 1000); // Brief delay to show the draw then play
                    }
                    break;
                }
                
                // NEW: Continue processing CPU actions until turn is complete  
                let continuousActions = 0;
                const maxActions = 10; // Prevent infinite loops
                
                const processContinuous = async () => {
                  if (continuousActions >= maxActions) {
                    console.log(`CPU ${nextPlayer} reached max actions limit, ending turn`);
                    const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                    if (nextAfterCPU) {
                      io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                    }
                    return;
                  }
                  
                  setTimeout(async () => {
                    const followUpAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
                    if (followUpAction && followUpAction.type !== 'end-turn') {
                      console.log(`CPU ${nextPlayer} continuing with action: ${followUpAction.type}`);
                      continuousActions++;
                      await processContinuous(); // Continue processing
                    } else {
                      // CPU is done or wants to end turn
                      console.log(`CPU ${nextPlayer} finished all actions, ending turn`);
                      const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                      if (nextAfterCPU) {
                        io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                      }
                    }
                  }, 1000);
                };
                
                await processContinuous();
                
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

    // Handle elimination confirmation
    socket.on('confirm-elimination', ({ gameId, playerName, confirmed }) => {
      if (confirmed) {
        // Player confirms elimination
        const success = gameManager.markPlayerEliminated(gameId, playerName);
        if (success) {
          io.to(gameId).emit('player-eliminated', { playerName });
          
          // Check for game victory
          const winner = gameManager.checkForGameVictory(gameId);
          if (winner) {
            io.to(gameId).emit('game-victory', { winner });
            // Award Rankiard points
            gameManager.completeMatch(gameId, winner);
          }
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);
        }
      }
      // If not confirmed, player continues playing and will get asked again next time
    });

    // Allow any player to force end the current turn
    socket.on('force-end-turn', async ({ gameId }) => {
      try {
        const game = gameManager.getGameState(gameId);
        if (!game) {
          socket.emit('force-end-turn-error', { message: 'Game not found' });
          return;
        }

        // Check if there's a valid turn order and current player
        if (!game.turnOrder || game.turnOrder.length === 0) {
          socket.emit('force-end-turn-error', { message: 'No turn order established' });
          return;
        }

        const currentPlayerName = game.turnOrder[game.currentTurnIndex];
        if (!currentPlayerName) {
          socket.emit('force-end-turn-error', { message: 'No current player found' });
          return;
        }

        console.log(`Force ending turn for ${currentPlayerName} (requested by player)`);

        // Force end the current player's turn (bypasses validation)
        const nextPlayer = gameManager.forceEndTurn(gameId);
        
        if (nextPlayer) {
          // Broadcast turn change to all players
          io.to(gameId).emit('next-turn', { nextPlayer });
          
          // Process parasitic card turn effects (PARASSITA drain, SAIBAIM explosion)
          const parasiticResults = await gameManager.processParasiticTurnEffects(
            gameId, 
            nextPlayer,
            (event, data) => io.to(gameId).emit(event, data)
          );
          
          // Handle SAIBAIM explosions
          if (parasiticResults.explosions.length > 0) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-saibaim-explosion`,
              playerName: 'SISTEMA',
              message: `💥 SAIBAIM è esploso! Due personaggi sono stati eliminati!`,
              timestamp: Date.now()
            });
          }
          
          // Handle PARASSITA drains
          for (const drain of parasiticResults.drains) {
            io.to(gameId).emit('chat-message', {
              id: `${Date.now()}-parassita-drain-${drain.cardId}`,
              playerName: 'SISTEMA',
              message: `🦠 PARASSITA ha drenato ${drain.ptiDrained} PTI dal bersaglio!`,
              timestamp: Date.now()
            });
          }
          
          // Process persistent damages at the START of the next player's turn
          gameManager.processPersistentDamages(gameId, nextPlayer, io);
          
          // Update game state
          const gameState = gameManager.getSanitizedGameState(gameId);
          io.to(gameId).emit('game-state-update', gameState);

          console.log(`Turn forcibly ended for ${currentPlayerName}, next player: ${nextPlayer}`);
          
          // Send success response
          socket.emit('force-end-turn-success', { 
            message: `Turn ended for ${currentPlayerName}`, 
            nextPlayer 
          });

          // Process next player's turn if they are a CPU
          if (nextPlayer?.startsWith('CPU-')) {
            console.log(`Processing automated turn for CPU: ${nextPlayer}`);
            setTimeout(async () => {
              try {
                const cpuAction = await gameManager.processCPUTurn(gameId, nextPlayer, io);
                if (cpuAction) {
                  console.log(`CPU ${nextPlayer} action:`, cpuAction.type);
                  // Handle CPU action processing (simplified for now)
                  switch (cpuAction.type) {
                    case 'play-card':
                      const playResult = await gameManager.playCard(gameId, cpuAction.data.cardId, cpuAction.data.playerName);
                      
                      // According to MINKIARDS rules: when you play a card, you automatically draw a replacement of the same type
                      if (playResult.card) {
                        const cardType = playResult.card.type;
                        if (cardType === 'personaggi' || cardType === 'mosse' || cardType === 'bonus' || cardType === 'personaggi_speciali') {
                          const replacementDrawn = await gameManager.pickCard(gameId, cardType, cpuAction.data.playerName);
                          if (replacementDrawn) {
                            console.log(`CPU ${nextPlayer} drew replacement ${cardType} card after playing`);
                          }
                        }
                      }
                      
                      const playGameState = gameManager.getSanitizedGameState(gameId);
                      io.to(gameId).emit('game-state-update', playGameState);
                      
                      // CRITICAL FIX: If CPU played a MOSSE card, announce attack and wait for master to input damage
                      if (playResult.card && playResult.card.type === 'mosse') {
                        console.log(`🎯 CPU ${nextPlayer} played MOSSE card (force-end-turn) - announcing attack for master to input damage`);
                        
                        // Find enemy characters on field to attack
                        const currentGameState = gameManager.getSanitizedGameState(gameId);
                        const enemyCharacters = currentGameState?.field?.filter((c: any) => 
                          c.owner !== nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                        ) || [];
                        
                        if (enemyCharacters.length > 0) {
                          // Select a target (prefer lowest PTI for strategic advantage)
                          const targetCard = enemyCharacters.reduce((best: any, current: any) => {
                            const bestPti = parseInt((best.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                            const currentPti = parseInt((current.text || '').match(/PTI:\s*(\d+)/i)?.[1] || '9999');
                            return currentPti < bestPti ? current : best;
                          });
                          
                          const getMosseName = (url: string) => {
                            const parts = url.split('/');
                            const filename = parts[parts.length - 1];
                            return filename
                              .toLowerCase()
                              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                              .replace(/[-_]/g, ' ')
                              .split(' ')
                              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };
                          
                          const mosseName = getMosseName(playResult.card.frontImage);
                          const targetName = getMosseName(targetCard.frontImage);
                          
                          // Send chat message about attack
                          io.to(gameId).emit('chat-message', {
                            id: `${Date.now()}-cpu-mosse-attack-fe`,
                            playerName: nextPlayer,
                            message: `🎯 Uso la carta MOSSE "${mosseName}" per attaccare ${targetName} di ${targetCard.owner}! Master, inserisci il danno.`,
                            timestamp: Date.now()
                          });
                          
                          // Emit cpu-damage-request event to trigger the CPUDamageDialog
                          const getMosseNameFE = (url: string) => {
                            const parts = url.split('/');
                            const filename = parts[parts.length - 1];
                            return filename
                              .toLowerCase()
                              .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
                              .replace(/[-_]/g, ' ')
                              .split(' ')
                              .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
                              .join(' ');
                          };
                          
                          setTimeout(() => {
                            // Get the CPU's character on field for the attacker info
                            const cpuCharacter = currentGameState?.field?.find((c: any) => 
                              c.owner === nextPlayer && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
                            );
                            
                            // Find the game creator (first human player)
                            const gameCreator = gameManager.getGameCreator(gameId);
                            
                            io.to(gameId).emit('cpu-damage-request', {
                              cpuName: nextPlayer,
                              cpuCharacterName: cpuCharacter ? getMosseNameFE(cpuCharacter.frontImage) : nextPlayer,
                              mosseCardId: playResult.card!.id,
                              mosseCardName: mosseName,
                              mosseCardImage: playResult.card!.frontImage,
                              targetCardId: targetCard.id,
                              targetCardName: targetName,
                              targetOwner: targetCard.owner,
                              gameCreator: gameCreator || '',
                              timestamp: Date.now(),
                              attackerCharacter: cpuCharacter ? {
                                id: cpuCharacter.id,
                                name: getMosseNameFE(cpuCharacter.frontImage),
                                image: cpuCharacter.frontImage,
                                notes: cpuCharacter.text || ''
                              } : null,
                              defenderCharacter: {
                                id: targetCard.id,
                                name: targetName,
                                image: targetCard.frontImage,
                                notes: targetCard.text || ''
                              },
                              isHandTarget: false
                            });
                            
                            console.log(`📢 CPU ${nextPlayer} cpu-damage-request emitted (force-end-turn) - waiting for master to input damage`);
                          }, 500);
                          
                          // Don't end turn or return card - wait for attack resolution
                          break;
                        } else {
                          console.log(`⚠️ CPU ${nextPlayer} has MOSSE card but no enemy targets on field`);
                        }
                      }
                      
                      // Default: end turn for non-MOSSE cards or if no targets
                      setTimeout(() => {
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        }
                      }, 1500);
                      break;
                      
                    case 'mosse-attack':
                      // Handle MOSSE attack for CPU - Execute using new defense system
                      console.log(`CPU ${nextPlayer} performing MOSSE attack with defense system`);
                      
                      // Use the new executeMossaAttack method that supports defense system
                      const defaultCPUDamage = cpuAction.data.damageValue || 150; // Default CPU damage value
                      const attackResult = await gameManager.executeMossaAttack(
                        gameId,
                        cpuAction.data.playerName,
                        cpuAction.data.mosseCardId,
                        cpuAction.data.targetCardId,
                        defaultCPUDamage
                      );
                      
                      if (attackResult.success) {
                        // CRITICAL: Emit defense:request if required
                        if (attackResult.result && attackResult.result.requiresDefenseResponse) {
                          console.log(`🛡️ Emitting defense:request for CPU attack`);
                          await gameManager.emitDefenseRequest(gameId, io);
                        }
                        
                        // Legacy card-attacked event for UI compatibility
                        const gameState = gameManager.getSanitizedGameState(gameId);
                        const targetCard = gameState.field.find((card: any) => card.id === cpuAction.data.targetCardId);
                        
                        let targetCardName = 'CARD';
                        if (targetCard && targetCard.frontImage) {
                          try {
                            const url = new URL(targetCard.frontImage);
                            const pathname = url.pathname;
                            const filename = pathname.split('/').pop() || '';
                            targetCardName = filename.replace(/\.[^/.]+$/, '').replace(/-/g, ' ').toUpperCase();
                          } catch {
                            targetCardName = 'CARD';
                          }
                        }
                        
                        io.to(gameId).emit('card-attacked', {
                          targetCardName: targetCardName,
                          fromPlayer: cpuAction.data.playerName,
                          toPlayer: cpuAction.data.targetOwner
                        });
                      } else {
                        console.error(`CPU ${nextPlayer} MOSSE attack failed: ${attackResult.error}`);
                      }
                      
                      // MANUAL RETURN: CPU must manually return MOSSE cards like humans
                      setTimeout(async () => {
                        console.log(`CPU ${nextPlayer} manually returning used MOSSE card to deck bottom`);
                        gameManager.returnToDeck(gameId, cpuAction.data.mosseCardId, cpuAction.data.playerName);
                        
                        const gameState = gameManager.getSanitizedGameState(gameId);
                        io.to(gameId).emit('game-state-update', gameState);
                        
                        // Draw replacement card
                        const pickResult = await gameManager.pickCard(gameId, 'mosse', cpuAction.data.playerName);
                        if (pickResult) {
                          console.log(`CPU ${nextPlayer} drew replacement MOSSE card`);
                          const pickGameState = gameManager.getSanitizedGameState(gameId);
                          io.to(gameId).emit('game-state-update', pickGameState);
                        }
                        
                        // End turn after completing action
                        setTimeout(() => {
                          const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                          if (nextAfterCPU) {
                            io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                          }
                        }, 1000);
                      }, 2000);
                      break;
                      
                    case 'pick-card':
                      // Handle card picking for CPU
                      const pickSuccess = await gameManager.pickCard(gameId, cpuAction.data.deckType, cpuAction.data.playerName);
                      if (pickSuccess) {
                        console.log(`CPU ${nextPlayer} picked ${cpuAction.data.deckType} card`);
                        const pickGameState = gameManager.getSanitizedGameState(gameId);
                        io.to(gameId).emit('game-state-update', pickGameState);
                      }
                      
                      setTimeout(() => {
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
                        }
                      }, 1500);
                      break;
                      
                    default:
                      // For other actions, just end turn after delay
                      setTimeout(() => {
                        const nextAfterCPU = gameManager.endTurn(gameId, nextPlayer);
                        if (nextAfterCPU) {
                          io.to(gameId).emit('next-turn', { nextPlayer: nextAfterCPU });
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
        } else {
          socket.emit('force-end-turn-error', { message: 'Failed to end turn' });
        }
        
      } catch (error) {
        console.error('Error in force-end-turn:', error);
        socket.emit('force-end-turn-error', { 
          message: `Error ending turn: ${error instanceof Error ? error.message : 'Unknown error'}` 
        });
      }
    });

    // Music synchronization events
    socket.on('music-action', ({ gameId, playerName, action, trackUrl, time, volume }) => {
      console.log(`🎵 Music action from ${playerName}:`, action, { trackUrl, time, volume });
      
      // Broadcast music control to all players in the game room
      io.to(gameId).emit('music-control', {
        action,
        trackUrl,
        time,
        volume
      });
    });

    // WebRTC Voice Chat events
    socket.on('voice-chat-join', ({ gameId, playerName }) => {
      console.log(`🎤 ${playerName} joined voice chat in ${gameId}`);
      
      // Create room if it doesn't exist
      if (!voiceChatRooms.has(gameId)) {
        voiceChatRooms.set(gameId, new Map());
      }
      
      const room = voiceChatRooms.get(gameId)!;
      
      // Get existing participants before adding new one
      const existingParticipants = Array.from(room.keys());
      
      // Add new participant
      room.set(playerName, socket.id);
      
      console.log(`🎤 Voice chat room ${gameId} participants:`, Array.from(room.keys()));
      
      // Send list of existing participants to the new joiner
      if (existingParticipants.length > 0) {
        socket.emit('voice-chat-existing-users', { participants: existingParticipants });
        console.log(`🎤 Sent existing participants to ${playerName}:`, existingParticipants);
      }
      
      // Notify all other players in the room that this player joined voice chat
      socket.to(gameId).emit('voice-chat-user-joined', { playerId: playerName });
    });

    socket.on('voice-chat-leave', ({ gameId, playerName }) => {
      console.log(`🎤 ${playerName} left voice chat in ${gameId}`);
      
      const room = voiceChatRooms.get(gameId);
      if (room) {
        room.delete(playerName);
        if (room.size === 0) {
          voiceChatRooms.delete(gameId);
        }
      }
      
      // Notify all other players in the room that this player left voice chat
      socket.to(gameId).emit('voice-chat-user-left', { playerId: playerName });
    });

    socket.on('webrtc-offer', ({ gameId, targetPlayerId, offer, fromPlayer }) => {
      console.log(`🎤 WebRTC offer from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send offer only to target player
          io.to(targetSocketId).emit('webrtc-offer', { fromPlayer, offer });
          console.log(`🎤 Sent offer to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('webrtc-answer', ({ gameId, targetPlayerId, answer, fromPlayer }) => {
      console.log(`🎤 WebRTC answer from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send answer only to target player
          io.to(targetSocketId).emit('webrtc-answer', { fromPlayer, answer });
          console.log(`🎤 Sent answer to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('webrtc-ice-candidate', ({ gameId, targetPlayerId, candidate, fromPlayer }) => {
      console.log(`🎤 ICE candidate from ${fromPlayer} to ${targetPlayerId}`);
      
      // Get target player's socket ID
      const room = voiceChatRooms.get(gameId);
      if (room) {
        const targetSocketId = room.get(targetPlayerId);
        if (targetSocketId) {
          // Send ICE candidate only to target player
          io.to(targetSocketId).emit('webrtc-ice-candidate', { fromPlayer, candidate });
          console.log(`🎤 Sent ICE candidate to ${targetPlayerId} (socket: ${targetSocketId})`);
        } else {
          console.log(`🎤 Target player ${targetPlayerId} not found in voice chat`);
        }
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      
      // Remove from voice chat rooms
      voiceChatRooms.forEach((room, gameId) => {
        const entries = Array.from(room.entries());
        for (const [playerName, socketId] of entries) {
          if (socketId === socket.id) {
            room.delete(playerName);
            console.log(`🎤 Removed ${playerName} from voice chat room ${gameId} (disconnected)`);
            // Notify others that player left
            socket.to(gameId).emit('voice-chat-user-left', { playerId: playerName });
            break;
          }
        }
        if (room.size === 0) {
          voiceChatRooms.delete(gameId);
        }
      });
      
      gameManager.removePlayer(socket.id);
    });
  });

  // ============================================
  // CUSTOM CARDS CRUD ENDPOINTS
  // ============================================
  
  // Get all permanent custom cards
  app.get('/api/custom-cards', async (req, res) => {
    try {
      const deckType = req.query.deckType as string | undefined;
      
      let cards;
      if (deckType) {
        cards = await db.select().from(customCards).where(eq(customCards.deckType, deckType));
      } else {
        cards = await db.select().from(customCards);
      }
      
      res.json({ success: true, cards });
    } catch (error) {
      console.error('Error fetching custom cards:', error);
      res.status(500).json({ success: false, error: 'Failed to fetch custom cards' });
    }
  });
  
  // Update a custom card
  app.patch('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const { name, pti, stars } = req.body;
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const updateData: Record<string, any> = {};
      if (name !== undefined && typeof name === 'string' && name.trim()) {
        updateData.name = name.trim();
      }
      if (pti !== undefined) {
        updateData.pti = pti === null || pti === '' ? null : parseInt(pti);
      }
      if (stars !== undefined) {
        updateData.stars = stars === null || stars === '' ? null : parseInt(stars);
      }
      
      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ success: false, error: 'No valid fields to update' });
      }
      
      const result = await db.update(customCards)
        .set(updateData)
        .where(eq(customCards.id, cardId))
        .returning();
      
      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      res.json({ success: true, card: result[0] });
    } catch (error) {
      console.error('Error updating custom card:', error);
      res.status(500).json({ success: false, error: 'Failed to update custom card' });
    }
  });
  
  // Delete a custom card
  app.delete('/api/custom-cards/:id', async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      
      if (isNaN(cardId)) {
        return res.status(400).json({ success: false, error: 'Invalid card ID' });
      }
      
      const result = await db.delete(customCards)
        .where(eq(customCards.id, cardId))
        .returning();
      
      if (!result || result.length === 0) {
        return res.status(404).json({ success: false, error: 'Card not found' });
      }
      
      res.json({ success: true, message: 'Card deleted successfully' });
    } catch (error) {
      console.error('Error deleting custom card:', error);
      res.status(500).json({ success: false, error: 'Failed to delete custom card' });
    }
  });

  // DEBUG ENDPOINT: Add CPU to test MOSSE sequence  
  app.post('/api/debug/add-cpu-player', async (req, res) => {
    try {
      const { gameId } = req.body;
      console.log(`🎯 DEBUG: Adding CPU to game ${gameId}`);
      
      const cpuName = await gameManager.addCPUPlayer(gameId);
      const gameState = gameManager.getSanitizedGameState(gameId);
      
      // Broadcast to all clients in that game
      io.to(gameId).emit('game-state-update', gameState);
      io.to(gameId).emit('player-joined', { playerName: cpuName });
      
      console.log(`🎯 DEBUG: CPU ${cpuName} added successfully to game ${gameId}`);
      res.json({ success: true, cpuName, gameId });
    } catch (error) {
      console.error('🎯 DEBUG: Error adding CPU:', error);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return httpServer;
}
