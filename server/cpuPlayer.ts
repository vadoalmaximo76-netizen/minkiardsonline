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

  get isWaitingForResponse(): boolean {
    return this.waitingForResponse;
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

      // Analyze hand cards
      const handAnalyses = await Promise.all(
        cpuPlayer.hand.map((card: any) => this.analyzeCardImage(card.frontImage))
      );

      // Get conversation context for enhanced decision making
      const conversationContext = this.getConversationContext();

      // Create game situation description
      const situationDesc = `
        My character: ${myCharacter ? `${myCharacter.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '')}` : 'None'}
        Enemy characters: ${enemyCharacters.map((c: any) => c.frontImage.split('/').pop()?.replace(/\.[^/.]+$/, '')).join(', ')}
        Hand cards: ${handAnalyses.map(a => `${a.name} (${a.cardType})`).join(', ')}
        Field situation: ${gameState.field.length} cards on field
        Previous conversation: ${conversationContext || 'Nessuna conversazione precedente'}
      `;

      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert MINKIARDS player that can communicate in Italian. Based on the game rules:
            
            RULES SUMMARY:
            - Each player needs a character (personaggio) on the field to take actions
            - Goal: Eliminate enemy characters by reducing their points to 0
            - Move cards (mosse) deal damage = base damage × character's stars
            - Bonus cards provide special effects
            - Characters have points (life), stars (damage multiplier), and special powers
            - Can counter attacks if you have a move with equal/higher damage
            - Can buy powers by spending character points
            - Can switch characters from hand to field
            
            Consider previous conversation with human players to adapt your strategy.
            If humans have given you specific instructions or clarifications, prioritize those.
            
            Analyze the current situation and recommend the best action. Consider:
            1. Do I have a character on field? If not, play one
            2. Can I deal lethal damage to an enemy?
            3. Should I defend against incoming threats?
            4. Should I use bonus cards for advantage?
            5. Should I switch to a stronger character?
            6. Any specific human guidance from previous conversation?
            
            Respond with JSON containing your analysis and recommended action.`
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
        const targetCard = gameState.field.find((c: any) => c.id === action.target);
        
        if (moveCard && targetCard) {
          console.log(`CPU ${this.playerName} attacking with: ${moveCard.id}`);
          return {
            type: 'mosse-attack',
            data: {
              mosseCardId: moveCard.id,
              targetCardId: action.target,
              attackerName: this.playerName,
              targetOwner: targetCard.owner
            }
          };
        } else {
          // Fallback to playing the move card normally
          if (moveCard) {
            return {
              type: 'play-card',
              data: {
                cardId: moveCard.id,
                playerName: this.playerName
              }
            };
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

  // Main CPU turn logic - uses simple strategy (no API calls)  
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
      
      // If CPU has no cards, try to pick cards first
      if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
        console.log(`CPU ${this.playerName} has no cards, trying to pick cards`);
        const pickAction = this.decideCardToPick(gameState);
        if (pickAction) {
          this.sendChatMessage("Devo pescare qualche carta prima!");
          return pickAction;
        }
      }
      
      // If still no cards after trying to pick, can't play
      if (!cpuPlayer.hand || cpuPlayer.hand.length === 0) {
        console.log(`CPU ${this.playerName} still has no cards after pick attempt`);
        this.sendChatMessage(this.getRandomChatResponse('no_actions'));
        return null;
      }
      
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
  
  // Decide which type of card to pick
  decideCardToPick(gameState: any): any {
    const cpuPlayer = gameState.players[this.playerName];
    if (!cpuPlayer) return null;
    
    // Check which decks have cards available
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
    
    if (availableDecks.length === 0) {
      console.log(`CPU ${this.playerName} no decks have cards available`);
      return null;
    }
    
    // Check if CPU needs a character
    const myCharacter = gameState.field.find((card: any) => card.owner === this.playerName && card.type === 'personaggi');
    
    // Priority: character first if don't have one, then varied strategy
    let preferredDeck;
    
    if (!myCharacter && availableDecks.includes('personaggi')) {
      preferredDeck = 'personaggi';
      console.log(`CPU ${this.playerName} needs a character, picking from personaggi`);
    } else {
      // Pick randomly but with some strategy
      const rand = Math.random();
      if (rand < 0.4 && availableDecks.includes('mosse')) {
        preferredDeck = 'mosse';
      } else if (rand < 0.7 && availableDecks.includes('bonus')) {
        preferredDeck = 'bonus'; 
      } else if (availableDecks.includes('personaggi')) {
        preferredDeck = 'personaggi';
      } else {
        preferredDeck = availableDecks[0];
      }
      console.log(`CPU ${this.playerName} picking from ${preferredDeck}`);
    }
    
    return {
      type: 'pick-card',
      data: {
        deckType: preferredDeck,
        playerName: this.playerName
      }
    };
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

  // Process human chat messages to respond appropriately
  processHumanChat(message: string, senderName: string): boolean {
    const lowerMessage = message.toLowerCase();
    
    // Respond to greetings
    if (lowerMessage.includes('ciao') || lowerMessage.includes('salve') || lowerMessage.includes('buongiorno')) {
      setTimeout(() => {
        this.sendChatMessage(`Ciao ${senderName}! Come va la partita?`);
      }, 1000 + Math.random() * 2000); // Random delay
      return true;
    }
    
    // Respond to questions about strategy
    if (lowerMessage.includes('strategia') || lowerMessage.includes('cosa fai') || lowerMessage.includes('che farai')) {
      setTimeout(() => {
        const responses = [
          "Sto pensando alla mossa migliore!",
          "La mia strategia è segreta per ora",
          "Adatterò la strategia alla situazione",
          "Vedremo chi avrà la meglio!"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 1000 + Math.random() * 2000);
      return true;
    }
    
    // Respond to direct questions to the CPU
    if (lowerMessage.includes(this.playerName.toLowerCase()) || lowerMessage.includes('cpu')) {
      setTimeout(() => {
        const responses = [
          "Sì?",
          "Dimmi tutto!",
          "Ti ascolto",
          "Cosa posso fare per te?"
        ];
        this.sendChatMessage(responses[Math.floor(Math.random() * responses.length)]);
      }, 500 + Math.random() * 1500);
      return true;
    }
    
    return false;
  }
}