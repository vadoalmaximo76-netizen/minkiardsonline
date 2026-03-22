import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Deck } from "./Deck";
import { PlayerHand } from "./PlayerHand";
import { OtherPlayersHands } from "./OtherPlayersHands";
import { CPUControls } from "./CPUControls";
import { RoundTable } from "./RoundTable";
import { Graveyard } from "./Graveyard";
import { Chat } from "./Chat";
import { ChatNotification } from "./ChatNotification";
import { Calculator } from "./Calculator";
import { CardModal } from "./CardModal";
import { DiceModal } from "./DiceModal";
import { FullScreenNotification } from "./FullScreenNotification";
import { PersonaggioNotification } from "./PersonaggioNotification";
import { EvolutionAnimation } from "./EvolutionAnimation";
import { FusionAnimation } from "./FusionAnimation";
import { CardAnimation } from "./CardAnimation";
import { CustomAnimationOverlay } from "./CustomAnimationOverlay";
import { AddCardsModal } from "./AddCardsModal";
import { PlayerOrderNotification } from "./PlayerOrderNotification";
import { NextTurnNotification } from "./NextTurnNotification";
import { LeaveGameNotification } from "./LeaveGameNotification";
import { TimedEffectBanner } from "./TimedEffectBanner";
import { SuperDice } from "./SuperDice";
import { TransferRequestDialog } from "./TransferRequestDialog";
import { DefenseDialog } from "./DefenseDialog";
import { ContrattazioneDialog } from "./ContrattazioneDialog";
import { AttackInterceptorPanel } from "./AttackInterceptorPanel";
import { ClashBattle } from "./ClashBattle";
import { CPUDamageDialog } from "./CPUDamageDialog";
import { DuelBattleOverlay } from "./DuelBattleOverlay";
import { RecursiveDamagePanel } from "./RecursiveDamagePanel";
import AuctionOverlay from "./AuctionOverlay";
import { HandModal } from "./HandModal";
import { Dice3D } from "./Dice3D";
import { CardShatter3D } from "./CardShatter3D";
import { AttackSlash3D } from "./AttackSlash3D";
import { MusicPlayer } from "./MusicPlayer";
import { VoiceChat } from "./VoiceChat";
import { YouTubeVideoModal } from "./YouTubeVideoModal";
import { PickedCardModal } from "./PickedCardModal";
import { SorosActivation } from "./SorosActivation";
import { CharacterEffects } from "./CharacterEffects";
import { getDamageEffectType, AttackEffectType } from "../lib/attackEffects";
import { trackGameStarted, trackGameEnded, trackCardPlayed, trackFeatureUsed, identifyPlayer, trackVoiceChatUsed } from "../lib/posthog";
import { TutorialOverlay } from "./TutorialOverlay";
import { AdBanner, InterstitialAd } from "./AdBanner";
import { GameEndRewardsPanel } from "./GameEndRewardsPanel";
import { ConnectionStatus } from "./ConnectionStatus";
import { GameToastContainer, useGameToast } from "./GameToast";
import { ContextualTooltipLoader, ContextualTooltipDisplay, useTooltipStore } from "./ContextualTooltip";
import { haptic } from "../lib/haptic";
import { SoundSettings } from "./SoundSettings";
import { LastPlayedCards } from "./LastPlayedCards";
import { GameLog } from "./GameLog";
import { MissionsPanel } from "./MissionsPanel";
import { AchievementsPanel } from "./AchievementsPanel";
import { RankiardLeaderboard } from "./RankiardLeaderboard";
import StatsPanel from "./StatsPanel";
import { ProfilePanel } from "./ProfilePanel";
import { CollectionPanel } from "./CollectionPanel";
import { TableThemeSelector } from "./TableThemeSelector";
import useTableTheme from "../lib/stores/useTableTheme";
import { EmojiReactions } from "./EmojiReactions";
import { JoinRequestDialog } from "./JoinRequestDialog";
import CardTrailParticles from "./CardTrailParticles";
import AmbientParticles from "./AmbientParticles";
import { GameBoard3D } from "./GameBoard3D";
import VictoryDefeatAnimation from "./VictoryDefeatAnimation";
import { AnimatedNumber } from "./AnimatedNumber";
import { PreGameLobbyPanel } from "./PreGameLobbyPanel";
import { InvitePanel } from "./InvitePanel";
import { useScreenShake } from "../lib/useScreenShake";
import { useGameState } from "../lib/stores/useGameState";
import { useAudio } from "../lib/stores/useAudio";
import { useBackgroundEffect } from "../lib/stores/useBackgroundEffect";
import { socket } from "../lib/socket";
import { getOptimizedUrl, onCloudNameReady, getCloudinaryCloudName } from "../lib/imagePreloader";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink, Crown, Star, Hand, Music, Shuffle, User, LogOut, Target, Trophy, SkipForward, ScrollText, Settings, MoreVertical, BookOpen, UserPlus, RotateCcw, PlusCircle, ChevronDown, Palette, BarChart2 } from "lucide-react";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";

const _isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  avatar: string | null;
  puntiRankiard?: number;
}

