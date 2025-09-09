import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CardAnalysis {
  cardType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali' | string;
  name: string;
  points?: number;
  stars?: number;
  damage?: number;
  effect?: string;
  powers?: string | string[];
  canCounter?: boolean;
  canBeCountered?: boolean;
  powerCost?: number;
  transformations?: {
    evolution?: string;
    taroccata?: string;
    super?: string;
    supreme?: string;
  };
  // New detailed analysis fields
  pti?: number;
  baseDamage?: number;
  characterSpecific?: string;
}

interface GameAnalysis {
  myCharacter: any;
  enemyCharacters: any[];
  handCards: any[];
  fieldSituation: string;
  recommendedAction: {
    type: 'play_card' | 'switch_character' | 'attack' | 'defend' | 'buy_power';
    cardId?: string;
    target?: string;
    reasoning: string;
  };
}

export class CPUPlayer {
  private playerName: string;
  private gameId: string;
  private waitingForResponse: boolean = false;
  private currentQuestion: string = '';
  private conversationHistory: Array<{type: 'question' | 'answer', content: string, timestamp: number}> = [];
  private socketEmitter: any;
  private lastAdvice: any = null;
  private openingSequenceState: {
    phase: 'pick-initial' | 'play-character' | 'pick-replacement' | 'completed';
    pickedCards: string[];
  } = { phase: 'pick-initial', pickedCards: [] };
  
  private openaiApiKey: string | undefined;

