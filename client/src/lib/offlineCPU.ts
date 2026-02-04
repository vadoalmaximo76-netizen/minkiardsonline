import { 
  OfflineGameState, 
  OfflineCard, 
  drawCard, 
  playCardToField, 
  attackWithMosse, 
  endTurn,
  getCurrentPlayerName
} from './offlineGameEngine';

export interface CPUAction {
  type: 'draw' | 'play' | 'attack' | 'bonus' | 'end_turn' | 'wait';
  cardId?: string;
  targetCardId?: string;
  deckType?: 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';
  description: string;
}

export interface CPUDecision {
  actions: CPUAction[];
  reasoning: string;
}

export class OfflineCPU {
  private cpuName: string;
  private difficulty: 'easy' | 'medium' | 'hard';
  private actionDelay: number;

  constructor(cpuName: string = 'CPU', difficulty: 'easy' | 'medium' | 'hard' = 'medium') {
    this.cpuName = cpuName;
    this.difficulty = difficulty;
    this.actionDelay = difficulty === 'easy' ? 1500 : difficulty === 'medium' ? 1000 : 500;
  }

  getCPUName(): string {
    return this.cpuName;
  }

  getActionDelay(): number {
    return this.actionDelay;
  }

  decideTurn(state: OfflineGameState): CPUDecision {
    const actions: CPUAction[] = [];
    const cpu = state.players[this.cpuName];
    
    if (!cpu) {
      return { actions: [{ type: 'end_turn', description: 'CPU non trovata' }], reasoning: 'Errore: CPU non trovata' };
    }

    const hand = cpu.hand;
    const cpuCharactersOnField = state.field.filter(
      c => c.owner === this.cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );
    const enemyCharactersOnField = state.field.filter(
      c => c.owner !== this.cpuName && (c.type === 'personaggi' || c.type === 'personaggi_speciali')
    );

    const personaggiInHand = hand.filter(c => c.type === 'personaggi' || c.type === 'personaggi_speciali');
    const mosseInHand = hand.filter(c => c.type === 'mosse');
    const bonusInHand = hand.filter(c => c.type === 'bonus');

    let reasoning = `CPU analizza: ${personaggiInHand.length} personaggi in mano, ${cpuCharactersOnField.length} in campo, ${mosseInHand.length} mosse, ${enemyCharactersOnField.length} nemici. `;

    if (cpuCharactersOnField.length === 0 && personaggiInHand.length === 0) {
      if (state.decks.personaggi.length > 0 || state.decks.personaggi_speciali.length > 0) {
        const deckType = state.decks.personaggi_speciali.length > 0 && Math.random() > 0.7 
          ? 'personaggi_speciali' 
          : 'personaggi';
        actions.push({
          type: 'draw',
          deckType,
          description: `Pesca carta ${deckType}`
        });
        reasoning += 'Deve pescare un personaggio. ';
      }
    }

    if (personaggiInHand.length > 0 && cpuCharactersOnField.length < 2) {
      const bestPersonaggio = this.selectBestPersonaggio(personaggiInHand);
      if (bestPersonaggio) {
        actions.push({
          type: 'play',
          cardId: bestPersonaggio.id,
          description: `Gioca ${bestPersonaggio.name || 'personaggio'} (${bestPersonaggio.pti} PTI, ${bestPersonaggio.stars} stelle)`
        });
        reasoning += `Gioca ${bestPersonaggio.name}. `;
      }
    }

    if (mosseInHand.length === 0 && cpuCharactersOnField.length > 0 && enemyCharactersOnField.length > 0) {
      if (state.decks.mosse.length > 0) {
        actions.push({
          type: 'draw',
          deckType: 'mosse',
          description: 'Pesca carta MOSSE'
        });
        reasoning += 'Pesca una mossa per attaccare. ';
      }
    }

    if (mosseInHand.length > 0 && cpuCharactersOnField.length > 0 && enemyCharactersOnField.length > 0) {
      const target = this.selectBestTarget(enemyCharactersOnField);
      const mosse = this.selectBestMosse(mosseInHand, cpuCharactersOnField);
      
      if (target && mosse) {
        actions.push({
          type: 'attack',
          cardId: mosse.id,
          targetCardId: target.id,
          description: `Attacca ${target.name || 'nemico'} con ${mosse.name || 'mossa'} (${mosse.mosseDamageValue} danno base)`
        });
        reasoning += `Attacca ${target.name} (${target.currentPti} PTI). `;
      }
    }

    if (bonusInHand.length > 0 && Math.random() > 0.6) {
      const bonus = bonusInHand[Math.floor(Math.random() * bonusInHand.length)];
      const bonusName = (bonus.name || '').toUpperCase();
      
      if (bonusName.includes('MEDICINA') || bonusName.includes('CURA')) {
        const damagedCharacter = cpuCharactersOnField.find(c => 
          c.currentPti && c.pti && c.currentPti < c.pti * 0.7
        );
        if (damagedCharacter) {
          actions.push({
            type: 'bonus',
            cardId: bonus.id,
            targetCardId: damagedCharacter.id,
            description: `Usa ${bonus.name} su ${damagedCharacter.name}`
          });
          reasoning += `Cura ${damagedCharacter.name}. `;
        }
      } else if (bonusName.includes('DOPING') || bonusName.includes('POTENZIAMENTO')) {
        if (cpuCharactersOnField.length > 0) {
          const target = cpuCharactersOnField[Math.floor(Math.random() * cpuCharactersOnField.length)];
          actions.push({
            type: 'bonus',
            cardId: bonus.id,
            targetCardId: target.id,
            description: `Usa ${bonus.name} su ${target.name}`
          });
          reasoning += `Potenzia ${target.name}. `;
        }
      }
    }

    if (hand.length < 3 && state.decks.bonus.length > 0 && Math.random() > 0.5) {
      actions.push({
        type: 'draw',
        deckType: 'bonus',
        description: 'Pesca carta BONUS'
      });
      reasoning += 'Pesca bonus extra. ';
    }

    actions.push({
      type: 'end_turn',
      description: 'Fine turno'
    });

    return { actions, reasoning };
  }

