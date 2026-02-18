import posthog from 'posthog-js';

let isInitialized = false;

export async function initPostHog(): Promise<void> {
  if (isInitialized) {
    return;
  }

  try {
    const response = await fetch('/api/posthog-key');
    if (!response.ok) {
      console.warn('Failed to fetch PostHog API key');
      return;
    }

    const data = await response.json();
    const apiKey = data.key || data.apiKey;

    if (!apiKey) {
      console.warn('PostHog API key not provided');
      return;
    }

    posthog.init(apiKey, {
      api_host: apiKey.startsWith('phc_') ? 'https://us.i.posthog.com' : 'https://eu.i.posthog.com',
      autocapture: false,
      capture_pageview: true,
      persistence: 'localStorage',
    });

    isInitialized = true;
    console.log('PostHog initialized successfully');
  } catch (error) {
    console.error('Error initializing PostHog:', error);
  }
}

function ensureInitialized(): boolean {
  if (!isInitialized) {
    console.warn('PostHog is not initialized');
    return false;
  }
  return true;
}

export function trackGameEvent(
  eventName: string,
  properties?: Record<string, any>
): void {
  if (!ensureInitialized()) return;
  posthog.capture(eventName, properties || {});
}

export function trackCardPlayed(
  cardName: string,
  cardType: string,
  playerName: string
): void {
  if (!ensureInitialized()) return;
  posthog.capture('card_played', {
    card_name: cardName,
    card_type: cardType,
    player_name: playerName,
  });
}

export function trackGameStarted(
  gameId: string,
  playerCount: number,
  hasCPU: boolean
): void {
  if (!ensureInitialized()) return;
  posthog.capture('game_started', {
    game_id: gameId,
    player_count: playerCount,
    has_cpu: hasCPU,
  });
}

export function trackGameEnded(
  gameId: string,
  winner: string,
  duration: number,
  turnsPlayed: number
): void {
  if (!ensureInitialized()) return;
  posthog.capture('game_ended', {
    game_id: gameId,
    winner,
    duration_seconds: duration,
    turns_played: turnsPlayed,
  });
}

export function trackFeatureUsed(
  featureName: string,
  details?: Record<string, any>
): void {
  if (!ensureInitialized()) return;
  posthog.capture('feature_used', {
    feature_name: featureName,
    ...details,
  });
}

export function trackMatchDuration(durationSeconds: number): void {
  if (!ensureInitialized()) return;
  posthog.capture('match_duration', {
    duration_seconds: durationSeconds,
  });
}

export function identifyPlayer(
  playerName: string,
  properties?: Record<string, any>
): void {
  if (!ensureInitialized()) return;
  posthog.identify(playerName, properties || {});
}

export function trackDeckSelected(deckType: string): void {
  if (!ensureInitialized()) return;
  posthog.capture('deck_selected', {
    deck_type: deckType,
  });
}

export function trackTutorialStep(step: number, completed: boolean): void {
  if (!ensureInitialized()) return;
  posthog.capture('tutorial_step', {
    step,
    completed,
  });
}

export function trackVoiceChatUsed(gameId: string): void {
  if (!ensureInitialized()) return;
  posthog.capture('voice_chat_used', {
    game_id: gameId,
  });
}

export function trackMusicPlayed(trackName: string): void {
  if (!ensureInitialized()) return;
  posthog.capture('music_played', {
    track_name: trackName,
  });
}
