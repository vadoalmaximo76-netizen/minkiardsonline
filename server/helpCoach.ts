import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type HelpEvent = 'cpu_played' | 'human_turn_start' | 'human_question' | 'game_start' | 'defense_prompt' | 'attack_prompt';

interface HelpContext {
  humanPlayerName: string;
  humanHand: Array<{ type: string; name: string; pti?: number; stars?: number; effect?: string; mosseDamageValue?: number }>;
  fieldCards: Array<{ owner: string; type: string; name: string; pti?: number; stars?: number }>;
  currentTurnPlayer: string;
  cpuAction?: { cardName: string; cardType: string; targetPlayer?: string; damage?: number; reasoning?: string };
  humanQuestion?: string;
  turnNumber?: number;
  graveyardCount?: number;
}

const FALLBACK_TIPS: Record<HelpEvent, string[]> = {
  game_start: [
    "Benvenuto in Minkiards! All'inizio del tuo turno, pesca una carta da uno dei mazzi (Personaggi, Mosse o Bonus). Poi gioca una carta dalla tua mano trascinandola sul campo.",
    "Per iniziare, ti serve almeno un Personaggio sul campo. Pesca dal mazzo Personaggi e giocalo! I Personaggi hanno PTI (punti vita) e Stelle (moltiplicatore danno).",
  ],
  cpu_played: [
    "La CPU ha giocato la sua carta. Quando è il tuo turno, puoi giocare un Personaggio per difenderti, una Mossa per attaccare, o un Bonus per ottenere effetti speciali.",
    "Osserva cosa fa la CPU: capire la sua strategia ti aiuta a pianificare le tue mosse!",
  ],
  human_turn_start: [
    "È il tuo turno! Puoi: 1) Giocare una carta dalla mano (trascinala sul campo) 2) Usare una Mossa per attaccare un avversario 3) Giocare un Bonus per effetti speciali. Clicca 'Fine Turno' quando hai finito.",
    "Controlla le carte in mano: se hai una Mossa con danno alto e il nemico ha pochi PTI, potrebbe essere il momento giusto per attaccare!",
  ],
  human_question: [
    "Per giocare una carta, trascinala dalla tua mano al campo di gioco. Per attaccare, gioca una carta Mossa e seleziona il bersaglio.",
    "Le carte Personaggio hanno PTI (punti vita) e Stelle. Il danno delle Mosse viene moltiplicato per le Stelle del tuo personaggio attivo!",
  ],
  defense_prompt: [
    "Sei sotto attacco! Puoi difenderti usando una carta Mossa dalla tua mano. Se la tua Mossa ha un danno maggiore, puoi contrattaccare!",
  ],
  attack_prompt: [
    "Per attaccare, gioca una carta Mossa sul campo. Il danno viene calcolato: Danno Base × Stelle del tuo Personaggio. Scegli il bersaglio nemico con meno PTI per eliminarlo!",
  ],
};

function buildSystemPrompt(): string {
  return `Sei un coach amichevole ed esperto del gioco di carte MINKIARDS. Parli SOLO in italiano.
Il tuo ruolo è guidare i giocatori inesperti durante la partita, spiegando le regole e suggerendo strategie.

REGOLE PRINCIPALI DI MINKIARDS:
- Ogni giocatore ha un mazzo di Personaggi, Mosse e Bonus
- I Personaggi hanno PTI (Punti Totali di Impatto = vita) e Stelle (moltiplicatore danno)
- Le Mosse sono carte attacco: il danno = Danno Base × Stelle del proprio Personaggio attivo
- I Bonus danno effetti speciali (guarigione, potenziamento, ecc.)
- Per attaccare: gioca una Mossa, seleziona il bersaglio nemico
- Quando un Personaggio arriva a 0 PTI, viene eliminato
- Un giocatore viene eliminato quando perde tutti i suoi Personaggi
- Si può difendere un attacco giocando una Mossa dalla mano
- Ogni turno: pesca 1 carta, gioca carte, poi "Fine Turno"

ISTRUZIONI:
- Rispondi SEMPRE in italiano
- Sii breve e chiaro (2-3 frasi massimo)
- Usa un tono amichevole e incoraggiante
- Spiega COSA fare e PERCHÉ
- Se suggerisci una carta specifica, spiega il vantaggio
- NON usare markdown o formattazione speciale, solo testo semplice`;
}