  private selectBestPersonaggio(characters: OfflineCard[]): OfflineCard | null {
    if (characters.length === 0) return null;
    
    if (this.difficulty === 'hard') {
      return characters.reduce((best, current) => {
        const currentScore = (current.pti || 0) + (current.stars || 1) * 200;
        const bestScore = (best.pti || 0) + (best.stars || 1) * 200;
        return currentScore > bestScore ? current : best;
      });
    } else if (this.difficulty === 'medium') {
      const sorted = [...characters].sort((a, b) => (b.pti || 0) - (a.pti || 0));
      return sorted[Math.floor(Math.random() * Math.min(2, sorted.length))];
    } else {
      return characters[Math.floor(Math.random() * characters.length)];
    }
  }

  private selectBestTarget(enemies: OfflineCard[]): OfflineCard | null {
    if (enemies.length === 0) return null;
    
    if (this.difficulty === 'hard' || this.difficulty === 'medium') {
      return enemies.reduce((lowest, current) => {
        const currentPti = current.currentPti || current.pti || 9999;
        const lowestPti = lowest.currentPti || lowest.pti || 9999;
        return currentPti < lowestPti ? current : lowest;
      });
    } else {
      return enemies[Math.floor(Math.random() * enemies.length)];
    }
  }

  private selectBestMosse(mosse: OfflineCard[], attackers: OfflineCard[]): OfflineCard | null {
    if (mosse.length === 0) return null;
    
    if (this.difficulty === 'hard') {
      return mosse.reduce((best, current) => {
        const currentDamage = current.mosseDamageValue || 0;
        const bestDamage = best.mosseDamageValue || 0;
        return currentDamage > bestDamage ? current : best;
      });
    } else {
      return mosse[Math.floor(Math.random() * mosse.length)];
    }
  }

  async executeTurn(
    state: OfflineGameState, 
    onStateUpdate: (newState: OfflineGameState) => void,
    onActionExecuted?: (action: CPUAction) => void
  ): Promise<OfflineGameState> {
    if (getCurrentPlayerName(state) !== this.cpuName) {
      return state;
    }

    const decision = this.decideTurn(state);
    let currentState = { ...state };

    for (const action of decision.actions) {
      if (currentState.gameEnded) break;

      await this.delay(this.actionDelay);

      switch (action.type) {
        case 'draw':
          if (action.deckType) {
            const result = drawCard(currentState, this.cpuName, action.deckType);
            currentState = result.state;
          }
          break;

        case 'play':
          if (action.cardId) {
            currentState = playCardToField(currentState, this.cpuName, action.cardId);
          }
          break;

        case 'attack':
          if (action.cardId && action.targetCardId) {
            currentState = attackWithMosse(currentState, this.cpuName, action.cardId, action.targetCardId);
          }
          break;

        case 'bonus':
          if (action.cardId) {
            const player = currentState.players[this.cpuName];
            const cardIndex = player?.hand.findIndex(c => c.id === action.cardId);
            if (player && cardIndex !== undefined && cardIndex !== -1) {
              const bonusCard = player.hand.splice(cardIndex, 1)[0];
              currentState.graveyard.push(bonusCard);
              currentState.messages.push({
                id: `msg-${Date.now()}`,
                playerName: 'Sistema',
                message: `${this.cpuName} ha usato ${bonusCard.name || 'carta bonus'}`,
                timestamp: Date.now(),
              });
              currentState = { ...currentState };
            }
          }
          break;

        case 'end_turn':
          currentState = endTurn(currentState);
          break;
      }

      onStateUpdate(currentState);
      onActionExecuted?.(action);
    }

    return currentState;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export function getCPUAction(state: OfflineGameState, cpuName: string = 'CPU'): CPUDecision {
  const cpu = new OfflineCPU(cpuName, 'medium');
  return cpu.decideTurn(state);
}

export function executeCPUTurn(
  state: OfflineGameState,
  cpuName: string = 'CPU'
): OfflineGameState {
  const decision = getCPUAction(state, cpuName);
  let currentState = { ...state };
  const cpu = currentState.players[cpuName];

  if (!cpu) return currentState;

  for (const action of decision.actions) {
    if (currentState.gameEnded) break;

    switch (action.type) {
      case 'draw':
        if (action.deckType) {
          const result = drawCard(currentState, cpuName, action.deckType);
          currentState = result.state;
        }
        break;

      case 'play':
        if (action.cardId) {
          currentState = playCardToField(currentState, cpuName, action.cardId);
        }
        break;

      case 'attack':
        if (action.cardId && action.targetCardId) {
          currentState = attackWithMosse(currentState, cpuName, action.cardId, action.targetCardId);
        }
        break;

      case 'end_turn':
        currentState = endTurn(currentState);
        break;
    }
  }

  return currentState;
}
