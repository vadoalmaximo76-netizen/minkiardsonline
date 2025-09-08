import { db } from './db';
import { matches, gameEvents } from '../shared/schema';
import type { Match, GameEvent } from '../shared/schema';
import { desc, eq } from 'drizzle-orm';

export interface ReplayState {
  decks: {
    personaggi: any[];
    mosse: any[];
    bonus: any[];
    personaggi_speciali: any[];
  };
  players: Record<string, { name: string; hand: any[] }>;
  field: any[];
  graveyard: any[];
  scenarioCardsActive: boolean;
  eventCounter: number;
}

export class ReplayManager {
  async getMatchHistory(limit = 10): Promise<Match[]> {
    try {
      const matchList = await db.select().from(matches)
        .orderBy(desc(matches.startedAt))
        .limit(limit);
      return matchList;
    } catch (error) {
      console.error('Failed to get match history:', error);
      return [];
    }
  }

  async getMatchDetails(matchId: number): Promise<{ match: Match | null, events: GameEvent[] }> {
    try {
      const [match] = await db.select().from(matches).where(eq(matches.id, matchId));
      
      const events = await db.select().from(gameEvents)
        .where(eq(gameEvents.matchId, matchId))
        .orderBy(gameEvents.eventOrder);

      return { match, events };
    } catch (error) {
      console.error('Failed to get match details:', error);
      return { match: null, events: [] };
    }
  }

  async getReplayData(matchId: number): Promise<{
    match: Match | null;
    events: GameEvent[];
    initialState: ReplayState;
  }> {
    const { match, events } = await this.getMatchDetails(matchId);
    
    if (!match) {
      return { match: null, events: [], initialState: this.createInitialReplayState() };
    }

    // Create initial state based on standard game setup
    const initialState = this.createInitialReplayState();
    
    return { match, events, initialState };
  }

  private createInitialReplayState(): ReplayState {
    return {
      decks: {
        personaggi: [],
        mosse: [],
        bonus: [],
        personaggi_speciali: []
      },
      players: {},
      field: [],
      graveyard: [],
      scenarioCardsActive: false,
      eventCounter: 0
    };
  }

  reconstructGameState(initialState: ReplayState, events: GameEvent[], upToEventIndex?: number): ReplayState {
    const state = JSON.parse(JSON.stringify(initialState)); // Deep clone
    const eventsToApply = upToEventIndex !== undefined 
      ? events.slice(0, upToEventIndex + 1) 
      : events;

    for (const event of eventsToApply) {
      this.applyEventToState(state, event);
    }

    return state;
  }

  private applyEventToState(state: ReplayState, event: GameEvent): void {
    const { eventType, eventData, playerName } = event;

    switch (eventType) {
      case 'player-join':
        if (!state.players[playerName]) {
          state.players[playerName] = { name: playerName, hand: [] };
        }
        break;

      case 'pick-card':
        // Add card to player's hand
        if (state.players[playerName] && eventData.cardId) {
          const card = {
            id: eventData.cardId,
            type: eventData.cardType,
            frontImage: eventData.frontImage,
            backImage: '', // Will be determined by type
            owner: playerName,
            text: ''
          };
          state.players[playerName].hand.push(card);
        }
        break;

      case 'play-card':
        // Move card from hand to field
        if (state.players[playerName] && eventData.cardId) {
          const handCardIndex = state.players[playerName].hand.findIndex(c => c.id === eventData.cardId);
          if (handCardIndex !== -1) {
            const card = state.players[playerName].hand.splice(handCardIndex, 1)[0];
            state.field.push(card);
          }
        }
        break;

      case 'transfer-card':
        // Move card between players
        const { fromPlayer, toPlayer, cardId } = eventData;
        if (state.players[fromPlayer] && state.players[toPlayer]) {
          // Find card in fromPlayer's hand or field
          let card = null;
          
          // Check hand
          const handIndex = state.players[fromPlayer].hand.findIndex(c => c.id === cardId);
          if (handIndex !== -1) {
            card = state.players[fromPlayer].hand.splice(handIndex, 1)[0];
          } else {
            // Check field
            const fieldIndex = state.field.findIndex(c => c.id === cardId && c.owner === fromPlayer);
            if (fieldIndex !== -1) {
              card = state.field.splice(fieldIndex, 1)[0];
            }
          }
          
          if (card) {
            card.owner = toPlayer;
            state.players[toPlayer].hand.push(card);
          }
        }
        break;

      case 'return-to-hand':
        // Move card from field/graveyard to hand
        if (state.players[playerName] && eventData.cardId) {
          let card = null;
          
          if (eventData.fromLocation === 'field') {
            const fieldIndex = state.field.findIndex(c => c.id === eventData.cardId);
            if (fieldIndex !== -1) {
              card = state.field.splice(fieldIndex, 1)[0];
            }
          } else {
            const graveyardIndex = state.graveyard.findIndex(c => c.id === eventData.cardId);
            if (graveyardIndex !== -1) {
              card = state.graveyard.splice(graveyardIndex, 1)[0];
            }
          }
          
          if (card) {
            state.players[playerName].hand.push(card);
          }
        }
        break;

      case 'eliminate-personaggi':
        // Move card from field to graveyard
        if (eventData.cardId) {
          const fieldIndex = state.field.findIndex(c => c.id === eventData.cardId);
          if (fieldIndex !== -1) {
            const card = state.field.splice(fieldIndex, 1)[0];
            card.eliminatedBy = eventData.eliminatedBy;
            state.graveyard.push(card);
          }
        }
        break;
    }

    state.eventCounter++;
  }
}

export const replayManager = new ReplayManager();