  constructor(playerName: string, gameId: string, socketEmitter?: any) {
    this.playerName = playerName;
    this.gameId = gameId;
    this.socketEmitter = socketEmitter;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  // Reset opening sequence for new game
  resetOpeningSequence() {
    this.openingSequenceState = { 
      phase: 'pick-initial', 
      pickedCards: [] 
    };
    console.log(`CPU ${this.playerName} opening sequence reset for new game`);
  }

  setSocketEmitter(emitter: any) {
    this.socketEmitter = emitter;
  }

  get isWaitingForResponse(): boolean {
    return this.waitingForResponse;
  }

  // Detailed card analysis with MINKIARDS rules
  async analyzeCardImageDetailed(imageUrl: string, cardType: string): Promise<CardAnalysis> {
    try {
      if (!this.openaiApiKey) {
        return { 
          name: this.getCardNameFromUrl(imageUrl), 
          cardType, 
          effect: 'No analysis available',
          pti: 0,
          stars: 0,
          powers: '',
          baseDamage: 0
        };
      }

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Analyze this MINKIARDS card image following these rules:

            For PERSONAGGI cards, identify:
            - Name of character
            - PTI (points/life) - number on bottom left
            - Stars (stelle) - on bottom right  
            - Powers (red text) - special abilities
            - Transformation markers (colored dots: E=evolution, S=super, PS=supreme)

            For MOSSE cards, identify:
            - Name of move
            - Base damage value (negative number like -80)
            - Special effects or conditions
            - Counter symbols (+ green = can counter, - red = can be countered)
            - Character-specific bonuses

            For BONUS cards, identify:
            - Name and effect
            - PTI bonuses (+numbers)
            - Special powers granted
            - Game dynamic changes

            Respond with JSON: {
              "name": "card name",
              "cardType": "${cardType}",
              "effect": "detailed effect description",
              "pti": number (for characters),
              "stars": number (for characters), 
              "powers": ["list of powers"],
              "baseDamage": number (for moves, negative),
              "canCounter": boolean,
              "canBeCountered": boolean,
              "characterSpecific": "character name if applicable"
            }`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this ${cardType} card following MINKIARDS rules:`
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
      return {
        name: analysis.name || this.getCardNameFromUrl(imageUrl),
        cardType,
        effect: analysis.effect || 'Standard effect',
        pti: analysis.pti || 0,
        stars: analysis.stars || 0,
        powers: Array.isArray(analysis.powers) ? analysis.powers.join(', ') : (analysis.powers || ''),
        baseDamage: analysis.baseDamage || 0,
        canCounter: analysis.canCounter || false,
        canBeCountered: analysis.canBeCountered !== false,
        characterSpecific: analysis.characterSpecific
      };

    } catch (error) {
      console.error('Error analyzing card image:', error);
      return { 
        name: this.getCardNameFromUrl(imageUrl), 
        cardType, 
        effect: 'Analysis failed',
        pti: 0,
        stars: 0,
        powers: '',
        baseDamage: 0
      };
    }
  }

  // Analyze a card image using OpenAI Vision API
  async analyzeCardImage(imageUrl: string): Promise<CardAnalysis> {
    try {
      // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS card game analyzer following the official rules. Extract precise information:

PERSONAGGI CARDS:
- Points (PTI): Look for numbers in bottom left (e.g., "2800", "1500")
- Stars: Look for star symbols in bottom right (count them: ⭐⭐⭐ = 3 stars)
- Name: Character name in the header
- Powers: Red text describing special abilities
- Transformations: Colored dots with letters (E=evolution, T=taroccata, S=super, PS=supreme)

MOSSE CARDS:
- Damage value: Negative number (e.g., "-80", "-120")
- Counter indicators: + green (can counter), - red (can be countered)
- Special conditions: Look for "Per tutti" or specific character restrictions

BONUS CARDS:
- Effects: Special abilities or power-ups
- Conditions: When/how they can be used

Extract EXACT numbers and text as they appear on the card. Return JSON format only.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Read this MINKIARDS card carefully and extract ALL visible information, especially PTI and stars for characters, damage values for moves:"
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
        max_tokens: 700
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      console.log(`CPU ${this.playerName} analyzed card ${imageUrl}:`, analysis);
      return analysis;
    } catch (error) {
      console.error('Error analyzing card image:', error);
      return {
        cardType: 'personaggi',
        name: 'Unknown Card',
        points: 1000,
        stars: 1
      };
    }
  }

  // Auto-update card notes when CPU plays a PERSONAGGI card
  async autoUpdateCardNotes(cardId: string, cardImage: string, gameState: any) {
    try {
      console.log(`CPU ${this.playerName} auto-updating notes for card ${cardId}`);
      
      // Analyze the card image to extract PTI and stars
      const cardAnalysis = await this.analyzeCardImage(cardImage);
      
      if (cardAnalysis.cardType === 'personaggi' || cardAnalysis.cardType === 'personaggi_speciali') {
        const pti = cardAnalysis.points || 1000;
        const stars = cardAnalysis.stars || 1;
        const powers = cardAnalysis.effect || cardAnalysis.powers || '';
        
        // Create comprehensive notes
        const notes = `PTI: ${pti} | Stelle: ${stars}` + (powers ? ` | Poteri: ${powers}` : '');
        
        console.log(`CPU ${this.playerName} setting notes for ${cardAnalysis.name}: ${notes}`);
        
        // Update the card notes on the server
        if (this.socketEmitter) {
          this.socketEmitter.emit('update-card-notes', {
            cardId: cardId,
            notes: notes,
            playerName: this.playerName
          });
        }
        
        // Send chat message about the analysis
        this.sendChatMessage(`Ho analizzato ${cardAnalysis.name}: ${pti} PTI, ${stars} stelle!`);
        
        return { pti, stars, powers, name: cardAnalysis.name };
      }
    } catch (error) {
      console.error(`Error auto-updating notes for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Calculate and apply damage when a character is attacked
  async handleCharacterAttacked(attackedCardId: string, damageValue: number, attackerStars: number, gameState: any) {
    try {
      console.log(`CPU ${this.playerName} handling character attack: card ${attackedCardId}, damage ${damageValue}, attacker stars ${attackerStars}`);
      
      // Find the attacked card in the field
      const attackedCard = gameState.field.find((card: any) => card.id === attackedCardId && card.owner === this.playerName);
      
      if (!attackedCard) {
        console.log(`CPU ${this.playerName}: Attacked card not found or not owned by CPU`);
        return;
      }
      
      // Calculate total damage: damage value × attacker stars
      const totalDamage = Math.abs(damageValue) * attackerStars;
      
      // Parse current PTI and stars from notes or use defaults
      let currentPTI = 1000; // default
      let attackedStars = 1; // default stars for damage calculation
      if (attackedCard.notes || attackedCard.text) {
        const notes = attackedCard.notes || attackedCard.text || '';
        const ptiMatch = notes.match(/PTI:\s*(\d+)/);
        const starsMatch = notes.match(/Stelle:\s*(\d+)/);
        
        if (ptiMatch) {
          currentPTI = parseInt(ptiMatch[1]);
        }
        if (starsMatch) {
          attackedStars = parseInt(starsMatch[1]);
        }
      }
      
      // Calculate new PTI after damage
      const newPTI = Math.max(0, currentPTI - totalDamage);
      
      console.log(`CPU ${this.playerName}: ${attackedCard.id} PTI: ${currentPTI} → ${newPTI} (damage: ${totalDamage})`);
      
      // Update the notes with new PTI, preserving stars and powers
      let updatedNotes = (attackedCard.notes || attackedCard.text || '').replace(/PTI:\s*\d+/, `PTI: ${newPTI}`);
      
      // If notes don't exist, create them with stars
      if (!updatedNotes.includes('Stelle:')) {
        updatedNotes = updatedNotes.replace(/PTI:\s*\d+/, `PTI: ${newPTI} | Stelle: ${attackedStars}`);
      }
      
      // Send update to server
      if (this.socketEmitter) {
        this.socketEmitter.emit('update-card-notes', {
          cardId: attackedCardId,
          notes: updatedNotes,
          playerName: this.playerName
        });
      }
      
      // Send chat message about the damage
      if (newPTI > 0) {
        this.sendChatMessage(`Il mio personaggio ha subito ${totalDamage} danni! PTI rimanenti: ${newPTI}`);
      } else {
        this.sendChatMessage(`Nooo! Il mio personaggio è stato eliminato con ${totalDamage} danni!`);
      }
      
      return { newPTI, totalDamage, eliminated: newPTI === 0 };
      
    } catch (error) {
      console.error(`Error handling character attack for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Monitor and analyze move cards to extract damage values  
  async analyzeMoveCard(cardImage: string) {
    try {
      const analysis = await this.analyzeCardImage(cardImage);
      
      if (analysis.cardType === 'mosse') {
        const damage = analysis.damage || 0;
        console.log(`CPU ${this.playerName} analyzed move card: ${analysis.name}, damage: ${damage}`);
        return { name: analysis.name, damage, canCounter: analysis.canCounter, canBeCountered: analysis.canBeCountered };
      }
    } catch (error) {
      console.error(`Error analyzing move card for CPU ${this.playerName}:`, error);
    }
    
    return null;
  }

  // Reference to game manager for checking used cards
  private gameManager: any = null;
  
  setGameManager(gameManager: any) {
    this.gameManager = gameManager;
  }

  // Analyze current game state and decide next move with conversation context
  async analyzeGameState(gameState: any): Promise<GameAnalysis> {
    try {
      // Get CPU player's information
      const cpuPlayer = gameState.players[this.playerName];
      if (!cpuPlayer) {
        throw new Error('CPU player not found in game state');
      }

      // Find CPU's character on the field
      const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName);
      
      // Find enemy characters on the field
      const enemyCharacters = gameState.field.filter((card: any) => 
        card.owner !== this.playerName && card.type === 'personaggi'
      );

      // Analyze hand cards with detailed MINKIARDS rules
      const handAnalyses = await Promise.all(
        cpuPlayer.hand.map((card: any) => this.analyzeCardImageDetailed(card.frontImage, card.type))
      );

      // Get conversation context for enhanced decision making
      const conversationContext = this.getConversationContext();

      // Analyze field cards for strategic planning
      const myFieldCards = gameState.field.filter((c: any) => c.owner === this.playerName);
      const fieldAnalyses = await Promise.all(
        myFieldCards.map((card: any) => this.analyzeCardImageDetailed(card.frontImage, card.type))
      );

      // Create detailed game situation description
      const situationDesc = `
        MY CHARACTER: ${myCharacter ? `${this.getCardNameFromUrl(myCharacter.frontImage)} (PTI: ${myCharacter.text || 'unknown'}, Stars: unknown)` : 'NONE - MUST PLAY ONE!'}
        ENEMY CHARACTERS: ${enemyCharacters.map((c: any) => `${this.getCardNameFromUrl(c.frontImage)} (Owner: ${c.owner})`).join(', ')}
        MY HAND: ${handAnalyses.map(a => `${a.name} (${a.cardType}) - ${a.effect || 'Standard effect'}`).join(', ')}
        MY FIELD CARDS: ${fieldAnalyses.map(a => `${a.name} (${a.cardType})`).join(', ')}
        TOTAL CARDS ON FIELD: ${gameState.field.length}
        CONVERSATION CONTEXT: ${conversationContext || 'Nessuna conversazione precedente'}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS player that can communicate in Italian. Based on the complete game rules:
            
            CORE RULES:
            - WITHOUT a character (personaggio) on field, you CANNOT perform any actions
            - Goal: Eliminate enemy characters by reducing their PTI (points) to 0
            - ONE card per turn OR character substitution (not both)
            - When placing a character, immediately draw another of same type
            
            CHARACTERS (PERSONAGGI):
            - PTI (points) = character's life/health
            - Stars (stelle) = damage multiplier for moves
            - Powers can be bought from "Banca dei poteri" by spending PTI
            - Multiple powers cost exponentially more (2x, 3x, 4x, etc.)
            - Can substitute field character with hand character (costs your turn)
            
            MOVES (MOSSE):
            - Damage = base value × attacker's stars
            - Cannot use moves if character has 0 stars
            - Can counter/block attacks with equal/higher damage moves
            - After use, card returns to bottom of deck
            - Must announce target before using
            
            BONUS CARDS:
            - Can strengthen your characters (+PTI, +powers, etc.)
            - Can change game dynamics (shields, special effects)
            - Apply only to your own characters unless stated otherwise
            
            CARD USAGE SEQUENCE:
            1. Play card on field first
            2. Use the card for its effect
            3. Card returns to its deck
            4. Automatically draw replacement of same type
            
            STRATEGIC CONSIDERATIONS:
            - Balance PTI spending on powers vs survival
            - Counter-attack opportunities with green (+) moves
            - Timing of shields and defensive bonuses
            - Character switching for better stats/powers
            
            Consider previous conversation with human players to adapt your strategy.
            If humans have given you specific instructions or clarifications, prioritize those.
            
            Analyze the current situation and recommend the best action. Consider:
            1. Do I have a character on field? If not, MUST play one immediately
            2. Can I deal lethal damage to eliminate an enemy character?
            3. Should I strengthen my character with bonus cards (+PTI)?
            4. Should I buy powers from "Banca dei poteri" using PTI?
            5. Do I need defensive measures (shields, blocks)?
            6. Should I switch to a stronger character from hand?
            7. Can I counter-attack with higher damage moves?
            8. Are there special card effects I should utilize?
            9. Any specific human guidance from previous conversation?
            
            Remember: Only ONE action per turn - either play/use a card OR switch characters.
            All moves must be calculated: base damage × my character's stars.
            
            Respond with JSON containing your detailed analysis and recommended action.`
          },
          {
            role: "user",
            content: `Current game state: ${situationDesc}
            
            Available actions:
            - Play a card from hand
            - Switch character (if I have one in hand)
            - Buy a power (if my character has enough points)
            
            What should I do and why? Consider any previous human guidance.`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 300
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        myCharacter,
        enemyCharacters,
        handCards: cpuPlayer.hand,
        fieldSituation: situationDesc,
        recommendedAction: analysis.recommendedAction || {
          type: 'play_card',
          reasoning: 'Default action - play first available card'
        }
      };

    } catch (error) {
      console.error('Error analyzing game state:', error);
      // Fallback strategy
      return {
        myCharacter: null,
        enemyCharacters: [],
        handCards: [],
        fieldSituation: 'Error analyzing game',
        recommendedAction: {
          type: 'play_card',
          reasoning: 'Fallback action due to analysis error'
        }
      };
    }
  }

  // Execute the decided action
  async executeAction(gameState: any, action: GameAnalysis['recommendedAction']) {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) {
      console.log(`CPU ${this.playerName} not found in game state`);
      return null;
    }
    
    if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
      console.log(`CPU ${this.playerName} has no cards in hand`);
      return null;
    }

    console.log(`CPU ${this.playerName} executing action: ${action.type}, has ${cpuPlayer.hand.length} cards`);

    switch (action.type) {
      case 'play_card':
        // Play the specified card or the first available card
        let cardToPlay = null;
        
        if (action.cardId) {
          cardToPlay = cpuPlayer.hand.find((c: any) => c.id === action.cardId);
        }
        
        if (!cardToPlay && cpuPlayer.hand.length > 0) {
          cardToPlay = cpuPlayer.hand[0];
        }
        
        if (cardToPlay) {
          console.log(`CPU ${this.playerName} playing card: ${cardToPlay.id}`);
          
          // Auto-analyze PERSONAGGI cards when played
          if ((cardToPlay.type === 'personaggi' || cardToPlay.type === 'personaggi_speciali') && cardToPlay.frontImage) {
            // Schedule auto-update after a delay to allow the card to be played first
            setTimeout(async () => {
              await this.autoUpdateCardNotes(cardToPlay.id, cardToPlay.frontImage, gameState);
            }, 2000);
          }
          
          return {
            type: 'play-card',
            data: {
              cardId: cardToPlay.id,
              playerName: this.playerName
            }
          };
        }
        break;

      case 'attack':
        // Check if we have a MOSSE card on the field to use for attack
        const mosseOnField = gameState.field.find((c: any) => 
          c.owner === this.playerName && c.type === 'mosse'
        );
        const targetCard = gameState.field.find((c: any) => c.id === action.target);
        
        if (mosseOnField && targetCard) {
          // Check if this MOSSE card type has already been used this turn
          if (this.gameManager && this.gameManager.hasCardTypeBeenUsed(gameState.id, mosseOnField.frontImage, this.playerName)) {
            console.log(`CPU ${this.playerName}: MOSSE card ${mosseOnField.frontImage} already used this turn, cannot attack`);
            this.sendChatMessage(`Non posso riutilizzare la stessa carta MOSSE nello stesso turno!`);
            
            // Try to play a different MOSSE card from hand instead
            const unusedMoveCard = cpuPlayer.hand.find((c: any) => 
              c.type === 'mosse' && 
              (!this.gameManager || !this.gameManager.hasCardTypeBeenUsed(gameState.id, c.frontImage, this.playerName))
            );
            
            if (unusedMoveCard) {
              const cardName = this.getCardNameFromUrl(unusedMoveCard.frontImage);
              this.sendChatMessage(`Gioco una carta MOSSE diversa: "${cardName}".`);
              
              return {
                type: 'play-card',
                data: {
                  cardId: unusedMoveCard.id,
                  playerName: this.playerName
                }
              };
            } else {
              this.sendChatMessage(`Non ho altre carte MOSSE disponibili. Passo il turno.`);
              return null;
            }
          }
          
          // Use the MOSSE card that's already on the field for attack
          const cardName = this.getCardNameFromUrl(mosseOnField.frontImage);
          const targetName = this.getCardNameFromUrl(targetCard.frontImage);
          
          this.sendChatMessage(`Uso la carta MOSSE "${cardName}" per attaccare ${targetName}!`);
          
          // Emit the attack immediately
          if (this.socketEmitter) {
            this.socketEmitter.emit('mosse-attack', {
              mosseCardId: mosseOnField.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner
            });
          }
          
          return {
            type: 'mosse-attack',
            data: {
              mosseCardId: mosseOnField.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner,
              cardName,
              targetName
            }
          };
        } else {
          // Need to play a MOSSE card first from hand, but check if it's already been used
          const unusedMoveCard = cpuPlayer.hand.find((c: any) => 
            c.type === 'mosse' && 
            (!this.gameManager || !this.gameManager.hasCardTypeBeenUsed(gameState.id, c.frontImage, this.playerName))
          );
          
          if (unusedMoveCard) {
            const cardName = this.getCardNameFromUrl(unusedMoveCard.frontImage);
            this.sendChatMessage(`Prima devo giocare la carta MOSSE "${cardName}" sul campo.`);
            
            return {
              type: 'play-card',
              data: {
                cardId: unusedMoveCard.id,
                playerName: this.playerName
              }
            };
          } else {
            this.sendChatMessage(`Tutte le mie carte MOSSE sono già state usate questo turno.`);
            return null;
          }
        }
        break;

      case 'switch_character':
        // Switch to a character from hand
        const characterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi');
        if (characterCard) {
          console.log(`CPU ${this.playerName} switching to character: ${characterCard.id}`);
          return {
            type: 'play-card',
            data: {
              cardId: characterCard.id,
              playerName: this.playerName
            }
          };
        }
        break;
    }

    console.log(`CPU ${this.playerName} could not execute action, returning null`);
    return null;
  }

