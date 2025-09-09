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

  constructor(playerName: string, gameId: string) {
    this.playerName = playerName;
    this.gameId = gameId;
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

  // Main CPU turn logic
  async takeTurn(gameState: any) {
    try {
      console.log(`CPU ${this.playerName} is thinking...`);
      
      // Analyze current game state
      const analysis = await this.analyzeGameState(gameState);
      
      console.log(`CPU ${this.playerName} analysis:`, analysis.recommendedAction.reasoning);
      
      // Execute the decided action
      const action = await this.executeAction(gameState, analysis.recommendedAction);
      
      if (action) {
        console.log(`CPU ${this.playerName} executes:`, action.type);
        return action;
      }
      
      console.log(`CPU ${this.playerName} has no valid actions`);
      return null;
      
    } catch (error) {
      console.error(`Error in CPU ${this.playerName} turn:`, error);
      return null;
    }
  }
}