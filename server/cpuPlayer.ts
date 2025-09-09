import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface CardAnalysis {
  cardType: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
  name: string;
  points?: number;
  stars?: number;
  damage?: number;
  effect?: string;
  canCounter?: boolean;
  canBeCountered?: boolean;
  powerCost?: number;
  transformations?: {
    evolution?: string;
    taroccata?: string;
    super?: string;
    supreme?: string;
  };
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

  constructor(playerName: string, gameId: string, socketEmitter?: any) {
    this.playerName = playerName;
    this.gameId = gameId;
    this.socketEmitter = socketEmitter;
  }

  setSocketEmitter(emitter: any) {
    this.socketEmitter = emitter;
  }

  // Analyze a card image using OpenAI Vision API
  async analyzeCardImage(imageUrl: string): Promise<CardAnalysis> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // Use GPT-4 with vision capabilities
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS card game analyzer. Analyze the card image and extract:
            1. Card type (personaggi/mosse/bonus/personaggi_speciali)
            2. Character/card name
            3. Points (PTI) if it's a character
            4. Stars if it's a character
            5. Damage value if it's a move (-XX format)
            6. Any special effects or powers described in red text
            7. Transformation indicators (E=evolution, T=taroccata, S=super, PS=supreme)
            8. Counter indicators (+ green = can counter, - red = can be countered)
            
            Respond with JSON format only.`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this MINKIARDS card and extract all relevant game information:"
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
        max_tokens: 500
      });

      return JSON.parse(response.choices[0].message.content || '{}');
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

  // Analyze current game state and decide next move
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

      // Analyze hand cards
      const handAnalyses = await Promise.all(
        cpuPlayer.hand.map((card: any) => this.analyzeCardImage(card.frontImage))
      );

      // Create game situation description
      const situationDesc = `
        My character: ${myCharacter ? `${myCharacter.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '')}` : 'None'}
        Enemy characters: ${enemyCharacters.map((c: any) => c.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '')).join(', ')}
        Hand cards: ${handAnalyses.map(a => `${a.name} (${a.cardType})`).join(', ')}
        Field situation: ${gameState.field.length} cards on field
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS player. Based on the game rules:
            
            RULES SUMMARY:
            - Each player needs a character (personaggio) on the field to take actions
            - Goal: Eliminate enemy characters by reducing their points to 0
            - Move cards (mosse) deal damage = base damage × character's stars
            - Bonus cards provide special effects
            - Characters have points (life), stars (damage multiplier), and special powers
            - Can counter attacks if you have a move with equal/higher damage
            - Can buy powers by spending character points
            - Can switch characters from hand to field
            
            Analyze the current situation and recommend the best action. Consider:
            1. Do I have a character on field? If not, play one
            2. Can I deal lethal damage to an enemy?
            3. Should I defend against incoming threats?
            4. Should I use bonus cards for advantage?
            5. Should I switch to a stronger character?
            
            Respond with JSON containing your analysis and recommended action.`
          },
          {
            role: "user",
            content: `Current game state: ${situationDesc}
            
            Available actions:
            - Play a card from hand
            - Switch character (if I have one in hand)
            - Buy a power (if my character has enough points)
            
            What should I do and why?`
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
    if (!cpuPlayer || cpuPlayer.hand.length === 0) return null;

    switch (action.type) {
      case 'play_card':
        // Play the first playable card or the specified card
        const cardToPlay = action.cardId 
          ? cpuPlayer.hand.find((c: any) => c.id === action.cardId)
          : cpuPlayer.hand[0];
        
        if (cardToPlay) {
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
        // Find a move card and attack specified target
        const moveCard = cpuPlayer.hand.find((c: any) => c.type === 'mosse');
        if (moveCard && action.target) {
          return {
            type: 'mosse-attack',
            data: {
              mosseCardId: moveCard.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: gameState.field.find((c: any) => c.id === action.target)?.owner
            }
          };
        }
        break;

      case 'switch_character':
        // Switch to a character from hand
        const characterCard = cpuPlayer.hand.find((c: any) => c.type === 'personaggi');
        if (characterCard) {
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

  // Main CPU turn logic with chat integration
  async takeTurn(gameState: any) {
    try {
      console.log(`CPU ${this.playerName} is thinking...`);
      
      // If waiting for response, don't take action
      if (this.waitingForResponse) {
        console.log(`CPU ${this.playerName} is waiting for human response`);
        return null;
      }
      
      // Analyze current game state
      const analysis = await this.analyzeGameState(gameState);
      
      // Check if CPU needs clarification
      const clarificationCheck = await this.needsClarification(gameState);
      
      if (clarificationCheck.needsClarification) {
        await this.askQuestion(clarificationCheck.question);
        return null; // Don't take action until clarified
      }
      
      console.log(`CPU ${this.playerName} analysis:`, analysis.recommendedAction.reasoning);
      
      // Announce strategy before acting
      const strategy = this.getStrategyAnnouncement(analysis);
      if (strategy) {
        this.sendChatMessage(strategy);
      }
      
      // Execute the decided action
      const action = await this.executeAction(gameState, analysis.recommendedAction);
      
      if (action) {
        console.log(`CPU ${this.playerName} executes:`, action.type);
        return action;
      }
      
      console.log(`CPU ${this.playerName} has no valid actions`);
      this.sendChatMessage(`Non ho mosse disponibili, passo il turno.`);
      return null;
      
    } catch (error) {
      console.error(`Error in CPU ${this.playerName} turn:`, error);
      this.sendChatMessage(`Ho avuto un problema, salto questo turno.`);
      return null;
    }
  }

  // Generate strategy announcement
  private getStrategyAnnouncement(analysis: GameAnalysis): string {
    const action = analysis.recommendedAction;
    
    switch (action.type) {
      case 'play_card':
        return `Giocherò una carta per rafforzare la mia posizione.`;
      case 'attack':
        return `Attaccherò il personaggio nemico - ${action.reasoning}`;
      case 'switch_character':
        return `Cambierò personaggio per una strategia migliore.`;
      case 'buy_power':
        return `Comprerò un potere per il mio personaggio.`;
      default:
        return '';
    }
  }
}