function buildContextMessage(event: HelpEvent, ctx: HelpContext): string {
  const handDesc = ctx.humanHand.map(c => {
    if (c.type === 'personaggi' || c.type === 'personaggi_speciali')
      return `${c.name} (Personaggio, PTI:${c.pti || '?'}, Stelle:${c.stars || '?'})`;
    if (c.type === 'mosse')
      return `${c.name} (Mossa, Danno:${c.mosseDamageValue || '?'})`;
    return `${c.name} (Bonus${c.effect ? ': ' + c.effect.substring(0, 60) : ''})`;
  }).join('; ');

  const fieldDesc = ctx.fieldCards.map(c =>
    `${c.name} [${c.owner}] (${c.type}, PTI:${c.pti || '?'}, Stelle:${c.stars || '?'})`
  ).join('; ');

  let prompt = `Stato partita:
- Giocatore umano: ${ctx.humanPlayerName}
- Mano del giocatore: ${handDesc || 'vuota'}
- Campo di gioco: ${fieldDesc || 'vuoto'}
- Turno corrente: ${ctx.currentTurnPlayer}`;

  switch (event) {
    case 'game_start':
      prompt += `\n\nLa partita è appena iniziata. Dai il benvenuto e spiega brevemente i primi passi.`;
      break;
    case 'cpu_played':
      if (ctx.cpuAction) {
        prompt += `\n\nLa CPU ha appena giocato: ${ctx.cpuAction.cardName} (${ctx.cpuAction.cardType})${ctx.cpuAction.targetPlayer ? ' contro ' + ctx.cpuAction.targetPlayer : ''}${ctx.cpuAction.damage ? ' (danno: ' + ctx.cpuAction.damage + ')' : ''}.
Spiega brevemente perché la CPU ha fatto questa scelta e cosa potrebbe fare il giocatore per rispondere.`;
      }
      break;
    case 'human_turn_start':
      prompt += `\n\nÈ il turno del giocatore umano. Analizza le sue carte in mano e il campo, poi suggerisci quale carta giocare e perché. Se non ha personaggi in campo, suggerisci di giocarne uno. Se ha una mossa forte e il nemico è debole, suggerisci di attaccare.`;
      break;
    case 'human_question':
      prompt += `\n\nIl giocatore ha chiesto: "${ctx.humanQuestion}"
Rispondi alla sua domanda in modo chiaro e utile, nel contesto della partita in corso.`;
      break;
    case 'defense_prompt':
      prompt += `\n\nIl giocatore è stato attaccato! Spiega come funziona la difesa e consiglia se difendersi o meno in base alle carte in mano.`;
      break;
    case 'attack_prompt':
      prompt += `\n\nIl giocatore vuole attaccare. Spiega come selezionare il bersaglio e quale nemico conviene attaccare.`;
      break;
  }

  return prompt;
}

export async function generateHelpMessage(
  gameId: string,
  event: HelpEvent,
  context: HelpContext
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return getFallbackMessage(event);
    }

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildContextMessage(event, context) },
      ],
      max_tokens: 200,
      temperature: 0.7,
    });

    const msg = response.choices[0]?.message?.content?.trim();
    if (!msg) return getFallbackMessage(event);
    return msg;
  } catch (error) {
    console.error('[HelpCoach] OpenAI error:', error);
    return getFallbackMessage(event);
  }
}

function getFallbackMessage(event: HelpEvent): string {
  const tips = FALLBACK_TIPS[event] || FALLBACK_TIPS.human_question;
  return tips[Math.floor(Math.random() * tips.length)];
}

export function getCardNameFromUrl(url: string): string {
  try {
    const parts = url.split('/');
    const filename = parts[parts.length - 1] || '';
    return filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch {
    return 'Carta';
  }
}

export function buildHelpContext(
  gameState: any,
  humanPlayerName: string,
  cpuAction?: { cardName: string; cardType: string; targetPlayer?: string; damage?: number }
): HelpContext {
  const humanPlayer = gameState.players[humanPlayerName];
  const hand = (humanPlayer?.hand || []).map((c: any) => ({
    type: c.type,
    name: c.name || getCardNameFromUrl(c.frontImage || ''),
    pti: c.pti,
    stars: c.stars,
    effect: c.effect,
    mosseDamageValue: c.mosseDamageValue,
  }));

  const fieldCards = (gameState.field || [])
    .filter((c: any) => c.type === 'personaggi' || c.type === 'personaggi_speciali')
    .map((c: any) => ({
      owner: c.owner,
      type: c.type,
      name: c.name || getCardNameFromUrl(c.frontImage || ''),
      pti: c.pti,
      stars: c.stars,
    }));

  const currentPlayer = gameState.turnOrder?.[gameState.currentTurnIndex] || '';

  return {
    humanPlayerName,
    humanHand: hand,
    fieldCards,
    currentTurnPlayer: currentPlayer,
    cpuAction,
  };
}

export function emitHelpMessage(io: any, gameId: string, message: string) {
  io.to(gameId).emit('chat-message', {
    id: `help-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    playerName: 'Assistente',
    message: `[AIUTO] ${message}`,
    timestamp: Date.now(),
    isHelp: true,
  });
}