  // Send chat message to game
  sendChatMessage(message: string) {
    if (this.socketEmitter) {
      const chatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        playerName: this.playerName,
        message,
        timestamp: Date.now()
      };
      this.socketEmitter.to(this.gameId).emit('chat-message', chatMessage);
      console.log(`CPU ${this.playerName} says: ${message}`);
    }
  }

  // Check if CPU needs clarification about a card or situation
  async needsClarification(gameState: any, cardAnalysis?: CardAnalysis): Promise<{needsClarification: boolean, question: string}> {
    if (this.waitingForResponse) {
      return { needsClarification: false, question: '' };
    }

    try {
      const situation = cardAnalysis ? 
        `Sto analizzando la carta "${cardAnalysis.name}" con effetto: "${cardAnalysis.effect || 'Nessun effetto speciale rilevato'}"` :
        `Sto valutando la situazione di gioco attuale`;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Sei un CPU che gioca a MINKIARDS. Devi decidere se hai bisogno di chiarimenti dal giocatore umano.
            
            Fai domande quando:
            - L'effetto di una carta non è chiaro dalle regole standard
            - Ci sono ambiguità su come applicare un potere o trasformazione
            - Non sei sicuro dell'interpretazione di una situazione di gioco
            - Vuoi confermare una strategia prima di procedere
            
            NON fare domande per:
            - Azioni semplici come giocare carte base
            - Regole standard che già conosci
            - Situazioni evidenti
            
            Rispondi con JSON: {"needsClarification": boolean, "question": "domanda in italiano"}
            
            Storia conversazione precedente: ${JSON.stringify(this.conversationHistory.slice(-3))}`
          },
          {
            role: "user",
            content: `${situation}
            
            Giocatori in partita: ${Object.keys(gameState.players).join(', ')}
            Mie carte in mano: ${gameState.players[this.playerName]?.hand?.length || 0}
            Carte sul campo: ${gameState.field?.length || 0}
            
            Ho bisogno di chiarimenti prima di procedere?`
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content || '{"needsClarification": false, "question": ""}');
      return result;
    } catch (error) {
      console.error('Error checking clarification need:', error);
      return { needsClarification: false, question: '' };
    }
  }

  // Process human response to CPU question
  processHumanResponse(response: string) {
    if (this.waitingForResponse && this.currentQuestion) {
      this.conversationHistory.push({
        type: 'answer',
        content: response,
        timestamp: Date.now()
      });
      
      this.waitingForResponse = false;
      this.currentQuestion = '';
      
      // Send confirmation message
      this.sendChatMessage(`Grazie per la spiegazione! Ora procedo con la mia mossa.`);
      return true;
    }
    return false;
  }

  // Ask a question and wait for response
  async askQuestion(question: string): Promise<boolean> {
    this.currentQuestion = question;
    this.waitingForResponse = true;
    
    this.conversationHistory.push({
      type: 'question',
      content: question,
      timestamp: Date.now()
    });
    
    this.sendChatMessage(question);
    return true;
  }

  // Get context from conversation history for decision making
  getConversationContext(): string {
    return this.conversationHistory
      .slice(-5) // Last 5 exchanges
      .map(entry => `${entry.type === 'question' ? 'CPU ha chiesto' : 'Umano ha risposto'}: ${entry.content}`)
      .join('\n');
  }

  // Simple game analysis without AI (fallback)
  analyzeGameStateSimple(gameState: any): GameAnalysis {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) {
      return this.getDefaultAnalysis();
    }

    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && card.type === 'personaggi');
    const enemyCharacters = gameState.field.filter((card: any) => card.owner !== this.playerName && card.type === 'personaggi');

    // Simple strategy: 
    // 1. Play a character if I don't have one
    // 2. Play a move/bonus card if I have a character
    // 3. Otherwise just play any card
    let recommendedAction;

    if (!myCharacter) {
      // Need a character
      const characterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi');
      if (characterCard) {
        recommendedAction = {
          type: 'play_card' as const,
          cardId: characterCard.id,
          reasoning: 'Ho bisogno di un personaggio in campo'
        };
      } else {
        recommendedAction = {
          type: 'play_card' as const,
          reasoning: 'Gioco una carta qualsiasi'
        };
      }
    } else {
      // I have a character, play strategically
      const moveCard = cpuPlayer.hand.find((c: any) => c.type === 'mosse');
      const bonusCard = cpuPlayer.hand.find((c: any) => c.type === 'bonus');
      
      if (moveCard && enemyCharacters.length > 0) {
        recommendedAction = {
          type: 'attack' as const,
          cardId: moveCard.id,
          target: enemyCharacters[0].id,
          reasoning: 'Attacco un personaggio nemico'
        };
      } else if (bonusCard) {
        recommendedAction = {
          type: 'play_card' as const,
          cardId: bonusCard.id,
          reasoning: 'Uso una carta bonus'
        };
      } else if (cpuPlayer.hand.length > 0) {
        recommendedAction = {
          type: 'play_card' as const,
          cardId: cpuPlayer.hand[0].id,
          reasoning: 'Gioco una carta disponibile'
        };
      } else {
        recommendedAction = {
          type: 'play_card' as const,
          reasoning: 'Passo il turno'
        };
      }
    }

    return {
      myCharacter,
      enemyCharacters,
      handCards: cpuPlayer.hand,
      fieldSituation: `${gameState.field.length} carte in campo`,
      recommendedAction
    };
  }

  getDefaultAnalysis(): GameAnalysis {
    return {
      myCharacter: null,
      enemyCharacters: [],
      handCards: [],
      fieldSituation: 'Analisi non disponibile',
      recommendedAction: {
        type: 'play_card',
        reasoning: 'Azione di default'
      }
    };
  }

  // Random chat responses for more personality
  getRandomChatResponse(situation: string): string {
    const responses = {
      thinking: [
        "Fammi pensare un attimo...",
        "Sto valutando le mie opzioni",
        "Interessante situazione...",
        "Vediamo cosa posso fare"
      ],
      playing_character: [
        "È ora di entrare in azione!",
        "Ecco il mio campione!",
        "Questo personaggio farà la differenza",
        "Preparatevi alla battaglia!"
      ],
      attacking: [
        "Attacco!",
        "È ora di fare sul serio!",
        "Prendi questa!",
        "Difenditi se puoi!"
      ],
      no_actions: [
        "Non posso fare molto per ora",
        "Passo il turno",
        "Tocca a voi",
        "Aspetto il momento giusto"
      ],
      greeting: [
        "Ciao a tutti! Pronto a giocare?",
        "Salve! Che la partita abbia inizio!",
        "Ciao! Vediamo chi vincerà",
        "Buongiorno! Sono pronto per la sfida"
      ]
    };

    const situationResponses = responses[situation as keyof typeof responses] || responses.thinking;
    return situationResponses[Math.floor(Math.random() * situationResponses.length)];
  }

  // Main CPU turn logic - uses simple strategy with correct game rules
  async takeTurn(gameState: any) {
    try {
      console.log(`CPU ${this.playerName} is thinking...`);
      
      // If waiting for response, don't take action
      if (this.waitingForResponse) {
        console.log(`CPU ${this.playerName} is waiting for human response`);
        return null;
      }
      
      const cpuPlayer = gameState.players[this.playerName];
      if (!cpuPlayer) {
        console.log(`CPU ${this.playerName} not found in game state`);
        return null;
      }
      
      // Check if this is the opening sequence (no cards in hand, no character on field)
      const isOpeningSequence = this.isOpeningSequence(cpuPlayer, gameState);
      
      if (isOpeningSequence) {
        console.log(`CPU ${this.playerName} executing opening sequence`);
        return await this.executeOpeningSequence(gameState);
      }
      
      // Check if there's recent advice to follow (but not during opening sequence)
      if (!isOpeningSequence && this.lastAdvice && (Date.now() - this.lastAdvice.timestamp) < 60000) { // Follow advice within 1 minute
        console.log(`CPU ${this.playerName} following advice from ${this.lastAdvice.from}:`, this.lastAdvice);
        
        if (this.lastAdvice.type === 'pick-card') {
          const advisedPickAction = {
            type: 'pick-card',
            data: {
              deckType: this.lastAdvice.deckType,
              playerName: this.playerName
            }
          };
          
          // Check if the advised deck is available
          if (gameState.decks[this.lastAdvice.deckType] && gameState.decks[this.lastAdvice.deckType].length > 0) {
            this.sendChatMessage(`Seguo il consiglio di ${this.lastAdvice.from}!`);
            this.lastAdvice = null; // Clear advice after using
            return advisedPickAction;
          } else {
            this.sendChatMessage(`Purtroppo non ci sono più carte ${this.lastAdvice.deckType} disponibili!`);
            this.lastAdvice = null;
          }
        } else if (this.lastAdvice.type === 'wait') {
          this.sendChatMessage(`Come mi ha consigliato ${this.lastAdvice.from}, aspetto il momento giusto.`);
          this.lastAdvice = null;
          return null;
        }
      }
      
      // Check if CPU understands the correct game rules
      const handAnalysis = this.analyzeHandForGameRules(cpuPlayer.hand || []);
      
      // If doesn't have required cards, ask for advice or pick cards (but not during opening)
      if (!handAnalysis.canPlay) {
        if (handAnalysis.missingTypes.length > 0) {
          // Ask human for advice about strategy (less frequently if following advice, and not during opening)
          if (!isOpeningSequence && !this.lastAdvice && Math.random() < 0.6) {
            this.askForAdvice(handAnalysis);
            return null;
          }
          
          // Try to pick missing card types
          const pickAction = this.decideCardToPickBasedOnRules(gameState, handAnalysis);
          if (pickAction) {
            this.sendChatMessage(`Mi servono carte di tipo ${handAnalysis.missingTypes.join(', ')}!`);
            return pickAction;
          }
        }
        
        if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
          console.log(`CPU ${this.playerName} has no cards`);
          const pickAction = this.decideCardToPick(gameState);
          if (pickAction) {
            this.sendChatMessage("Devo pescare qualche carta prima!");
            return pickAction;
          }
        }
      }
      
      // If can play according to rules, proceed with strategy
      if (handAnalysis.canPlay) {
        console.log(`CPU ${this.playerName} has correct cards to play:`, handAnalysis);
        
        // Use simple analysis (no OpenAI calls)
        const analysis = this.analyzeGameStateSimple(gameState);
        
        // Send a thinking message
        this.sendChatMessage(this.getRandomChatResponse('thinking'));
        
        console.log(`CPU ${this.playerName} strategy:`, analysis.recommendedAction.reasoning);
        
        // Announce strategy before acting
        const strategy = this.getStrategyAnnouncement(analysis);
        if (strategy) {
          setTimeout(() => {
            this.sendChatMessage(strategy);
          }, 1000);
        }
        
        // Execute the decided action
        const action = await this.executeAction(gameState, analysis.recommendedAction);
        
        if (action) {
          console.log(`CPU ${this.playerName} executes:`, action.type);
          return action;
        }
      }
      
      console.log(`CPU ${this.playerName} has no valid actions, trying to play any card`);
      
      // Fallback: try to play any available card
      if (cpuPlayer.hand && cpuPlayer.hand.length > 0) {
        const anyCard = cpuPlayer.hand[0];
        this.sendChatMessage("Gioco una carta a caso!");
        return {
          type: 'play-card',
          data: {
            cardId: anyCard.id,
            playerName: this.playerName
          }
        };
      }
      
      this.sendChatMessage(this.getRandomChatResponse('no_actions'));
      return null;
      
    } catch (error) {
      console.error(`Error in CPU ${this.playerName} turn:`, error);
      this.sendChatMessage(this.getRandomChatResponse('no_actions'));
      return null;
    }
  }
  
  // Analyze hand to check if player can play according to rules
  analyzeHandForGameRules(hand: any[]): {canPlay: boolean, hasPersonaggi: boolean, hasMosse: boolean, hasBonus: boolean, missingTypes: string[]} {
    const hasPersonaggi = hand.some(card => card.type === 'personaggi' || card.type === 'personaggi_speciali');
    const hasMosse = hand.some(card => card.type === 'mosse');
    const hasBonus = hand.some(card => card.type === 'bonus');
    
    const missingTypes = [];
    if (!hasPersonaggi) missingTypes.push('PERSONAGGI');
    if (!hasMosse) missingTypes.push('MOSSE');
    if (!hasBonus) missingTypes.push('BONUS');
    
    const canPlay = hasPersonaggi && hasMosse && hasBonus;
    
    console.log(`CPU ${this.playerName} hand analysis: PERSONAGGI=${hasPersonaggi}, MOSSE=${hasMosse}, BONUS=${hasBonus}, canPlay=${canPlay}`);
    
    return {
      canPlay,
      hasPersonaggi,
      hasMosse,
      hasBonus,
      missingTypes
    };
  }
  
  // Ask human players for advice
  askForAdvice(handAnalysis: any) {
    const questions = [
      `Ho solo ${handAnalysis.missingTypes.length > 0 ? 'alcune' : 'tutte le'} carte necessarie. Cosa mi consigli di fare?`,
      `Mi mancano carte di tipo: ${handAnalysis.missingTypes.join(', ')}. Quale dovrei pescare prima?`,
      `Non riesco a giocare perché mi servono 3 tipi di carte diverse. Aiutami con la strategia!`,
      `So che per giocare servono PERSONAGGI, MOSSE e BONUS. Mi mancano: ${handAnalysis.missingTypes.join(', ')}. Che faccio?`
    ];
    
    const question = questions[Math.floor(Math.random() * questions.length)];
    this.currentQuestion = question;
    this.waitingForResponse = true;
    
    this.sendChatMessage(question);
    
    // Set timeout to stop waiting for response after 30 seconds
    setTimeout(() => {
      if (this.waitingForResponse) {
        this.waitingForResponse = false;
        this.sendChatMessage("Ok, proverò da solo allora!");
      }
    }, 30000);
  }
  
  // Decide card to pick based on game rules
  decideCardToPickBasedOnRules(gameState: any, handAnalysis: any): any {
    const availableDecks = [];
    
    if (gameState.decks.personaggi && gameState.decks.personaggi.length > 0) {
      availableDecks.push('personaggi');
    }
    if (gameState.decks.mosse && gameState.decks.mosse.length > 0) {
      availableDecks.push('mosse');
    }
    if (gameState.decks.bonus && gameState.decks.bonus.length > 0) {
      availableDecks.push('bonus');
    }
    if (gameState.decks.personaggi_speciali && gameState.decks.personaggi_speciali.length > 0) {
      availableDecks.push('personaggi_speciali');
    }
    
    if (availableDecks.length === 0) return null;
    
    // Priority based on missing types
    let preferredDeck;
    
    if (!handAnalysis.hasPersonaggi && availableDecks.includes('personaggi')) {
      preferredDeck = 'personaggi';
    } else if (!handAnalysis.hasPersonaggi && availableDecks.includes('personaggi_speciali')) {
      preferredDeck = 'personaggi_speciali';
    } else if (!handAnalysis.hasMosse && availableDecks.includes('mosse')) {
      preferredDeck = 'mosse';
    } else if (!handAnalysis.hasBonus && availableDecks.includes('bonus')) {
      preferredDeck = 'bonus';
    } else {
      // Pick any available deck
      preferredDeck = availableDecks[0];
    }
    
    return {
      type: 'pick-card',
      data: {
        deckType: preferredDeck,
        playerName: this.playerName
      }
    };
  }
  
  // Decide which type of card to pick (fallback method)
  decideCardToPick(gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) return null;
    
    const handAnalysis = this.analyzeHandForGameRules(cpuPlayer.hand || []);
    return this.decideCardToPickBasedOnRules(gameState, handAnalysis);
  }

  // Helper function to extract card name from URL
  getCardNameFromUrl(url: string): string {
    if (!url) return "Carta Sconosciuta";
    
    const parts = url.split('/');
    const filename = parts[parts.length - 1];
    return filename
      .toLowerCase()
      .replace(/\.(png|jpg|jpeg|gif|webp)$/i, '')
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // Check if this is the opening sequence
  isOpeningSequence(cpuPlayer: any, gameState: any): boolean {
    // Opening sequence is active if phase is not completed
    const isInOpeningSequence = this.openingSequenceState.phase !== 'completed';
    
    // Reset opening sequence if CPU already has a character on field from previous games
    const hasCharacterOnField = gameState.field.some((card: any) => 
      card.owner === this.playerName && (card.type === 'personaggi' || card.type === 'personaggi_speciali')
    );
    
    if (hasCharacterOnField && this.openingSequenceState.phase === 'pick-initial') {
      console.log(`CPU ${this.playerName} already has character on field, skipping opening sequence`);
      this.openingSequenceState.phase = 'completed';
      return false;
    }
    
    console.log(`CPU ${this.playerName} opening check: phase=${this.openingSequenceState.phase}, isInSequence=${isInOpeningSequence}, hasCharacterOnField=${hasCharacterOnField}`);
    
    return isInOpeningSequence;
  }

  // Execute the opening sequence according to MINKIARDS rules
  async executeOpeningSequence(gameState: any): Promise<any> {
    const cpuPlayer = gameState.players[this.playerName];
    
    switch (this.openingSequenceState.phase) {
      case 'pick-initial':
        return this.executeInitialCardPicking(gameState);
        
      case 'play-character':
        return this.executePlayCharacter(gameState);
        
      case 'pick-replacement':
        return this.executePickReplacement(gameState);
        
      default:
        console.log(`CPU ${this.playerName} opening sequence completed`);
        this.openingSequenceState.phase = 'completed';
        return { type: 'opening-complete' }; // Signal that opening is done
    }
  }

  // Phase 1: Pick initial 3 cards (PERSONAGGI, MOSSE, BONUS) - all at once
  executeInitialCardPicking(gameState: any): any {
    const neededTypes = ['personaggi', 'mosse', 'bonus'];
    const remainingTypes = neededTypes.filter(type => 
      !this.openingSequenceState.pickedCards.includes(type)
    );
    
    console.log(`CPU ${this.playerName} executing initial card picking. Remaining types:`, remainingTypes);
    
    // Check if we need to pick all 3 cards at once
    if (remainingTypes.length === 3) {
      this.sendChatMessage("Inizio partita! Pesco le mie 3 carte iniziali: PERSONAGGI, MOSSE e BONUS.");
      
      // Mark all types as picked and move to next phase
      this.openingSequenceState.pickedCards = ['personaggi', 'mosse', 'bonus'];
      this.openingSequenceState.phase = 'play-character';
      
      // Return action to pick all 3 cards
      return {
        type: 'pick-opening-cards',
        data: {
          types: ['personaggi', 'mosse', 'bonus'],
          playerName: this.playerName
        }
      };
    }
    
    // If we somehow end up here, move to next phase
    this.openingSequenceState.phase = 'play-character';
    return null;
  }

  // Phase 2: Play the PERSONAGGI card
  executePlayCharacter(gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    
    // Find a PERSONAGGI card in hand
    const personaggioCard = cpuPlayer.hand?.find((card: any) => 
      card.type === 'personaggi' || card.type === 'personaggi_speciali'
    );
    
    if (personaggioCard) {
      console.log(`CPU ${this.playerName} playing initial character: ${personaggioCard.id}`);
      this.sendChatMessage("Metto in campo il mio personaggio!");
      
      // Move to next phase
      this.openingSequenceState.phase = 'pick-replacement';
      
      return {
        type: 'play-card',
        data: {
          cardId: personaggioCard.id,
          playerName: this.playerName
        }
      };
    }
    
    // If no character to play, move to next phase
    this.openingSequenceState.phase = 'pick-replacement';
    return null;
  }

  // Phase 3: Pick replacement PERSONAGGI card
  executePickReplacement(gameState: any): any {
    // Check if PERSONAGGI deck has cards
    if (gameState.decks.personaggi && gameState.decks.personaggi.length > 0) {
      console.log(`CPU ${this.playerName} picking replacement character`);
      this.sendChatMessage("Pesco un nuovo personaggio e finisco il turno!");
      
      // Complete the opening sequence
      this.openingSequenceState.phase = 'completed';
      
      return {
        type: 'pick-card',
        data: {
          deckType: 'personaggi',
          playerName: this.playerName
        }
      };
    }
    
    // If no cards to pick, just complete the sequence
    this.openingSequenceState.phase = 'completed';
    this.sendChatMessage("Sequenza di apertura completata!");
    return null;
  }

  // Generate strategy announcement with more variety
  private getStrategyAnnouncement(analysis: GameAnalysis): string {
    const action = analysis.recommendedAction;
    
    switch (action.type) {
      case 'play_card':
        if (action.reasoning.includes('personaggio')) {
          return this.getRandomChatResponse('playing_character');
        }
        return analysis.handCards.length > 3 
          ? "Ho molte opzioni, scelgo questa carta" 
          : "Gioco questa carta strategicamente";
      case 'attack':
        return this.getRandomChatResponse('attacking');
      case 'switch_character':
        return "Cambio tattica, nuovo personaggio in arrivo!";
      case 'buy_power':
        return "Investo in un potere speciale!";
      default:
        return this.getRandomChatResponse('thinking');
    }
  }

  // Process human chat messages to respond appropriately and follow advice
  processHumanChat(message: string, senderName: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // If waiting for response to our question, process the advice
    if (this.waitingForResponse) {
      this.processAdvice(message, senderName);
      return true;
    }
    
    // Respond to greetings
    if (lowerMessage.includes('ciao') || lowerMessage.includes('salve') || lowerMessage.includes('buongiorno')) {
      setTimeout(() => {
        this.sendChatMessage(`Ciao ${senderName}! Dimmi, conosci bene le regole di MINKIARDS?`);
      }, 1000 + Math.random() * 2000);
      return true;
    }
    
    // Respond to advice/instructions (even when not explicitly waiting)
    if (lowerMessage.includes('pesca') || lowerMessage.includes('prendi') || lowerMessage.includes('carta')) {
      this.processAdvice(message, senderName);
      return true;
    }
    
    if (lowerMessage.includes('gioca') || lowerMessage.includes('usa') || lowerMessage.includes('attacca')) {
      this.processAdvice(message, senderName);
      return true;
    }
    
    // Respond to questions about strategy
    if (lowerMessage.includes('strategia') || lowerMessage.includes('cosa fai') || lowerMessage.includes('che farai')) {
      setTimeout(() => {
        const responses = [
          "Sto imparando le regole: servono 3 tipi di carte per giocare bene!",
          "Vorrei capire meglio quando è il momento giusto per attaccare",
          "Mi stai insegnando molto su questo gioco!",
          "Hai qualche consiglio per la mia prossima mossa?"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 1000 + Math.random() * 2000);
      return true;
    }
    
    // Respond to direct questions to the CPU
    if (lowerMessage.includes(this.playerName.toLowerCase()) || lowerMessage.includes('cpu')) {
      setTimeout(() => {
        const responses = [
          "Sì? Hai un consiglio per me?",
          "Ti ascolto! Cosa devo fare?",
          "Dimmi, cosa mi consigli?",
          "Sono qui, aiutami a migliorare!"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 500 + Math.random() * 1500);
      return true;
    }
    
    // Ask occasional questions about the game
    if (Math.random() < 0.3) {
      setTimeout(() => {
        const questions = [
          "È vero che servono PERSONAGGI, MOSSE e BONUS per giocare bene?",
          "Quando è il momento migliore per attaccare?",
          "Cosa fai di solito quando hai poche carte?",
          "Mi spieghi la tua strategia?"
        ];
        this.sendChatMessage(questions[Math.floor(Math.random() * questions.length)]);
      }, 2000 + Math.random() * 3000);
      return true;
    }
    
    return false;
  }
  
  // Process advice from human players
  processAdvice(message: string, senderName: string) {
    const lowerMessage = message.toLowerCase();
    this.conversationHistory.push({
      type: 'answer',
      content: message,
      timestamp: Date.now()
    });
    
    // Extract deck type from advice
    let advisedDeck = null;
    if (lowerMessage.includes('personaggi') || lowerMessage.includes('personaggio')) {
      advisedDeck = 'personaggi';
    } else if (lowerMessage.includes('mosse') || lowerMessage.includes('mossa')) {
      advisedDeck = 'mosse';
    } else if (lowerMessage.includes('bonus')) {
      advisedDeck = 'bonus';
    } else if (lowerMessage.includes('speciali') || lowerMessage.includes('speciale')) {
      advisedDeck = 'personaggi_speciali';
    }
    
    // Respond to the advice
    setTimeout(() => {
      if (advisedDeck) {
        this.sendChatMessage(`Perfetto ${senderName}! Proverò a pescare da ${advisedDeck}. Grazie del consiglio!`);
        // Store the advice for next turn
        this.lastAdvice = {
          type: 'pick-card',
          deckType: advisedDeck,
          from: senderName,
          timestamp: Date.now()
        };
      } else if (lowerMessage.includes('gioca') || lowerMessage.includes('attacca')) {
        this.sendChatMessage(`Hai ragione ${senderName}! Seguirò il tuo consiglio nella prossima mossa.`);
        this.lastAdvice = {
          type: 'play-aggressive',
          from: senderName,
          timestamp: Date.now()
        };
      } else if (lowerMessage.includes('aspetta') || lowerMessage.includes('calma') || lowerMessage.includes('pazienza')) {
        this.sendChatMessage(`Ok ${senderName}, sarò più paziente e aspetterò il momento giusto.`);
        this.lastAdvice = {
          type: 'wait',
          from: senderName,
          timestamp: Date.now()
        };
      } else {
        this.sendChatMessage(`Grazie ${senderName}! Terrò a mente il tuo consiglio.`);
        this.lastAdvice = {
          type: 'general',
          advice: message,
          from: senderName,
          timestamp: Date.now()
        };
      }
      
      // Stop waiting for response if we were
      if (this.waitingForResponse) {
        this.waitingForResponse = false;
      }
    }, 1000 + Math.random() * 2000);
  }
}