interface GameBoardProps {
  authenticatedUser?: AuthUser | null;
  onLogout?: () => void;
  authToken?: string | null;
  isTrainingMode?: boolean;
  isGymMode?: boolean;
  onBack?: () => void;
  onLeaveGame?: () => void;
  onContinueTournament?: () => void;
  onContinueFantaTournament?: (fantaId: string) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ authenticatedUser, onLogout, authToken, onBack, onLeaveGame, onContinueTournament, onContinueFantaTournament, isGymMode }) => {
  const [, _forceCloudUpdate] = useState(0);
  const _cloudNameReadyAtMount = useRef(!!getCloudinaryCloudName());
  useEffect(() => {
    if (!_cloudNameReadyAtMount.current) {
      return onCloudNameReady(() => _forceCloudUpdate(n => n + 1));
    }
  }, []);

  // Request browser notification permission for turn alerts
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const [chatOpen, setChatOpen] = useState(false);
  const [soundSettingsOpen, setSoundSettingsOpen] = useState(false);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);
  const [graveyardOpen, setGraveyardOpen] = useState(false);
  const [missionsOpen, setMissionsOpen] = useState(false);
  const [achievementsOpen, setAchievementsOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [gameLogOpen, setGameLogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [diceOpen, setDiceOpen] = useState(false);
  const [diceResult, setDiceResult] = useState<number | undefined>();
  const [playerWhoRolled, setPlayerWhoRolled] = useState<string | undefined>();
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationPlayer, setNotificationPlayer] = useState<string>("");
  const [notificationCardCount, setNotificationCardCount] = useState<number>(0);
  const [notificationTitle, setNotificationTitle] = useState<string>("");
  const [timedEffectBannerVisible, setTimedEffectBannerVisible] = useState(false);
  const [timedEffectBannerCard, setTimedEffectBannerCard] = useState<string>("");
  const [timedEffectBannerPlayer, setTimedEffectBannerPlayer] = useState<string>("");
  const [timedEffectBannerDesc, setTimedEffectBannerDesc] = useState<string>("");
  const [unreadMessages, setUnreadMessages] = useState<number>(0);
  const [scenarioCardsActive, setScenarioCardsActive] = useState<boolean>(false);
  const [showRotationWarning, setShowRotationWarning] = useState(true);
  const [ciaoNotificationVisible, setCiaoNotificationVisible] = useState(false);
  const [ciaoCardName, setCiaoCardName] = useState<string>("");
  const [personaggioNotificationVisible, setPersonaggioNotificationVisible] = useState(false);
  const [personaggioCardName, setPersonaggioCardName] = useState<string>("");
  const [personaggioMessage, setPersonaggioMessage] = useState<string>("");
  const [personaggioCardImage, setPersonaggioCardImage] = useState<string>("");
  const [addCardsModalOpen, setAddCardsModalOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem("minkiards-tutorial-completed") !== "true";
  });
  const [playerOrderVisible, setPlayerOrderVisible] = useState(false);
  const [playerOrder, setPlayerOrder] = useState<string[]>([]);
  const [nextTurnVisible, setNextTurnVisible] = useState(false);
  const [nextTurnPlayer, setNextTurnPlayer] = useState<string>("");
  const [leaveGameVisible, setLeaveGameVisible] = useState(false);
  const [leavingPlayer, setLeavingPlayer] = useState<string>("");
  const [turnTimerState, setTurnTimerState] = useState<{ active: boolean; seconds: number; playerName: string; isWarning: boolean }>({ active: false, seconds: 30, playerName: '', isWarning: false });
  const turnTimerIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const timerPlayerRef = React.useRef<string>('');
  const [rematchState, setRematchState] = useState<{ votes: number; total: number; voters: string[]; declined: boolean; declinedBy: string; expired: boolean; newGameId: string | null }>({ votes: 0, total: 0, voters: [], declined: false, declinedBy: '', expired: false, newGameId: null });
  const [bo3State, setBo3State] = useState<{ votes: number; total: number; voters: string[]; declined: boolean; declinedBy: string; seriesScore: { [name: string]: number }; seriesEnded: boolean; seriesWinner: string; seriesStarted: boolean; newGameId: string | null }>({ votes: 0, total: 0, voters: [], declined: false, declinedBy: '', seriesScore: {}, seriesEnded: false, seriesWinner: '', seriesStarted: false, newGameId: null });
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [superDiceOpen, setSuperDiceOpen] = useState(false);
  const [showCpuControls, setShowCpuControls] = useState(false);
  const [is3DMode, setIs3DMode] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [chatNotifications, setChatNotifications] = useState<Array<{
    id: string;
    message: string;
    playerName: string;
    isGymLeader?: boolean;
  }>>([]);
  const [rankiardOpen, setRankiardOpen] = useState(false);
  const [rankiardPoints, setRankiardPoints] = useState<string>(() => {
    return localStorage.getItem('rankiard-points') || '';
  });
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [gameInstruction, setGameInstruction] = useState('');
  const [conversationMode, setConversationMode] = useState(false);
  const [assistantQuestion, setAssistantQuestion] = useState('');
  const [conversationHistory, setConversationHistory] = useState<Array<{
    type: 'user' | 'assistant';
    message: string;
    timestamp: number;
  }>>([]);
  const [lobbyCharacterLimit, setLobbyCharacterLimit] = useState('3');
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [eliminationDialogOpen, setEliminationDialogOpen] = useState(false);
  const [victoryDialogOpen, setVictoryDialogOpen] = useState(false);
  const [victoryPlayer, setVictoryPlayer] = useState<string>('');
  const [showInterstitialAd, setShowInterstitialAd] = useState(false);
  const [gameEndRewards, setGameEndRewards] = useState<{
    visible: boolean;
    pointsEarned: number;
    previousTotal: number;
    newTotal: number;
    placement: number;
    isWinner: boolean;
    winnerName: string;
  }>({ visible: false, pointsEarned: 0, previousTotal: 0, newTotal: 0, placement: 0, isWinner: false, winnerName: '' });
  const [cardTrailParticles, setCardTrailParticles] = useState<{ visible: boolean; cardType: string; x: number; y: number }>({ visible: false, cardType: '', x: 0, y: 0 });
  const [victoryDefeatAnim, setVictoryDefeatAnim] = useState<{ visible: boolean; type: 'victory' | 'defeat'; playerName: string; stats?: { cardsPlayed: number; totalDamageDealt: number; totalDamageReceived: number; turnsPlayed: number; matchDuration: number; finalBlowCard?: { name: string; imageUrl?: string; deckType: string } } }>({ visible: false, type: 'victory', playerName: '' });
  const { shake } = useScreenShake();
  const [removePlayerDialogOpen, setRemovePlayerDialogOpen] = useState(false);
  const [playerEliminationNotification, setPlayerEliminationNotification] = useState<{
    visible: boolean;
    player: string;
  }>({ visible: false, player: '' });
  const { handModalOpen, setHandModalOpen } = useGameState();
  const [specialMoveOverlay, setSpecialMoveOverlay] = useState<{
    visible: boolean;
    moveName: string;
    damage: number;
    attackerName: string;
    category: string | null;
  }>({ visible: false, moveName: '', damage: 0, attackerName: '', category: null });
  const [evolutionAnim, setEvolutionAnim] = useState<{
    visible: boolean;
    key: number;
    type: 'evolution' | 'transformation' | 'taroccata';
    oldName: string;
    newName: string;
    oldImage: string;
    newImage: string;
    playerName: string;
    pti?: number;
    stars?: number;
  }>({ visible: false, key: 0, type: 'evolution', oldName: '', newName: '', oldImage: '', newImage: '', playerName: '' });
  const [fusionAnim, setFusionAnim] = useState<{
    visible: boolean;
    key: number;
    card1Name: string;
    card2Name: string;
    card1Image: string;
    card2Image: string;
    resultName: string;
    resultImage: string;
    playerName: string;
    fusionType: 'fusione' | 'unione_clandestina' | 'ameeco';
    resultPti?: number;
    resultStars?: number;
  }>({ visible: false, key: 0, card1Name: '', card2Name: '', card1Image: '', card2Image: '', resultName: '', resultImage: '', playerName: '', fusionType: 'fusione' });
  const [cardAnimationVisible, setCardAnimationVisible] = useState(false);
  const [cardAnimationName, setCardAnimationName] = useState<string>("");
  const [customAnimationVisible, setCustomAnimationVisible] = useState(false);
  const [customAnimationData, setCustomAnimationData] = useState<{ cardName: string; animationDescription: string } | null>(null);
  const [sorosActivationVisible, setSorosActivationVisible] = useState(false);
  const [sorosData, setSorosData] = useState<{ activator: string; cardImage: string } | null>(null);
  const [attackEffectVisible, setAttackEffectVisible] = useState(false);
  const [attackedCharacterName, setAttackedCharacterName] = useState<string>("");
  const [attackEffectType, setAttackEffectType] = useState<AttackEffectType>('physical');
  const [attackSlash3D, setAttackSlash3D] = useState<{ visible: boolean; attackerName: string; targetName: string; damage: number }>({ visible: false, attackerName: '', targetName: '', damage: 0 });
  const [damageVignetteVisible, setDamageVignetteVisible] = useState(false);
  const damageVignetteTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [cinematicFlash, setCinematicFlash] = useState<{ visible: boolean; type: 'attack' | 'heal' }>({ visible: false, type: 'attack' });
  const [cardShatter3D, setCardShatter3D] = useState<{ visible: boolean; cardImage: string; cardName: string }>({ visible: false, cardImage: '', cardName: '' });
  const [attackEffectKey, setAttackEffectKey] = useState(0);
  const [deathEffectVisible, setDeathEffectVisible] = useState(false);
  const [deadCharacterName, setDeadCharacterName] = useState<string>("");
  const [deathEffectKey, setDeathEffectKey] = useState(0);
  const [choosingNotification, setChoosingNotification] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [blockTypeSelection, setBlockTypeSelection] = useState<{ visible: boolean; options: string[]; turns: number } | null>(null);
  const [daddyConteDialog, setDaddyConteDialog] = useState<{ visible: boolean; characters: Array<{id: string; name: string; frontImage: string; owner: string}> } | null>(null);
  const [fabrizioDialog, setFabrizioDialog] = useState<{ visible: boolean; characterName: string; characterId: string; currentPti: number } | null>(null);
  const [controlTurnPanel, setControlTurnPanel] = useState<{ visible: boolean; controlledPlayer: string; availableTypes: string[]; possibleTargets: string[]; selectedType: string | null; selectedTarget: string | null }>({ visible: false, controlledPlayer: '', availableTypes: [], possibleTargets: [], selectedType: null, selectedTarget: null });
  const [controlTurnTargetPanel, setControlTurnTargetPanel] = useState<{ visible: boolean; opponents: string[] }>({ visible: false, opponents: [] });
  const [cpuThinkingPlayer, setCpuThinkingPlayer] = useState<string | null>(null);
  const [helpBanner, setHelpBanner] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [graveyardSelectionModal, setGraveyardSelectionModal] = useState<{
    visible: boolean;
    reason: string;
    cards: any[];
    message: string;
  }>({ visible: false, reason: '', cards: [], message: '' });
  const [ptiInputPanel, setPtiInputPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    effectDescription: string;
  }>({ visible: false, cardId: '', cardName: '', effectDescription: '' });
  const [ptiInputValue, setPtiInputValue] = useState<string>('');
  const [ptiDistributionPanel, setPtiDistributionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    cardImage: string;
    totalBudget: number;
    ptiPerStar: number;
  }>({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 });
  const [distributionPti, setDistributionPti] = useState<number>(1000);
  const [distributionStars, setDistributionStars] = useState<number>(0);
  const [deckSelectionPanel, setDeckSelectionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    effectDescription: string;
    excludeSpeciali?: boolean;
  }>({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
  const [deckCardPickerPanel, setDeckCardPickerPanel] = useState<{
    visible: boolean;
    cardId: string;
    deckType: string;
    deckDisplayName: string;
    cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>;
  }>({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] });
  const [swapSelectionPanel, setSwapSelectionPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    otherPlayers: string[];
    effectDescription: string;
  }>({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' });
  const [diceControlPanel, setDiceControlPanel] = useState<{
    visible: boolean;
    rollingPlayer: string;
    controllingPlayer: string;
    controllingCardName: string;
    pendingId?: string;
    targetCharName?: string;
  }>({ visible: false, rollingPlayer: '', controllingPlayer: '', controllingCardName: '' });
  const [targetSelectionModal, setTargetSelectionModal] = useState<{
    visible: boolean;
    effectType: 'damage' | 'heal';
    value: number;
    maxTargets: number;
    targets: Array<{ id: string; frontImage: string; owner: string; text?: string; name?: string }>;
    message: string;
  }>({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [parasiticTargetSelect, setParasiticTargetSelect] = useState<{
    visible: boolean;
    parasiticCardId: string;
    parasiticType: 'PARASSITA' | 'SAIBAIM' | null;
    targets: Array<{ id: string; frontImage: string; owner: string; text?: string }>;
  }>({ visible: false, parasiticCardId: '', parasiticType: null, targets: [] });
  const [saibaImExplosionVisible, setSaibaImExplosionVisible] = useState(false);
  const [cimiceEffectData, setCimiceEffectData] = useState<{
    visible: boolean;
    type: 'attack' | 'death';
    damagePerCard: number;
    affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }>;
    message: string;
  } | null>(null);
  const [clashBattleData, setClashBattleData] = useState<{
    visible: boolean;
    clashId: string;
    attacker: string;
    defender: string;
    damageValue: number;
    duration: number;
  } | null>(null);
  
  // YouTube Video Modal
  const [youtubeVideoData, setYoutubeVideoData] = useState<{
    visible: boolean;
    youtubeUrl: string;
    cardName: string;
    playerName: string;
    cardType?: string;
  } | null>(null);
  
  // DICE SYSTEM - Character selection modal (choose which characters to involve)
  const [diceCharacterSelectModal, setDiceCharacterSelectModal] = useState<{
    visible: boolean;
    diceEffectId: string;
    cardName: string;
    correctEffect: string;
    wrongEffect: string;
    availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    selectedCharacterIds: string[];
  }>({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', availableCharacters: [], selectedCharacterIds: [] });
  
  // DICE SYSTEM - Selection modal for dice effect cards (number selection)
  const [diceSelectionModal, setDiceSelectionModal] = useState<{
    visible: boolean;
    diceEffectId: string;
    cardName: string;
    correctEffect: string;
    wrongEffect: string;
    involvedCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    myCharacterIds: string[];
  }>({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', involvedCharacters: [], myCharacterIds: [] });
  const [diceChoices, setDiceChoices] = useState<Record<string, string>>({});
  const [diceRollResult, setDiceRollResult] = useState<{
    visible: boolean;
    result: number;
    winners: Array<{ name: string; effect: string }>;
    losers: Array<{ name: string; effect: string }>;
  } | null>(null);
  // AUTO DICE: Result modal for automatic dice rolls
  const [autoDiceResult, setAutoDiceResult] = useState<{
    visible: boolean;
    cardName: string;
    diceResult: number;
    effect: string;
    affectedCharacters: Array<{ charId: string; charName: string; effect: string }>;
    isAnimating: boolean;
    animationPhase: 'rolling' | 'result' | 'effects';
  }>({ visible: false, cardName: '', diceResult: 0, effect: '', affectedCharacters: [], isAnimating: false, animationPhase: 'rolling' });
  // FOLATA DI VENTO: Wind dice roll animation visible to all players
  const [windDiceRoll, setWindDiceRoll] = useState<{ visible: boolean; value: number; playerName: string }>({ visible: false, value: 0, playerName: '' });
  // EVOLUTION DICE ROLL: Dice-based evolution variant animation
  const [evolutionDiceRoll, setEvolutionDiceRoll] = useState<{ visible: boolean; characterName: string; playerName: string; diceResult: number; evolutionTarget: string | null; animationPhase: 'rolling' | 'result' }>({ visible: false, characterName: '', playerName: '', diceResult: 0, evolutionTarget: null, animationPhase: 'rolling' });
  // CUSTOM TARGET SELECTION: Modal for choosing targets for custom effects with [BERSAGLIO: scelta]
  const [customTargetModal, setCustomTargetModal] = useState<{
    visible: boolean;
    selectionId: string;
    cardId: string;
    cardName: string;
    owner: string;
    availableTargets: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
    maxSelections?: number;
    title?: string;
    subtitle?: string;
  }>({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
  const [customSelectedTargets, setCustomSelectedTargets] = useState<string[]>([]);
  // AUTO DICE SETUP: Modal for configuring automatic dice before rolling
  const [autoDiceSetupModal, setAutoDiceSetupModal] = useState<{
    visible: boolean;
    autoDiceId: string;
    cardName: string;
    defaultEffects: Record<number, string>;
    availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
    initiatorPlayer: string;
  }>({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
  const [autoDiceSelectedChars, setAutoDiceSelectedChars] = useState<string[]>([]);
  const [autoDiceCustomEffects, setAutoDiceCustomEffects] = useState<Record<number, string>>({});
  // REVEAL: Modal showing revealed opponent cards
  const [revealedCards, setRevealedCards] = useState<{
    visible: boolean;
    revealedBy: string;
    hands: Record<string, Array<{id: string; name: string; frontImage: string; type: string; pti: number | null; stars: number | null}>>;
  }>({ visible: false, revealedBy: '', hands: {} });
  // AUCTION SYSTEM
  const [auctionData, setAuctionData] = useState<any>(null);
  const [auctionBidUpdate, setAuctionBidUpdate] = useState<any>(null);
  const [auctionCountdownUpdate, setAuctionCountdownUpdate] = useState<any>(null);
  const [auctionResult, setAuctionResult] = useState<any>(null);
  const [auctionDeckPicker, setAuctionDeckPicker] = useState<{
    visible: boolean;
    cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>;
    initiator: string;
  }>({ visible: false, cards: [], initiator: '' });
  const [lastPlayedCards, setLastPlayedCards] = useState<Array<{
    id: string;
    frontImage: string;
    name?: string;
    playerName: string;
    timestamp: number;
    cardType: string;
  }>>([]);
    const { selectedCard, setSelectedCard, gameId, playerName, gameState, setGameId, setUserRankiardPoints, addPRSpent, prSpentThisGame, resetPRSpent, clearSession } = useGameState();
  const fantaTournamentId = (gameState as any)?.fantaTournamentId as string | null | undefined;
  const { playGameStart, playPlayerJoin, playChatMessage, playCardToGraveyard, playDiceRoll, playDamageSound, playBeeSound, playCharacterSound, playCardAnimationSound, initAudioContext, toggleMute, isMuted, playAttackSound, playDeathSound, playCardPickup, playCardPlay, playTurnChange, playBonusActivated, playMyTurn, playDeckShuffle, playEffectActivate, playHostageApplied, playHostageReleased, playPersonaggioEnter, playCardReveal, playErrorSound, playPlayerEliminated, playSorosActivation, playFusionSound, playCardPlayedToField, playVictory, playDefeat, playButtonClick, playPanelOpen, playPanelClose, playModalOpen, playModalClose, playConfirm } = useAudio();


  const shareInviteLink = () => {
    const link = `${window.location.origin}?game=${gameId}`;
    navigator.clipboard.writeText(link);
    alert("Invitation link copied to clipboard!");
  };

  const handleOpenChat = () => {
    setChatOpen(true);
    setUnreadMessages(0); // Reset unread count when opening chat
  };

  const handleCloseChat = () => {
    setChatOpen(false);
  };

  const handleRankiardPointsChange = (value: string) => {
    setRankiardPoints(value);
    localStorage.setItem('rankiard-points', value);
  };

  const handleExecuteGameInstruction = () => {
    if (!gameInstruction.trim()) {
      alert("Inserisci un'istruzione per modificare il gioco");
      return;
    }

    // Add user message to conversation history
    const userMessage = {
      type: 'user' as const,
      message: gameInstruction.trim(),
      timestamp: Date.now()
    };
    setConversationHistory(prev => [...prev, userMessage]);

    // Send instruction to server for AI processing
    socket.emit('game-instruction', {
      gameId,
      playerName,
      instruction: gameInstruction.trim()
    });

    setGameInstruction('');
  };

  const removeChatNotification = (notificationId: string) => {
    setChatNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const handleResetGame = () => {
    if (confirm("Sei sicuro di voler ricominciare la partita? Tutte le carte verranno rimesse nei mazzi.")) {
      socket.emit('reset-game', { gameId });
      // Reset scenario cards state when game is reset
      setScenarioCardsActive(false);
      // Clear last played cards history
      setLastPlayedCards([]);
    }
  };

  const handleNewGame = () => {
    if (confirm("Sei sicuro di voler creare una nuova partita? Entrerai in una nuova stanza di gioco.")) {
      // Generate a new room code (6 characters uppercase)
      const newGameId = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Update game ID in state
      setGameId(newGameId);
      
      // Update URL
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('game', newGameId);
      window.history.pushState({}, '', newUrl);
      
      // Clear last played cards history for new game
      setLastPlayedCards([]);
      
      // Join the new game room
      socket.emit('join-game', { gameId: newGameId, playerName, userId: authenticatedUser?.id });
    }
  };

  const handleStartGame = () => {
    if (isStartingGame) return;
    setIsStartingGame(true);
    if ((gameState as any)?.tournamentCharacterLimit) {
      socket.emit('start-game', { gameId, playerName, characterLimit: (gameState as any).tournamentCharacterLimit });
      return;
    }
    socket.emit('start-game', { gameId, playerName, characterLimit: lobbyCharacterLimit });
  };

  // Reset isStartingGame when the game actually starts
  useEffect(() => {
    if ((gameState as any)?.isPlaying && isStartingGame) {
      setIsStartingGame(false);
    }
  }, [(gameState as any)?.isPlaying, isStartingGame]);

  const handleLobbyCharacterLimitChange = (limit: string) => {
    setLobbyCharacterLimit(limit);
    socket.emit('set-lobby-settings', { gameId, playerName, characterLimit: limit });
  };

  const handleLeaveGame = () => {
    if (confirm("Sei sicuro di voler lasciare la partita? Diventerai uno spettatore.")) {
      socket.emit('leave-game', { gameId, playerName });
      onLeaveGame?.();
      onBack?.();
      clearSession();
    }
  };

  // Sync scenarioCardsActive with game state
  useEffect(() => {
    if (gameState?.scenarioCardsActive !== undefined) {
      setScenarioCardsActive(gameState.scenarioCardsActive);
    }
  }, [gameState?.scenarioCardsActive]);

  useEffect(() => {
    if (gameState?.characterLimit && !(gameState as any)?.isPlaying) {
      setLobbyCharacterLimit(gameState.characterLimit);
    }
  }, [gameState?.characterLimit, (gameState as any)?.isPlaying]);

  // Sync user's Rankiard points to the store when authenticated user changes
  useEffect(() => {
    if (authenticatedUser?.puntiRankiard !== undefined) {
      setUserRankiardPoints(authenticatedUser.puntiRankiard);
    }
  }, [authenticatedUser?.puntiRankiard, setUserRankiardPoints]);

  // Reset PR spent when starting a new game
  useEffect(() => {
    if (gameId) {
      resetPRSpent();
    }
  }, [gameId, resetPRSpent]);

  // Initialize audio context and play game start sound on mount
  useEffect(() => {
    initAudioContext();
    const timer = setTimeout(() => {
      playGameStart();
    }, 500);
    return () => {
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handleGameReset = ({ message }: { message: string }) => {
      alert(message);
    };

    const handlePlayerJoined = ({ playerName: newPlayer }: { playerName: string }) => {
      // Play sound when a new player joins
      playPlayerJoin();
    };

    const handleCardShown = ({ cardImage, fromPlayer, message }: { cardImage: string, fromPlayer: string, message: string }) => {
      // Create a modal-like notification to show the card
      const modal = document.createElement('div');
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; z-index: 9999;';
      
      modal.innerHTML = `
        <div style="background: #1f2937; padding: 24px; border-radius: 8px; text-align: center; max-width: 400px;">
          <h3 style="color: white; margin-bottom: 16px; font-weight: bold;">${message}</h3>
          <img src="${cardImage}" alt="Shown card" style="width: 160px; height: 224px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); margin-bottom: 16px;">
          <button style="background: #3b82f6; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;" onclick="this.closest('div').parentElement.remove()">Chiudi</button>
        </div>
      `;
      
      document.body.appendChild(modal);
      
      // Auto-remove after 10 seconds
      setTimeout(() => {
        if (modal.parentElement) {
          modal.remove();
        }
      }, 10000);
    };

    const handleCardShowConfirmed = ({ message }: { message: string }) => {
      alert(message);
    };

    const handleDiceRoll = ({ result, playerName }: { result: number, playerName: string }) => {
      setDiceResult(result);
      setPlayerWhoRolled(playerName);
      setDiceOpen(true);
      
      // Play dice roll sound when anyone rolls the dice
      playDiceRoll();
    };

    const handleDiceWindowOpen = ({ playerName: opener }: { playerName: string }) => {
      setDiceResult(undefined);
      setPlayerWhoRolled(undefined);
      setDiceOpen(true);
    };

    const handleGraveyardMilestone = ({ playerName: achievingPlayer, cardCount, title }: { playerName: string, cardCount: number, title: string }) => {
      setNotificationPlayer(achievingPlayer);
      setNotificationCardCount(cardCount);
      setNotificationTitle(title);
      setNotificationVisible(true);
    };

    const handleChatMessage = (message: { id: string; playerName: string; message: string; timestamp: number; isHelp?: boolean; isGymLeader?: boolean }) => {
      const isSystemEvent = message.playerName === 'Sistema';
      
      if (gameId) {
        try {
          const storedMessages = localStorage.getItem(`chat_messages_${gameId}`);
          const existingMessages = storedMessages ? JSON.parse(storedMessages) : [];
          if (!existingMessages.some((m: any) => m.id === message.id)) {
            const newMessages = [...existingMessages, message];
            localStorage.setItem(`chat_messages_${gameId}`, JSON.stringify(newMessages));
          }
        } catch (error) {
          console.error('Error persisting chat message:', error);
        }
      }

      if (message.isHelp) {
        const cleanMsg = message.message.replace(/^\[AIUTO\]\s*/, '');
        setHelpBanner({ visible: true, message: cleanMsg });
      }
      
      if (isSystemEvent) return;
      
      if (!chatOpen && message.playerName !== playerName) {
        setUnreadMessages(prev => prev + 1);
        
        setChatNotifications(prev => [...prev, {
          id: message.id,
          message: message.message,
          playerName: message.playerName,
          isGymLeader: message.isGymLeader,
        }]);
      }
      playChatMessage();
    };

    const handleScenarioCardsToggled = ({ active }: { active: boolean }) => {
      setScenarioCardsActive(active);
    };

    const handleCardAttacked = ({ targetCardName, fromPlayer, toPlayer, damageValue, attackerName, targetOwner }: { targetCardName?: string, fromPlayer?: string, toPlayer?: string, damageValue?: number, attackerName?: string, targetOwner?: string }) => {
      const attacker = fromPlayer || attackerName || '???';
      const defender = toPlayer || targetOwner || '???';
      const target = targetCardName || defender;
      const dmg = damageValue || 0;
      console.log(`${attacker} attacked ${defender}'s ${target} for ${dmg} damage`);
      setAttackedCharacterName(target);
      setAttackEffectType(getDamageEffectType(dmg));
      setAttackEffectVisible(false);
      setTimeout(() => {
        setAttackEffectKey(prev => prev + 1);
        setAttackEffectVisible(true);
      }, 10);
      setAttackSlash3D({ visible: true, attackerName: attacker, targetName: target, damage: dmg });
      if (dmg >= 30) {
        setCinematicFlash({ visible: true, type: 'attack' });
        setTimeout(() => setCinematicFlash({ visible: false, type: 'attack' }), 700);
      }
      shake(dmg > 50 ? 'heavy' : dmg > 20 ? 'medium' : 'light');
      playAttackSound();
      playDamageSound();
      // Screen damage vignette when the current player's card is hit
      if (targetOwner === playerName && dmg > 0) {
        if (damageVignetteTimerRef.current) clearTimeout(damageVignetteTimerRef.current);
        setDamageVignetteVisible(true);
        damageVignetteTimerRef.current = setTimeout(() => setDamageVignetteVisible(false), 700);
      }
    };

    const handleCardToGraveyard = ({ cardName, cardType }: { cardName: string, cardType?: string }) => {
      shake('medium');
      setCiaoCardName(cardName);
      setCiaoNotificationVisible(true);
      playCardToGraveyard();
      
      if (cardType === 'personaggi' || cardType === 'personaggi_speciali') {
        setDeadCharacterName(cardName);
        setDeathEffectVisible(false);
        setTimeout(() => {
          setDeathEffectKey(prev => prev + 1);
          setDeathEffectVisible(true);
        }, 10);
        setCardShatter3D({ visible: true, cardImage: '', cardName });
        playDeathSound();
      }
      
      setTimeout(() => {
        setCiaoNotificationVisible(false);
      }, 3000);
    };

    const handlePersonaggioEnters = ({ cardName, message, cardImage }: { cardName: string, message: string, cardImage: string }) => {
      console.log('Personaggio enters:', { cardName, message, cardImage });
      playPersonaggioEnter();
      setPersonaggioCardName(cardName);
      setPersonaggioMessage(message);
      setPersonaggioCardImage(cardImage);
      setPersonaggioNotificationVisible(true);
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };

    const handleCardsAdded = ({ playerName, deckLabel, count }: { playerName: string, deckLabel: string, count: number }) => {
      alert(`${playerName} ha aggiunto ${count} carte al mazzo ${deckLabel}!`);
    };

    const handleBeeSound = ({ cardName, playerName }: { cardName: string, playerName: string }) => {
      console.log(`Playing bee sound for ${cardName} played by ${playerName}`);
      playBeeSound();
    };

    const handleCharacterSound = ({ cardName, playerName, soundType }: { cardName: string, playerName: string, soundType: string }) => {
      console.log(`Playing ${soundType} sound for ${cardName} played by ${playerName}`);
      playCharacterSound(soundType);
    };

    const handleCardAnimationTrigger = ({ cardName, playerName, cardId }: { cardName: string, playerName: string, cardId: string }) => {
      console.log(`🎬 Card animation triggered for ${cardName} played by ${playerName}`);
      setCardAnimationName(cardName);
      setCardAnimationVisible(true);
      playCardAnimationSound(cardName);
    };
    
    const handleCustomAnimationTrigger = ({ cardId, cardName, playerName, animationDescription }: { 
      cardId: string, 
      cardName: string, 
      playerName: string, 
      animationDescription: string 
    }) => {
      console.log(`🎬 Custom animation triggered for ${cardName}: ${animationDescription}`);
      playEffectActivate();
      setCustomAnimationData({ cardName, animationDescription });
      setCustomAnimationVisible(true);
      // Auto-hide after 4 seconds
      setTimeout(() => {
        setCustomAnimationVisible(false);
        setCustomAnimationData(null);
      }, 4000);
    };

    const handleSpecialMoveOverlay = (data: { moveName: string; damage: number; attackerName: string; playerName: string; category: string | null }) => {
      console.log(`💥 Special move overlay: ${data.attackerName} uses ${data.moveName} for ${data.damage} damage`);
      setAttackEffectType(getDamageEffectType(data.damage, data.moveName));
      setSpecialMoveOverlay({
        visible: true,
        moveName: data.moveName,
        damage: data.damage,
        attackerName: data.attackerName,
        category: data.category
      });
      setTimeout(() => {
        setSpecialMoveOverlay(prev => ({ ...prev, visible: false }));
      }, 4000);
    };

    const handleEvolutionAnimation = (data: {
      type: 'evolution' | 'transformation' | 'taroccata';
      oldName: string;
      newName: string;
      oldImage: string;
      newImage: string;
      playerName: string;
      pti?: number;
      stars?: number;
      timestamp?: number;
    }) => {
      console.log(`🌟 Evolution animation: ${data.oldName} → ${data.newName} (${data.type})`);
      setEvolutionAnim({
        visible: true,
        key: Date.now(),
        type: data.type,
        oldName: data.oldName,
        newName: data.newName,
        oldImage: data.oldImage,
        newImage: data.newImage,
        playerName: data.playerName,
        pti: data.pti,
        stars: data.stars
      });
    };

    const handleFusionAnimation = (data: {
      card1Name: string; card2Name: string; card1Image: string; card2Image: string;
      resultName: string; resultImage: string; playerName: string;
      fusionType: 'fusione' | 'unione_clandestina' | 'ameeco';
      resultPti?: number; resultStars?: number;
    }) => {
      console.log(`🔗 Fusion animation: ${data.card1Name} + ${data.card2Name} → ${data.resultName} (${data.fusionType})`);
      setFusionAnim({
        visible: true,
        key: Date.now(),
        card1Name: data.card1Name,
        card2Name: data.card2Name,
        card1Image: data.card1Image,
        card2Image: data.card2Image,
        resultName: data.resultName,
        resultImage: data.resultImage,
        playerName: data.playerName,
        fusionType: data.fusionType,
        resultPti: data.resultPti,
        resultStars: data.resultStars
      });
    };

    const handleCardPlayed = ({ cardId, cardType, frontImage, cardName, playerName: cardPlayerName }: { 
      cardId: string, 
      cardType: string, 
      frontImage: string, 
      cardName?: string,
      playerName: string 
    }) => {
      playCardPlayedToField();
      const cx = window.innerWidth / 2 + (Math.random() - 0.5) * 200;
      const cy = window.innerHeight / 2 + (Math.random() - 0.5) * 100;
      setCardTrailParticles({ visible: true, cardType: cardType || '', x: cx, y: cy });
      setLastPlayedCards(prev => {
        const newCard = {
          id: cardId,
          frontImage,
          name: cardName,
          playerName: cardPlayerName,
          timestamp: Date.now(),
          cardType
        };
        const updated = [...prev, newCard];
        return updated.slice(-10);
      });

      // Track card for collection (non-blocking)
      const collectionToken = authToken || localStorage.getItem('authToken');
      if (collectionToken && cardPlayerName === playerName) {
        const extractedName = cardName || (frontImage ? frontImage.split('/').pop()?.replace(/\.\w+$/, '').replace(/-/g, ' ') : '');
        if (extractedName) {
          fetch('/api/collection/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${collectionToken}` },
            body: JSON.stringify({ cardName: extractedName, cardDeckType: cardType, cardImageUrl: frontImage })
          }).catch(() => {});
        }
      }
    };

    const handleCardPlayedFaceDown = ({ cardId, playerName, message }: { cardId: string, playerName: string, message: string }) => {
      playCardPlayedToField();
      console.log(`Card played face down: ${message}`);
      // Optional: Show a notification that a card was played face down
    };

    const handleCardRevealed = ({ cardId, cardName, playerName, cardImage, message }: { cardId: string, cardName: string, playerName: string, cardImage: string, message: string }) => {
      playCardReveal();
      console.log(`Card revealed: ${message}`);
      // Optional: Show a notification that a card was revealed
    };

    const handleGameStarted = ({ playerOrder }: { playerOrder: string[] }) => {
      setPlayerOrder(playerOrder);
      setPlayerOrderVisible(true);
      identifyPlayer(playerName || 'unknown');
      trackGameStarted(gameId || 'unknown', playerOrder.length, playerOrder.some(p => p.startsWith('CPU')));
    };

    const handleNextTurn = ({ nextPlayer }: { nextPlayer: string }) => {
      // Only clear if the timer is still for the OLD player.
      // turn-timer-start (emitted by the server BEFORE next-turn) may have already
      // set timerPlayerRef.current to nextPlayer — in that case, don't touch it.
      if (timerPlayerRef.current !== nextPlayer) {
        if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
        timerPlayerRef.current = '';
        setTurnTimerState({ active: false, seconds: 30, playerName: '', isWarning: false });
      }
      setNextTurnPlayer(nextPlayer);
      setNextTurnVisible(true);
      if (nextPlayer === playerName) {
        playMyTurn();
        // Browser notification when tab is in background
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification('MINKIARDS - Tocca a te!', {
              body: 'È il tuo turno, muoviti!',
              icon: '/favicon.ico',
              tag: 'minkiards-turn',
              renotify: true,
            });
          } catch (_) {}
        }
      } else {
        playTurnChange();
      }
    };

    const handlePlayerLeft = ({ playerName }: { playerName: string }) => {
      setLeavingPlayer(playerName);
      setLeaveGameVisible(true);
    };

    const handleOpenSuperDice = ({ playerName: dicePlayerName }: { playerName: string }) => {
      console.log(`Super dice opened by ${dicePlayerName}`);
      setSuperDiceOpen(true);
    };

    const handleSuperDiceRolled = ({ playerName: rollerName, rolledCard }: { playerName: string, rolledCard: any }) => {
      console.log(`Super dice rolled by ${rollerName}:`, rolledCard);
      // The dice will remain visible until closed
    };

    const handleSorosActivation = ({ activator, cardImage }: { activator: string; cardImage: string }) => {
      playSorosActivation();
      setSorosData({ activator, cardImage });
      setSorosActivationVisible(true);
      
      // Pause music during SOROS cinematic
      if (musicPlayerOpen) {
        const musicToggleBtn = document.querySelector('[data-music-control="play"]');
        if (musicToggleBtn) {
          (musicToggleBtn as HTMLButtonElement).click();
        }
      }
    };

    socket.on('game-reset', handleGameReset);
    socket.on('card-shown', handleCardShown);
    socket.on('card-show-confirmed', handleCardShowConfirmed);
    socket.on('dice-rolled', handleDiceRoll);
    socket.on('dice-window-opened', handleDiceWindowOpen);
    
    const handleWindDiceRoll = (data: { value: number; playerName: string; gameId: string }) => {
      console.log('🎲 FOLATA DI VENTO dice roll:', data);
      setWindDiceRoll({ visible: true, value: data.value, playerName: data.playerName });
      setTimeout(() => setWindDiceRoll({ visible: false, value: 0, playerName: '' }), 4000);
    };
    socket.on('dice-roll', handleWindDiceRoll);
    
    const handleEvolutionDiceRoll = (data: { playerName: string; characterName: string; diceResult: number; evolutionTarget: string | null; evolutionTargetId: string | null }) => {
      console.log('🎲 EVOLUTION DICE ROLL:', data);
      setEvolutionDiceRoll({ visible: true, characterName: data.characterName, playerName: data.playerName, diceResult: data.diceResult, evolutionTarget: data.evolutionTarget, animationPhase: 'rolling' });
      setTimeout(() => {
        setEvolutionDiceRoll(prev => ({ ...prev, animationPhase: 'result' }));
      }, 1500);
      setTimeout(() => {
        setEvolutionDiceRoll({ visible: false, characterName: '', playerName: '', diceResult: 0, evolutionTarget: null, animationPhase: 'rolling' });
      }, 5500);
    };
    socket.on('evolution-dice-roll', handleEvolutionDiceRoll);
    
    const handleTimedEffectActivated = ({ cardName, sourcePlayer, description }: { cardName: string; sourcePlayer: string; description: string }) => {
      setTimedEffectBannerCard(cardName);
      setTimedEffectBannerPlayer(sourcePlayer);
      setTimedEffectBannerDesc(description);
      setTimedEffectBannerVisible(true);
    };

    socket.on('graveyard-milestone', handleGraveyardMilestone);
    socket.on('timed-effect-activated', handleTimedEffectActivated);
    socket.on('chat-message', handleChatMessage);
    socket.on('scenario-cards-toggled', handleScenarioCardsToggled);
    socket.on('card-attacked', handleCardAttacked);
    socket.on('card-to-graveyard', handleCardToGraveyard);
    socket.on('player-joined', handlePlayerJoined);
    socket.on('personaggio-enters', handlePersonaggioEnters);
    socket.on('cards-added', handleCardsAdded);
    socket.on('bee-sound', handleBeeSound);
    socket.on('character-sound', handleCharacterSound);
    socket.on('card-animation-trigger', handleCardAnimationTrigger);
    socket.on('custom-animation-trigger', handleCustomAnimationTrigger);
    socket.on('special-move-overlay', handleSpecialMoveOverlay);
    socket.on('evolution-animation', handleEvolutionAnimation);
    socket.on('fusion-animation', handleFusionAnimation);
    socket.on('card-played', handleCardPlayed);
    socket.on('card-played-face-down', handleCardPlayedFaceDown);
    socket.on('card-revealed', handleCardRevealed);
    socket.on('game-started', handleGameStarted);
    const handleLobbySettingsUpdated = ({ characterLimit: newLimit }: { characterLimit: string }) => {
      setLobbyCharacterLimit(newLimit);
    };
    socket.on('lobby-settings-updated', handleLobbySettingsUpdated);
    socket.on('next-turn', handleNextTurn);
    socket.on('player-left', handlePlayerLeft);
    socket.on('super-dice-opened', handleOpenSuperDice);
    socket.on('super-dice-rolled', handleSuperDiceRolled);
    socket.on('soros-activated', handleSorosActivation);

    // CPU thinking indicator
    const handleCpuThinking = ({ playerName: cpuName }: { playerName: string }) => {
      setCpuThinkingPlayer(cpuName);
    };
    const handleCpuDoneThinking = () => {
      setCpuThinkingPlayer(null);
    };
    socket.on('cpu-thinking', handleCpuThinking);
    socket.on('cpu-done-thinking', handleCpuDoneThinking);
    socket.on('next-turn', handleCpuDoneThinking);

    const handleControlTurnSet = (data: { controllingPlayer: string; controlledPlayer: string }) => {
      if (data.controlledPlayer === playerName) {
        setChoosingNotification({ visible: true, message: `🎮 Il tuo prossimo turno è controllato da ${data.controllingPlayer}!` });
        setTimeout(() => setChoosingNotification({ visible: false, message: '' }), 5000);
      } else if (data.controllingPlayer === playerName) {
        setChoosingNotification({ visible: true, message: `🎮 Controllerai il prossimo turno di ${data.controlledPlayer}!` });
        setTimeout(() => setChoosingNotification({ visible: false, message: '' }), 5000);
      }
    };
    socket.on('control-turn-set', handleControlTurnSet);

    const handleBlockCardTypeSelect = (data: { cardId: string; cardName: string; options: string[]; turns: number; playerName: string }) => {
      if (data.playerName === playerName) {
        setBlockTypeSelection({ visible: true, options: data.options, turns: data.turns });
      }
    };
    socket.on('block-card-type-select', handleBlockCardTypeSelect);

    const handleDaddyConteChoice = (data: { characters: Array<{id: string; name: string; frontImage: string; owner: string}> }) => {
      setDaddyConteDialog({ visible: true, characters: data.characters });
    };
    socket.on('daddy-conte-choice', handleDaddyConteChoice);

    const handleFabrizioChoice = (data: { characterName: string; characterId: string; currentPti: number }) => {
      setFabrizioDialog({ visible: true, characterName: data.characterName, characterId: data.characterId, currentPti: data.currentPti });
    };
    socket.on('fabrizio-choice', handleFabrizioChoice);

    const handleControlTurnChooseTarget = (data: { controllingPlayer: string; opponents: string[] }) => {
      if (data.controllingPlayer === playerName) {
        setControlTurnTargetPanel({ visible: true, opponents: data.opponents });
      }
    };
    socket.on('control-turn-choose-target', handleControlTurnChooseTarget);

    const handleControlTurnActive = (data: { controllingPlayer: string; controlledPlayer: string; availableTypes?: string[]; possibleTargets?: string[] }) => {
      if (data.controlledPlayer === playerName) {
        setChoosingNotification({ visible: true, message: `🎮 Il tuo turno è controllato da ${data.controllingPlayer}! Un avversario sceglierà cosa giochi.` });
        setTimeout(() => setChoosingNotification({ visible: false, message: '' }), 10000);
      } else if (data.controllingPlayer === playerName) {
        setControlTurnPanel({
          visible: true,
          controlledPlayer: data.controlledPlayer,
          availableTypes: data.availableTypes || [],
          possibleTargets: data.possibleTargets || [],
          selectedType: null,
          selectedTarget: null,
        });
      }
    };
    socket.on('opponent-turn-control', handleControlTurnActive);

    const handleControlTurnResolved = () => {
      setControlTurnPanel(prev => ({ ...prev, visible: false, selectedType: null, selectedTarget: null }));
    };
    socket.on('control-turn-resolved', handleControlTurnResolved);

    // MOSSE ATTACK ERROR: Handle attack errors (e.g., one MOSSE per turn limit)
    const handleAttackError = ({ message }: { message: string }) => {
      playErrorSound();
      console.log(`❌ Attack error: ${message}`);
      setChoosingNotification({ visible: true, message: `❌ ${message}` });
      setTimeout(() => {
        setChoosingNotification({ visible: false, message: '' });
      }, 4000);
    };
    socket.on('attack-error', handleAttackError);
    socket.on('attack-blocked', handleAttackError);

    const handleDefenseResult = (data: { attackId?: string; success?: boolean; defenderName?: string; defenseCardName?: string; message?: string; damageDelayed?: boolean; damageReflected?: boolean; damageRedirected?: boolean }) => {
      if (data.success) {
        let msg = data.message || '';
        if (data.damageReflected) msg = 'Danno riflesso al mittente! ' + msg;
        if (data.damageRedirected) msg = 'Danno reindirizzato! ' + msg;
        if (data.damageDelayed) msg = 'Danno ritardato! ' + msg;
      }
    };
    socket.on('defense:result', handleDefenseResult);

    const handleEffectApplied = (data: { cardName?: string; effectDescription?: string; playerName?: string }) => {
      // Effect applied handler (no narrator)
    };
    socket.on('bonus-effect-applied', handleEffectApplied);

    // CLASH BATTLE: Start battle when equal damage values
    const handleClashBattleStart = ({ clashId, attacker, defender, damageValue, duration }: {
      clashId: string;
      attacker: string;
      defender: string;
      damageValue: number;
      duration: number;
    }) => {
      console.log(`⚡ CLASH BATTLE started: ${attacker} vs ${defender} with ${damageValue} PTI`);
      setClashBattleData({
        visible: true,
        clashId,
        attacker,
        defender,
        damageValue,
        duration
      });
    };
    socket.on('clash-battle-start', handleClashBattleStart);

    // CLASH BATTLE: End battle
    const handleClashBattleEnd = ({ clashId, winner, isTie }: {
      clashId: string;
      winner: string | null;
      isTie: boolean;
    }) => {
      shake('heavy');
      console.log(`⚡ CLASH BATTLE ended: winner=${winner}, tie=${isTie}`);
      setTimeout(() => {
        setClashBattleData(null);
      }, 2000); // Keep visible briefly to show result
    };
    socket.on('clash-battle-end', handleClashBattleEnd);

    // Handler for player choosing a card notification
    const handlePlayerChoosingNotification = ({ playerName: chooserName, deckName, message }: { 
      playerName: string, deckName: string, message: string 
    }) => {
      setChoosingNotification({ visible: true, message });
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setChoosingNotification({ visible: false, message: '' });
      }, 3000);
    };
    socket.on('player-choosing-notification', handlePlayerChoosingNotification);

    // GRAVEYARD SELECTION: Handle interactive graveyard card selection
    const handleShowGraveyardSelection = (data: { reason: string; cards: any[]; message: string }) => {
      console.log('👼 Show graveyard selection:', data);
      setGraveyardSelectionModal({
        visible: true,
        reason: data.reason,
        cards: data.cards,
        message: data.message
      });
    };
    socket.on('show-graveyard-selection', handleShowGraveyardSelection);

    // PTI INPUT PANEL: Handle custom card effect that requires PTI input
    const handleShowPtiInputPanel = (data: { cardId: string; cardName: string; playerName: string; effectDescription: string }) => {
      console.log('📋 Show PTI input panel:', data);
      if (data.playerName === playerName) {
        setPtiInputPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          effectDescription: data.effectDescription
        });
        setPtiInputValue('');
      }
    };
    socket.on('show-pti-input-panel', handleShowPtiInputPanel);

    // PTI DISTRIBUTION PANEL: Handle Giovanni Muciaccia-style PTI/stelle distribution
    const handleShowPtiDistribution = (data: { cardId: string; cardName: string; cardImage: string; playerName: string; totalBudget: number; ptiPerStar: number }) => {
      console.log('🎭 Show PTI distribution panel:', data);
      if (data.playerName === playerName) {
        setPtiDistributionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          cardImage: data.cardImage || '',
          totalBudget: data.totalBudget || 1000,
          ptiPerStar: data.ptiPerStar || 100
        });
        setDistributionPti(data.totalBudget || 1000);
        setDistributionStars(0);
      }
    };
    socket.on('show-pti-distribution-panel', handleShowPtiDistribution);

    // DECK SELECTION PANEL: Handle custom card effect that requires deck selection
    const handleShowDeckSelection = (data: { cardId: string; cardName: string; playerName: string; effectDescription: string; excludeSpeciali?: boolean }) => {
      console.log('📋 Show deck selection panel:', data);
      if (data.playerName === playerName) {
        setDeckSelectionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          effectDescription: data.effectDescription,
          excludeSpeciali: data.excludeSpeciali ?? false
        });
      }
    };
    socket.on('show-deck-selection', handleShowDeckSelection);

    const handleShowDeckCardPicker = (data: { cardId: string; deckType: string; deckDisplayName: string; cards: Array<{ id: string; name: string; frontImage: string; type: string; pti?: number; stars?: number }>; playerName: string }) => {
      console.log('📋 Show deck card picker:', data.deckDisplayName, data.cards.length, 'cards');
      if (data.playerName === playerName) {
        setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
        setDeckCardPickerPanel({
          visible: true,
          cardId: data.cardId,
          deckType: data.deckType,
          deckDisplayName: data.deckDisplayName,
          cards: data.cards
        });
      }
    };
    socket.on('show-deck-card-picker', handleShowDeckCardPicker);

    // AUCTION SYSTEM LISTENERS
    const handleAuctionSelectCharacter = (data: { playerName: string; gameId: string }) => {
      if (data.playerName === playerName) {
        socket.emit('get-deck-contents', { deckType: 'personaggi' });
        const onDeckContents = (deckData: { deckType: string; cards: any[] }) => {
          if (deckData.deckType === 'personaggi') {
            setAuctionDeckPicker({
              visible: true,
              cards: deckData.cards.filter(c => c.type === 'personaggi'),
              initiator: data.playerName
            });
            socket.off('deck-contents', onDeckContents);
          }
        };
        socket.on('deck-contents', onDeckContents);
      }
    };
    socket.on('auction-select-character', handleAuctionSelectCharacter);

    const handleAuctionStarted = (data: any) => {
      setAuctionData(data);
      setAuctionBidUpdate(null);
      setAuctionCountdownUpdate(null);
      setAuctionResult(null);
      setAuctionDeckPicker({ visible: false, cards: [], initiator: '' });
    };
    socket.on('auction-started', handleAuctionStarted);

    const handleAuctionBidUpdate = (data: any) => {
      setAuctionBidUpdate({ ...data, _ts: Date.now() });
    };
    socket.on('auction-bid-update', handleAuctionBidUpdate);

    const handleAuctionCountdown = (data: any) => {
      setAuctionCountdownUpdate({ ...data, _ts: Date.now() });
    };
    socket.on('auction-countdown', handleAuctionCountdown);

    const handleAuctionEnded = (data: any) => {
      setAuctionResult(data);
      if (data.winner === playerName && data.bid > 0) {
        addPRSpent(data.bid);
      }
    };
    socket.on('auction-ended', handleAuctionEnded);

    // SWAP SELECTION: Handle baratto/swap panel for selecting player to swap with
    const handleShowSwapSelection = (data: { cardId: string; cardName: string; playerName: string; otherPlayers: string[]; effectDescription: string }) => {
      console.log('🔄 Show swap selection:', data);
      if (data.playerName === playerName) {
        setSwapSelectionPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          otherPlayers: data.otherPlayers,
          effectDescription: data.effectDescription
        });
      }
    };
    socket.on('show-swap-selection', handleShowSwapSelection);

    // DICE CONTROL: Handle dice control panel for choosing dice result
    const handleShowDiceControlPanel = (data: { rollingPlayer: string; controllingPlayer: string; controllingCardId: string; controllingCardName: string; pendingId?: string; targetCharName?: string }) => {
      console.log('🎲 Show dice control panel:', data);
      if (data.controllingPlayer === playerName) {
        setDiceControlPanel({
          visible: true,
          rollingPlayer: data.rollingPlayer,
          controllingPlayer: data.controllingPlayer,
          controllingCardName: data.controllingCardName,
          pendingId: data.pendingId,
          targetCharName: data.targetCharName
        });
      }
    };
    socket.on('show-dice-control-panel', handleShowDiceControlPanel);

    // TARGET SELECTION: Handle interactive target selection for custom effects
    const handleShowTargetSelection = (data: { 
      effectType: 'damage' | 'heal'; 
      value: number; 
      maxTargets: number;
      targets: Array<{ id: string; frontImage: string; owner: string; text?: string; name?: string }>;
      message: string;
    }) => {
      console.log('🎯 Show target selection:', data);
      setSelectedTargetIds([]);
      setTargetSelectionModal({
        visible: true,
        effectType: data.effectType,
        value: data.value,
        maxTargets: data.maxTargets || 1,
        targets: data.targets,
        message: data.message
      });
    };
    socket.on('show-target-selection', handleShowTargetSelection);

    // DICE SYSTEM: Handle dice selection modal
    // DICE SYSTEM: Handle character selection for dice effect (step 1 - choose which characters)
    const handleShowDiceCharacterSelect = (data: {
      diceEffectId: string;
      cardName: string;
      correctEffect: string;
      wrongEffect: string;
      availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
      initiatorPlayer: string;
    }) => {
      console.log('🎲 Show dice character selection:', data);
      // Only show to the player who initiated the dice effect
      if (data.initiatorPlayer === playerName) {
        setDiceCharacterSelectModal({
          visible: true,
          diceEffectId: data.diceEffectId,
          cardName: data.cardName,
          correctEffect: data.correctEffect,
          wrongEffect: data.wrongEffect,
          availableCharacters: data.availableCharacters,
          selectedCharacterIds: data.availableCharacters.map(c => c.id) // All selected by default
        });
      }
    };
    socket.on('show-dice-character-select', handleShowDiceCharacterSelect);

    // DICE SYSTEM: Handle number selection (step 2 - choose numbers)
    const handleShowDiceSelection = (data: {
      diceEffectId: string;
      cardName: string;
      correctEffect: string;
      wrongEffect: string;
      involvedCharacters: Array<{ id: string; name: string; owner: string; frontImage: string }>;
    }) => {
      console.log('🎲 Show dice selection:', data);
      const myCharacterIds = data.involvedCharacters
        .filter(c => c.owner === playerName)
        .map(c => c.id);
      
      if (myCharacterIds.length > 0) {
        setDiceChoices({});
        setDiceSelectionModal({
          visible: true,
          diceEffectId: data.diceEffectId,
          cardName: data.cardName,
          correctEffect: data.correctEffect,
          wrongEffect: data.wrongEffect,
          involvedCharacters: data.involvedCharacters,
          myCharacterIds
        });
      }
    };
    socket.on('show-dice-selection', handleShowDiceSelection);

    // DICE SYSTEM: Handle dice roll result
    const handleDiceRollResult = (data: {
      result: number;
      winners: Array<{ name: string; effect: string }>;
      losers: Array<{ name: string; effect: string }>;
    }) => {
      console.log('🎲 Dice roll result:', data);
      setDiceRollResult({
        visible: true,
        result: data.result,
        winners: data.winners,
        losers: data.losers
      });
      // Auto-hide after 6 seconds
      setTimeout(() => {
        setDiceRollResult(null);
      }, 6000);
    };
    socket.on('dice-roll-result', handleDiceRollResult);

    // AUTO DICE: Handle automatic dice roll result
    const handleAutoDiceResult = (data: {
      cardName: string;
      diceResult: number;
      effect: string;
      affectedCharacters: Array<{ charId: string; charName: string; effect: string }>;
    }) => {
      console.log('🎲 Auto dice result:', data);
      
      // Start animation sequence
      setAutoDiceResult({
        visible: true,
        cardName: data.cardName,
        diceResult: data.diceResult,
        effect: data.effect,
        affectedCharacters: data.affectedCharacters,
        isAnimating: true,
        animationPhase: 'rolling'
      });
      
      // Play dice sound
      playDiceRoll();
      
      // Phase 1: Rolling animation (1.5s)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, animationPhase: 'result' }));
      }, 1500);
      
      // Phase 2: Show result (after 1.5s)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, animationPhase: 'effects' }));
      }, 3000);
      
      // Phase 3: Hide after showing effects (8s total)
      setTimeout(() => {
        setAutoDiceResult(prev => ({ ...prev, visible: false, isAnimating: false }));
      }, 8000);
    };
    socket.on('auto-dice-result', handleAutoDiceResult);

    // CUSTOM TARGET SELECTION: Handler for showing custom target selection modal for [BERSAGLIO: scelta]
    const handleShowCustomTargetSelection = (data: {
      selectionId: string;
      cardId: string;
      cardName: string;
      owner: string;
      availableTargets: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
      maxSelections?: number;
      title?: string;
      subtitle?: string;
    }) => {
      console.log('🎯 Show custom target selection:', data);
      if (data.owner === playerName) {
        setCustomSelectedTargets([]);
        setCustomTargetModal({
          visible: true,
          selectionId: data.selectionId,
          cardId: data.cardId,
          cardName: data.cardName,
          owner: data.owner,
          availableTargets: data.availableTargets,
          maxSelections: data.maxSelections,
          title: data.title,
          subtitle: data.subtitle
        });
      }
    };
    socket.on('show-custom-target-selection', handleShowCustomTargetSelection);

    // REVEAL: Handler for showing revealed cards
    const handleCardsRevealed = (data: { revealedBy: string; hands: Record<string, Array<{id: string; name: string; frontImage: string; type: string; pti: number | null; stars: number | null}>> }) => {
      console.log('👁️ Cards revealed:', data);
      if (data.revealedBy === playerName) {
        setRevealedCards({
          visible: true,
          revealedBy: data.revealedBy,
          hands: data.hands
        });
      }
    };
    socket.on('cards-revealed', handleCardsRevealed);

    // AUTO DICE SETUP: Handler for automatic dice configuration
    const handleShowAutoDiceSetup = (data: {
      autoDiceId: string;
      cardName: string;
      defaultEffects: Record<number, string>;
      availableCharacters: Array<{ id: string; name: string; owner: string; frontImage: string; pti: number | null; stars: number | null }>;
      initiatorPlayer: string;
      preSelected?: boolean;
    }) => {
      console.log('🎲 Show auto dice setup:', data);
      // Only show to the initiator player
      if (data.initiatorPlayer === playerName) {
        // If preSelected flag is true, auto-select all available characters
        if (data.preSelected) {
          setAutoDiceSelectedChars(data.availableCharacters.map(c => c.id));
        } else {
          setAutoDiceSelectedChars([]);
        }
        setAutoDiceCustomEffects({ ...data.defaultEffects });
        setAutoDiceSetupModal({
          visible: true,
          autoDiceId: data.autoDiceId,
          cardName: data.cardName,
          defaultEffects: data.defaultEffects,
          availableCharacters: data.availableCharacters,
          initiatorPlayer: data.initiatorPlayer
        });
      }
    };
    socket.on('show-auto-dice-setup', handleShowAutoDiceSetup);

    // PARASITIC CARDS: Handler for target selection
    const handleParasiticTargetSelect = ({ parasiticCardId, parasiticType, ownerPlayer, targets }: {
      parasiticCardId: string;
      parasiticType: 'PARASSITA' | 'SAIBAIM';
      ownerPlayer: string;
      targets: Array<{ id: string; frontImage: string; owner: string; text?: string }>;
    }) => {
      // Only show to the player who owns the parasitic card
      if (ownerPlayer === playerName) {
        setParasiticTargetSelect({
          visible: true,
          parasiticCardId,
          parasiticType,
          targets
        });
      }
    };
    socket.on('parasitic-target-select', handleParasiticTargetSelect);

    // PARASITIC CARDS: Handler for attachment notification
    const handleParasiticAttached = ({ parasiticCardId, parasiticType, targetCardId, targetName, ownerPlayer, targetPlayer }: {
      parasiticCardId: string;
      parasiticType: 'PARASSITA' | 'SAIBAIM';
      targetCardId: string;
      targetName: string;
      ownerPlayer: string;
      targetPlayer: string;
    }) => {
      // Only close target selection for the owner player who made the selection
      if (ownerPlayer === playerName) {
        setParasiticTargetSelect({ visible: false, parasiticCardId: '', parasiticType: null, targets: [] });
      }
      playEffectActivate();
      
      // Show attachment notification to all players
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName(parasiticType);
      setPersonaggioMessage(`${parasiticType} di ${ownerPlayer} si è agganciato a ${targetName} di ${targetPlayer}!`);
      setPersonaggioCardImage(parasiticType === 'PARASSITA' 
        ? 'https://i.postimg.cc/j5X32dn7/parassita.png'
        : 'https://i.postimg.cc/RFs123nX/saibaim.png');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('parasitic-attached', handleParasiticAttached);

    // SAIBAIM explosion effect
    const handleSaibaImExplosion = ({ saibaim, target, targetOwner }: {
      saibaim: string;
      target: string;
      targetOwner: string;
    }) => {
      setSaibaImExplosionVisible(true);
      playCardAnimationSound('BOMBA'); // Use explosion sound
      setTimeout(() => {
        setSaibaImExplosionVisible(false);
      }, 2000);
    };
    socket.on('saibaim-explosion', handleSaibaImExplosion);

    // OSTAGGIO (HOSTAGE) event handlers
    const handleHostageApplied = ({ ostaggioCardId, targetCardId, targetName, captorPlayer, originalOwner, turnsRemaining, damageDealt }: {
      ostaggioCardId: string;
      targetCardId: string;
      targetName: string;
      captorPlayer: string;
      originalOwner: string;
      turnsRemaining: number;
      damageDealt: number;
    }) => {
      console.log(`⛓️ OSTAGGIO applied: ${targetName} captured by ${captorPlayer}`);
      playHostageApplied();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO');
      setPersonaggioMessage(`⛓️ ${captorPlayer} prende ${targetName} in OSTAGGIO per ${turnsRemaining} turni! (${damageDealt} danni inflitti)`);
      setPersonaggioCardImage('');
      // Vignette when our card is taken hostage and damaged
      if (originalOwner === playerName && damageDealt > 0) {
        if (damageVignetteTimerRef.current) clearTimeout(damageVignetteTimerRef.current);
        setDamageVignetteVisible(true);
        damageVignetteTimerRef.current = setTimeout(() => setDamageVignetteVisible(false), 700);
      }
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-applied', handleHostageApplied);

    const handleHostageUpdated = ({ targetCardId, turnsRemaining, captorPlayer }: {
      targetCardId: string;
      turnsRemaining: number;
      captorPlayer: string;
    }) => {
      console.log(`⛓️ OSTAGGIO update: ${turnsRemaining} turns remaining`);
    };
    socket.on('hostage-updated', handleHostageUpdated);

    const handleHostageReleased = ({ targetCardId, targetName, originalOwner, captorPlayer }: {
      targetCardId: string;
      targetName: string;
      originalOwner: string;
      captorPlayer: string;
    }) => {
      console.log(`⛓️🔓 OSTAGGIO released: ${targetName} freed`);
      playHostageReleased();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO TERMINATO');
      setPersonaggioMessage(`⛓️🔓 ${targetName} è stato liberato dall'OSTAGGIO e torna a ${originalOwner}!`);
      setPersonaggioCardImage('');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-released', handleHostageReleased);

    const handleHostageDied = ({ targetCardId, targetName, captorPlayer, originalOwner }: {
      targetCardId: string;
      targetName: string;
      captorPlayer: string;
      originalOwner: string;
    }) => {
      console.log(`⛓️💀 OSTAGGIO death: ${targetName} died`);
      playDeathSound();
      setPersonaggioNotificationVisible(true);
      setPersonaggioCardName('OSTAGGIO - MORTE');
      setPersonaggioMessage(`⛓️💀 ${targetName} aveva meno di 300 PTI ed è morto sotto OSTAGGIO!`);
      setPersonaggioCardImage('');
      
      setTimeout(() => {
        setPersonaggioNotificationVisible(false);
      }, 4000);
    };
    socket.on('hostage-died', handleHostageDied);

    // CARD AUDIO: Play audio when a card with audioUrl is placed on field
    const handleCardAudioPlay = ({ cardId, playerName: audioPlayerName, audioUrl, cardName }: {
      cardId: string;
      playerName: string;
      audioUrl: string;
      cardName: string;
    }) => {
      console.log(`🔊 Card audio triggered: ${cardName} by ${audioPlayerName}, URL: ${audioUrl}`);
      
      if (audioUrl) {
        try {
          let playableUrl = audioUrl;
          
          // Convert Google Drive view/share links to direct download links
          const driveMatch = audioUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
          if (driveMatch) {
            const fileId = driveMatch[1];
            playableUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
            console.log(`🔊 Converted Google Drive URL to: ${playableUrl}`);
          }
          
          // Also handle Dropbox links (change dl=0 to dl=1)
          if (audioUrl.includes('dropbox.com') && audioUrl.includes('dl=0')) {
            playableUrl = audioUrl.replace('dl=0', 'dl=1');
            console.log(`🔊 Converted Dropbox URL to: ${playableUrl}`);
          }
          
          const audio = new Audio(playableUrl);
          audio.volume = 0.7;
          audio.play().catch(err => {
            console.error('Error playing card audio:', err);
          });
        } catch (err) {
          console.error('Error creating card audio:', err);
        }
      }
    };
    socket.on('card-audio-play', handleCardAudioPlay);

    const handleCharacterAttackAudio = ({ cardId, playerName: audioPlayerName, audioUrl, cardName, baseDamage }: {
      cardId: string;
      playerName: string;
      audioUrl: string;
      cardName: string;
      baseDamage: number;
    }) => {
      console.log(`🔊 Character attack audio: ${cardName} by ${audioPlayerName}, damage: ${baseDamage}, URL: ${audioUrl}`);
      
      if (audioUrl) {
        try {
          let playableUrl = audioUrl;
          
          const driveMatch = audioUrl.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
          if (driveMatch) {
            playableUrl = `https://docs.google.com/uc?export=download&id=${driveMatch[1]}`;
          }
          
          if (audioUrl.includes('dropbox.com') && audioUrl.includes('dl=0')) {
            playableUrl = audioUrl.replace('dl=0', 'dl=1');
          }
          
          const audio = new Audio(playableUrl);
          audio.volume = 0.7;
          audio.play().catch(err => {
            console.error('Error playing character attack audio:', err);
          });
        } catch (err) {
          console.error('Error creating character attack audio:', err);
        }
      }
    };
    socket.on('character-attack-audio', handleCharacterAttackAudio);

    // YOUTUBE VIDEO: Show YouTube video when a card with youtubeUrl is played
    const handleShowYoutubeVideo = ({ cardId, playerName: videoPlayerName, youtubeUrl, cardName, cardType }: {
      cardId: string;
      playerName: string;
      youtubeUrl: string;
      cardName: string;
      cardType?: string;
    }) => {
      console.log(`📺 YouTube video requested for card ${cardName}: ${youtubeUrl}`);
      setYoutubeVideoData({
        visible: true,
        youtubeUrl,
        cardName,
        playerName: videoPlayerName,
        cardType
      });
    };
    socket.on('show-youtube-video', handleShowYoutubeVideo);

    // CIMICE effect (attack or death)
    const handleCimiceEffect = (data: {
      type: 'attack' | 'death';
      cimiceCardId: string;
      damagePerCard: number;
      affectedCards: Array<{ id: string; name: string; owner: string; oldPTI: number; newPTI: number }>;
      message: string;
    }) => {
      console.log('🪲 CIMICE effect received:', data);
      setCimiceEffectData({ visible: true, ...data });
      playBeeSound(); // Use bee sound for bug effect
      setTimeout(() => {
        setCimiceEffectData(null);
      }, 4000);
    };
    socket.on('cimice-effect', handleCimiceEffect);

    const handleInstructionExecuted = ({ playerName: instructorName, instruction, result, timestamp }: { 
      playerName: string, instruction: string, result: string, timestamp: number 
    }) => {
      // Show notification to all players about the executed instruction
      alert(`🎮 ISTRUZIONE ESEGUITA:\n${result}`);
      
      // Clear conversation mode since instruction was successful
      setConversationMode(false);
      setAssistantQuestion('');
      setConversationHistory([]);
    };

    const handleInstructionSuccess = ({ message }: { message: string }) => {
      // Add success message to conversation
      const successMessage = {
        type: 'assistant' as const,
        message: `✅ ${message}`,
        timestamp: Date.now()
      };
      setConversationHistory(prev => [...prev, successMessage]);
      
      // Clear conversation mode after success
      setTimeout(() => {
        setConversationMode(false);
        setAssistantQuestion('');
        setConversationHistory([]);
        setInstructionsOpen(false);
      }, 2000);
    };

    const handleInstructionError = ({ message }: { message: string }) => {
      // Show error message to the instructor
      alert(`❌ ${message}`);
    };

    const handleInstructionQuestion = ({ playerName: instructorName, instruction, question, timestamp }: { 
      playerName: string, instruction: string, question: string, timestamp: number 
    }) => {
      // Add assistant question to conversation history
      const assistantMessage = {
        type: 'assistant' as const,
        message: question,
        timestamp
      };
      setConversationHistory(prev => [...prev, assistantMessage]);
      setConversationMode(true);
      setAssistantQuestion(question);
      
      // Keep the instructions panel open for response
      setInstructionsOpen(true);
    };

    const handleInstructionDialogue = ({ playerName: instructorName, instruction, question, timestamp }: { 
      playerName: string, instruction: string, question: string, timestamp: number 
    }) => {
      // Show to all players that there's a conversation happening
      if (instructorName !== playerName) {
        alert(`💬 ${instructorName} sta dialogando con l'assistente:\n"${instruction}"\n\nAssistente: ${question}`);
      }
    };

    const handleEliminationCheck = ({ playerName: targetPlayer }: { playerName: string }) => {
      if (targetPlayer === playerName) {
        setEliminationDialogOpen(true);
      }
    };

    const handlePlayerEliminated = ({ playerName: eliminatedPlayer }: { playerName: string }) => {
      playPlayerEliminated();
      setPlayerEliminationNotification({
        visible: true,
        player: eliminatedPlayer
      });
      
      // Don't clear session here - let game-victory and game-end-rewards handle the end flow
      // The player will see the winner announcement and rewards panel before being redirected
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setPlayerEliminationNotification({ visible: false, player: '' });
      }, 3000);
    };

    const handleGameVictory = ({ winner, lastAction, matchDuration, playerStats }: { winner: string; lastAction?: any; matchDuration?: number; playerStats?: Record<string, any> }) => {
      const isWinner = winner === playerName;
      if (isWinner) {
        playVictory();
        shake('extreme');
      } else {
        playDefeat();
        shake('heavy');
      }
      setVictoryPlayer(winner);
      // In gym mode, suppress GameBoard's own victory/defeat screen — GymMode handles it
      if (isGymMode) return;
      const myStats = playerStats?.[playerName || ''];
      const stats = myStats ? {
        cardsPlayed: myStats.cardsPlayed || 0,
        totalDamageDealt: myStats.damageDealt || 0,
        totalDamageReceived: myStats.damageReceived || 0,
        turnsPlayed: myStats.turnsPlayed || 0,
        matchDuration: matchDuration || 0,
        finalBlowCard: lastAction?.cardName ? { name: lastAction.cardName, imageUrl: lastAction.cardImageUrl, deckType: lastAction.cardDeckType || 'personaggi' } : undefined,
      } : undefined;
      setVictoryDefeatAnim({ visible: true, type: isWinner ? 'victory' : 'defeat', playerName: winner, stats });
      trackGameEnded(gameId || 'unknown', winner, matchDuration || 0, myStats?.turnsPlayed || 0);
    };

    let rewardsTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleGameEndRewards = ({ rewards, winner }: { rewards: Record<string, { pointsEarned: number; newTotal: number; placement: number; isWinner: boolean }>; winner: string }) => {
      console.log('[REWARDS] game-end-rewards received:', { rewards, winner, playerName });
      // In gym mode, suppress the rewards panel — GymMode has its own victory screen
      if (isGymMode) return;
      const currentPlayerName = useGameState.getState().playerName || playerName;
      const myRewards = rewards[currentPlayerName];
      if (myRewards) {
        const previousTotal = Math.max(0, myRewards.newTotal - myRewards.pointsEarned);
        rewardsTimeoutId = setTimeout(() => {
          setVictoryDefeatAnim({ visible: false, type: 'victory', playerName: '' });
          setGameEndRewards({
            visible: true,
            pointsEarned: myRewards.pointsEarned,
            previousTotal,
            newTotal: myRewards.newTotal,
            placement: myRewards.placement,
            isWinner: myRewards.isWinner,
            winnerName: winner,
          });
          setUserRankiardPoints(myRewards.newTotal);
        }, 4000);
      } else {
        rewardsTimeoutId = setTimeout(() => {
          setVictoryDefeatAnim({ visible: false, type: 'victory', playerName: '' });
          setGameEndRewards({
            visible: true,
            pointsEarned: 0,
            previousTotal: 0,
            newTotal: 0,
            placement: 0,
            isWinner: false,
            winnerName: winner,
          });
        }, 4000);
      }
    };

    const handleFusionError = ({ message }: { message: string }) => {
      playErrorSound();
      alert(`❌ ${message}`);
    };

    const handleVoodooError = ({ message }: { message: string }) => {
      playErrorSound();
      alert(`❌ ${message}`);
    };

    socket.on('instruction-executed', handleInstructionExecuted);
    socket.on('instruction-success', handleInstructionSuccess);
    socket.on('instruction-error', handleInstructionError);
    socket.on('instruction-question', handleInstructionQuestion);
    socket.on('instruction-dialogue', handleInstructionDialogue);
    socket.on('elimination-check', handleEliminationCheck);
    socket.on('player-eliminated', handlePlayerEliminated);
    socket.on('game-victory', handleGameVictory);
    socket.on('game-end-rewards', handleGameEndRewards);
    socket.on('fusion-error', handleFusionError);
    socket.on('voodoo:error', handleVoodooError);

    // ── Turn Timer ──────────────────────────────────────────────────────────
    const startTurnCountdown = (totalSeconds: number, timerPlayerName: string) => {
      if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
      timerPlayerRef.current = timerPlayerName;
      let remaining = totalSeconds;
      setTurnTimerState({ active: true, seconds: remaining, playerName: timerPlayerName, isWarning: remaining <= 10 });
      turnTimerIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
          setTurnTimerState({ active: false, seconds: 0, playerName: timerPlayerName, isWarning: false });
        } else {
          setTurnTimerState({ active: true, seconds: remaining, playerName: timerPlayerName, isWarning: remaining <= 10 });
        }
      }, 1000);
    };
    const handleTurnTimerStart = ({ playerName: timerPlayer, seconds }: { playerName: string; seconds: number }) => {
      startTurnCountdown(seconds, timerPlayer);
    };
    const handleTurnTimerWarning = ({ playerName: timerPlayer, seconds }: { playerName: string; seconds: number }) => {
      // Resync the interval with the server's authoritative remaining time.
      // Without this, the local `remaining` closure variable drifts and the
      // display shows incorrect values after the warning fires.
      startTurnCountdown(seconds, timerPlayer || timerPlayerRef.current);
    };
    const handleTurnTimerPause = ({ remainingSeconds }: { remainingSeconds: number }) => {
      if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
      turnTimerIntervalRef.current = null;
      // Keep timer visible but frozen at remaining seconds
      setTurnTimerState(prev => ({ ...prev, active: true, seconds: remainingSeconds, isWarning: remainingSeconds <= 10 }));
    };
    const handleTurnTimerResume = ({ playerName: timerPlayer, remainingSeconds }: { playerName: string; remainingSeconds: number }) => {
      startTurnCountdown(remainingSeconds, timerPlayer);
    };
    socket.on('turn-timer-start', handleTurnTimerStart);
    socket.on('turn-timer-warning', handleTurnTimerWarning);
    socket.on('turn-timer-pause', handleTurnTimerPause);
    socket.on('turn-timer-resume', handleTurnTimerResume);
    // ── Rematch ─────────────────────────────────────────────────────────────
    const handleRematchVoteUpdate = ({ votes, total, voters }: { votes: number; total: number; voters: string[] }) => {
      setRematchState(prev => ({ ...prev, votes, total, voters }));
    };
    const handleRematchReady = ({ newGameId }: { newGameId: string }) => {
      setRematchState(prev => ({ ...prev, newGameId }));
      setTimeout(() => {
        window.location.href = `${window.location.origin}?game=${newGameId}`;
      }, 2000);
    };
    const handleRematchDeclined = ({ declinedBy }: { declinedBy: string }) => {
      setRematchState(prev => ({ ...prev, declined: true, declinedBy }));
    };
    const handleRematchExpired = () => {
      setRematchState(prev => ({ ...prev, expired: true }));
    };
    socket.on('rematch-vote-update', handleRematchVoteUpdate);
    socket.on('rematch-ready', handleRematchReady);
    socket.on('rematch-declined', handleRematchDeclined);
    socket.on('rematch-expired', handleRematchExpired);
    // ── Best of 3 ────────────────────────────────────────────────────────────
    const handleBo3VoteUpdate = ({ votes, total, voters }: { votes: number; total: number; voters: string[] }) => {
      setBo3State(prev => ({ ...prev, votes, total, voters }));
    };
    const handleBo3SeriesStarted = ({ seriesId, newGameId, player1, player2 }: { seriesId: string; newGameId: string; player1: string; player2: string }) => {
      setBo3State(prev => ({ ...prev, seriesStarted: true, newGameId }));
      setTimeout(() => {
        window.location.href = `${window.location.origin}?game=${newGameId}`;
      }, 2500);
    };
    const handleBo3Declined = ({ declinedBy }: { declinedBy: string }) => {
      setBo3State(prev => ({ ...prev, declined: true, declinedBy }));
    };
    const handleSeriesScoreUpdate = ({ player1, player2, wins }: { player1: string; player2: string; wins: { [k: string]: number } }) => {
      setBo3State(prev => ({ ...prev, seriesScore: wins }));
    };
    const handleSeriesEnded = ({ winner, wins }: { winner: string; wins: { [k: string]: number } }) => {
      setBo3State(prev => ({ ...prev, seriesEnded: true, seriesWinner: winner, seriesScore: wins }));
    };
    socket.on('bo3-vote-update', handleBo3VoteUpdate);
    socket.on('bo3-series-started', handleBo3SeriesStarted);
    socket.on('bo3-declined', handleBo3Declined);
    socket.on('series-score-update', handleSeriesScoreUpdate);
    socket.on('series-ended', handleSeriesEnded);
    // ────────────────────────────────────────────────────────────────────────

    return () => {
      if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
      socket.off('turn-timer-start', handleTurnTimerStart);
      socket.off('turn-timer-warning', handleTurnTimerWarning);
      socket.off('turn-timer-pause', handleTurnTimerPause);
      socket.off('turn-timer-resume', handleTurnTimerResume);
      socket.off('rematch-vote-update', handleRematchVoteUpdate);
      socket.off('rematch-ready', handleRematchReady);
      socket.off('rematch-declined', handleRematchDeclined);
      socket.off('rematch-expired', handleRematchExpired);
      socket.off('bo3-vote-update', handleBo3VoteUpdate);
      socket.off('bo3-series-started', handleBo3SeriesStarted);
      socket.off('bo3-declined', handleBo3Declined);
      socket.off('series-score-update', handleSeriesScoreUpdate);
      socket.off('series-ended', handleSeriesEnded);
      socket.off('game-reset', handleGameReset);
      socket.off('card-shown', handleCardShown);
      socket.off('card-show-confirmed', handleCardShowConfirmed);
      socket.off('dice-rolled', handleDiceRoll);
      socket.off('dice-roll', handleWindDiceRoll);
      socket.off('evolution-dice-roll', handleEvolutionDiceRoll);
      socket.off('dice-window-opened', handleDiceWindowOpen);
      socket.off('graveyard-milestone', handleGraveyardMilestone);
      socket.off('timed-effect-activated', handleTimedEffectActivated);
      socket.off('chat-message', handleChatMessage);
      socket.off('scenario-cards-toggled', handleScenarioCardsToggled);
      socket.off('card-attacked', handleCardAttacked);
      socket.off('card-to-graveyard', handleCardToGraveyard);
      socket.off('player-joined', handlePlayerJoined);
      socket.off('personaggio-enters', handlePersonaggioEnters);
      socket.off('cards-added', handleCardsAdded);
      socket.off('bee-sound', handleBeeSound);
      socket.off('character-sound', handleCharacterSound);
      socket.off('special-move-overlay', handleSpecialMoveOverlay);
      socket.off('evolution-animation', handleEvolutionAnimation);
      socket.off('fusion-animation', handleFusionAnimation);
      socket.off('card-played', handleCardPlayed);
      socket.off('card-played-face-down', handleCardPlayedFaceDown);
      socket.off('card-revealed', handleCardRevealed);
      socket.off('game-started', handleGameStarted);
      socket.off('lobby-settings-updated', handleLobbySettingsUpdated);
      socket.off('next-turn', handleNextTurn);
      socket.off('player-left', handlePlayerLeft);
      socket.off('super-dice-opened', handleOpenSuperDice);
      socket.off('super-dice-rolled', handleSuperDiceRolled);
      socket.off('cpu-thinking', handleCpuThinking);
      socket.off('cpu-done-thinking', handleCpuDoneThinking);
      socket.off('next-turn', handleCpuDoneThinking);
      socket.off('control-turn-set', handleControlTurnSet);
      socket.off('block-card-type-select', handleBlockCardTypeSelect);
      socket.off('daddy-conte-choice', handleDaddyConteChoice);
      socket.off('fabrizio-choice', handleFabrizioChoice);
      socket.off('control-turn-choose-target', handleControlTurnChooseTarget);
      socket.off('opponent-turn-control', handleControlTurnActive);
      socket.off('control-turn-resolved', handleControlTurnResolved);
      socket.off('instruction-executed', handleInstructionExecuted);
      socket.off('instruction-success', handleInstructionSuccess);
      socket.off('instruction-error', handleInstructionError);
      socket.off('instruction-question', handleInstructionQuestion);
      socket.off('instruction-dialogue', handleInstructionDialogue);
      socket.off('elimination-check', handleEliminationCheck);
      socket.off('player-eliminated', handlePlayerEliminated);
      socket.off('game-victory', handleGameVictory);
      socket.off('game-end-rewards', handleGameEndRewards);
      socket.off('fusion-error', handleFusionError);
      socket.off('voodoo:error', handleVoodooError);
      socket.off('player-choosing-notification', handlePlayerChoosingNotification);
      socket.off('show-graveyard-selection', handleShowGraveyardSelection);
      socket.off('show-pti-input-panel', handleShowPtiInputPanel);
      socket.off('show-pti-distribution-panel', handleShowPtiDistribution);
      socket.off('show-deck-selection', handleShowDeckSelection);
      socket.off('show-deck-card-picker', handleShowDeckCardPicker);
      socket.off('auction-select-character', handleAuctionSelectCharacter);
      socket.off('auction-started', handleAuctionStarted);
      socket.off('auction-bid-update', handleAuctionBidUpdate);
      socket.off('auction-countdown', handleAuctionCountdown);
      socket.off('auction-ended', handleAuctionEnded);
      socket.off('show-swap-selection', handleShowSwapSelection);
      socket.off('show-dice-control-panel', handleShowDiceControlPanel);
      socket.off('show-target-selection', handleShowTargetSelection);
      socket.off('show-custom-target-selection', handleShowCustomTargetSelection);
      socket.off('cards-revealed', handleCardsRevealed);
      socket.off('show-auto-dice-setup', handleShowAutoDiceSetup);
      socket.off('show-dice-character-select', handleShowDiceCharacterSelect);
      socket.off('show-dice-selection', handleShowDiceSelection);
      socket.off('dice-roll-result', handleDiceRollResult);
      socket.off('auto-dice-result', handleAutoDiceResult);
      socket.off('parasitic-target-select', handleParasiticTargetSelect);
      socket.off('parasitic-attached', handleParasiticAttached);
      socket.off('saibaim-explosion', handleSaibaImExplosion);
      socket.off('cimice-effect', handleCimiceEffect);
      socket.off('hostage-applied', handleHostageApplied);
      socket.off('hostage-updated', handleHostageUpdated);
      socket.off('hostage-released', handleHostageReleased);
      socket.off('hostage-died', handleHostageDied);
      socket.off('card-audio-play', handleCardAudioPlay);
      socket.off('character-attack-audio', handleCharacterAttackAudio);
      socket.off('show-youtube-video', handleShowYoutubeVideo);
      socket.off('clash-battle-start', handleClashBattleStart);
      socket.off('clash-battle-end', handleClashBattleEnd);
      socket.off('attack-error', handleAttackError);
      socket.off('attack-blocked', handleAttackError);
      socket.off('defense:result', handleDefenseResult);
      socket.off('bonus-effect-applied', handleEffectApplied);
      if (rewardsTimeoutId) clearTimeout(rewardsTimeoutId);
    };
  }, []);

  const { triggerEvent: triggerBgEvent, colors: bgColors } = useBackgroundEffect();
  const addToast = useGameToast(state => state.addToast);
  const triggerTooltipFn = useTooltipStore(state => state.triggerTooltip);

  useEffect(() => {
    const onAttack = () => { triggerBgEvent('attack'); haptic.attack(); addToast('Attacco in corso!', 'attack'); };
    const onDeath = () => { triggerBgEvent('death'); haptic.death(); addToast('Personaggio eliminato!', 'death'); triggerTooltipFn('card_died'); };
    const onEvolution = () => { triggerBgEvent('evolution'); haptic.evolution(); addToast('Evoluzione!', 'evolution', 4000); };
    const onCardPlayed = (data: any) => {
      if (data?.cardType === 'bonus') {
        triggerBgEvent('bonus');
      } else {
        triggerBgEvent('card-played');
      }
      haptic.cardPlay();
      triggerTooltipFn('card_drawn');
    };
    const onDice = () => { triggerBgEvent('dice'); haptic.dice(); triggerTooltipFn('dice_rolled'); };
    const onSpecialMove = () => triggerBgEvent('special-move');
    const onNextTurn = (data: any) => {
      if (data?.nextPlayer === playerName) {
        triggerBgEvent('my-turn');
        haptic.myTurn();
        addToast('Tocca a te!', 'turn');
        triggerTooltipFn('turn_started');
      } else {
        triggerBgEvent('opponent-turn');
      }
    };
    const onClash = () => triggerBgEvent('clash');
    const onHostage = () => triggerBgEvent('hostage');
    const onDefense = () => triggerBgEvent('defense');

    socket.on('card-attacked', onAttack);
    socket.on('card-to-graveyard', onDeath);
    socket.on('evolution-animation', onEvolution);
    socket.on('card-played', onCardPlayed);
    socket.on('dice-rolled', onDice);
    socket.on('dice-roll', onDice);
    socket.on('evolution-dice-roll', onDice);
    socket.on('special-move-overlay', onSpecialMove);
    socket.on('next-turn', onNextTurn);
    socket.on('clash-battle-start', onClash);
    socket.on('hostage-applied', onHostage);
    socket.on('defense-card-used', onDefense);
    socket.on('attack-blocked', onDefense);

    return () => {
      socket.off('card-attacked', onAttack);
      socket.off('card-to-graveyard', onDeath);
      socket.off('evolution-animation', onEvolution);
      socket.off('card-played', onCardPlayed);
      socket.off('dice-rolled', onDice);
      socket.off('dice-roll', onDice);
      socket.off('evolution-dice-roll', onDice);
      socket.off('special-move-overlay', onSpecialMove);
      socket.off('next-turn', onNextTurn);
      socket.off('clash-battle-start', onClash);
      socket.off('hostage-applied', onHostage);
      socket.off('defense-card-used', onDefense);
      socket.off('attack-blocked', onDefense);
    };
  }, [triggerBgEvent, playerName, addToast, triggerTooltipFn]);

  useEffect(() => {
    const isVisible = youtubeVideoData?.visible === true;
    if (isVisible) {
      if (turnTimerIntervalRef.current) clearInterval(turnTimerIntervalRef.current);
      turnTimerIntervalRef.current = null;
      socket.emit('timer-pause', { playerName: timerPlayerRef.current || '' });
    } else {
      socket.emit('timer-resume', { playerName: timerPlayerRef.current || '' });
    }
  }, [youtubeVideoData?.visible]);

  return (
    <div id="game-root" className="min-h-screen bg-arena-deep text-slate-100 p-4 relative overflow-hidden">
      <div className="game-field-aurora" />
      <GameToastContainer />
      <ContextualTooltipLoader />
      <ContextualTooltipDisplay />
      <ConnectionStatus />
      
      {/* Last Played Cards History */}
      <LastPlayedCards cards={lastPlayedCards} maxCards={5} />
      
      {/* Missions Panel */}
      <MissionsPanel 
        isOpen={missionsOpen}
        onClose={() => setMissionsOpen(false)}
        authToken={authToken || null}
        onPointsUpdated={(newTotal) => {
          setUserRankiardPoints(newTotal);
        }}
      />
      
      {/* Achievements Panel */}
      <AchievementsPanel
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        authToken={authToken || null}
        onPointsUpdated={(newTotal) => {
          setUserRankiardPoints(newTotal);
        }}
      />

      {/* Stats Panel */}
      {showStatsPanel && authenticatedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <StatsPanel
              username={authenticatedUser.username}
              userId={authenticatedUser.id}
              onClose={() => setShowStatsPanel(false)}
            />
          </div>
        </div>
      )}
      
      {/* Rankiard Leaderboard */}
      <RankiardLeaderboard
        isOpen={leaderboardOpen}
        onClose={() => setLeaderboardOpen(false)}
      />
      
      {/* Profile Panel */}
      <ProfilePanel
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        authToken={authToken || null}
        gameId={gameId || undefined}
      />

      {/* Collection Panel */}
      <CollectionPanel
        visible={collectionOpen}
        onClose={() => setCollectionOpen(false)}
      />

      {/* Table Theme Selector */}
      <TableThemeSelector
        visible={themeOpen}
        onClose={() => setThemeOpen(false)}
      />

      {helpBanner.visible && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] max-w-lg w-[calc(100%-2rem)] animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="bg-purple-900/90 backdrop-blur-md border border-purple-400/40 rounded-xl px-4 py-3 shadow-2xl flex items-start gap-3">
            <span className="text-2xl flex-shrink-0 mt-0.5">💡</span>
            <span className="bg-purple-500/60 text-purple-100 text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5">AIUTO</span>
            <p className="text-purple-100 text-sm flex-1 leading-relaxed">{helpBanner.message}</p>
            <button
              onClick={() => setHelpBanner({ visible: false, message: '' })}
              className="text-purple-300 hover:text-white flex-shrink-0 mt-0.5 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      {/* Join Request Dialog for room creator */}
      <JoinRequestDialog
        isCreator={gameState?.turnOrder?.[0] === playerName}
        gameId={gameId || ''}
      />
      
      {/* Card Trail Particles */}
      <CardTrailParticles
        visible={cardTrailParticles.visible}
        cardType={cardTrailParticles.cardType}
        startX={cardTrailParticles.x}
        startY={cardTrailParticles.y}
        onComplete={() => setCardTrailParticles(prev => ({ ...prev, visible: false }))}
      />

      {/* Victory/Defeat Animation — wrapped in AnimatePresence for result-phase transition */}
      <AnimatePresence>
        {victoryDefeatAnim.visible && (
          <motion.div
            key="victory-defeat"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <VictoryDefeatAnimation
              visible={victoryDefeatAnim.visible}
              type={victoryDefeatAnim.type}
              playerName={victoryDefeatAnim.playerName}
              stats={victoryDefeatAnim.stats}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen damage vignette — red rim flash when player's card is hit */}
      <AnimatePresence>
        {damageVignetteVisible && (
          <motion.div
            key="damage-vignette"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 pointer-events-none z-[45]"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(239,68,68,0.3) 70%, rgba(239,68,68,0.55) 100%)'
            }}
          />
        )}
      </AnimatePresence>

      {/* Animated gradient background - dynamic colors based on game events */}
      <div className="fixed inset-0 pointer-events-none dynamic-bg-transition animate-color-shift" style={{ background: bgColors.gradient }} />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Main floating orbs - static on mobile, animated on desktop */}
        <div className="absolute w-[200px] h-[200px] md:w-[700px] md:h-[700px] rounded-full blur-[40px] md:blur-[120px] md:animate-bg-float-1 dynamic-bg-transition will-change-[opacity]" style={{ background: `radial-gradient(circle, ${bgColors.orb1}, transparent 65%)`, opacity: bgColors.opacity1, top: '5%', left: '15%' }} />
        <div className="absolute w-[180px] h-[180px] md:w-[600px] md:h-[600px] rounded-full blur-[35px] md:blur-[100px] md:animate-bg-float-2 dynamic-bg-transition will-change-[opacity]" style={{ background: `radial-gradient(circle, ${bgColors.orb2}, transparent 65%)`, opacity: bgColors.opacity2, bottom: '10%', right: '10%' }} />
        <div className="hidden md:block absolute w-[500px] h-[500px] rounded-full blur-[90px] animate-bg-float-3 dynamic-bg-transition" style={{ background: `radial-gradient(circle, ${bgColors.orb3}, transparent 65%)`, opacity: bgColors.opacity3, top: '40%', left: '55%' }} />
        <div className="hidden md:block absolute w-[550px] h-[550px] rounded-full blur-[110px] animate-bg-float-4 dynamic-bg-transition" style={{ background: `radial-gradient(circle, ${bgColors.orb4}, transparent 65%)`, opacity: bgColors.opacity4, top: '60%', left: '5%' }} />
        <div className="hidden md:block absolute w-[450px] h-[450px] rounded-full blur-[80px] animate-bg-float-5 dynamic-bg-transition" style={{ background: `radial-gradient(circle, ${bgColors.orb5}, transparent 65%)`, opacity: bgColors.opacity5, top: '15%', right: '25%' }} />
        {/* Aurora wave effects - hidden on mobile */}
        <div className="hidden md:block absolute inset-0 animate-aurora-1 dynamic-bg-transition" style={{ background: `linear-gradient(90deg, transparent 0%, ${bgColors.auroraColor1} 30%, ${bgColors.auroraColor2} 50%, ${bgColors.auroraColor1} 70%, transparent 100%)`, opacity: bgColors.auroraOpacity, height: '40%', top: '10%' }} />
        <div className="hidden md:block absolute inset-0 animate-aurora-2 dynamic-bg-transition" style={{ background: `linear-gradient(90deg, transparent 0%, ${bgColors.auroraColor2} 25%, ${bgColors.auroraColor1} 50%, ${bgColors.auroraColor2} 75%, transparent 100%)`, opacity: bgColors.auroraOpacity * 0.7, height: '35%', bottom: '15%', top: 'auto' }} />
        {/* Central nebula pulse - hidden on mobile */}
        <div className="hidden md:block absolute w-[800px] h-[800px] rounded-full blur-[150px] animate-nebula-pulse dynamic-bg-transition" style={{ background: `radial-gradient(circle, ${bgColors.pulseColor}, transparent 60%)`, opacity: bgColors.pulseOpacity, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
      </div>

      <AmbientParticles visible={true} />

      {/* Back to Home button - hidden since back is in header menu */}

      {/* Portrait mode message - only show on mobile portrait if not dismissed */}
      {showRotationWarning && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 portrait:flex landscape:hidden sm:hidden">
          <div className="relative text-center text-white bg-gray-800 rounded-lg p-6 max-w-sm mx-4">
            {/* Close button */}
            <Button
              onClick={() => setShowRotationWarning(false)}
              className="absolute top-2 right-2 bg-transparent hover:bg-gray-700 text-white p-1 h-8 w-8 rounded-full"
              size="sm"
            >
              <X size={16} />
            </Button>
            
            <div className="text-6xl mb-4">📱</div>
            <h2 className="text-xl font-bold mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>Ruota il dispositivo</h2>
            <p className="text-sm opacity-80 mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>Per la migliore esperienza di gioco, ruota il tuo smartphone in modalità orizzontale</p>
            
            {/* Optional continue button */}
            <Button
              onClick={() => setShowRotationWarning(false)}
              className="btn-neon-blue text-white text-sm px-4 py-2"
              style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}
            >
              Continua comunque
            </Button>
          </div>
        </div>
      )}
      

      {/* Elimination Confirmation Dialog */}
      {eliminationDialogOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-center mb-6 text-gray-800">
              È morto il tuo ultimo personaggio, confermi di aver perso la partita?
            </h2>
            <div className="space-y-3">
              <Button
                onClick={() => {
                  setEliminationDialogOpen(false);
                  socket.emit('confirm-elimination', { gameId, playerName, confirmed: true });
                }}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 text-lg border-2 border-red-400 shadow-[0_0_15px_rgba(220,38,38,0.4)]"
              >
                Sì, mi arrendo
              </Button>
              <Button
                onClick={() => {
                  setEliminationDialogOpen(false);
                  socket.emit('confirm-elimination', { gameId, playerName, confirmed: false });
                }}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 text-lg border-2 border-green-400 shadow-[0_0_15px_rgba(22,163,74,0.4)]"
              >
                No, continuo a giocare
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game End Rewards Panel */}
      <GameEndRewardsPanel
        visible={gameEndRewards.visible}
        pointsEarned={gameEndRewards.pointsEarned}
        previousTotal={gameEndRewards.previousTotal}
        newTotal={gameEndRewards.newTotal}
        placement={gameEndRewards.placement}
        isWinner={gameEndRewards.isWinner}
        winnerName={gameEndRewards.winnerName}
        playerName={playerName}
        onGoHome={() => {
          console.log('[REWARDS] onGoHome clicked');
          clearSession();
          window.location.href = window.location.origin;
        }}
        onNewGame={() => {
          console.log('[REWARDS] onNewGame clicked');
          clearSession();
          window.location.href = window.location.origin;
        }}
        onContinueTournament={(gameId.startsWith('tournament-') || !!fantaTournamentId) ? () => {
          console.log('[REWARDS] Continua torneo clicked, fantaTournamentId:', fantaTournamentId);
          if (fantaTournamentId && onContinueFantaTournament) {
            clearSession();
            onContinueFantaTournament(fantaTournamentId);
          } else if (onContinueTournament) {
            onContinueTournament();
          }
        } : undefined}
        rematchSection={!rematchState.newGameId && !bo3State.seriesStarted ? (
          rematchState.declined ? (
            <div className="bg-red-900/80 border border-red-500 text-white px-4 py-3 rounded-xl text-center">
              <p className="font-bold">❌ Rivincita rifiutata</p>
              <p className="text-sm text-red-200">{rematchState.declinedBy} non vuole rigiocare</p>
            </div>
          ) : bo3State.declined ? (
            <div className="bg-red-900/80 border border-red-500 text-white px-4 py-3 rounded-xl text-center">
              <p className="font-bold">❌ Best of 3 rifiutato</p>
              <p className="text-sm text-red-200">{bo3State.declinedBy} non vuole la serie</p>
            </div>
          ) : rematchState.expired ? (
            <div className="bg-gray-900/80 border border-gray-500 text-white px-4 py-3 rounded-xl text-center">
              <p className="text-sm">⏰ Il tempo per la rivincita è scaduto</p>
            </div>
          ) : bo3State.voters.includes(playerName || '') ? (
            <div className="bg-purple-900/80 border border-purple-500 text-white px-4 py-3 rounded-xl text-center animate-pulse">
              <p className="font-bold">⏳ In attesa per Bo3...</p>
              <p className="text-sm text-purple-200">{bo3State.votes}/{bo3State.total} pronti</p>
            </div>
          ) : rematchState.voters.includes(playerName || '') ? (
            <div className="bg-yellow-900/80 border border-yellow-500 text-white px-4 py-3 rounded-xl text-center animate-pulse">
              <p className="font-bold">⏳ In attesa degli altri...</p>
              <p className="text-sm text-yellow-200">{rematchState.votes}/{rematchState.total} hanno accettato</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => socket.emit('request-rematch', { gameId, playerName })}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                >
                  🔄 Rivincita!
                </button>
                <button
                  onClick={() => socket.emit('request-bo3', { gameId, playerName })}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-500 hover:to-violet-600 text-white font-bold px-4 py-3 rounded-xl shadow-lg transition-all hover:scale-105 flex items-center justify-center gap-2"
                  title="Proponi serie Best of 3 — vince chi vince 2 partite"
                >
                  🏆 Best of 3
                </button>
              </div>
              <button
                onClick={() => socket.emit('decline-rematch', { gameId, playerName })}
                className="text-white/50 hover:text-white/80 font-medium px-4 py-2 transition-all text-sm"
              >
                No grazie
              </button>
            </div>
          )
        ) : undefined}
      />

      {/* Player Elimination Notification */}
      {playerEliminationNotification.visible && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          <div className="flex items-center space-x-2">
            <Skull className="w-5 h-5" />
            <span className="font-bold">
              {playerEliminationNotification.player} è stato eliminato dalla partita!
            </span>
          </div>
        </div>
      )}

      {/* PARASITIC CARD: Target Selection Dialog */}
      {parasiticTargetSelect.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-green-900 to-green-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-green-400 shadow-[0_0_30px_rgba(34,197,94,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🦠 {parasiticTargetSelect.parasiticType === 'PARASSITA' ? 'PARASSITA' : 'SAIBAIM'}
              </h2>
              <p className="text-green-100" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {parasiticTargetSelect.parasiticType === 'PARASSITA' 
                  ? 'Scegli il personaggio nemico a cui agganciarti per drenare i suoi PTI!' 
                  : 'Scegli il personaggio nemico a cui agganciarti per esplodere insieme dopo 3 turni!'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-80 overflow-y-auto">
              {parasiticTargetSelect.targets.map((target) => (
                <button
                  key={target.id}
                  onClick={() => {
                    socket.emit('parasitic-attach-target', {
                      gameId,
                      parasiticCardId: parasiticTargetSelect.parasiticCardId,
                      targetCardId: target.id,
                      playerName
                    });
                  }}
                  className="bg-gray-800/80 hover:bg-green-600 transition-all duration-200 rounded-lg p-3 border-2 border-green-400 hover:border-green-300 hover:shadow-[0_0_20px_rgba(34,197,94,0.6)]"
                >
                  {target.frontImage ? (
                    <img 
                      src={getOptimizedUrl(target.frontImage, 'card')} 
                      alt="Target" 
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => { const t=e.currentTarget; if(t.src!==target.frontImage){t.onerror=null;t.src=target.frontImage;} }}
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                      <span className="text-white text-xs">Carta</span>
                    </div>
                  )}
                  <p className="text-white text-sm font-bold" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {target.owner}
                  </p>
                  {target.text && (
                    <p className="text-green-200 text-xs" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {target.text}
                    </p>
                  )}
                </button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <p className="text-green-200 text-xs" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {parasiticTargetSelect.parasiticType === 'PARASSITA' 
                  ? '⚠️ Il PARASSITA non può essere attaccato mentre è agganciato' 
                  : '⚠️ Il SAIBAIM esploderà dopo 3 turni eliminando entrambi i personaggi'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* GRAVEYARD SELECTION MODAL - Interactive card selection from graveyard */}
      {graveyardSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6 w-full max-w-3xl mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                👼 SCEGLI CARTA DAL CIMITERO
              </h2>
              <p className="text-purple-100" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {graveyardSelectionModal.message || 'Seleziona una carta da riportare in mano'}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {graveyardSelectionModal.cards.map((card: any) => (
                <button
                  key={card.id}
                  onClick={() => {
                    socket.emit('resurrect-select', {
                      cardId: card.id,
                      playerName
                    });
                    setGraveyardSelectionModal({ visible: false, reason: '', cards: [], message: '' });
                  }}
                  className="bg-gray-800/80 hover:bg-purple-600 transition-all duration-200 rounded-lg p-3 border-2 border-purple-400 hover:border-purple-300 hover:shadow-[0_0_20px_rgba(147,51,234,0.6)]"
                >
                  {card.frontImage ? (
                    <img 
                      src={getOptimizedUrl(card.frontImage, 'card')} 
                      alt="Graveyard Card" 
                      className="w-full h-32 object-cover rounded mb-2"
                      onError={(e) => { const t=e.currentTarget; if(t.src!==card.frontImage){t.onerror=null;t.src=card.frontImage;} }}
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                      <span className="text-white text-xs">Carta</span>
                    </div>
                  )}
                  <p className="text-white text-sm font-bold truncate" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                    {card.name || card.id}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 text-center">
              <button
                onClick={() => setGraveyardSelectionModal({ visible: false, reason: '', cards: [], message: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PTI INPUT PANEL - For effects that require user to input PTI amount */}
      {ptiInputPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-blue-900 to-blue-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                📋 {ptiInputPanel.cardName}
              </h2>
              <p className="text-blue-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {ptiInputPanel.effectDescription.length > 150 
                  ? ptiInputPanel.effectDescription.substring(0, 150) + '...' 
                  : ptiInputPanel.effectDescription}
              </p>
            </div>
            <div className="mb-4">
              <label className="text-white text-sm font-bold mb-2 block">Inserisci quantità PTI:</label>
              <Input
                type="number"
                value={ptiInputValue}
                onChange={(e) => setPtiInputValue(e.target.value)}
                placeholder="Es: 500"
                className="bg-gray-800 text-white border-blue-400"
                min="0"
              />
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  const ptiValue = parseInt(ptiInputValue) || 0;
                  socket.emit('pti-input-confirm', {
                    cardId: ptiInputPanel.cardId,
                    ptiValue,
                    playerName
                  });
                  setPtiInputPanel({ visible: false, cardId: '', cardName: '', effectDescription: '' });
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2"
              >
                Conferma
              </Button>
              <Button
                onClick={() => setPtiInputPanel({ visible: false, cardId: '', cardName: '', effectDescription: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PTI DISTRIBUTION PANEL - Giovanni Muciaccia style PTI/stelle allocation */}
      {ptiDistributionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-indigo-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(147,51,234,0.5)]">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎭 {ptiDistributionPanel.cardName}
              </h2>
              <p className="text-purple-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                Distribuisci {ptiDistributionPanel.totalBudget} punti tra PTI e Stelle. Ogni stella costa {ptiDistributionPanel.ptiPerStar} PTI.
              </p>
            </div>
            {ptiDistributionPanel.cardImage && (
              <div className="flex justify-center mb-4">
                <img src={ptiDistributionPanel.cardImage} alt={ptiDistributionPanel.cardName} className="w-24 h-32 object-cover rounded border-2 border-purple-300" />
              </div>
            )}
            <div className="bg-black/30 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-3">
                <span className="text-white font-bold text-lg">PTI: {distributionPti}</span>
                <span className="text-yellow-300 font-bold text-lg">Stelle: {distributionStars} {'⭐'.repeat(distributionStars)}</span>
              </div>
              <div className="mb-3">
                <label className="text-purple-200 text-xs block mb-1">Stelle (ogni stella = {ptiDistributionPanel.ptiPerStar} PTI)</label>
                <input
                  type="range"
                  min="0"
                  max={Math.floor(ptiDistributionPanel.totalBudget / ptiDistributionPanel.ptiPerStar)}
                  value={distributionStars}
                  onChange={(e) => {
                    const stars = parseInt(e.target.value);
                    setDistributionStars(stars);
                    setDistributionPti(ptiDistributionPanel.totalBudget - (stars * ptiDistributionPanel.ptiPerStar));
                  }}
                  className="w-full accent-purple-500"
                />
                <div className="flex justify-between text-purple-300 text-xs mt-1">
                  <span>0 stelle</span>
                  <span>{Math.floor(ptiDistributionPanel.totalBudget / ptiDistributionPanel.ptiPerStar)} stelle</span>
                </div>
              </div>
              <div className="text-center text-purple-200 text-sm">
                Budget usato: {distributionPti + (distributionStars * ptiDistributionPanel.ptiPerStar)}/{ptiDistributionPanel.totalBudget}
              </div>
            </div>
            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => {
                  socket.emit('pti-distribution-confirm', {
                    cardId: ptiDistributionPanel.cardId,
                    ptiValue: distributionPti,
                    starsValue: distributionStars,
                    playerName
                  });
                  setPtiDistributionPanel({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 });
                }}
                className="bg-green-600 hover:bg-green-500 text-white px-6 py-2"
              >
                Conferma
              </Button>
              <Button
                onClick={() => setPtiDistributionPanel({ visible: false, cardId: '', cardName: '', cardImage: '', totalBudget: 1000, ptiPerStar: 100 })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DECK SELECTION PANEL - For effects that require user to select from decks */}
      {deckSelectionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(217,119,6,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎴 {deckSelectionPanel.cardName}
              </h2>
              <p className="text-amber-100 text-sm" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {deckSelectionPanel.effectDescription.length > 150 
                  ? deckSelectionPanel.effectDescription.substring(0, 150) + '...' 
                  : deckSelectionPanel.effectDescription}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'personaggi',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-red-600 hover:bg-red-500 text-white py-4"
              >
                PERSONAGGI
              </Button>
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'mosse',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white py-4"
              >
                MOSSE
              </Button>
              <Button
                onClick={() => {
                  socket.emit('deck-selection-confirm', {
                    cardId: deckSelectionPanel.cardId,
                    deckType: 'bonus',
                    playerName
                  });
                  setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                }}
                className="bg-green-600 hover:bg-green-500 text-white py-4"
              >
                BONUS
              </Button>
              {!deckSelectionPanel.excludeSpeciali && (
                <Button
                  onClick={() => {
                    socket.emit('deck-selection-confirm', {
                      cardId: deckSelectionPanel.cardId,
                      deckType: 'personaggi_speciali',
                      playerName
                    });
                    setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false });
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white py-4"
                >
                  SPECIALI
                </Button>
              )}
            </div>
            <div className="text-center">
              <Button
                onClick={() => setDeckSelectionPanel({ visible: false, cardId: '', cardName: '', effectDescription: '', excludeSpeciali: false })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {deckCardPickerPanel.visible && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-4 w-full max-w-4xl mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(217,119,6,0.5)] max-h-[85vh] flex flex-col">
            <div className="text-center mb-4">
              <h2 className="text-xl font-bold text-white mb-1" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎴 Scegli una carta dal mazzo {deckCardPickerPanel.deckDisplayName}
              </h2>
              <p className="text-amber-200 text-sm">{deckCardPickerPanel.cards.length} carte disponibili</p>
            </div>
            <div className="overflow-y-auto flex-1 mb-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {deckCardPickerPanel.cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => {
                      socket.emit('deck-card-pick-confirm', {
                        selectedCardId: card.id,
                        deckType: deckCardPickerPanel.deckType,
                        cardId: deckCardPickerPanel.cardId,
                        playerName
                      });
                      setDeckCardPickerPanel({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] });
                    }}
                    className="cursor-pointer rounded-lg border-2 border-amber-600 hover:border-yellow-300 hover:shadow-[0_0_15px_rgba(253,224,71,0.5)] transition-all duration-200 bg-black/30 p-1 flex flex-col items-center"
                  >
                    {card.frontImage ? (
                      <img
                        src={getOptimizedUrl(card.frontImage, 'card')}
                        alt={card.name}
                        className="w-full h-auto rounded object-contain max-h-32"
                        loading="lazy"
                        onError={(e) => { const t=e.currentTarget; if(t.src!==card.frontImage){t.onerror=null;t.src=card.frontImage;} }}
                      />
                    ) : (
                      <div className="w-full h-24 bg-gray-700 rounded flex items-center justify-center text-white text-xs">
                        {card.name}
                      </div>
                    )}
                    <p className="text-white text-[10px] mt-1 text-center truncate w-full" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {card.name}
                    </p>
                    {(card.pti != null || card.stars != null) && (
                      <p className="text-amber-300 text-[9px] text-center">
                        {card.pti != null ? `PTI: ${card.pti}` : ''}{card.pti != null && card.stars != null ? ' | ' : ''}{card.stars != null ? `⭐${card.stars}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-center">
              <Button
                onClick={() => setDeckCardPickerPanel({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SWAP SELECTION PANEL - Baratto effect player selection */}
      {swapSelectionPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-cyan-900 to-cyan-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-cyan-400 shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🔄 {swapSelectionPanel.cardName}
              </h2>
              <p className="text-cyan-100 text-sm mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {swapSelectionPanel.effectDescription.length > 150 
                  ? swapSelectionPanel.effectDescription.substring(0, 150) + '...' 
                  : swapSelectionPanel.effectDescription}
              </p>
              <p className="text-cyan-200 font-bold">Scegli con chi scambiare:</p>
            </div>
            <div className="space-y-3 mb-4">
              {swapSelectionPanel.otherPlayers.map((otherPlayer: string) => (
                <Button
                  key={otherPlayer}
                  onClick={() => {
                    socket.emit('swap-confirm', {
                      cardId: swapSelectionPanel.cardId,
                      targetPlayer: otherPlayer,
                      playerName
                    });
                    setSwapSelectionPanel({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' });
                  }}
                  className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-4 text-lg font-bold"
                >
                  🎮 {otherPlayer}
                </Button>
              ))}
            </div>
            <div className="text-center">
              <Button
                onClick={() => setSwapSelectionPanel({ visible: false, cardId: '', cardName: '', otherPlayers: [], effectDescription: '' })}
                className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2"
              >
                Annulla
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DICE CONTROL PANEL - Choose dice result */}
      {diceControlPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-yellow-900 to-orange-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-yellow-400 shadow-[0_0_30px_rgba(234,179,8,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 CONTROLLO DEL DADO
              </h2>
              <p className="text-yellow-100 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                <span className="font-bold">{diceControlPanel.rollingPlayer}</span> sta per lanciare il dado!
              </p>
              <p className="text-yellow-100 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                La tua carta <span className="font-bold">{diceControlPanel.controllingCardName}</span> ti permette di scegliere il risultato!
              </p>
              {diceControlPanel.targetCharName && (
                <p className="text-orange-200 text-sm mb-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                  Bersaglio: <span className="font-bold">{diceControlPanel.targetCharName}</span>
                </p>
              )}
              <p className="text-yellow-200 font-bold">Scegli il numero del dado:</p>
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6].map((num) => (
                <Button
                  key={num}
                  onClick={() => {
                    socket.emit('dice-control-select', {
                      gameId,
                      selectedNumber: num,
                      controllingPlayer: diceControlPanel.controllingPlayer,
                      rollingPlayer: diceControlPanel.rollingPlayer,
                      pendingId: diceControlPanel.pendingId
                    });
                    setDiceControlPanel({ visible: false, rollingPlayer: '', controllingPlayer: '', controllingCardName: '' });
                  }}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white py-6 text-3xl font-bold"
                >
                  {num}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TARGET SELECTION MODAL - Interactive target selection for custom effects */}
      {targetSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className={`bg-gradient-to-br ${targetSelectionModal.effectType === 'damage' ? 'from-red-900 to-red-700 border-red-400' : 'from-green-900 to-green-700 border-green-400'} rounded-lg p-6 w-full max-w-3xl mx-4 border-4 shadow-[0_0_30px_rgba(220,38,38,0.5)]`}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎯 SCEGLI BERSAGLI ({selectedTargetIds.length}/{targetSelectionModal.maxTargets})
              </h2>
              <p className="text-white/90" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {targetSelectionModal.message || `Seleziona fino a ${targetSelectionModal.maxTargets} personaggi`}
              </p>
              <p className="text-lg font-bold mt-2" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {targetSelectionModal.effectType === 'damage' 
                  ? `⚔️ Danno: ${targetSelectionModal.value} PTI` 
                  : `💚 Cura: ${targetSelectionModal.value} PTI`}
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
              {targetSelectionModal.targets.map((card) => {
                const isSelected = selectedTargetIds.includes(card.id);
                return (
                  <button
                    key={card.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedTargetIds(prev => prev.filter(id => id !== card.id));
                      } else if (selectedTargetIds.length < targetSelectionModal.maxTargets) {
                        setSelectedTargetIds(prev => [...prev, card.id]);
                      }
                    }}
                    className={`transition-all duration-200 rounded-lg p-3 border-2 ${
                      isSelected 
                        ? (targetSelectionModal.effectType === 'damage' 
                            ? 'bg-red-600 border-red-300 shadow-[0_0_20px_rgba(220,38,38,0.8)]' 
                            : 'bg-green-600 border-green-300 shadow-[0_0_20px_rgba(34,197,94,0.8)]')
                        : 'bg-gray-800/80 hover:bg-gray-700 border-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {card.frontImage ? (
                      <img 
                        src={getOptimizedUrl(card.frontImage, 'card')} 
                        alt="Target Card" 
                        className="w-full h-32 object-cover rounded mb-2"
                        onError={(e) => { const t=e.currentTarget; if(t.src!==card.frontImage){t.onerror=null;t.src=card.frontImage;} }}
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-700 rounded mb-2 flex items-center justify-center">
                        <span className="text-white text-xs">Carta</span>
                      </div>
                    )}
                    <p className="text-white text-sm font-bold truncate" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                      {card.name || card.id}
                    </p>
                    <p className="text-xs text-gray-300">{card.owner}</p>
                    {isSelected && (
                      <div className="mt-1 text-xl">✓</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={() => {
                  setTargetSelectionModal({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
                  setSelectedTargetIds([]);
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (selectedTargetIds.length > 0) {
                    socket.emit('target-select', {
                      targetCardIds: selectedTargetIds,
                      playerName
                    });
                    setTargetSelectionModal({ visible: false, effectType: 'damage', value: 0, maxTargets: 1, targets: [], message: '' });
                    setSelectedTargetIds([]);
                  }
                }}
                disabled={selectedTargetIds.length === 0}
                className={`px-4 py-2 rounded font-bold ${
                  selectedTargetIds.length > 0
                    ? (targetSelectionModal.effectType === 'damage' 
                        ? 'bg-red-600 hover:bg-red-500 text-white' 
                        : 'bg-green-600 hover:bg-green-500 text-white')
                    : 'bg-gray-500 text-gray-300 cursor-not-allowed'
                }`}
              >
                {targetSelectionModal.effectType === 'damage' ? '⚔️ Attacca' : '💚 Cura'} ({selectedTargetIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE CHARACTER SELECTION MODAL - Step 1: Choose which characters to involve */}
      {diceCharacterSelectModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎯 SELEZIONA PERSONAGGI - {diceCharacterSelectModal.cardName}
              </h2>
              <div className="text-purple-100 text-sm space-y-1">
                <p>✅ Se indovina: <span className="text-green-300 font-bold">{diceCharacterSelectModal.correctEffect}</span></p>
                <p>❌ Se sbaglia: <span className="text-red-300 font-bold">{diceCharacterSelectModal.wrongEffect}</span></p>
              </div>
            </div>
            
            <p className="text-white text-center mb-4">Seleziona quali personaggi coinvolgere nel lancio del dado:</p>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {diceCharacterSelectModal.availableCharacters.map(char => {
                const isSelected = diceCharacterSelectModal.selectedCharacterIds.includes(char.id);
                return (
                  <div
                    key={char.id}
                    onClick={() => {
                      setDiceCharacterSelectModal(prev => ({
                        ...prev,
                        selectedCharacterIds: isSelected
                          ? prev.selectedCharacterIds.filter(id => id !== char.id)
                          : [...prev.selectedCharacterIds, char.id]
                      }));
                    }}
                    className={`bg-gray-800/80 rounded-lg p-3 border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.6)]'
                        : 'border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {char.frontImage && (
                        <img src={getOptimizedUrl(char.frontImage, 'card')} alt={char.name} className="w-16 h-20 object-cover rounded" onError={(e) => { const t=e.currentTarget; if(t.src!==char.frontImage){t.onerror=null;t.src=char.frontImage;} }} />
                      )}
                      <span className="text-white font-bold text-sm text-center">{char.name}</span>
                      <span className={`text-xs ${char.owner === playerName ? 'text-green-400' : 'text-red-400'}`}>
                        {char.owner === playerName ? '(Tuo)' : `(${char.owner})`}
                      </span>
                      {isSelected && (
                        <span className="text-purple-300 text-xl">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => {
                  if (diceCharacterSelectModal.selectedCharacterIds.length > 0) {
                    socket.emit('dice-characters-confirmed', {
                      diceEffectId: diceCharacterSelectModal.diceEffectId,
                      selectedCharacterIds: diceCharacterSelectModal.selectedCharacterIds,
                      playerName
                    });
                    setDiceCharacterSelectModal({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', availableCharacters: [], selectedCharacterIds: [] });
                  }
                }}
                disabled={diceCharacterSelectModal.selectedCharacterIds.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  diceCharacterSelectModal.selectedCharacterIds.length > 0
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 Conferma Personaggi ({diceCharacterSelectModal.selectedCharacterIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE SELECTION MODAL - Step 2: Choose number before dice roll */}
      {diceSelectionModal.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-amber-900 to-amber-700 rounded-lg p-6 w-full max-w-2xl mx-4 border-4 border-amber-400 shadow-[0_0_30px_rgba(251,191,36,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 LANCIO DEL DADO - {diceSelectionModal.cardName}
              </h2>
              <div className="text-amber-100 text-sm space-y-1">
                <p>✅ Se indovini: <span className="text-green-300 font-bold">{diceSelectionModal.correctEffect}</span></p>
                <p>❌ Se sbagli: <span className="text-red-300 font-bold">{diceSelectionModal.wrongEffect}</span></p>
              </div>
            </div>
            
            <p className="text-white text-center mb-4">Scegli un numero per ogni tuo personaggio coinvolto:</p>
            
            <div className="space-y-4 max-h-80 overflow-y-auto">
              {diceSelectionModal.myCharacterIds.map(charId => {
                const char = diceSelectionModal.involvedCharacters.find(c => c.id === charId);
                if (!char) return null;
                return (
                  <div key={charId} className="bg-gray-800/80 rounded-lg p-4 border border-amber-500/50">
                    <div className="flex items-center gap-3 mb-3">
                      {char.frontImage && (
                        <img src={getOptimizedUrl(char.frontImage, 'card')} alt={char.name} className="w-12 h-16 object-cover rounded" onError={(e) => { const t=e.currentTarget; if(t.src!==char.frontImage){t.onerror=null;t.src=char.frontImage;} }} />
                      )}
                      <span className="text-white font-bold">{char.name}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {['1', '2', '3', '4', '5', '6', 'Pari', 'Dispari'].map(choice => (
                        <button
                          key={choice}
                          onClick={() => setDiceChoices(prev => ({ ...prev, [charId]: choice }))}
                          className={`p-2 rounded font-bold transition-all ${
                            diceChoices[charId] === choice
                              ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(251,191,36,0.8)]'
                              : 'bg-gray-700 text-white hover:bg-gray-600'
                          }`}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={() => {
                  const allChosen = diceSelectionModal.myCharacterIds.every(id => diceChoices[id]);
                  if (allChosen) {
                    socket.emit('dice-choice-submit', {
                      diceEffectId: diceSelectionModal.diceEffectId,
                      choices: diceChoices,
                      playerName
                    });
                    setDiceSelectionModal({ visible: false, diceEffectId: '', cardName: '', correctEffect: '', wrongEffect: '', involvedCharacters: [], myCharacterIds: [] });
                  }
                }}
                disabled={!diceSelectionModal.myCharacterIds.every(id => diceChoices[id])}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  diceSelectionModal.myCharacterIds.every(id => diceChoices[id])
                    ? 'bg-amber-500 hover:bg-amber-400 text-black shadow-[0_0_20px_rgba(251,191,36,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 Conferma Scelte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DICE ROLL RESULT - Animated result display */}
      {diceRollResult?.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-gradient-to-br from-amber-900 to-amber-600 rounded-xl p-8 border-4 border-amber-300 shadow-[0_0_50px_rgba(251,191,36,0.8)] animate-bounce-once">
            <div className="text-center">
              <div className="w-[80px] h-[80px] mx-auto mb-4">
                <Dice3D isRolling={false} result={diceRollResult.result} size={80} />
              </div>
              <h2 className="text-4xl font-bold text-white mb-2" style={{textShadow: '3px 3px 6px rgba(0,0,0,0.8)'}}>
                RISULTATO: {diceRollResult.result}
              </h2>
              <p className="text-amber-200 text-lg">
                {diceRollResult.result % 2 === 0 ? 'PARI' : 'DISPARI'}
              </p>
              
              {diceRollResult.winners.length > 0 && (
                <div className="mt-4 bg-green-600/30 border border-green-400 rounded-lg p-3">
                  <p className="text-green-300 font-bold mb-2">✅ HANNO INDOVINATO:</p>
                  {diceRollResult.winners.map((w, i) => (
                    <p key={i} className="text-white">{w.name} → {w.effect}</p>
                  ))}
                </div>
              )}
              
              {diceRollResult.losers.length > 0 && (
                <div className="mt-4 bg-red-600/30 border border-red-400 rounded-lg p-3">
                  <p className="text-red-300 font-bold mb-2">❌ HANNO SBAGLIATO:</p>
                  {diceRollResult.losers.map((l, i) => (
                    <p key={i} className="text-white">{l.name} → {l.effect}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AUTO DICE RESULT - Animated automatic dice roll display */}
      {windDiceRoll.visible && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative bg-gradient-to-br from-cyan-900 via-blue-800 to-teal-700 rounded-2xl p-8 border-4 border-cyan-400 shadow-[0_0_80px_rgba(0,200,255,0.6)] max-w-md w-full mx-4">
            <div className="text-center">
              <h3 className="text-xl font-bold text-cyan-200 mb-2">FOLATA DI VENTO</h3>
              <p className="text-gray-300 text-sm mb-4">{windDiceRoll.playerName} tira il dado!</p>
              <div className="w-[90px] h-[90px] mx-auto mb-4">
                <Dice3D isRolling={false} result={windDiceRoll.value} size={90} />
              </div>
              <h2 className="text-7xl font-bold text-white mb-4 animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
                {windDiceRoll.value}
              </h2>
              <div className={`text-2xl font-bold ${windDiceRoll.value % 2 === 0 ? 'text-green-400' : 'text-orange-400'}`}>
                {windDiceRoll.value % 2 === 0 ? 'PARI - Danno al prossimo giocatore!' : 'DISPARI - Danno al giocatore precedente!'}
              </div>
            </div>
          </div>
        </div>
      )}

      {evolutionDiceRoll.visible && (
        <div className="fixed inset-0 z-[9998] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/85" style={{ animation: 'evo-dice-backdrop 0.4s ease-out' }} />
          <div className="relative flex flex-col items-center gap-4" style={{ animation: 'evo-dice-panel-enter 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
            <h3 className="text-2xl font-black text-yellow-200 tracking-widest" style={{ textShadow: '0 0 30px rgba(255,215,0,0.6)' }}>
              DADO EVOLUZIONE
            </h3>
            <p className="text-gray-300 text-sm">{evolutionDiceRoll.playerName} lancia il dado per <span className="text-yellow-300 font-bold">{evolutionDiceRoll.characterName}</span></p>
            
            <div className="my-4">
              <Dice3D 
                isRolling={evolutionDiceRoll.animationPhase === 'rolling'} 
                result={evolutionDiceRoll.animationPhase === 'result' ? evolutionDiceRoll.diceResult : null} 
                size={120} 
              />
            </div>
            
            {evolutionDiceRoll.animationPhase === 'result' && (
              <div style={{ animation: 'evo-dice-result-reveal 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                {evolutionDiceRoll.evolutionTarget ? (
                  <div className="text-center">
                    <div className="text-5xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(255,215,0,0.8)' }}>
                      {evolutionDiceRoll.diceResult}
                    </div>
                    <div className="text-xl font-bold text-green-400" style={{ textShadow: '0 0 20px rgba(74,222,128,0.6)', animation: 'evo-dice-glow 1.5s ease-in-out infinite' }}>
                      🌟 Si evolve in: {evolutionDiceRoll.evolutionTarget}!
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-5xl font-black text-white mb-2" style={{ textShadow: '0 0 40px rgba(239,68,68,0.8)' }}>
                      {evolutionDiceRoll.diceResult}
                    </div>
                    <div className="text-xl font-bold text-red-400">
                      ❌ Nessuna evoluzione per questo numero!
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <style>{`
            @keyframes evo-dice-backdrop { from { opacity: 0; } to { opacity: 1; } }
            @keyframes evo-dice-panel-enter { from { opacity: 0; transform: scale(0.5) translateY(40px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes evo-dice-result-reveal { from { opacity: 0; transform: scale(0.3); } to { opacity: 1; transform: scale(1); } }
            @keyframes evo-dice-glow { 0%, 100% { text-shadow: 0 0 20px rgba(74,222,128,0.6); } 50% { text-shadow: 0 0 40px rgba(74,222,128,1), 0 0 80px rgba(74,222,128,0.4); } }
          `}</style>
        </div>
      )}

      {autoDiceResult.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div className="absolute inset-0 bg-black/80" />
          <div className="relative bg-gradient-to-br from-purple-900 via-indigo-800 to-purple-700 rounded-2xl p-8 border-4 border-purple-400 shadow-[0_0_80px_rgba(168,85,247,0.8)] max-w-lg w-full mx-4">
            <div className="text-center">
              {/* Card name header */}
              <h3 className="text-xl font-bold text-purple-200 mb-4">
                {autoDiceResult.cardName}
              </h3>
              
              {/* Rolling animation phase */}
              {autoDiceResult.animationPhase === 'rolling' && (
                <div>
                  <div className="w-[100px] h-[100px] mx-auto mb-4">
                    <Dice3D isRolling={true} size={100} />
                  </div>
                  <p className="text-2xl text-purple-300 font-bold animate-pulse">Lancio del dado...</p>
                </div>
              )}
              
              {/* Result phase */}
              {(autoDiceResult.animationPhase === 'result' || autoDiceResult.animationPhase === 'effects') && (
                <>
                  <div className="w-[100px] h-[100px] mx-auto mb-4">
                    <Dice3D isRolling={false} result={autoDiceResult.diceResult} size={100} />
                  </div>
                  <h2 className="text-6xl font-bold text-white mb-4 animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
                    {autoDiceResult.diceResult}
                  </h2>
                  <div className="bg-purple-800/50 border border-purple-400/50 rounded-lg p-4 mb-4">
                    <p className="text-xl text-white font-semibold">
                      {autoDiceResult.effect}
                    </p>
                  </div>
                </>
              )}
              
              {/* Effects phase - show affected characters */}
              {autoDiceResult.animationPhase === 'effects' && autoDiceResult.affectedCharacters.length > 0 && (
                <div className="mt-4 bg-indigo-900/50 border border-indigo-400/50 rounded-lg p-4 animate-fade-in">
                  <p className="text-indigo-300 font-bold mb-3">⚡ PERSONAGGI COLPITI:</p>
                  <div className="grid grid-cols-2 gap-2">
                    {autoDiceResult.affectedCharacters.map((char, i) => (
                      <div key={i} className="bg-indigo-800/50 rounded p-2 text-center">
                        <p className="text-white font-medium text-sm">{char.charName}</p>
                        <p className="text-indigo-300 text-xs">{char.effect}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM TARGET SELECTION MODAL - Choose targets for custom effects with [BERSAGLIO: scelta] */}
      {customTargetModal.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80">
          <div className="bg-gradient-to-br from-cyan-900 via-teal-800 to-cyan-700 rounded-2xl p-6 border-4 border-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.6)] max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                {customTargetModal.title || '🎯 SCEGLI I BERSAGLI'}
              </h2>
              <p className="text-cyan-200">{customTargetModal.subtitle || <>Effetto di <span className="font-bold text-white">{customTargetModal.cardName}</span></>}</p>
              <p className="text-cyan-300 text-sm mt-1">
                {customTargetModal.maxSelections === 1 ? 'Clicca su un personaggio' : 'Clicca sui personaggi da selezionare'}
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
              {customTargetModal.availableTargets.map(target => {
                const isSelected = customSelectedTargets.includes(target.id);
                return (
                  <div
                    key={target.id}
                    onClick={() => {
                      if (isSelected) {
                        setCustomSelectedTargets(prev => prev.filter(id => id !== target.id));
                      } else if (customTargetModal.maxSelections === 1) {
                        setCustomSelectedTargets([target.id]);
                      } else {
                        setCustomSelectedTargets(prev => [...prev, target.id]);
                      }
                    }}
                    className={`cursor-pointer rounded-lg p-2 border-2 transition-all transform hover:scale-105 relative ${
                      isSelected 
                        ? 'border-cyan-300 bg-cyan-600/50 shadow-[0_0_20px_rgba(34,211,238,0.6)]' 
                        : 'border-gray-600 bg-gray-800/50 hover:border-cyan-500'
                    }`}
                  >
                    <img 
                      src={getOptimizedUrl(target.frontImage, 'card')} 
                      alt={target.name}
                      className="w-full h-24 object-contain rounded mb-1"
                      onError={(e) => { const t=e.currentTarget; if(t.src!==target.frontImage){t.onerror=null;t.src=target.frontImage;} }}
                    />
                    <p className="text-white text-xs font-medium text-center truncate">{target.name}</p>
                    <p className="text-cyan-300 text-xs text-center">
                      {target.pti !== null ? `${target.pti} PTI` : ''} 
                      {target.stars !== null ? ` ★${target.stars}` : ''}
                    </p>
                    <p className="text-gray-400 text-xs text-center">{target.owner}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 text-lg">✅</div>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setCustomTargetModal({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
                  setCustomSelectedTargets([]);
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (customSelectedTargets.length > 0) {
                    socket.emit('target-selection-confirm', {
                      selectionId: customTargetModal.selectionId,
                      selectedTargetIds: customSelectedTargets,
                      playerName
                    });
                    setCustomTargetModal({ visible: false, selectionId: '', cardId: '', cardName: '', owner: '', availableTargets: [] });
                    setCustomSelectedTargets([]);
                  }
                }}
                disabled={customSelectedTargets.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  customSelectedTargets.length > 0
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎯 Conferma ({customSelectedTargets.length} selezionati)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVEAL MODAL - Show revealed opponent cards */}
      {revealedCards.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80" onClick={() => setRevealedCards({ visible: false, revealedBy: '', hands: {} })}>
          <div className="bg-gradient-to-br from-indigo-900 via-purple-800 to-blue-900 rounded-2xl p-4 sm:p-6 border-4 border-cyan-400 shadow-[0_0_60px_rgba(34,211,238,0.6)] max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl sm:text-2xl font-black text-cyan-400 text-center mb-4" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
              👁️ CARTE RIVELATE
            </h2>
            {Object.entries(revealedCards.hands).map(([pName, cards]) => (
              <div key={pName} className="mb-4">
                <h3 className="text-lg font-bold text-amber-400 mb-2">🃏 Mano di {pName} ({cards.length} carte)</h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {cards.map(card => (
                    <div key={card.id} className="bg-black/40 rounded-lg p-2 border border-cyan-500/30 text-center">
                      {card.frontImage && (
                        <img src={getOptimizedUrl(card.frontImage, 'card')} alt={card.name} className="w-full h-24 sm:h-32 object-contain rounded mb-1" onError={(e) => { const t=e.currentTarget; if(t.src!==card.frontImage){t.onerror=null;t.src=card.frontImage;} }} />
                      )}
                      <p className="text-xs sm:text-sm text-white font-bold truncate">{card.name}</p>
                      <p className="text-xs text-cyan-300">{card.type}</p>
                      {card.pti !== null && <p className="text-xs text-amber-400">PTI: {card.pti}</p>}
                      {card.stars !== null && <p className="text-xs text-yellow-300">{'⭐'.repeat(card.stars)}</p>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <div className="text-center mt-4">
              <button
                onClick={() => setRevealedCards({ visible: false, revealedBy: '', hands: {} })}
                className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg shadow-[0_0_20px_rgba(34,211,238,0.6)] transition-all"
              >
                ✓ Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTO DICE SETUP MODAL - Configure automatic dice before rolling */}
      {autoDiceSetupModal.visible && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80">
          <div className="bg-gradient-to-br from-purple-900 via-indigo-800 to-purple-700 rounded-2xl p-6 border-4 border-purple-400 shadow-[0_0_60px_rgba(168,85,247,0.6)] max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center mb-4">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🎲 DADO AUTOMATICO
              </h2>
              <p className="text-purple-200">Carta: <span className="font-bold text-white">{autoDiceSetupModal.cardName}</span></p>
              <p className="text-purple-300 text-sm mt-1">Seleziona i personaggi coinvolti e personalizza le conseguenze</p>
            </div>
            
            {/* Character Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-2">📍 Personaggi Coinvolti</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {autoDiceSetupModal.availableCharacters.map(char => {
                  const isSelected = autoDiceSelectedChars.includes(char.id);
                  return (
                    <div
                      key={char.id}
                      onClick={() => {
                        if (isSelected) {
                          setAutoDiceSelectedChars(prev => prev.filter(id => id !== char.id));
                        } else {
                          setAutoDiceSelectedChars(prev => [...prev, char.id]);
                        }
                      }}
                      className={`cursor-pointer rounded-lg p-2 border-2 transition-all transform hover:scale-105 relative ${
                        isSelected 
                          ? 'border-purple-300 bg-purple-600/50 shadow-[0_0_20px_rgba(168,85,247,0.6)]' 
                          : 'border-gray-600 bg-gray-800/50 hover:border-purple-500'
                      }`}
                    >
                      <img 
                        src={getOptimizedUrl(char.frontImage, 'card')} 
                        alt={char.name}
                        className="w-full h-20 object-contain rounded mb-1"
                        onError={(e) => { const t=e.currentTarget; if(t.src!==char.frontImage){t.onerror=null;t.src=char.frontImage;} }}
                      />
                      <p className="text-white text-xs font-medium text-center truncate">{char.name}</p>
                      <p className="text-purple-300 text-xs text-center">
                        {char.pti !== null ? `${char.pti} PTI` : ''} 
                        {char.stars !== null ? ` ★${char.stars}` : ''}
                      </p>
                      <p className="text-gray-400 text-xs text-center">{char.owner}</p>
                      {isSelected && (
                        <div className="absolute top-1 right-1 text-lg">✅</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Effects Configuration */}
            <div className="mb-6">
              <h3 className="text-lg font-bold text-white mb-2">🎯 Conseguenze per Numero</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <div key={num} className="flex items-center gap-2 bg-black/30 rounded-lg p-2">
                    <div className="w-10 h-10 flex items-center justify-center bg-purple-600 rounded-lg text-white font-bold text-xl">
                      {num}
                    </div>
                    <input
                      type="text"
                      value={autoDiceCustomEffects[num] || ''}
                      onChange={(e) => setAutoDiceCustomEffects(prev => ({ ...prev, [num]: e.target.value }))}
                      placeholder={`Effetto per ${num}...`}
                      className="flex-1 bg-gray-700/50 text-white px-3 py-2 rounded-lg border border-purple-500/50 focus:border-purple-400 focus:outline-none text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setAutoDiceSetupModal({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
                  setAutoDiceSelectedChars([]);
                  setAutoDiceCustomEffects({});
                }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-all"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  if (autoDiceSelectedChars.length > 0) {
                    socket.emit('auto-dice-confirm', {
                      autoDiceId: autoDiceSetupModal.autoDiceId,
                      selectedCharacterIds: autoDiceSelectedChars,
                      customEffects: autoDiceCustomEffects,
                      playerName
                    });
                    setAutoDiceSetupModal({ visible: false, autoDiceId: '', cardName: '', defaultEffects: {}, availableCharacters: [], initiatorPlayer: '' });
                    setAutoDiceSelectedChars([]);
                    setAutoDiceCustomEffects({});
                  }
                }}
                disabled={autoDiceSelectedChars.length === 0}
                className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
                  autoDiceSelectedChars.length > 0
                    ? 'bg-purple-500 hover:bg-purple-400 text-white shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                🎲 LANCIA IL DADO ({autoDiceSelectedChars.length} personaggi)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SAIBAIM Explosion Effect */}
      {saibaImExplosionVisible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          <div className="absolute inset-0 bg-orange-500 animate-pulse opacity-50" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl animate-bounce">💥</div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white animate-pulse" style={{textShadow: '4px 4px 8px rgba(0,0,0,0.8)'}}>
              SAIBAIM È ESPLOSO!
            </h1>
          </div>
        </div>
      )}

      {/* CIMICE Effect - Green Splash Explosion with Disclaimer */}
      {cimiceEffectData?.visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden">
          {/* Green pulsing background */}
          <div className="absolute inset-0 bg-green-500 animate-pulse opacity-40" />
          
          {/* Green splash particles - using CSS classes for deterministic animations */}
          <div className="absolute inset-0">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className={`absolute rounded-full bg-green-400 cimice-particle-${(i % 10) + 1}`}
                style={{
                  width: `${30 + (i * 3) % 30}px`,
                  height: `${30 + (i * 3) % 30}px`,
                  left: `${(i * 17) % 100}%`,
                  top: `${(i * 23) % 100}%`,
                  opacity: 0.5 + (i % 5) * 0.1,
                  animation: `cimice-splash ${0.5 + (i % 5) * 0.1}s ease-out forwards`,
                  animationDelay: `${(i % 6) * 0.05}s`,
                  boxShadow: '0 0 20px rgba(34, 197, 94, 0.8), 0 0 40px rgba(34, 197, 94, 0.5)'
                }}
              />
            ))}
          </div>
          
          {/* Flying bug emoji */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-8xl animate-bounce" style={{ animationDuration: '0.5s' }}>
              🪲
            </div>
          </div>
          
          {/* Disclaimer panel */}
          <div className="absolute inset-x-0 top-1/4 flex justify-center">
            <div className="bg-black/90 border-4 border-green-500 rounded-xl p-6 mx-4 max-w-2xl text-center shadow-2xl" style={{ boxShadow: '0 0 40px rgba(34, 197, 94, 0.6)' }}>
              <h2 className="text-3xl font-bold text-green-400 mb-3" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                {cimiceEffectData.type === 'attack' ? '🪲 CIMICE ATTACCATA!' : '🪲💀 CIMICE È MORTA!'}
              </h2>
              <p className="text-xl text-white mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                {cimiceEffectData.type === 'attack' 
                  ? 'Tutti gli altri personaggi in campo perdono 50 PTI!' 
                  : 'Tutti i personaggi in campo perdono 500 PTI!'}
              </p>
              <div className="text-lg text-green-300 font-bold">
                Danni inflitti: -{cimiceEffectData.damagePerCard} PTI a {cimiceEffectData.affectedCards.length} personaggi
              </div>
              {cimiceEffectData.affectedCards.length > 0 && (
                <div className="mt-3 text-sm text-green-200/80">
                  {cimiceEffectData.affectedCards.map((card, i) => (
                    <span key={card.id}>
                      {card.name} ({card.oldPTI}→{card.newPTI})
                      {i < cimiceEffectData.affectedCards.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Remove Player Dialog */}
      {removePlayerDialogOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 border-2 border-orange-500">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">
                Elimina concorrente
              </h2>
              <Button
                onClick={() => setRemovePlayerDialogOpen(false)}
                className="btn-neon-red text-white rounded-full p-1"
              >
                <X size={16} />
              </Button>
            </div>
            <p className="text-white/80 mb-4 text-sm">
              Seleziona il giocatore da eliminare dal tavolo. Diventerà spettatore e le sue carte torneranno nei mazzi.
            </p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {gameState?.players && Object.values(gameState.players)
                .filter((p: any) => p.name !== playerName)
                .map((player: any) => (
                  <Button
                    key={player.name}
                    onClick={() => {
                      if (confirm(`Sei sicuro di voler eliminare ${player.name} dalla partita?`)) {
                        socket.emit('remove-player', { 
                          gameId, 
                          playerToRemove: player.name,
                          removedBy: playerName 
                        });
                        setRemovePlayerDialogOpen(false);
                      }
                    }}
                    className="w-full btn-neon-orange text-white font-bold py-3 text-left px-4 flex items-center gap-2"
                  >
                    <Skull size={16} />
                    {player.name}
                  </Button>
                ))}
              {gameState?.players && Object.values(gameState.players).filter((p: any) => p.name !== playerName).length === 0 && (
                <p className="text-white/60 text-center py-4">
                  Nessun giocatore disponibile per l'eliminazione
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Game content */}
      <div className="relative z-10 pt-14 landscape:pt-12 md:pt-14">
        {/* Header - Premium slim bar - fixed at top */}
        <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between gap-2 px-3 py-1.5"
          style={{
            background: 'rgba(5,3,20,0.92)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(99,102,241,0.25)',
            boxShadow: '0 2px 16px rgba(0,0,0,0.5), inset 0 -1px 0 rgba(99,102,241,0.12)',
          }}
        >
          {/* Left: Back + Logo + Room */}
          <div className="flex items-center gap-2 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="text-indigo-400/70 hover:text-cyan-300 transition-colors text-sm font-bold"
              >
                ←
              </button>
            )}
            <h1
              className="text-lg landscape:text-2xl md:text-2xl font-black tracking-tight whitespace-nowrap"
              style={{
                background: 'linear-gradient(to right, #22d3ee, #818cf8, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.45))',
              }}
            >MINKIARDS</h1>
            {gameId && gameId.startsWith('room-') && (
              <span
                className="text-[10px] landscape:text-xs md:text-xs px-2 py-0.5 rounded-full whitespace-nowrap font-bold"
                style={{
                  background: 'rgba(99,102,241,0.12)',
                  border: '1px solid rgba(99,102,241,0.30)',
                  color: 'rgba(199,210,254,0.80)',
                }}
              >
                {gameId.replace('room-', '')}
              </span>
            )}
          </div>

          {/* Center: Primary actions - only show when game is playing */}
          {gameState?.turnOrder && gameState.turnOrder.length > 0 && (gameState as any)?.isPlaying && (
          <div className="flex items-center gap-1.5 landscape:gap-2 md:gap-2">
            <Button
              onClick={() => { playButtonClick(); setShowCpuControls(!showCpuControls); }}
              className={`${showCpuControls ? 'border-purple-400/40' : 'border-white/10'} text-white font-bold text-[11px] landscape:text-sm md:text-sm px-3 landscape:px-4 md:px-4 py-1.5 landscape:py-2 md:py-2 rounded-xl shadow-lg border transition-all duration-200`}
              style={{
                background: showCpuControls ? 'rgba(124,58,237,0.75)' : 'rgba(255,255,255,0.07)',
                boxShadow: showCpuControls ? '0 0 12px rgba(124,58,237,0.4)' : 'none',
              }}
            >
              CPU
            </Button>
            <Button
              onClick={() => { playButtonClick(); setIs3DMode(!is3DMode); }}
              className={`${is3DMode ? 'border-cyan-400/40' : 'border-white/10'} text-white font-bold text-[11px] landscape:text-sm md:text-sm px-3 landscape:px-4 md:px-4 py-1.5 landscape:py-2 md:py-2 rounded-xl shadow-lg border transition-all duration-200`}
              style={{
                background: is3DMode ? 'rgba(34,211,238,0.55)' : 'rgba(255,255,255,0.07)',
                boxShadow: is3DMode ? '0 0 12px rgba(34,211,238,0.35)' : 'none',
              }}
            >
              3D
            </Button>
            <Button
              onClick={() => { playButtonClick(); setShowInvitePanel(!showInvitePanel); }}
              className={`${showInvitePanel ? 'border-emerald-400/40' : 'border-white/10'} text-white font-bold text-[11px] landscape:text-sm md:text-sm px-3 landscape:px-4 md:px-4 py-1.5 landscape:py-2 md:py-2 rounded-xl shadow-lg border transition-all duration-200 whitespace-nowrap`}
              style={{
                background: showInvitePanel ? 'rgba(16,185,129,0.65)' : 'rgba(255,255,255,0.07)',
                boxShadow: showInvitePanel ? '0 0 12px rgba(16,185,129,0.35)' : 'none',
              }}
            >
              INVITA
            </Button>
          </div>
          )}

          {/* Right: User info + Menu */}
          <div className="flex items-center gap-1.5">
            {authenticatedUser && (
              <div
                className="flex items-center gap-1.5 backdrop-blur-md px-2.5 py-1.5 rounded-xl cursor-pointer hover:bg-white/10 transition-all duration-200"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
                onClick={() => setProfileOpen(true)}
                title="Apri Profilo"
              >
                <User size={13} className="text-indigo-400/80 flex-shrink-0" />
                <span className="text-white/80 text-[11px] landscape:text-xs md:text-xs truncate max-w-[60px] landscape:max-w-[100px] md:max-w-[100px]">
                  {authenticatedUser.username}
                </span>
                <span className="text-cyan-300 text-[11px] landscape:text-xs md:text-xs font-bold whitespace-nowrap">
                  <AnimatedNumber value={authenticatedUser.puntiRankiard || 0} />
                </span>
                {onLogout && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onLogout(); }}
                    className="text-red-400/60 hover:text-red-400 transition-colors ml-0.5"
                    title="Esci"
                  >
                    <LogOut size={12} />
                  </button>
                )}
              </div>
            )}

            {/* Dropdown menu for secondary actions */}
            <div className="relative">
              <button
                onClick={() => { playButtonClick(); setHeaderMenuOpen(!headerMenuOpen); }}
                className="p-2 rounded-xl backdrop-blur-md border hover:bg-white/10 transition-all duration-200 text-indigo-400/70 hover:text-cyan-300"
                style={{
                  background: 'rgba(99,102,241,0.08)',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                <MoreVertical size={18} />
              </button>

              {headerMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setHeaderMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-2xl overflow-hidden shadow-2xl shadow-black/60 border"
                    style={{
                      background: 'rgba(5,3,20,0.96)',
                      backdropFilter: 'blur(24px)',
                      borderColor: 'rgba(99,102,241,0.30)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.12)',
                    }}
                  >
                    <div className="py-1.5">
                      <button onClick={() => { window.open('https://minkiards.wixsite.com/minkiards/post/regolamento-ufficiale', '_blank'); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <BookOpen size={16} className="text-blue-400 flex-shrink-0" />
                        Regolamento
                      </button>
                      <button onClick={() => { authenticatedUser ? setProfileOpen(true) : shareInviteLink(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <UserPlus size={16} className="text-cyan-400 flex-shrink-0" />
                        Invita Amici
                      </button>
                      {authenticatedUser && (
                        <>
                          <button onClick={() => { setShowStatsPanel(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <BarChart2 size={16} className="text-blue-400 flex-shrink-0" />
                            Statistiche
                          </button>
                          <button onClick={() => { setMissionsOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <Target size={16} className="text-emerald-400 flex-shrink-0" />
                            Missioni
                          </button>
                          <button onClick={() => { setAchievementsOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <Trophy size={16} className="text-yellow-400 flex-shrink-0" />
                            Trofei
                          </button>
                          <button onClick={() => { setCollectionOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                            <BookOpen size={16} className="text-pink-400 flex-shrink-0" />
                            Collezione
                          </button>
                        </>
                      )}
                      <button onClick={() => { setThemeOpen(true); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Palette size={16} className="text-violet-400 flex-shrink-0" />
                        Tema Tavolo
                      </button>
                      <button onClick={() => { setRankiardOpen(!rankiardOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Star size={16} className="text-amber-400 flex-shrink-0" />
                        Rankiard
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button onClick={() => { handleNewGame(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <PlusCircle size={16} className="text-purple-400 flex-shrink-0" />
                        Nuova Partita
                      </button>
                      <button onClick={() => { handleResetGame(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition-colors">
                        <RotateCcw size={16} className="flex-shrink-0" />
                        Ricomincia Partita
                      </button>
                      <div className="my-1 border-t border-white/10" />
                      <button onClick={() => { initAudioContext(); toggleMute(); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        {isMuted ? <VolumeX size={16} className="text-violet-400 flex-shrink-0" /> : <Volume2 size={16} className="text-violet-400 flex-shrink-0" />}
                        {isMuted ? 'Attiva Audio' : 'Disattiva Audio'}
                      </button>
                      <button onClick={() => { playButtonClick(); if (soundSettingsOpen) { playPanelClose(); } else { playPanelOpen(); } setSoundSettingsOpen(!soundSettingsOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Settings size={16} className="text-cyan-400 flex-shrink-0" />
                        Impostazioni Audio
                      </button>
                      <button onClick={() => { setMusicPlayerOpen(!musicPlayerOpen); setHeaderMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors">
                        <Music size={16} className="text-pink-400 flex-shrink-0" />
                        Musica
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
        {!(gameState as any)?.isPlaying && gameState?.players && !gameId?.startsWith('tournament-') && !(gameState as any)?.fantaTournamentId && !gameId?.startsWith('gym-') ? (
          <motion.div
            key="pre-game-lobby"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
          <PreGameLobbyPanel
            gameId={gameId}
            playerName={playerName}
            isCreator={gameState?.creatorName === playerName}
            players={Object.values(gameState.players).map((p: any) => ({ name: p.name, isCPU: p.isCPU, avatar: p.avatar }))}
            characterLimit={lobbyCharacterLimit}
            authToken={authToken}
            onCharacterLimitChange={handleLobbyCharacterLimitChange}
            onStartGame={() => { playConfirm(); handleStartGame(); }}
            roomCode={gameId?.replace('room-', '') || ''}
            isStartingGame={isStartingGame}
          />
          </motion.div>
        ) : (
        <motion.div
          key="game-board"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
        <>
        {/* Player Hand */}
        <PlayerHand />

        {/* CPU Controls - centered modal panel */}
        {showCpuControls && <CPUControls onClose={() => setShowCpuControls(false)} />}

        {/* Invite Panel */}
        {showInvitePanel && (
          <InvitePanel
            gameId={gameId || ''}
            authToken={authToken}
            onClose={() => setShowInvitePanel(false)}
          />
        )}

        {is3DMode ? (
          <GameBoard3D onCardClick={(card) => setSelectedCard(card)} />
        ) : (
          <>
            {/* Other Players' Hands */}
            <OtherPlayersHands />

            {/* Round Table - replaces the old decks and game field */}
            <RoundTable />
          </>
        )}
        </>
        </motion.div>
        )}
        </AnimatePresence>

        {/* Graveyard Modal */}
        {graveyardOpen && (
          <Graveyard onClose={() => setGraveyardOpen(false)} />
        )}

        {/* Right-side Game Tools */}
        <div
          data-tutorial="tools"
          className="fixed bottom-3 landscape:bottom-4 md:bottom-4 left-1/2 -translate-x-1/2 z-[95] transition-all duration-300"
          style={{
            opacity: (chatOpen || calculatorOpen || gameLogOpen || soundSettingsOpen || musicPlayerOpen) ? 0 : 1,
            pointerEvents: (chatOpen || calculatorOpen || gameLogOpen || soundSettingsOpen || musicPlayerOpen) ? 'none' : 'auto',
          }}
        >
          <div
            className="flex items-center gap-0.5 px-1.5 py-1 rounded-2xl shadow-2xl shadow-black/60"
            style={{
              background: 'rgba(5,3,20,0.90)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(99,102,241,0.35)',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.12), 0 8px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            <motion.button
              data-tutorial="hand"
              onClick={() => { playButtonClick(); playModalOpen(); setHandModalOpen(true); }}
              className="relative p-2 rounded-xl transition-colors"
              style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.15)' }}
              title="Carte in Mano"
              whileHover={{ scale: 1.12, background: 'rgba(124,58,237,0.32)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <Hand size={16} />
              {gameState?.players?.[playerName]?.hand?.length ? (
                <span className="absolute -top-1 -right-1 bg-indigo-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold shadow-md">
                  {gameState.players[playerName].hand.length}
                </span>
              ) : null}
            </motion.button>

            <motion.button
              onClick={() => { playButtonClick(); socket.emit('force-end-turn', { gameId }); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#a5f3fc', background: 'rgba(34,211,238,0.12)' }}
              title="Fine Turno"
              whileHover={{ scale: 1.12, background: 'rgba(34,211,238,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <SkipForward size={16} />
            </motion.button>

            <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(99,102,241,0.25)' }} />

            <motion.button
              onClick={() => { playButtonClick(); if (chatOpen) { playPanelClose(); handleCloseChat(); } else { playPanelOpen(); handleOpenChat(); } }}
              className="relative p-2 rounded-xl transition-colors"
              style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.12)' }}
              title="Chat"
              whileHover={{ scale: 1.12, background: 'rgba(59,130,246,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <MessageCircle size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] w-4 h-4 flex items-center justify-center font-bold shadow-md">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </motion.button>

            <motion.button
              onClick={() => { playButtonClick(); if (gameLogOpen) { playPanelClose(); } else { playPanelOpen(); } setGameLogOpen(!gameLogOpen); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#c4b5fd', background: 'rgba(124,58,237,0.12)' }}
              title="Game Log"
              whileHover={{ scale: 1.12, background: 'rgba(124,58,237,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <ScrollText size={16} />
            </motion.button>

            <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(99,102,241,0.25)' }} />

            <motion.button
              onClick={() => { playButtonClick(); playModalOpen(); setDiceOpen(true); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#ddd6fe', background: 'rgba(124,58,237,0.15)' }}
              title="Dado"
              whileHover={{ scale: 1.12, background: 'rgba(124,58,237,0.30)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <Dice6 size={16} />
            </motion.button>

            <motion.button
              onClick={() => { playButtonClick(); if (calculatorOpen) { playPanelClose(); } else { playPanelOpen(); } setCalculatorOpen(!calculatorOpen); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#6ee7b7', background: 'rgba(16,185,129,0.12)' }}
              title="Calcolatrice"
              whileHover={{ scale: 1.12, background: 'rgba(16,185,129,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <CalcIcon size={16} />
            </motion.button>

            <motion.button
              onClick={() => { playButtonClick(); playModalOpen(); setGraveyardOpen(true); }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#d1d5db', background: 'rgba(107,114,128,0.12)' }}
              title="Cimitero"
              whileHover={{ scale: 1.12, background: 'rgba(107,114,128,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <Skull size={16} />
            </motion.button>

            <motion.button
              onClick={() => {
                playButtonClick();
                playDeckShuffle();
                const deckTypes = ['personaggi', 'mosse', 'bonus', 'personaggi_speciali'];
                deckTypes.forEach(deckType => {
                  socket.emit('shuffle-deck', { deckType });
                });
              }}
              className="p-2 rounded-xl transition-colors"
              style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.12)' }}
              title="Mischia Mazzi"
              whileHover={{ scale: 1.12, background: 'rgba(59,130,246,0.28)' } as any}
              whileTap={{ scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 600, damping: 20 }}
            >
              <Shuffle size={16} />
            </motion.button>

            <VoiceChat />
          </div>
        </div>

        {/* Sound Settings Panel */}
        <div id="sound-settings-container">
          {soundSettingsOpen && (
            <div 
              className="fixed bottom-4 left-2 landscape:left-4 md:left-4 w-[calc(100vw-2rem)] max-w-80 h-80 landscape:h-96 md:h-[28rem] z-50 fade-in duration-300"
              style={{ position: 'fixed' }}
            >
              <SoundSettings onClose={() => { playPanelClose(); setSoundSettingsOpen(false); }} />
            </div>
          )}
        </div>

        <MusicPlayer 
          isOpen={musicPlayerOpen}
          onClose={() => setMusicPlayerOpen(false)}
        />

        {/* Calculator */}
        {calculatorOpen && (
          <div 
            className="fixed bottom-4 left-2 landscape:left-4 md:left-4 w-[calc(100vw-2rem)] max-w-80 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Calculator onClose={() => { playPanelClose(); setCalculatorOpen(false); }} />
          </div>
        )}

        {/* Chat */}
        {chatOpen && (
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-52 left-1 landscape:left-4 md:left-4 w-[calc(100vw-1rem)] max-w-64 landscape:w-72 md:w-80 h-72 landscape:h-80 md:h-96 z-40 animate-in slide-in-from-left-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <Chat onClose={handleCloseChat} />
          </div>
        )}

        {gameLogOpen && (
          <div 
            className="fixed bottom-16 landscape:bottom-20 md:bottom-52 left-1 landscape:left-4 md:left-4 w-[calc(100vw-1rem)] max-w-80 landscape:w-96 md:w-[28rem] h-80 landscape:h-96 md:h-[28rem] z-40 animate-in slide-in-from-left-5 fade-in duration-300"
            style={{ position: 'fixed' }}
          >
            <GameLog onClose={() => { playPanelClose(); setGameLogOpen(false); }} />
          </div>
        )}

        {/* Card Modal */}
        {selectedCard && <CardModal />}

        {/* Hand Modal */}
        {handModalOpen && (
          <HandModal onClose={() => { playModalClose(); setHandModalOpen(false); }} />
        )}

        {/* Ciao Ciao Notification */}
        {ciaoNotificationVisible && (
          <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-lg p-8 text-center border-2 border-yellow-400 shadow-2xl">
              <div className="text-6xl mb-4 animate-wave">👋</div>
              <h2 className="text-white font-bold text-3xl mb-2">Ciao ciao</h2>
              <p className="text-yellow-400 font-semibold text-xl">{ciaoCardName}</p>
            </div>
          </div>
        )}

        {/* Evolution/Transformation Animation */}
        <EvolutionAnimation
          key={evolutionAnim.key}
          isVisible={evolutionAnim.visible}
          type={evolutionAnim.type}
          oldName={evolutionAnim.oldName}
          newName={evolutionAnim.newName}
          oldImage={evolutionAnim.oldImage}
          newImage={evolutionAnim.newImage}
          playerName={evolutionAnim.playerName}
          pti={evolutionAnim.pti}
          stars={evolutionAnim.stars}
          onComplete={() => setEvolutionAnim(prev => ({ ...prev, visible: false }))}
        />

        {/* Fusion Animation */}
        <FusionAnimation
          key={fusionAnim.key}
          isVisible={fusionAnim.visible}
          card1Name={fusionAnim.card1Name}
          card2Name={fusionAnim.card2Name}
          card1Image={fusionAnim.card1Image}
          card2Image={fusionAnim.card2Image}
          resultName={fusionAnim.resultName}
          resultImage={fusionAnim.resultImage}
          playerName={fusionAnim.playerName}
          fusionType={fusionAnim.fusionType}
          resultPti={fusionAnim.resultPti}
          resultStars={fusionAnim.resultStars}
          onComplete={() => setFusionAnim(prev => ({ ...prev, visible: false }))}
        />

        {/* PERSONAGGI Enter Notification */}
        <PersonaggioNotification
          isVisible={personaggioNotificationVisible}
          cardName={personaggioCardName}
          message={personaggioMessage}
          cardImage={personaggioCardImage || ""}
        />

        {/* Card Animation */}
        <CardAnimation
          isVisible={cardAnimationVisible}
          cardName={cardAnimationName}
          onComplete={() => setCardAnimationVisible(false)}
        />
        
        {/* AUCTION DECK PICKER - for selecting character to auction */}
        {auctionDeckPicker.visible && (
          <div className="fixed inset-0 z-[9998] flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
            <div className="bg-slate-900 border-2 border-amber-500/50 rounded-2xl p-4 sm:p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
              <h2 className="text-lg sm:text-2xl font-black text-amber-400 text-center mb-2 sm:mb-4">🔨 SCEGLI UN PERSONAGGIO PER L'ASTA</h2>
              <p className="text-amber-200/60 text-center text-xs sm:text-sm mb-2 sm:mb-4">Seleziona il personaggio da mettere all'asta</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
                {auctionDeckPicker.cards.filter(c => c.type === 'personaggi' || c.type === 'personaggi_speciali').map(card => (
                  <div
                    key={card.id}
                    onClick={() => {
                      socket.emit('auction-select-card', { cardId: card.id, playerName });
                      setAuctionDeckPicker({ visible: false, cards: [], initiator: '' });
                    }}
                    className="cursor-pointer rounded-lg border-2 border-transparent hover:border-amber-400 active:border-amber-400 active:scale-95 transition-all hover:scale-105 p-1 bg-black/30"
                  >
                    <img src={getOptimizedUrl(card.frontImage, 'card')} alt={card.name || 'Card'} className="w-full h-28 object-contain rounded" onError={(e) => { const t=e.currentTarget; if(t.src!==card.frontImage){t.onerror=null;t.src=card.frontImage;} }} />
                    {card.name && <p className="text-white text-[10px] text-center mt-1 truncate">{card.name}</p>}
                  </div>
                ))}
              </div>
              <button
                onClick={() => setAuctionDeckPicker({ visible: false, cards: [], initiator: '' })}
                className="mt-3 sm:mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 sm:py-2 rounded-lg min-h-[48px]"
              >
                ANNULLA
              </button>
            </div>
          </div>
        )}

        {/* AUCTION OVERLAY */}
        {auctionData && (
          <AuctionOverlay
            auctionData={auctionData}
            currentPlayerName={playerName}
            onPlaceBid={(amount) => socket.emit('auction-place-bid', { bidAmount: amount, playerName })}
            onClose={() => { setAuctionData(null); setAuctionResult(null); }}
            bidUpdates={auctionBidUpdate}
            countdownUpdate={auctionCountdownUpdate}
            auctionResult={auctionResult}
          />
        )}

        {/* Custom Animation Overlay */}
        {customAnimationVisible && customAnimationData && (
          <CustomAnimationOverlay
            isVisible={customAnimationVisible}
            cardName={customAnimationData.cardName}
            animationDescription={customAnimationData.animationDescription}
            onComplete={() => {
              setCustomAnimationVisible(false);
              setCustomAnimationData(null);
            }}
          />
        )}

        {specialMoveOverlay.visible && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
          >
            <div className="absolute inset-0 bg-black/70" style={{ animation: 'fadeIn 0.2s ease-out' }} />
            <div className="relative flex flex-col items-center gap-4" style={{ animation: 'specialMoveEntry 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
              {specialMoveOverlay.category && (
                <div
                  className="text-yellow-400 text-lg font-bold uppercase tracking-widest"
                  style={{ textShadow: _isMobile ? 'none' : '0 0 20px rgba(234, 179, 8, 0.8)' }}
                >
                  {specialMoveOverlay.category}
                </div>
              )}
              <div
                className="text-white text-2xl font-bold tracking-wide"
                style={{ textShadow: _isMobile ? 'none' : '0 0 15px rgba(255, 255, 255, 0.5)' }}
              >
                {specialMoveOverlay.attackerName}
              </div>
              <div 
                className="text-transparent bg-clip-text font-black uppercase tracking-wider text-center px-8"
                style={{ 
                  fontSize: 'clamp(2.5rem, 8vw, 5rem)',
                  backgroundImage: 'linear-gradient(135deg, #ff6b35, #ff0844, #fffc00, #ff6b35)',
                  backgroundSize: _isMobile ? '100% 100%' : '300% 300%',
                  animation: _isMobile ? 'none' : 'specialMoveGlow 1.5s ease-in-out infinite',
                  WebkitTextStroke: _isMobile ? undefined : '1px rgba(255, 100, 0, 0.3)',
                  filter: _isMobile ? undefined : 'drop-shadow(0 0 30px rgba(255, 68, 0, 0.8)) drop-shadow(0 0 60px rgba(255, 0, 68, 0.4))',
                  lineHeight: 1.1
                }}
              >
                {specialMoveOverlay.moveName}
              </div>
              <div 
                className="text-red-100 font-black text-center"
                style={{ 
                  fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
                  textShadow: _isMobile ? '0 2px 4px rgba(0,0,0,0.5)' : '0 0 30px rgba(255, 0, 0, 0.9), 0 0 60px rgba(255, 0, 0, 0.5)',
                  animation: 'specialMoveDamage 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both'
                }}
              >
                {specialMoveOverlay.damage} PTI
              </div>
            </div>
          </div>
        )}

        <CharacterEffects
          key={`attack-${attackEffectKey}`}
          isVisible={attackEffectVisible}
          effectType={attackEffectType}
          characterName={attackedCharacterName}
          onComplete={() => setAttackEffectVisible(false)}
        />

        <CharacterEffects
          key={`death-${deathEffectKey}`}
          isVisible={deathEffectVisible}
          effectType="death"
          characterName={deadCharacterName}
          onComplete={() => setDeathEffectVisible(false)}
        />

        {attackSlash3D.visible && (
          <AttackSlash3D
            isVisible={attackSlash3D.visible}
            attackerName={attackSlash3D.attackerName}
            targetName={attackSlash3D.targetName}
            damage={attackSlash3D.damage}
            onComplete={() => setAttackSlash3D({ visible: false, attackerName: '', targetName: '', damage: 0 })}
          />
        )}

        {cardShatter3D.visible && (
          <CardShatter3D
            isVisible={cardShatter3D.visible}
            cardImage={cardShatter3D.cardImage || undefined}
            cardName={cardShatter3D.cardName}
            onComplete={() => setCardShatter3D({ visible: false, cardImage: '', cardName: '' })}
          />
        )}

        {cinematicFlash.visible && (
          <div className={cinematicFlash.type === 'attack' ? 'cinematic-attack-flash' : 'cinematic-heal-flash'} />
        )}

        {/* Player Order Notification */}
        <PlayerOrderNotification
          isVisible={playerOrderVisible}
          playerOrder={playerOrder}
          onClose={() => setPlayerOrderVisible(false)}
        />

        {/* Next Turn Notification */}
        <NextTurnNotification
          isVisible={nextTurnVisible}
          nextPlayer={nextTurnPlayer}
          onClose={() => setNextTurnVisible(false)}
          isMyTurn={nextTurnPlayer === playerName}
        />

        {/* Turn Timer Widget */}
        {turnTimerState.active && (
          <motion.div
            className={`fixed top-20 right-4 z-40 flex flex-col items-center gap-1 pointer-events-none select-none`}
            animate={turnTimerState.seconds <= 5 ? { x: [-3, 3, -3, 3, -2, 2, 0] } : { x: 0 }}
            transition={{ duration: 0.4, repeat: turnTimerState.seconds <= 5 ? Infinity : 0, ease: 'easeInOut' }}
          >
            <div className={`relative w-16 h-16 ${turnTimerState.isWarning ? 'drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]' : 'drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]'}`}>
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="28"
                  fill="none"
                  stroke={turnTimerState.isWarning ? '#ef4444' : '#facc15'}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 28}`}
                  strokeDashoffset={`${2 * Math.PI * 28 * (1 - turnTimerState.seconds / 30)}`}
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold ${turnTimerState.isWarning ? 'text-red-400' : 'text-yellow-300'}`}>
                  {turnTimerState.seconds}
                </span>
              </div>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${turnTimerState.isWarning ? 'bg-red-600/80 text-white' : 'bg-black/60 text-yellow-300'}`}>
              {turnTimerState.playerName === playerName ? 'Il tuo turno' : turnTimerState.playerName}
            </span>
          </motion.div>
        )}

        {/* Rematch Panel (overlaid over game end rewards) */}
        {/* Series Score Badge */}
        {Object.keys(bo3State.seriesScore).length > 0 && !bo3State.seriesEnded && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[150] bg-black/80 backdrop-blur-sm border border-yellow-500/40 rounded-full px-4 py-1.5 flex items-center gap-3 text-sm font-bold">
            <span className="text-yellow-400">🏆 Serie Bo3</span>
            {Object.entries(bo3State.seriesScore).map(([name, wins]) => (
              <span key={name} className={name === playerName ? 'text-green-400' : 'text-red-400'}>
                {name}: <AnimatedNumber value={wins} />
              </span>
            ))}
          </div>
        )}

        {/* Series Ended overlay */}
        {bo3State.seriesEnded && (
          <div className="fixed inset-0 bg-black/85 z-[350] flex items-center justify-center">
            <div className="bg-gradient-to-br from-yellow-900 to-amber-900 border-2 border-yellow-400 rounded-2xl p-10 text-center shadow-2xl max-w-sm w-full mx-4">
              <p className="text-5xl mb-4">🏆</p>
              <p className="text-3xl font-black text-yellow-300 mb-2">Serie completata!</p>
              <p className="text-xl text-white font-bold mb-4">{bo3State.seriesWinner} vince la serie!</p>
              <div className="flex justify-center gap-6 text-lg mb-6">
                {Object.entries(bo3State.seriesScore).map(([name, wins]) => (
                  <span key={name} className={`font-bold ${name === bo3State.seriesWinner ? 'text-yellow-300' : 'text-white/60'}`}>
                    {name}: {wins}
                  </span>
                ))}
              </div>
              <button
                onClick={() => setBo3State(prev => ({ ...prev, seriesEnded: false }))}
                className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold px-8 py-2 rounded-xl"
              >
                OK
              </button>
            </div>
          </div>
        )}

        {rematchState.newGameId && (
          <div className="fixed inset-0 bg-black/80 z-[300] flex items-center justify-center">
            <div className="bg-gradient-to-br from-yellow-900 to-orange-900 border-2 border-yellow-400 rounded-2xl p-8 text-center shadow-2xl animate-bounce">
              <p className="text-4xl mb-3">🔥</p>
              <p className="text-2xl font-bold text-yellow-300">Rivincita in corso!</p>
              <p className="text-white/70 mt-2">Ricarico la partita...</p>
            </div>
          </div>
        )}

        {/* Leave Game Notification */}
        <LeaveGameNotification
          isVisible={leaveGameVisible}
          playerName={leavingPlayer}
          onClose={() => setLeaveGameVisible(false)}
        />

        {/* Add Cards Modal */}
        <AddCardsModal
          isOpen={addCardsModalOpen}
          onClose={() => setAddCardsModalOpen(false)}
        />

        {/* Super Dice Modal */}
        <SuperDice
          isOpen={superDiceOpen}
          onClose={() => setSuperDiceOpen(false)}
          gameId={gameId || ''}
          playerName={playerName || ''}
        />


        {/* Add Cards, Scenari and Leave Game Buttons - Bottom of page */}
        <div className="mt-4 sm:mt-8 md:mt-16 mb-16 sm:mb-16 md:mb-8 grid grid-cols-2 sm:flex sm:flex-row justify-center gap-1.5 sm:gap-2 md:gap-4 px-2 sm:px-4">
          {/* Only show AGGIUNGI button for registered users (not guests) */}
          {authenticatedUser && authenticatedUser.id > 0 && (
            <Button
              onClick={() => setAddCardsModalOpen(true)}
              className="btn-neon-yellow text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
            >
              <Plus size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
              <span className="text-[10px] sm:text-sm md:text-base">AGGIUNGI</span>
            </Button>
          )}
          <Button
            onClick={() => {
              socket.emit('toggle-scenario-cards', { 
                gameId, 
                active: !scenarioCardsActive 
              });
            }}
            className={`${scenarioCardsActive ? 'btn-neon-green' : 'btn-neon-gray'} text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3`}
          >
            <span className="text-[10px] sm:text-sm md:text-base text-black bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
              SCENARI {scenarioCardsActive ? 'ON' : 'OFF'}
            </span>
          </Button>
          <Button
            onClick={handleLeaveGame}
            className="btn-neon-red text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
          >
            <X size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
            <span className="text-[10px] sm:text-sm md:text-base">LASCIA</span>
          </Button>
          <Button
            onClick={() => setRemovePlayerDialogOpen(true)}
            className="btn-neon-orange text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-4 md:px-6 py-1.5 sm:py-2 md:py-4 shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-1 sm:gap-2 md:gap-3"
          >
            <Skull size={14} className="sm:w-4 sm:h-4 md:w-6 md:h-6" />
            <span className="text-[10px] sm:text-sm md:text-base">ELIMINA</span>
          </Button>
        </div>

        {/* Dice Modal */}
        <DiceModal 
          isOpen={diceOpen}
          onClose={() => { playModalClose(); setDiceOpen(false); }}
          currentRoll={diceResult}
          playerWhoRolled={playerWhoRolled}
        />

        {/* Chat Notifications */}
        {chatNotifications.map((notification) => (
          <ChatNotification
            key={notification.id}
            message={notification.message}
            playerName={notification.playerName}
            isGymLeader={notification.isGymLeader}
            onClose={() => removeChatNotification(notification.id)}
            onOpenChat={handleOpenChat}
          />
        ))}

        {/* Player Choosing Card Notification */}
        {choosingNotification.visible && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
              <span className="text-2xl">🎴</span>
              <span className="font-semibold">{choosingNotification.message}</span>
            </div>
          </div>
        )}

        {blockTypeSelection?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
            <div className="bg-gradient-to-b from-blue-900 to-blue-800 rounded-xl p-6 shadow-2xl border border-blue-400/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🧊</span>
                <h3 className="text-white text-xl font-bold mt-2">IBERNAZIONE</h3>
                <p className="text-blue-200 text-sm mt-1">Scegli il tipo di carte da bloccare per {blockTypeSelection.turns} turni</p>
              </div>
              <div className="flex flex-col gap-3">
                {blockTypeSelection.options.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      socket.emit('block-card-type-choice', { gameId: gameId, cardType: option.toLowerCase(), turns: blockTypeSelection.turns });
                      setBlockTypeSelection(null);
                    }}
                    className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition-all duration-200 hover:scale-105 border border-blue-400/30"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {daddyConteDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl p-6 shadow-2xl border border-yellow-500/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🤵</span>
                <h3 className="text-white text-xl font-bold mt-2">DADDY CONTE</h3>
                <p className="text-yellow-200 text-sm mt-1">Scegli quale personaggio NON può attaccarti questo turno</p>
              </div>
              <div className="flex flex-col gap-3">
                {daddyConteDialog.characters.map((char) => (
                  <button
                    key={char.id}
                    onClick={() => {
                      socket.emit('daddy-conte-chosen', { gameId: gameId, characterId: char.id });
                      setDaddyConteDialog(null);
                    }}
                    className="w-full px-4 py-3 bg-yellow-700 hover:bg-yellow-600 text-white font-bold rounded-lg transition-all duration-200 hover:scale-105 border border-yellow-500/30 flex items-center gap-3"
                  >
                    {char.frontImage && (
                      <img src={char.frontImage} alt={char.name} className="w-10 h-10 rounded object-cover" />
                    )}
                    <span>{char.name || char.id} <span className="text-yellow-300 text-xs">({char.owner})</span></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {fabrizioDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-green-900 to-green-800 rounded-xl p-6 shadow-2xl border border-green-400/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🎭</span>
                <h3 className="text-white text-xl font-bold mt-2">FABRIZIO</h3>
                <p className="text-green-200 text-sm mt-1">Scegli la tua azione bonus di inizio turno</p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    socket.emit('fabrizio-skip', { gameId: gameId });
                    setFabrizioDialog(null);
                  }}
                  className="w-full px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-all duration-200 hover:scale-105 border border-green-400/30"
                >
                  🃏 Gioca una carta normalmente
                </button>
                <button
                  onClick={() => {
                    socket.emit('fabrizio-pti-choice', { gameId: gameId });
                    setFabrizioDialog(null);
                  }}
                  className="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-lg transition-all duration-200 hover:scale-105 border border-yellow-400/30"
                >
                  ⭐ +100 PTI a {fabrizioDialog.characterName} (ora: {fabrizioDialog.currentPti})
                </button>
              </div>
            </div>
          </div>
        )}

        {controlTurnPanel.visible && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9998]">
            <div className="bg-gradient-to-b from-purple-900/95 to-purple-800/95 rounded-xl p-6 shadow-2xl border border-purple-400/40 backdrop-blur-sm max-w-md w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-3xl">🎮</span>
                <h3 className="text-white font-bold text-lg mt-1">M DI MAJIN BU</h3>
                <p className="text-purple-300 text-sm mt-1">Scegli che tipo di carta far giocare a <span className="text-yellow-300 font-bold">{controlTurnPanel.controlledPlayer}</span></p>
              </div>

              {!controlTurnPanel.selectedType ? (
                <div className="flex flex-col gap-3">
                  {(controlTurnPanel.availableTypes.length > 0 ? controlTurnPanel.availableTypes : ['personaggio', 'mosse', 'bonus']).map((type) => {
                    const typeLabels: Record<string, string> = { personaggio: '🧍 PERSONAGGIO', mosse: '⚔️ MOSSA', bonus: '✨ BONUS' };
                    return (
                      <button
                        key={type}
                        onClick={() => setControlTurnPanel(prev => ({ ...prev, selectedType: type }))}
                        className="w-full py-3 px-4 bg-purple-700 hover:bg-purple-500 text-white font-bold rounded-lg border border-purple-400/50 hover:border-yellow-400 transition-all duration-200 text-center"
                      >
                        {typeLabels[type] || type.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              ) : controlTurnPanel.selectedType === 'mosse' && !controlTurnPanel.selectedTarget ? (
                <div className="flex flex-col gap-3">
                  <p className="text-purple-300 text-sm text-center mb-2">Scegli il bersaglio da attaccare:</p>
                  {controlTurnPanel.possibleTargets.filter(p => p !== controlTurnPanel.controlledPlayer).map((target) => (
                    <button
                      key={target}
                      onClick={() => {
                        socket.emit('control-turn-choice', { gameId, cardType: 'mosse', targetPlayer: target });
                        setControlTurnPanel(prev => ({ ...prev, visible: false, selectedType: null, selectedTarget: null }));
                      }}
                      className="w-full py-3 px-4 bg-red-700 hover:bg-red-500 text-white font-bold rounded-lg border border-red-400/50 hover:border-yellow-400 transition-all duration-200 text-center"
                    >
                      ⚔️ Attacca {target}
                    </button>
                  ))}
                  <button
                    onClick={() => setControlTurnPanel(prev => ({ ...prev, selectedType: null }))}
                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-all"
                  >
                    ← Indietro
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      socket.emit('control-turn-choice', { gameId, cardType: controlTurnPanel.selectedType! });
                      setControlTurnPanel(prev => ({ ...prev, visible: false, selectedType: null, selectedTarget: null }));
                    }}
                    className="w-full py-3 px-4 bg-green-700 hover:bg-green-500 text-white font-bold rounded-lg border border-green-400/50 hover:border-yellow-400 transition-all"
                  >
                    ✅ Conferma: fai giocare {controlTurnPanel.selectedType?.toUpperCase()}
                  </button>
                  <button
                    onClick={() => setControlTurnPanel(prev => ({ ...prev, selectedType: null }))}
                    className="w-full py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-all"
                  >
                    ← Indietro
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {controlTurnTargetPanel.visible && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999]">
            <div className="bg-gradient-to-b from-purple-900/95 to-purple-800/95 rounded-xl p-6 shadow-2xl border border-purple-400/40 backdrop-blur-sm max-w-md w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-3xl">🎮</span>
                <h3 className="text-white font-bold text-lg mt-1">M DI MAJIN BU</h3>
                <p className="text-purple-300 text-sm mt-1">Scegli quale avversario controllare al suo prossimo turno:</p>
              </div>
              <div className="flex flex-col gap-3">
                {controlTurnTargetPanel.opponents.map((opponent) => (
                  <button
                    key={opponent}
                    onClick={() => {
                      socket.emit('control-turn-target-choice', { gameId, targetPlayer: opponent });
                      setControlTurnTargetPanel({ visible: false, opponents: [] });
                    }}
                    className="w-full py-3 px-4 bg-purple-700 hover:bg-purple-500 text-white font-bold rounded-lg border border-purple-400/50 hover:border-yellow-400 transition-all duration-200 text-center"
                  >
                    🎯 {opponent}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Graveyard Milestone Notification */}
        <FullScreenNotification
          isVisible={notificationVisible}
          playerName={notificationPlayer}
          cardCount={notificationCardCount}
          title={notificationTitle}
          onClose={() => setNotificationVisible(false)}
        />

        {/* Timed Effect Activated Banner */}
        <TimedEffectBanner
          isVisible={timedEffectBannerVisible}
          cardName={timedEffectBannerCard}
          sourcePlayer={timedEffectBannerPlayer}
          description={timedEffectBannerDesc}
          onClose={() => setTimedEffectBannerVisible(false)}
        />

        {/* Rankiard Modal */}
        {rankiardOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.25)] p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">RANKIARD</h2>
                <Button
                  onClick={() => setRankiardOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-900/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 p-0"
                >
                  <X size={14} />
                </Button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-violet-300/80 text-sm font-semibold mb-2 block">
                    Punti Rankiard residui
                  </label>
                  <Textarea
                    value={rankiardPoints}
                    onChange={(e) => handleRankiardPointsChange(e.target.value)}
                    placeholder="Inserisci i tuoi punti Rankiard..."
                    className="bg-black/40 border border-violet-500/20 text-violet-100 placeholder:text-violet-300/40 focus:border-violet-400/60 resize-none rounded-xl"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Button
                    onClick={() => setLeaderboardOpen(true)}
                    className="bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold py-2 px-4 flex items-center justify-center gap-2 rounded-xl"
                  >
                    <Trophy size={16} />
                    CLASSIFICA RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1IEyFgz3stHj4W7k8VZrl8opIwkmP_7WC/view', '_blank')}
                    className="bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white font-bold py-2 px-4 flex items-center justify-center gap-2 rounded-xl"
                  >
                    <ExternalLink size={16} />
                    ASSEGNAZIONE PUNTI RANKIARD
                  </Button>
                  <Button
                    onClick={() => window.open('https://drive.google.com/file/d/1KSPlXXs2lDg3-0MqlJvkgippLUBCnEbz/view', '_blank')}
                    className="bg-gradient-to-r from-violet-700 to-purple-700 hover:from-violet-600 hover:to-purple-600 text-white font-bold py-2 px-4 flex items-center justify-center gap-2 rounded-xl"
                  >
                    <ExternalLink size={16} />
                    BANCA POTERI
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Instructions Modal */}
        {instructionsOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-black/85 backdrop-blur-xl border border-violet-500/30 rounded-2xl shadow-[0_0_40px_rgba(124,58,237,0.25)] p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-xl font-black bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">🎮 ISTRUZIONI AI</h2>
                <Button
                  onClick={() => setInstructionsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-900/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 p-0"
                >
                  <X size={14} />
                </Button>
              </div>
              
              <div className="space-y-4">
                {/* Conversation History */}
                {conversationHistory.length > 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-3 max-h-48 overflow-y-auto">
                    <h3 className="text-violet-300/80 text-sm font-semibold mb-2">💬 Conversazione</h3>
                    <div className="space-y-2">
                      {conversationHistory.map((message, index) => (
                        <div key={index} className={`text-sm ${message.type === 'user' ? 'text-cyan-300' : 'text-emerald-300'}`}>
                          <span className="font-medium">
                            {message.type === 'user' ? '👤 Tu: ' : '🤖 Assistente: '}
                          </span>
                          <span className="whitespace-pre-wrap">{message.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-violet-300/80 text-sm font-semibold mb-2 block">
                    {conversationMode 
                      ? "💬 Rispondi all'assistente" 
                      : "Indica al sistema come modificare il gioco"}
                  </label>
                  
                  {/* Current Assistant Question */}
                  {conversationMode && assistantQuestion && (
                    <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-3 mb-3">
                      <div className="text-emerald-400 text-sm font-semibold mb-1">🤖 Assistente chiede:</div>
                      <div className="text-emerald-100/80 text-sm whitespace-pre-wrap">{assistantQuestion}</div>
                    </div>
                  )}
                  
                  {!conversationMode && (
                    <p className="text-violet-400/50 text-xs mb-3">
                      Esempi: "Inverti i turni di gioco", "Tutte le carte in campo vengono coperte", "Tutti prendono 3 carte MOSSE"
                    </p>
                  )}
                  
                  <Textarea
                    value={gameInstruction}
                    onChange={(e) => setGameInstruction(e.target.value)}
                    placeholder={conversationMode 
                      ? "Scrivi qui la tua risposta..." 
                      : "Scrivi qui la tua istruzione..."}
                    className="bg-black/40 border border-violet-500/20 text-violet-100 placeholder:text-violet-300/40 focus:border-violet-400/60 resize-none rounded-xl"
                    rows={4}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={handleExecuteGameInstruction}
                    className="flex-1 bg-gradient-to-r from-emerald-700 to-green-700 hover:from-emerald-600 hover:to-green-600 text-white font-bold py-2 rounded-xl"
                  >
                    {conversationMode ? "💬 RISPONDI" : "🎮 ESEGUI ISTRUZIONE"}
                  </Button>
                  
                  {conversationMode && (
                    <Button
                      onClick={() => {
                        setConversationMode(false);
                        setAssistantQuestion('');
                        setConversationHistory([]);
                        setGameInstruction('');
                      }}
                      className="bg-gradient-to-r from-orange-700 to-amber-700 hover:from-orange-600 hover:to-amber-600 text-white py-2 px-4 rounded-xl"
                    >
                      🔄 Ricomincia
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => {
                      setInstructionsOpen(false);
                      setConversationMode(false);
                      setAssistantQuestion('');
                      setGameInstruction('');
                    }}
                    className="bg-white/10 hover:bg-white/20 border border-white/10 text-white py-2 px-4 rounded-xl"
                  >
                    Chiudi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Defense System Dialog */}
        <DefenseDialog />
        <ContrattazioneDialog />
        <AttackInterceptorPanel />
        
        {/* Clash Battle - Equal damage tap battle */}
        {clashBattleData?.visible && (
          <ClashBattle
            clashId={clashBattleData.clashId}
            attacker={clashBattleData.attacker}
            defender={clashBattleData.defender}
            damageValue={clashBattleData.damageValue}
            duration={clashBattleData.duration}
          />
        )}
        
        {/* YouTube Video Modal */}
        {youtubeVideoData?.visible && (
          <YouTubeVideoModal
            youtubeUrl={youtubeVideoData.youtubeUrl}
            cardName={youtubeVideoData.cardName}
            playerName={youtubeVideoData.playerName}
            cardType={youtubeVideoData.cardType}
            onClose={() => setYoutubeVideoData(null)}
          />
        )}
        
        {/* CPU Thinking Indicator */}
        {cpuThinkingPlayer && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
            <div className="bg-black/80 text-white px-5 py-2.5 rounded-full flex items-center gap-3 shadow-lg border border-yellow-500/40 animate-pulse">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-ping" />
              <span className="text-sm font-medium">🤖 {cpuThinkingPlayer} sta pensando...</span>
            </div>
          </div>
        )}
        
        {/* CPU Damage Request Dialog */}
        <CPUDamageDialog />
        
        {/* Pokémon-style Duel Battle Overlay */}
        <DuelBattleOverlay />
        
        {/* Recursive Damage Panel for SEMPAFAAGARA and PARTITA DI TENNIS */}
        <RecursiveDamagePanel />
        
        {/* Transfer Request Dialog */}
        <TransferRequestDialog />
        
        {/* Picked Card Modal - shown when player picks a card */}
        <PickedCardModal />
        
        {/* SOROS Activation Cinematic Effect */}
        {sorosActivationVisible && sorosData && (
          <SorosActivation
            activator={sorosData.activator}
            cardImage={sorosData.cardImage}
            onComplete={() => {
              setSorosActivationVisible(false);
              setSorosData(null);
              // Restart music after cinematic
              if (musicPlayerOpen) {
                setTimeout(() => {
                  const musicToggleBtn = document.querySelector('[data-music-control="play"]');
                  if (musicToggleBtn) {
                    (musicToggleBtn as HTMLButtonElement).click();
                  }
                }, 500);
              }
            }}
          />
        )}

        {/* Tutorial Overlay for new players */}
        {showTutorial && (
          <TutorialOverlay
            onComplete={() => setShowTutorial(false)}
            onSkip={() => setShowTutorial(false)}
          />
        )}

        {/* Interstitial Ad - shown between games */}
        <InterstitialAd
          show={showInterstitialAd}
          onClose={() => setShowInterstitialAd(false)}
        />

        {/* Emoji Reactions for quick communication */}
        {gameId && playerName && (
          <EmojiReactions gameId={gameId} playerName={playerName} />
        )}
      </div>
    </div>
  );
};