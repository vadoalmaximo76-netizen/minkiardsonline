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
import { LellellelleModal, type LellellelleState } from "./LellellelleModal";
import { FullScreenNotification } from "./FullScreenNotification";
import { PersonaggioNotification } from "./PersonaggioNotification";
import { EvolutionAnimation } from "./EvolutionAnimation";
import { FusionAnimation } from "./FusionAnimation";
import { CardAnimation } from "./CardAnimation";
import { CustomAnimationOverlay } from "./CustomAnimationOverlay";
import { CinematicOverlay, type CinematicEventData } from "./CinematicOverlay";
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
import TangramAssignOverlay from "./TangramAssignOverlay";
import KainokenOverlay from "./KainokenOverlay";
import SfaccimmSelectOverlay from "./SfaccimmSelectOverlay";
import { HandModal } from "./HandModal";
import { Dice3D } from "./Dice3D";
import { CardShatter3D } from "./CardShatter3D";
import { KOBanner } from "./KOBanner";
import { AttackSlash3D } from "./AttackSlash3D";
import { MossaFlyer } from "./MossaFlyer";
import { cardRegistry } from "../lib/cardRegistry";
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
import { TeamVictoryScreen } from "./TeamVictoryScreen";
import { ConnectionStatus } from "./ConnectionStatus";
import { GamepadController } from "./GamepadController";
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
import { MessageCircle, Calculator as CalcIcon, Volume2, VolumeX, Plus, Dice6, Skull, X, ExternalLink, Crown, Star, Hand, Music, Shuffle, User, LogOut, Target, Trophy, SkipForward, ScrollText, Settings, MoreVertical, BookOpen, UserPlus, RotateCcw, PlusCircle, ChevronDown, Palette, BarChart2, Gift, Shield } from "lucide-react";
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
  onLogin?: () => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({ authenticatedUser, onLogout, authToken, onBack, onLeaveGame, onContinueTournament, onContinueFantaTournament, isGymMode, onLogin }) => {
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
  const [activeScenarioBanner, setActiveScenarioBanner] = useState<{ name: string; cardImageUrl: string; playedBy: string; effectText: string } | null>(null);
  const [scenarioCinematic, setScenarioCinematic] = useState<{ visible: boolean; name: string; cardImageUrl: string; playedBy: string; effectText: string } | null>(null);
  const [multidadoRoll, setMultidadoRoll] = useState<{ visible: boolean; dice: number[]; total: number; converted: number; playerName: string } | null>(null);
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
    gymLeaderImageUrl?: string;
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
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [teamCoverOpportunity, setTeamCoverOpportunity] = useState<{
    attackId: string;
    attackedPlayer: string;
    attacker: string;
    damage: number;
    coverCardId: string;
    coverCardName: string;
    windowSeconds: number;
    timeLeft: number;
  } | null>(null);
  const teamCoverTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [eliminationDialogOpen, setEliminationDialogOpen] = useState(false);
  const [victoryDialogOpen, setVictoryDialogOpen] = useState(false);
  const [victoryPlayer, setVictoryPlayer] = useState<string>('');
  const [teamVictoryData, setTeamVictoryData] = useState<{
    isTeamVictory: boolean;
    winningTeam: 'teamA' | 'teamB';
    winningPlayers: string[];
    teams: { teamA: string[]; teamB: string[] } | null;
    teamPlayerStats: Record<string, any> | null;
  } | null>(null);
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
  const { handModalOpen, setHandModalOpen, playerName: gbPlayerName, gameState: gbGameState } = useGameState();
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
  const [mossaFlyer, setMossaFlyer] = useState<{ fromRect: DOMRect; toRect: DOMRect; cardImageSrc?: string; damage: number; key: number } | null>(null);
  const pendingAttackEffectsRef = React.useRef<(() => void) | null>(null);
  const [cardsAddedToast, setCardsAddedToast] = useState<string | null>(null);
  const [gameToast, setGameToast] = useState<{ msg: string; emoji: string; type: 'info' | 'error' | 'success' } | null>(null);
  const gameToastTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const showGameToast = React.useCallback((msg: string, emoji: string, type: 'info' | 'error' | 'success' = 'info', duration = 3500) => {
    if (gameToastTimerRef.current) clearTimeout(gameToastTimerRef.current);
    setGameToast({ msg, emoji, type });
    gameToastTimerRef.current = setTimeout(() => setGameToast(null), duration);
  }, []);
  const [damageVignetteVisible, setDamageVignetteVisible] = useState(false);
  const damageVignetteTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const [cinematicFlash, setCinematicFlash] = useState<{ visible: boolean; type: 'attack' | 'heal' }>({ visible: false, type: 'attack' });
  const [cinematicOverlayData, setCinematicOverlayData] = useState<CinematicEventData | null>(null);
  const [turnPhaseFlash, setTurnPhaseFlash] = useState<{ visible: boolean; isMyTurn: boolean }>({ visible: false, isMyTurn: false });
  const [cardShatter3D, setCardShatter3D] = useState<{ visible: boolean; cardImage: string; cardName: string }>({ visible: false, cardImage: '', cardName: '' });
  const [koBanner, setKoBanner] = useState<{ visible: boolean; cardName: string; cardOwner: string; cardImage: string; eliminationMode: boolean; isCurrentPlayer: boolean }>({ visible: false, cardName: '', cardOwner: '', cardImage: '', eliminationMode: false, isCurrentPlayer: false });
  const [tekkenMode, setTekkenMode] = useState(false);
  const [attackEffectKey, setAttackEffectKey] = useState(0);
  const [deathEffectVisible, setDeathEffectVisible] = useState(false);
  const [deadCharacterName, setDeadCharacterName] = useState<string>("");
  const [deathEffectKey, setDeathEffectKey] = useState(0);
  const [choosingNotification, setChoosingNotification] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [blockTypeSelection, setBlockTypeSelection] = useState<{ visible: boolean; options: string[]; turns: number } | null>(null);
  const [bobDylanPanel, setBobDylanPanel] = useState<{ visible: boolean; choiceId: string; title: string; question: string; options: Array<{value: string; label: string; description: string}> } | null>(null);
  const [stakuOpportunity, setStakuOpportunity] = useState<{ stakuOwner: string; casterName: string; cardName: string; timeoutMs: number } | null>(null);
  const [stakuCountdown, setStakuCountdown] = useState(0);
  const stakuTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [stakuMustAttack, setStakuMustAttack] = useState(false);
  const [trinitaPanel, setTrinitaPanel] = useState<{ visible: boolean; choiceId: string; playerName: string; fieldChars: Array<{id: string; name: string; owner: string; pti?: number; stars?: number; image?: string}>; selected: string[] } | null>(null);
  const [schedinePanel, setSchedinePanel] = useState<{ visible: boolean; choiceId: string; playerName: string; allPlayers: string[]; isGoldenFreezer: boolean; selected: string[] } | null>(null);
  const [daddyConteDialog, setDaddyConteDialog] = useState<{ visible: boolean; characters: Array<{id: string; name: string; frontImage: string; owner: string}> } | null>(null);
  const [fabrizioDialog, setFabrizioDialog] = useState<{ visible: boolean; characterName: string; characterId: string; currentPti: number } | null>(null);
  const [camilloDialog, setCamilloDialog] = useState<{ visible: boolean; halfPTI: number; opponents: Array<{playerName: string; charId?: string; charName: string; charImage: string}> } | null>(null);
  const [evilFakeDialog, setEvilFakeDialog] = useState<{ visible: boolean; graveyard: Array<{id: string; name: string; frontImage: string; owner: string; pti: number; stars: number}>; selected: string[] } | null>(null);
  const [cyberGeenaDialog, setCyberGeenaDialog] = useState<{ visible: boolean; myCardId: string; myPTI: number; opponents: Array<{id: string; name: string; frontImage: string; owner: string; pti: number}> } | null>(null);
  const [acchiapptDialog, setAcchiapptDialog] = useState<{ visible: boolean; attackId: string; diceResult: number; damageValue: number; characters: Array<{id: string; name: string; owner: string; frontImage: string}>; chosenNumber: number | null } | null>(null);
  const [controlTurnPanel, setControlTurnPanel] = useState<{ visible: boolean; controlledPlayer: string; availableTypes: string[]; possibleTargets: string[]; selectedType: string | null; selectedTarget: string | null }>({ visible: false, controlledPlayer: '', availableTypes: [], possibleTargets: [], selectedType: null, selectedTarget: null });
  const [controlTurnTargetPanel, setControlTurnTargetPanel] = useState<{ visible: boolean; opponents: string[] }>({ visible: false, opponents: [] });
  const [cpuThinkingPlayer, setCpuThinkingPlayer] = useState<string | null>(null);
  const [helpBanner, setHelpBanner] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const [comicBanner, setComicBanner] = useState<{ visible: boolean; text: string; owner: string }>({ visible: false, text: '', owner: '' });
  const [cardEffectBanner, setCardEffectBanner] = useState<{ playerName: string; cardName: string; cardImage: string; effectName: string; effectText: string } | null>(null);
  const cardEffectBannerTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const [bloccoPlayerPanel, setBloccoPlayerPanel] = useState<{
    visible: boolean;
    cardId: string;
    cardName: string;
    opponents: string[];
  }>({ visible: false, cardId: '', cardName: '', opponents: [] });
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
  // LELLELLELELLE: Sequential card-reveal animation
  const LELLELLELELLE_INIT: LellellelleState = { visible: false, targetOwner: '', attackerName: '', totalCards: 0, saved: null, revealedCards: [], finished: false };
  const [lellelellleState, setLellelellleState] = useState<LellellelleState>(LELLELLELELLE_INIT);
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
  const [tangramPrompt, setTangramPrompt] = useState<{
    visible: boolean;
    chars: Array<{ id: string; name: string; image: string; currentOwner: string }>;
    players: string[];
    cardId: string;
  } | null>(null);
  const [kainokenPrompt, setKainokenPrompt] = useState<{
    visible: boolean;
    opponents: string[];
    allCards: Array<{ id: string; name: string; frontImage: string; deckKey: string }>;
  } | null>(null);
  const [sfaccimmPrompt, setSfaccimmPrompt] = useState<{
    visible: boolean;
    submitting: boolean;
    cards: Array<{ id: string; name: string; type: string; frontImage: string; pti?: number; stars?: number; deckKey: string }>;
    maxSelect: number;
    cardId: string;
    selected: string[];
  } | null>(null);
  const [faccioQuelloPrompt, setFaccioQuelloPrompt] = useState<{
    players: string[];
    isAlBano: boolean;
    cardId: string;
    selectedPairs: [string, string][];
    currentPick: string | null;
  } | null>(null);
  const [fantafinanzaPrompt, setFantafinanzaPrompt] = useState<{
    cards: Array<{ id: string; name: string; frontImage: string; pti: number }>;
    isFenomeno: boolean;
    revealedHands?: Record<string, Array<{ id: string; name: string; frontImage: string; pti: number; stars: number }>>;
    selectedCardId: string | null;
  } | null>(null);
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
    showGameToast('Link di invito copiato!', '📋', 'success', 2500);
  };

  // Turn phase flash: brief color overlay when turn changes
  useEffect(() => {
    if (!nextTurnPlayer) return;
    const isMe = nextTurnPlayer === gbPlayerName;
    setTurnPhaseFlash({ visible: true, isMyTurn: isMe });
    const timer = setTimeout(() => setTurnPhaseFlash({ visible: false, isMyTurn: isMe }), 500);
    return () => clearTimeout(timer);
  }, [nextTurnPlayer, gbPlayerName]);

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
      showGameToast("Inserisci un'istruzione per modificare il gioco", '⚠️', 'error', 3000);
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

  // Sync activeScenario banner with game state (for reconnects)
  useEffect(() => {
    if (gameState?.activeScenario) {
      setActiveScenarioBanner({
        name: gameState.activeScenario.name,
        cardImageUrl: gameState.activeScenario.cardImageUrl,
        playedBy: gameState.activeScenario.playedBy,
        effectText: gameState.activeScenario.effectText || '',
      });
    } else if (gameState && !gameState.activeScenario) {
      setActiveScenarioBanner(null);
    }
  }, [gameState?.activeScenario?.name]);

  // Close sfaccimm overlay when game-state-update arrives while submitting (server accepted selection)
  useEffect(() => {
    if (sfaccimmPrompt?.submitting) {
      setSfaccimmPrompt(null);
    }
  // Only run when gameState changes (new state = server applied the selection)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

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
      showGameToast(message, '🔄', 'info');
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
      showGameToast(message, '🃏', 'info');
    };

    const handleDiceRoll = ({ result, playerName }: { result: number, playerName: string }) => {
      setDiceResult(result);
      setPlayerWhoRolled(playerName);
      setDiceOpen(true);
      
      // Play dice roll sound when anyone rolls the dice
      playDiceRoll();
    };

    // ── SCENARIO EVENTS ─────────────────────────────────────────────────────────
    const handleScenarioActivated = (data: { name: string; cardImageUrl: string; playedBy: string; effectText: string }) => {
      // Show cinematic for 4 seconds
      setScenarioCinematic({ visible: true, ...data });
      setActiveScenarioBanner(data);
      setTimeout(() => {
        setScenarioCinematic(null);
      }, 4500);
    };
    const handleScenarioDeactivated = (_data: { name: string; reason: string }) => {
      setActiveScenarioBanner(null);
    };
    const handleMultidadoRolled = (data: { dice: number[]; total: number; converted: number; playerName: string }) => {
      setMultidadoRoll({ visible: true, ...data });
      setTimeout(() => setMultidadoRoll(null), 3500);
    };
    socket.on('scenario-activated', handleScenarioActivated);
    socket.on('scenario-deactivated', handleScenarioDeactivated);
    socket.on('multidado-roll', handleMultidadoRolled);
    // ─────────────────────────────────────────────────────────────────────────────

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

    const handleChatMessage = (message: { id: string; playerName: string; message: string; timestamp: number; isHelp?: boolean; isGymLeader?: boolean; gymLeaderImageUrl?: string }) => {
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
          gymLeaderImageUrl: message.gymLeaderImageUrl,
        }]);
      }
      playChatMessage();
    };

    const handleScenarioCardsToggled = ({ active }: { active: boolean }) => {
      setScenarioCardsActive(active);
    };

    const handleCardAttacked = ({ targetCardName, fromPlayer, toPlayer, damageValue, attackerName, targetOwner, mosseCardId, targetCardId }: { targetCardName?: string, fromPlayer?: string, toPlayer?: string, damageValue?: number, attackerName?: string, targetOwner?: string, mosseCardId?: string, targetCardId?: string }) => {
      const attacker = fromPlayer || attackerName || '???';
      const defender = toPlayer || targetOwner || '???';
      const target = targetCardName || defender;
      const dmg = damageValue || 0;
      console.log(`${attacker} attacked ${defender}'s ${target} for ${dmg} damage`);
      // Clear STAKU mandatory attack flag when the local player attacks
      if (attacker === playerName) setStakuMustAttack(false);

      // All visual/audio effects that should fire at the moment of IMPACT (after card lands)
      const triggerImpactEffects = () => {
        setAttackedCharacterName(target);
        setAttackEffectType(getDamageEffectType(dmg));
        setAttackEffectVisible(false);
        setTimeout(() => {
          setAttackEffectKey(prev => prev + 1);
          setAttackEffectVisible(true);
        }, 10);
        setAttackSlash3D({ visible: true, attackerName: attacker, targetName: target, damage: dmg });
        if (dmg >= 30 && dmg < 150) {
          setCinematicFlash({ visible: true, type: 'attack' });
          setTimeout(() => setCinematicFlash({ visible: false, type: 'attack' }), 700);
        }
        shake(dmg > 50 ? 'heavy' : dmg > 20 ? 'medium' : 'light');
        playAttackSound();
        playDamageSound();
        if (targetOwner === playerName && dmg > 0) {
          if (damageVignetteTimerRef.current) clearTimeout(damageVignetteTimerRef.current);
          setDamageVignetteVisible(true);
          damageVignetteTimerRef.current = setTimeout(() => setDamageVignetteVisible(false), 700);
        }
      };

      // Try to get card rects for the MossaFlyer animation.
      // Priority: 1) direct registry/DOM, 2) storePendingMosse fallback, 3) viewport position based on attacker side
      let fromRect = mosseCardId ? cardRegistry.getRect(mosseCardId) : null;
      let cardImageSrc = mosseCardId ? cardRegistry.getImageSrc(mosseCardId) : null;
      console.log(`[MossaFlyer] card-attacked: mosseCardId=${mosseCardId}, targetCardId=${targetCardId}, fromRect(direct)=${!!fromRect}`);
      if (!fromRect) {
        const pending = cardRegistry.consumePendingMosse();
        if (pending) { fromRect = pending.rect; cardImageSrc = pending.imageSrc; }
        console.log(`[MossaFlyer] after consumePendingMosse: fromRect=${!!fromRect}`);
      }
      // Last resort: synthesize a rect based on attacker side (CPU = top area, human = bottom area)
      if (!fromRect) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isCPUAttacker = !attackerName || attackerName.startsWith('CPU-') || attackerName !== playerName;
        const fx = vw / 2;
        const fy = isCPUAttacker ? vh * 0.15 : vh * 0.80;
        fromRect = new DOMRect(fx - 30, fy - 42, 60, 84);
        console.log(`[MossaFlyer] using VIEWPORT FALLBACK fromRect: isCPU=${isCPUAttacker}, pos=(${Math.round(fx)},${Math.round(fy)})`);
      }
      let toRect = targetCardId ? cardRegistry.getRect(targetCardId) : null;
      if (!toRect) {
        // Fallback: target is on the opposite side of the attacker
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const isCPUAtk = !attackerName || attackerName !== playerName;
        const tx = vw / 2;
        const ty = isCPUAtk ? vh * 0.70 : vh * 0.20;
        toRect = new DOMRect(tx - 30, ty - 42, 60, 84);
        console.log(`[MossaFlyer] toRect VIEWPORT FALLBACK: isCPU=${isCPUAtk}, pos=(${Math.round(tx)},${Math.round(ty)})`);
      }
      console.log(`[MossaFlyer] WILL_ANIMATE=true fromRect=(${Math.round(fromRect.x)},${Math.round(fromRect.y)}) toRect=(${Math.round(toRect.x)},${Math.round(toRect.y)})`);

      // Always show the flying card animation; impact effects fire on landing
      pendingAttackEffectsRef.current = triggerImpactEffects;
      setMossaFlyer({
        fromRect,
        toRect,
        cardImageSrc: cardImageSrc ?? undefined,
        damage: dmg,
        key: Date.now(),
      });
    };

    const handleCardToGraveyard = ({ cardName, cardType, cardOwner, cardImage }: { cardName: string, cardType?: string, cardOwner?: string, cardImage?: string }) => {
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
        /* K.O. banner — delay slightly so it appears after the initial flash */
        setTimeout(() => {
          setKoBanner({ visible: true, cardName, cardOwner: cardOwner || '???', cardImage: cardImage || '', eliminationMode: false, isCurrentPlayer: false });
        }, 350);
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

    const handleCardsAdded = ({ playerName: addingPlayer, deckLabel, count }: { playerName: string, deckLabel: string, count: number }) => {
      const msg = `${addingPlayer} ha aggiunto ${count} carte al mazzo ${deckLabel}!`;
      setCardsAddedToast(msg);
      setTimeout(() => setCardsAddedToast(null), 3500);
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

    const handleCinematicEvent = (data: CinematicEventData) => {
      console.log(`🎬 [Cinematic] type=${data.type} attacker=${data.attackerCharName || data.attackerName} dmg=${data.damage ?? 0}`);
      setCinematicOverlayData(data);
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
      // Clear STAKU mandatory attack when turn changes
      setStakuMustAttack(false);
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

    // LELLELLELELLE: sequential card reveal animation
    const handleLellellelleStart = (data: { targetOwner: string; attackerName: string; totalCards: number; saved: boolean }) => {
      setLellelellleState({ visible: true, targetOwner: data.targetOwner, attackerName: data.attackerName, totalCards: data.totalCards, saved: null, revealedCards: [], finished: false });
    };
    const handleLellellelleReveal = (data: { cardIndex: number; totalCards: number; cardName: string; cardImage: string | null; damage: number; isSaveCard: boolean; targetOwner: string; isLast: boolean; saved: boolean }) => {
      setLellelellleState(prev => {
        const newCard = { cardIndex: data.cardIndex, totalCards: data.totalCards, cardName: data.cardName, cardImage: data.cardImage, damage: data.damage, isSaveCard: data.isSaveCard, targetOwner: data.targetOwner, isLast: data.isLast, saved: data.saved };
        return {
          ...prev,
          totalCards: data.totalCards,
          revealedCards: [...prev.revealedCards, newCard],
          finished: data.isLast,
          saved: data.isLast ? data.saved : prev.saved
        };
      });
    };
    socket.on('lellelelle-start', handleLellellelleStart);
    socket.on('lellelelle-reveal', handleLellellelleReveal);

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
    socket.on('cinematic-event', handleCinematicEvent);
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

    const handleComicBanner = ({ text, owner }: { text: string; owner: string }) => {
      setComicBanner({ visible: true, text, owner });
      setTimeout(() => setComicBanner({ visible: false, text: '', owner: '' }), 4000);
    };
    socket.on('comic-banner', handleComicBanner);

    const handleCardEffectBanner = (data: { playerName: string; cardName: string; cardImage: string; effectName: string; effectText: string }) => {
      if (cardEffectBannerTimerRef.current) clearTimeout(cardEffectBannerTimerRef.current);
      setCardEffectBanner(data);
      cardEffectBannerTimerRef.current = setTimeout(() => setCardEffectBanner(null), 3500);
    };
    socket.on('card-effect-banner', handleCardEffectBanner);

    const handleBlockCardTypeSelect = (data: { cardId: string; cardName: string; options: string[]; turns: number; playerName: string }) => {
      if (data.playerName === playerName) {
        setBlockTypeSelection({ visible: true, options: data.options, turns: data.turns });
      }
    };
    socket.on('block-card-type-select', handleBlockCardTypeSelect);

    const handleShowChoicePanel = (data: { choiceId: string; title: string; question: string; options: Array<{value: string; label: string; description: string}> }) => {
      setBobDylanPanel({ visible: true, choiceId: data.choiceId, title: data.title, question: data.question, options: data.options });
    };
    socket.on('show-choice-panel', handleShowChoicePanel);

    const handleFotografoRevealHand = (data: { playerName: string; hand: Array<{id: string; name: string; type: string}> }) => {
      // Just log; the steal choice panel will appear immediately after
      console.log(`[FOTOGRAFO] Revealed hand of ${data.playerName}: ${data.hand.length} cards`);
    };
    socket.on('fotografo-reveal-hand', handleFotografoRevealHand);

    const handleShowTrinitaPanel = (data: { choiceId: string; playerName: string; fieldChars: Array<{id: string; name: string; owner: string; pti?: number; stars?: number; image?: string}> }) => {
      console.log('[TRINITÀ] show-trinita-panel received', data);
      setTrinitaPanel({ visible: true, choiceId: data.choiceId, playerName: data.playerName, fieldChars: data.fieldChars, selected: [] });
    };
    socket.on('show-trinita-panel', handleShowTrinitaPanel);

    const handleShowSchedinePanel = (data: { choiceId: string; playerName: string; allPlayers: string[]; isGoldenFreezer: boolean }) => {
      console.log('[SCHEDINE] show-schedine-panel received', data);
      setSchedinePanel({ visible: true, choiceId: data.choiceId, playerName: data.playerName, allPlayers: data.allPlayers, isGoldenFreezer: data.isGoldenFreezer, selected: [] });
    };
    socket.on('show-schedine-panel', handleShowSchedinePanel);

    const handleDaddyConteChoice = (data: { characters: Array<{id: string; name: string; frontImage: string; owner: string}> }) => {
      setDaddyConteDialog({ visible: true, characters: data.characters });
    };
    socket.on('daddy-conte-choice', handleDaddyConteChoice);

    const handleFabrizioChoice = (data: { characterName: string; characterId: string; currentPti: number }) => {
      setFabrizioDialog({ visible: true, characterName: data.characterName, characterId: data.characterId, currentPti: data.currentPti });
    };
    socket.on('fabrizio-choice', handleFabrizioChoice);

    const handleCamilloKillChoice = (data: { halfPTI: number; opponents: Array<{playerName: string; charId?: string; charName: string; charImage: string}> }) => {
      setCamilloDialog({ visible: true, halfPTI: data.halfPTI, opponents: data.opponents });
    };
    socket.on('camillo-kill-choice', handleCamilloKillChoice);

    const handleEvilFakeChoice = (data: { graveyard: Array<{id: string; name: string; frontImage: string; owner: string; pti: number; stars: number}> }) => {
      setEvilFakeDialog({ visible: true, graveyard: data.graveyard, selected: [] });
    };
    socket.on('evil-fake-choice', handleEvilFakeChoice);

    const handleCyberGeenaChoice = (data: { myCardId: string; myPTI: number; opponents: Array<{id: string; name: string; frontImage: string; owner: string; pti: number}> }) => {
      setCyberGeenaDialog({ visible: true, myCardId: data.myCardId, myPTI: data.myPTI, opponents: data.opponents });
    };
    socket.on('cyber-geena-choice', handleCyberGeenaChoice);

    const handleAcchiapptNumberChoice = (data: { attackId: string; diceResult?: number; damageValue: number; characters: Array<{id: string; name: string; owner: string; frontImage: string}> }) => {
      setAcchiapptDialog({ visible: true, attackId: data.attackId, diceResult: data.diceResult ?? 0, damageValue: data.damageValue, characters: data.characters, chosenNumber: null });
    };
    socket.on('acchiappt-number-choice', handleAcchiapptNumberChoice);

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

    // ZODY: second mossa available notification
    const handleSecondMossaAvailable = (data: { playerName: string; characterName: string }) => {
      console.log(`⚔️ ZODY: second-mossa-available received for ${data.playerName}`);
      showGameToast(
        `⚔️ ${data.characterName} può usare una seconda MOSSE questo turno!`,
        '⚔️',
        'success',
        5000
      );
    };
    socket.on('second-mossa-available', handleSecondMossaAvailable);

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
              cards: deckData.cards.filter(c => c.type === 'personaggi' || c.type === 'personaggi_speciali'),
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

    // TANGRAM INTERACTIVE ASSIGNMENT
    const handleTangramAssignPrompt = (data: { chars: any[]; players: string[]; cardId: string }) => {
      setTangramPrompt({ visible: true, chars: data.chars, players: data.players, cardId: data.cardId });
    };
    socket.on('tangram-assign-prompt', handleTangramAssignPrompt);

    // KAINOKEN INTERACTIVE SELECTION
    const handleKainokenPrompt = (data: { opponents: string[]; allCards: any[] }) => {
      setKainokenPrompt({ visible: true, opponents: data.opponents, allCards: data.allCards || [] });
    };
    socket.on('kainoken-prompt', handleKainokenPrompt);

    // SFACCIMM CARD SELECTION
    const handleSfaccimmSelectPrompt = (data: { cards: any[]; maxSelect: number; cardId: string }) => {
      setSfaccimmPrompt({ visible: true, submitting: false, cards: data.cards, maxSelect: data.maxSelect, cardId: data.cardId, selected: [] });
    };
    socket.on('sfaccimm-select-prompt', handleSfaccimmSelectPrompt);

    // SFACCIMM ERROR: server rejected selection (wrong count / stale IDs) — reset submitting so player can retry
    const handleSfaccimmError = (data: { message: string }) => {
      console.warn('🤌 SFACCIMM error:', data.message);
      setSfaccimmPrompt(prev => prev ? { ...prev, submitting: false } : prev);
    };
    socket.on('sfaccimm-error', handleSfaccimmError);

    const handleFaccioQuelloPrompt = (data: { players: string[]; isAlBano: boolean; cardId: string }) => {
      console.log('🎲 FACCIO QUELLO CHE VOGLIO prompt received:', data);
      setFaccioQuelloPrompt({ players: data.players, isAlBano: data.isAlBano, cardId: data.cardId, selectedPairs: [], currentPick: null });
    };
    socket.on('faccio-quello-prompt', handleFaccioQuelloPrompt);

    const handleFantafinanzaReveal = (data: { allHands: Record<string, any[]> }) => {
      console.log('💰 FANTAFINANZA reveal received');
      setFantafinanzaPrompt(prev => prev ? { ...prev, revealedHands: data.allHands } : { cards: [], isFenomeno: true, revealedHands: data.allHands, selectedCardId: null });
    };
    socket.on('fantafinanza-reveal', handleFantafinanzaReveal);

    const handleFantafinanzaPrompt = (data: { cards: any[]; isFenomeno: boolean }) => {
      console.log('💰 FANTAFINANZA prompt received:', data.cards.length, 'cards');
      setFantafinanzaPrompt(prev => ({
        cards: data.cards,
        isFenomeno: data.isFenomeno,
        revealedHands: prev?.revealedHands,
        selectedCardId: null,
      }));
    };
    socket.on('fantafinanza-prompt', handleFantafinanzaPrompt);

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

    // BLOCCO: Handle player selection panel for BLOCCO card
    const handleShowBloccoPlayerSelection = (data: { cardId: string; cardName: string; playerName: string; opponents: string[] }) => {
      console.log('🚫 Show blocco player selection:', data);
      if (data.playerName === playerName) {
        setBloccoPlayerPanel({
          visible: true,
          cardId: data.cardId,
          cardName: data.cardName,
          opponents: data.opponents,
        });
      }
    };
    socket.on('show-blocco-player-selection', handleShowBloccoPlayerSelection);

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

    // MINI SEMAFORO: dice roll animation — show which character is blocked or unblocked
    const handleMiniSemaforoAnimation = ({ playerName: semPlayer, characterName: semChar, roll: semRoll, blocked: semBlocked }: { playerName: string; characterName: string; roll: number; blocked: boolean }) => {
      showGameToast(
        `🚦 MINI SEMAFORO — ${semChar} (${semPlayer}): dado ${semRoll} → ${semBlocked ? '🔴 BLOCCATO' : '🟢 SBLOCCATO!'}`,
        '🚦',
        semBlocked ? 'warning' : 'success',
        3000
      );
    };
    socket.on('mini-semaforo-animation', handleMiniSemaforoAnimation);

    // Z AMMONTA: bonus card redraw notification
    const handleZAmmontaRedraw = ({ playerName: zaPlayer, count: zaCount }: { playerName: string; count: number }) => {
      showGameToast(`🃏 Z AMMONTA! ${zaPlayer} ha pescato ${zaCount} nuove carte bonus!`, '🃏', 'success', 4000);
    };
    socket.on('z-ammonta-redraw', handleZAmmontaRedraw);

    const handleInstructionExecuted = ({ playerName: instructorName, instruction, result, timestamp }: { 
      playerName: string, instruction: string, result: string, timestamp: number 
    }) => {
      // Show notification to all players about the executed instruction
      showGameToast(result, '🎮', 'success', 5000);
      
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
      showGameToast(message, '❌', 'error');
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
        showGameToast(`${instructorName} sta dialogando con l'assistente...`, '💬', 'info', 4000);
      }
    };

    const handleEliminationCheck = ({ playerName: targetPlayer }: { playerName: string }) => {
      if (targetPlayer === playerName) {
        setEliminationDialogOpen(true);
      }
    };

    const handlePlayerEliminated = ({ playerName: eliminatedPlayer }: { playerName: string }) => {
      playPlayerEliminated();

      /* ── Tekken-style elimination effect ── */
      const isMe = eliminatedPlayer === playerName;
      /* 1. Immediately go B&W + slow-motion feel */
      setTekkenMode(true);
      /* 2. Brief freeze before the banner pops */
      setTimeout(() => {
        setKoBanner({
          visible: true,
          cardName: '',
          cardOwner: eliminatedPlayer,
          cardImage: '',
          eliminationMode: true,
          isCurrentPlayer: isMe,
        });
      }, 420);
      /* 3. When banner completes (~3s total), restore colour — handled by onComplete */
    };

    const handleGameVictory = ({ winner, lastAction, matchDuration, playerStats, teamVictoryData: tvd }: { winner: string; lastAction?: any; matchDuration?: number; playerStats?: Record<string, any>; teamVictoryData?: any }) => {
      // TEAM MODE: show team victory screen
      if (tvd?.isTeamVictory) {
        const myTeam = tvd.teams
          ? (tvd.teams.teamA.includes(playerName) ? 'teamA' : tvd.teams.teamB.includes(playerName) ? 'teamB' : null)
          : null;
        const isWinner = myTeam === tvd.winningTeam;
        if (isWinner) { playVictory(); shake('extreme'); } else { playDefeat(); shake('heavy'); }
        setTeamVictoryData(tvd);
        setVictoryPlayer(winner);
        trackGameEnded(gameId || 'unknown', winner, matchDuration || 0, 0);
        return;
      }
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
      showGameToast(message, '❌', 'error');
    };

    const handleVoodooError = ({ message }: { message: string }) => {
      playErrorSound();
      showGameToast(message, '❌', 'error');
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

    // TEAM MODE: Team cover opportunity notification
    const handleTeamCoverOpportunity = (data: {
      attackId: string; attackedPlayer: string; attacker: string; damage: number;
      coverCardId: string; coverCardName: string; windowSeconds: number;
    }) => {
      if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
      setTeamCoverOpportunity({ ...data, timeLeft: data.windowSeconds });
      let remaining = data.windowSeconds;
      teamCoverTimerRef.current = setInterval(() => {
        remaining -= 1;
        setTeamCoverOpportunity(prev => prev ? { ...prev, timeLeft: remaining } : null);
        if (remaining <= 0) {
          if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
          setTeamCoverOpportunity(null);
        }
      }, 1000);
    };
    const handleTeamCoverResolved = () => {
      if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
      setTeamCoverOpportunity(null);
    };
    socket.on('team-cover-opportunity', handleTeamCoverOpportunity);
    socket.on('team-cover-resolved', handleTeamCoverResolved);
    socket.on('fusion-error', handleFusionError);
    socket.on('voodoo:error', handleVoodooError);
    socket.on('room-deleted', ({ gameId: deletedGameId }: { gameId: string }) => {
      if (deletedGameId === gameId) {
        onBack?.();
      }
    });

    // STAKU reactive window
    const handleStakuOpportunity = (data: { stakuOwner: string; casterName: string; cardName: string; timeoutMs: number }) => {
      if (data.stakuOwner !== playerName) return;
      if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
      const totalSec = Math.round((data.timeoutMs || 8000) / 1000);
      setStakuCountdown(totalSec);
      setStakuOpportunity(data);
      let remaining = totalSec;
      stakuTimerRef.current = setInterval(() => {
        remaining -= 1;
        setStakuCountdown(remaining);
        if (remaining <= 0) {
          if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
          setStakuOpportunity(null);
        }
      }, 1000);
    };
    const handleStakuExpired = () => {
      if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
      setStakuOpportunity(null);
    };
    socket.on('staku:opportunity', handleStakuOpportunity);
    socket.on('staku:expired', handleStakuExpired);

    // STAKU mandatory attack notification (from STAKU bonus card effect)
    const handleStakuAutoAttack = (data: { playerName: string }) => {
      if (data.playerName === playerName) {
        setStakuMustAttack(true);
      }
    };
    const handleStakuMustAttack = (data: { playerName: string; message: string }) => {
      if (data.playerName === playerName) {
        setStakuMustAttack(true);
      }
    };
    socket.on('staku-auto-attack', handleStakuAutoAttack);
    socket.on('staku-must-attack', handleStakuMustAttack);

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
      socket.off('scenario-activated', handleScenarioActivated);
      socket.off('scenario-deactivated', handleScenarioDeactivated);
      socket.off('multidado-roll', handleMultidadoRolled);
      socket.off('dice-roll', handleWindDiceRoll);
      socket.off('evolution-dice-roll', handleEvolutionDiceRoll);
      socket.off('lellelelle-start', handleLellellelleStart);
      socket.off('lellelelle-reveal', handleLellellelleReveal);
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
      socket.off('cinematic-event', handleCinematicEvent);
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
      socket.off('comic-banner', handleComicBanner);
      socket.off('card-effect-banner', handleCardEffectBanner);
      socket.off('block-card-type-select', handleBlockCardTypeSelect);
      socket.off('show-choice-panel', handleShowChoicePanel);
      socket.off('fotografo-reveal-hand', handleFotografoRevealHand);
      socket.off('show-trinita-panel', handleShowTrinitaPanel);
      socket.off('show-schedine-panel', handleShowSchedinePanel);
      socket.off('daddy-conte-choice', handleDaddyConteChoice);
      socket.off('fabrizio-choice', handleFabrizioChoice);
      socket.off('camillo-kill-choice', handleCamilloKillChoice);
      socket.off('evil-fake-choice', handleEvilFakeChoice);
      socket.off('cyber-geena-choice', handleCyberGeenaChoice);
      socket.off('acchiappt-number-choice', handleAcchiapptNumberChoice);
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
      socket.off('team-cover-opportunity', handleTeamCoverOpportunity);
      socket.off('team-cover-resolved', handleTeamCoverResolved);
      if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
      socket.off('fusion-error', handleFusionError);
      socket.off('voodoo:error', handleVoodooError);
      socket.off('room-deleted');
      socket.off('staku:opportunity', handleStakuOpportunity);
      socket.off('staku:expired', handleStakuExpired);
      if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
      socket.off('staku-auto-attack', handleStakuAutoAttack);
      socket.off('staku-must-attack', handleStakuMustAttack);
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
      socket.off('tangram-assign-prompt', handleTangramAssignPrompt);
      socket.off('kainoken-prompt', handleKainokenPrompt);
      socket.off('sfaccimm-select-prompt', handleSfaccimmSelectPrompt);
      socket.off('sfaccimm-error', handleSfaccimmError);
      socket.off('faccio-quello-prompt', handleFaccioQuelloPrompt);
      socket.off('fantafinanza-reveal', handleFantafinanzaReveal);
      socket.off('fantafinanza-prompt', handleFantafinanzaPrompt);
      socket.off('show-swap-selection', handleShowSwapSelection);
      socket.off('show-blocco-player-selection', handleShowBloccoPlayerSelection);
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
      socket.off('mini-semaforo-animation', handleMiniSemaforoAnimation);
      socket.off('z-ammonta-redraw', handleZAmmontaRedraw);
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
      socket.off('second-mossa-available', handleSecondMossaAvailable);
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
    <div
      id="game-root"
      className="min-h-screen bg-arena-deep text-slate-100 p-4 relative overflow-hidden"
    >
      {/* Tekken B&W overlay — backdrop-filter so KO banner (z-index 9999) stays in colour */}
      {tekkenMode && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998, pointerEvents: 'none',
          backdropFilter: 'grayscale(1) brightness(0.75)',
          WebkitBackdropFilter: 'grayscale(1) brightness(0.75)',
          transition: 'opacity 0.4s ease',
        }} />
      )}
      <div className="game-field-aurora" />
      <GameToastContainer />

      {/* ── SCENARIO SYSTEM UI ──────────────────────────────────────────────────── */}

      {/* Scenario animated CSS overlay for 7 special scenarios — zIndex:20 to sit above z-10 content wrapper */}
      {activeScenarioBanner && (() => {
        const scenarioName = activeScenarioBanner.name;
        if (scenarioName === 'CALDO INFERNALE') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(0deg, rgba(255,50,0,0.50) 0%, rgba(255,120,0,0.30) 50%, rgba(255,80,0,0.12) 100%)',
              animation: 'scenario-flame-pulse 2s ease-in-out infinite alternate',
            }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '120px',
              background: 'linear-gradient(0deg, rgba(255,80,0,0.55), transparent)',
              animation: 'scenario-flame-flicker 0.5s ease-in-out infinite alternate',
            }} />
          </div>
        );
        if (scenarioName === 'GUERRA') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(135deg, rgba(80,80,80,0.25) 0px, transparent 60px, rgba(60,60,60,0.20) 120px)',
              animation: 'scenario-smoke-drift 4s linear infinite',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.50) 100%)',
            }} />
          </div>
        );
        if (scenarioName === 'MONDO SOMMERSO') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(0,60,180,0.50) 0%, rgba(0,120,255,0.35) 60%, rgba(0,80,200,0.15) 100%)',
              animation: 'scenario-wave-pulse 3s ease-in-out infinite alternate',
            }} />
            <div style={{
              position: 'absolute', top: 0, left: '-200%', right: 0, height: '12px',
              background: 'repeating-linear-gradient(90deg, transparent 0px, rgba(0,180,255,0.75) 50px, transparent 100px)',
              animation: 'scenario-wave-move 2.5s linear infinite',
            }} />
          </div>
        );
        if (scenarioName === 'PACIFISMO') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(255,100,100,0.20) 0%, rgba(255,200,0,0.20) 16%, rgba(0,255,0,0.20) 33%, rgba(0,200,255,0.20) 50%, rgba(100,0,255,0.20) 66%, rgba(255,0,200,0.20) 83%, rgba(255,100,100,0.20) 100%)',
              animation: 'scenario-rainbow-shift 6s linear infinite',
            }} />
          </div>
        );
        if (scenarioName === 'REGNO DEGLI INFERI') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(0deg, rgba(80,0,0,0.55) 0%, rgba(40,0,80,0.40) 60%, rgba(20,0,40,0.15) 100%)',
              animation: 'scenario-dark-flame-pulse 2.5s ease-in-out infinite alternate',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(circle at 50% 105%, rgba(140,0,0,0.50) 0%, transparent 60%)',
            }} />
          </div>
        );
        if (scenarioName === 'REGNO SPECIALE') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(135deg, rgba(255,215,0,0.22), rgba(200,100,255,0.25), rgba(0,200,255,0.22))',
              animation: 'scenario-shimmer 3s ease-in-out infinite alternate',
            }} />
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(255,215,0,0.28) 0%, transparent 70%)',
              animation: 'scenario-shimmer 3s ease-in-out infinite alternate-reverse',
            }} />
          </div>
        );
        if (scenarioName === 'VEDI NAPOLI E POI MUORI') return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(180deg, rgba(0,80,200,0.35) 0%, transparent 50%, rgba(200,0,0,0.30) 100%)',
            }} />
            {['🌶️','💙','🌋','🍕','🎭'].map((emoji, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${10 + i * 18}%`,
                top: '-10%',
                fontSize: '2rem',
                animation: `scenario-emoji-fall ${2.5 + i * 0.4}s linear ${i * 0.6}s infinite`,
                userSelect: 'none',
                opacity: 0.6,
              }}>{emoji}</div>
            ))}
          </div>
        );
        return null;
      })()}

      {/* Scenario cinematic overlay — shown for 4.5 seconds on activation */}
      {scenarioCinematic && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 8000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.82)',
          animation: 'scenario-cinematic-in 0.4s ease-out',
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
            background: 'linear-gradient(135deg, rgba(20,10,40,0.98), rgba(40,10,20,0.98))',
            border: '2px solid rgba(255,180,0,0.7)',
            borderRadius: '20px',
            padding: '32px 48px',
            boxShadow: '0 0 80px rgba(255,150,0,0.5), 0 0 160px rgba(255,80,0,0.2)',
            maxWidth: '520px',
            width: '90%',
            animation: 'scenario-card-pop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{ fontSize: '0.9rem', color: 'rgba(255,180,0,0.8)', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              🎭 NUOVO SCENARIO ATTIVATO
            </div>
            {scenarioCinematic.cardImageUrl && (
              <img
                src={scenarioCinematic.cardImageUrl}
                alt={scenarioCinematic.name}
                style={{
                  width: '140px', height: 'auto', borderRadius: '10px',
                  boxShadow: '0 0 30px rgba(255,180,0,0.6)',
                  animation: 'scenario-card-spin-in 0.7s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
              />
            )}
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#fff', textAlign: 'center', textShadow: '0 0 20px rgba(255,150,0,0.8)' }}>
              {scenarioCinematic.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'rgba(255,220,150,0.9)', textAlign: 'center', maxWidth: '380px', lineHeight: 1.5 }}>
              {scenarioCinematic.effectText}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(200,180,255,0.7)', marginTop: '-8px' }}>
              Giocato da <strong style={{ color: 'rgba(255,200,100,0.9)' }}>{scenarioCinematic.playedBy}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Scenario persistent banner — below the topbar (top ~56px) */}
      {activeScenarioBanner && !scenarioCinematic && (
        <div style={{
          position: 'fixed', top: '56px', left: 0, right: 0, zIndex: 39,
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '4px 12px',
          background: 'linear-gradient(90deg, rgba(20,5,40,0.97), rgba(40,10,20,0.97))',
          borderBottom: '2px solid rgba(255,140,0,0.6)',
          boxShadow: '0 2px 12px rgba(255,100,0,0.3)',
          animation: 'scenario-banner-in 0.3s ease-out',
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: '1.1rem' }}>🎭</div>
          {activeScenarioBanner.cardImageUrl && (
            <img
              src={activeScenarioBanner.cardImageUrl}
              alt={activeScenarioBanner.name}
              style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '4px', border: '1px solid rgba(255,140,0,0.5)' }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 800, color: '#ffd700', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              {activeScenarioBanner.name}
            </span>
            <span style={{ marginLeft: '8px', color: 'rgba(255,220,180,0.7)', fontSize: '0.7rem' }}>
              {activeScenarioBanner.effectText}
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'rgba(200,180,255,0.6)', whiteSpace: 'nowrap' }}>
            👤 {activeScenarioBanner.playedBy}
          </div>
        </div>
      )}

      {/* MULTIDADO 3-dice roll animation */}
      {multidadoRoll && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 7500, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          animation: 'scenario-cinematic-in 0.3s ease-out',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(20,10,50,0.98), rgba(10,30,50,0.98))',
            border: '2px solid rgba(100,200,255,0.6)',
            borderRadius: '20px',
            padding: '28px 40px',
            boxShadow: '0 0 60px rgba(100,180,255,0.4)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
            animation: 'scenario-card-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{ fontSize: '0.85rem', color: 'rgba(100,200,255,0.8)', fontWeight: 700, letterSpacing: '0.2em' }}>
              🎲🎲🎲 MULTIDADO — {multidadoRoll.playerName}
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              {multidadoRoll.dice.map((d, i) => (
                <div key={i} style={{
                  width: '56px', height: '56px', borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1a1a4a, #2a2a6a)',
                  border: '2px solid rgba(100,200,255,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.8rem', fontWeight: 900, color: '#fff',
                  boxShadow: '0 0 20px rgba(100,180,255,0.3)',
                  animation: `scenario-dice-bounce 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${i * 0.12}s both`,
                }}>{d}</div>
              ))}
              <div style={{ fontSize: '1.5rem', color: 'rgba(200,200,200,0.6)' }}>=</div>
              <div style={{
                minWidth: '56px', height: '56px', borderRadius: '10px', padding: '0 8px',
                background: 'linear-gradient(135deg, #4a1a00, #8a3a00)',
                border: '2px solid rgba(255,180,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', color: 'rgba(255,200,100,0.9)', flexDirection: 'column', gap: '2px',
              }}>
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>totale {multidadoRoll.total}</span>
                <span style={{ fontSize: '1.6rem', fontWeight: 900, color: '#ffd700' }}>{multidadoRoll.converted}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── END SCENARIO SYSTEM UI ─────────────────────────────────────────────── */}
      <ContextualTooltipLoader />
      <ContextualTooltipDisplay />
      <ConnectionStatus />
      <GamepadController />
      
      {/* Last Played Cards History */}
      <LastPlayedCards cards={lastPlayedCards} maxCards={5} />
      
      {/* Missions Panel */}
      <MissionsPanel 
        isOpen={missionsOpen}
        onClose={() => setMissionsOpen(false)}
        authToken={authToken || null}
        onLogin={onLogin}
        onPointsUpdated={(newTotal) => {
          setUserRankiardPoints(newTotal);
        }}
      />
      
      {/* Achievements Panel */}
      <AchievementsPanel
        isOpen={achievementsOpen}
        onClose={() => setAchievementsOpen(false)}
        authToken={authToken || null}
        onLogin={onLogin}
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

      {/* FRA MARTINO: Comic-book speech bubble banner */}
      {comicBanner.visible && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] pointer-events-none">
          <div className="relative animate-in zoom-in-50 fade-in duration-200">
            <div
              className="bg-yellow-300 border-4 border-black rounded-2xl px-8 py-5 shadow-[6px_6px_0_0_#000] text-center"
              style={{ fontFamily: "'Comic Sans MS', 'Bangers', cursive" }}
            >
              <p className="text-black font-black text-3xl tracking-widest uppercase" style={{ textShadow: '2px 2px 0 #fff, -1px -1px 0 #000' }}>
                {comicBanner.text}
              </p>
              <p className="text-black/70 font-bold text-sm mt-1">— FRA MARTINO 🙏</p>
            </div>
            {/* Speech bubble tail */}
            <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[16px] border-l-transparent border-r-transparent border-t-black" />
            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-300" />
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

      {/* TEAM MODE: Donate Card Modal */}
      {showDonateModal && gameState?.isTeamMode && gameState?.teams && playerName && (() => {
        const myTeam = gameState.teams.teamA.includes(playerName) ? 'teamA' : gameState.teams.teamB.includes(playerName) ? 'teamB' : null;
        const teammates = myTeam ? gameState.teams[myTeam].filter((p: string) => p !== playerName && !(gameState.eliminatedPlayers || []).includes(p)) : [];
        const donateableCards = (gameState.players[playerName]?.hand || []).filter((c: any) => c.type === 'mosse' || c.type === 'bonus');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-emerald-500/30 p-5 shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <Gift size={18} className="text-emerald-400" />
                <h3 className="text-white font-bold text-base">Presta una Carta al Compagno</h3>
                <button onClick={() => setShowDonateModal(false)} className="ml-auto text-white/40 hover:text-white/80 text-lg leading-none">✕</button>
              </div>
              {teammates.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">Nessun compagno disponibile</p>
              ) : donateableCards.length === 0 ? (
                <p className="text-white/50 text-sm text-center py-4">Nessuna carta MOSSE o BONUS in mano</p>
              ) : (
                <>
                  <p className="text-white/50 text-xs mb-3">Seleziona una carta (MOSSE o BONUS) e un compagno a cui prestarla (una volta per turno)</p>
                  <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                    {donateableCards.map((card: any) => (
                      <div key={card.id} className="bg-white/5 rounded-xl px-3 py-2 border border-white/10">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${card.type === 'mosse' ? 'bg-red-500/30 text-red-300' : 'bg-blue-500/30 text-blue-300'}`}>
                            {card.type === 'mosse' ? 'MOSSE' : 'BONUS'}
                          </span>
                          <p className="text-white/80 text-sm font-medium">{card.name || card.id}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {teammates.map((teammate: string) => (
                            <button
                              key={teammate}
                              onClick={() => {
                                socket.emit('donate-card', { gameId, toPlayer: teammate, cardId: card.id });
                                setShowDonateModal(false);
                              }}
                              className="text-xs bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/25 transition-all"
                            >
                              → {teammate}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* TEAM MODE: Team cover opportunity notification */}
      {teamCoverOpportunity && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
          <div className="bg-blue-900/95 border border-blue-400/40 rounded-2xl p-4 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="text-2xl flex-shrink-0">🛡️</div>
              <div className="flex-1 min-w-0">
                <p className="text-blue-200 font-bold text-sm mb-0.5">Copertura Squadra</p>
                <p className="text-white/80 text-xs leading-snug">
                  <span className="text-red-300 font-semibold">{teamCoverOpportunity.attacker}</span> attacca il tuo compagno{' '}
                  <span className="text-yellow-300 font-semibold">{teamCoverOpportunity.attackedPlayer}</span>!{' '}
                  Usa <span className="text-blue-300 font-semibold">{teamCoverOpportunity.coverCardName}</span> per proteggere?
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className={`text-lg font-black tabular-nums ${teamCoverOpportunity.timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-white/60'}`}>
                  {teamCoverOpportunity.timeLeft}s
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  socket.emit('team-cover-use', { gameId, attackId: teamCoverOpportunity.attackId });
                  if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
                  setTeamCoverOpportunity(null);
                }}
                className="flex-1 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm py-2 rounded-xl transition-all shadow-lg shadow-blue-500/30"
              >
                🛡️ Copri!
              </button>
              <button
                onClick={() => {
                  if (teamCoverTimerRef.current) clearInterval(teamCoverTimerRef.current);
                  setTeamCoverOpportunity(null);
                }}
                className="px-4 bg-white/10 hover:bg-white/20 text-white/60 font-semibold text-sm py-2 rounded-xl transition-all"
              >
                Passa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM MODE: Team victory screen */}
      {teamVictoryData && (
        <TeamVictoryScreen
          teamVictoryData={teamVictoryData}
          playerName={playerName || ''}
          onClose={() => setTeamVictoryData(null)}
        />
      )}

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
              {graveyardSelectionModal.cards.map((card: any, idx: number) => (
                <button
                  key={`graveyard-select-${card.id}-${idx}`}
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
                    data-modal-item="true"
                    tabIndex={0}
                    onClick={() => {
                      socket.emit('deck-card-pick-confirm', {
                        selectedCardId: card.id,
                        deckType: deckCardPickerPanel.deckType,
                        cardId: deckCardPickerPanel.cardId,
                        playerName
                      });
                      setDeckCardPickerPanel({ visible: false, cardId: '', deckType: '', deckDisplayName: '', cards: [] });
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') (e.currentTarget as HTMLElement).click(); }}
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

      {/* BLOCCO PANEL - Choose opponent to block */}
      {bloccoPlayerPanel.visible && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-red-900 to-red-700 rounded-lg p-6 w-full max-w-md mx-4 border-4 border-red-400 shadow-[0_0_30px_rgba(239,68,68,0.5)]">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-white mb-2" style={{textShadow: '2px 2px 4px rgba(0,0,0,0.8)'}}>
                🚫 {bloccoPlayerPanel.cardName.toUpperCase()}
              </h2>
              <p className="text-red-100 text-sm mb-4" style={{textShadow: '1px 1px 2px rgba(0,0,0,0.8)'}}>
                L'avversario scelto salterà il suo prossimo turno!
              </p>
              <p className="text-red-200 font-bold">Scegli chi bloccare:</p>
            </div>
            <div className="space-y-3 mb-4">
              {bloccoPlayerPanel.opponents.map((opponent: string) => (
                <Button
                  key={opponent}
                  onClick={() => {
                    socket.emit('blocco-player-confirm', {
                      cardId: bloccoPlayerPanel.cardId,
                      targetPlayer: opponent,
                    });
                    setBloccoPlayerPanel({ visible: false, cardId: '', cardName: '', opponents: [] });
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 text-white py-4 text-lg font-bold"
                >
                  🎮 {opponent}
                </Button>
              ))}
            </div>
            <div className="text-center">
              <Button
                onClick={() => {
                  socket.emit('blocco-player-cancel', { cardId: bloccoPlayerPanel.cardId });
                  setBloccoPlayerPanel({ visible: false, cardId: '', cardName: '', opponents: [] });
                }}
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
                    <p key={`winner-${i}-${w.name}`} className="text-white">{w.name} → {w.effect}</p>
                  ))}
                </div>
              )}
              
              {diceRollResult.losers.length > 0 && (
                <div className="mt-4 bg-red-600/30 border border-red-400 rounded-lg p-3">
                  <p className="text-red-300 font-bold mb-2">❌ HANNO SBAGLIATO:</p>
                  {diceRollResult.losers.map((l, i) => (
                    <p key={`loser-${i}-${l.name}`} className="text-white">{l.name} → {l.effect}</p>
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
                      <div key={`affected-${i}-${char.charName}`} className="bg-indigo-800/50 rounded p-2 text-center">
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
                    data-modal-item="true"
                    tabIndex={0}
                    onClick={() => {
                      if (isSelected) {
                        setCustomSelectedTargets(prev => prev.filter(id => id !== target.id));
                      } else if (customTargetModal.maxSelections === 1) {
                        setCustomSelectedTargets([target.id]);
                      } else {
                        setCustomSelectedTargets(prev => [...prev, target.id]);
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') (e.currentTarget as HTMLElement).click(); }}
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
                key={`cimice-particle-${i}`}
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
              data-action="end-turn"
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

            {/* TEAM MODE: Donate Card button (only visible when team mode active and it's my turn) */}
            {gameState?.isTeamMode && gameState?.teams && playerName && (() => {
              const myTeam = gameState.teams.teamA.includes(playerName) ? 'teamA' : gameState.teams.teamB.includes(playerName) ? 'teamB' : null;
              const teammates = myTeam ? gameState.teams[myTeam].filter((p: string) => p !== playerName) : [];
              const isMyTurn = gameState.turnOrder[gameState.currentTurnIndex] === playerName;
              const alreadyDonated = gameState.donatedCardsThisTurn?.includes(playerName);
              const myDonateableCards = (gameState.players[playerName]?.hand || []).filter((c: any) => c.type === 'mosse' || c.type === 'bonus');
              if (teammates.length === 0 || !isMyTurn || myDonateableCards.length === 0 || alreadyDonated) return null;
              return (
                <motion.button
                  onClick={() => { playButtonClick(); setShowDonateModal(true); }}
                  className="p-2 rounded-xl transition-colors"
                  style={{ color: '#86efac', background: 'rgba(34,197,94,0.12)' }}
                  title="Dona Carta a Compagno"
                  whileHover={{ scale: 1.12, background: 'rgba(34,197,94,0.28)' } as any}
                  whileTap={{ scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                >
                  <Gift size={16} />
                </motion.button>
              );
            })()}

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

        {/* TANGRAM ASSIGNMENT OVERLAY */}
        {tangramPrompt && tangramPrompt.visible && (
          <TangramAssignOverlay
            chars={tangramPrompt.chars}
            players={tangramPrompt.players}
            onConfirm={(assignments) => {
              socket.emit('tangram-apply-assignments', { assignments });
              setTangramPrompt(null);
            }}
            onCancel={() => {
              socket.emit('tangram-cancel');
              setTangramPrompt(null);
            }}
          />
        )}

        {/* KAINOKEN INTERACTIVE SELECTION OVERLAY */}
        {kainokenPrompt && kainokenPrompt.visible && (
          <KainokenOverlay
            opponents={kainokenPrompt.opponents}
            allCards={kainokenPrompt.allCards}
            onConfirm={(assignments) => {
              socket.emit('kainoken-apply', { assignments });
              setKainokenPrompt(null);
            }}
            onCancel={() => {
              socket.emit('kainoken-cancel');
              setKainokenPrompt(null);
            }}
          />
        )}

        {/* SFACCIMM CARD SELECTION OVERLAY */}
        {sfaccimmPrompt && sfaccimmPrompt.visible && (
          <SfaccimmSelectOverlay
            cards={sfaccimmPrompt.cards}
            maxSelect={sfaccimmPrompt.maxSelect}
            selected={sfaccimmPrompt.selected}
            onToggle={(id) => {
              setSfaccimmPrompt(prev => {
                if (!prev) return prev;
                const already = prev.selected.includes(id);
                const newSelected = already
                  ? prev.selected.filter(x => x !== id)
                  : prev.selected.length < prev.maxSelect
                    ? [...prev.selected, id]
                    : prev.selected;
                return { ...prev, selected: newSelected };
              });
            }}
            submitting={sfaccimmPrompt.submitting}
            onConfirm={() => {
              if (!sfaccimmPrompt || sfaccimmPrompt.submitting) return;
              setSfaccimmPrompt(prev => prev ? { ...prev, submitting: true } : prev);
              socket.emit('sfaccimm-apply-selection', { selectedCardIds: sfaccimmPrompt.selected });
              // Overlay stays open until server confirms via game-state-update; sfaccimm-error resets submitting
            }}
            onCancel={() => {
              socket.emit('sfaccimm-cancel');
              setSfaccimmPrompt(null);
            }}
          />
        )}

        {/* FANTAFINANZA - CARD SELECTION PANEL */}
        {fantafinanzaPrompt && fantafinanzaPrompt.cards.length > 0 && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: '#1a1a2e', border: '2px solid #ffd700', borderRadius: 12, padding: 24, maxWidth: 560, width: '92%', color: '#fff' }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>💰 FANTAFINANZA!</h2>
              <p style={{ fontSize: 13, color: '#ccc', marginBottom: 16, textAlign: 'center' }}>
                {fantafinanzaPrompt.isFenomeno
                  ? 'IL FENOMENO: hai visto le mani avversarie. Scegli quale carta cedere al giocatore precedente. La carta che ricevi sarà protetta da furti.'
                  : 'Scegli quale carta cedere al giocatore precedente nel giro dei turni.'}
              </p>

              {/* Revealed hands for IL FENOMENO */}
              {fantafinanzaPrompt.isFenomeno && fantafinanzaPrompt.revealedHands && (
                <div style={{ marginBottom: 16, background: '#0d1525', borderRadius: 8, padding: 12 }}>
                  <p style={{ fontSize: 12, color: '#ffd700', marginBottom: 8, fontWeight: 'bold' }}>👁️ Mani avversarie (visibili solo a te):</p>
                  {Object.entries(fantafinanzaPrompt.revealedHands).map(([p, cards]) => (
                    <div key={p} style={{ marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#aaa' }}>{p}: </span>
                      {(cards as any[]).map(c => (
                        <span key={c.id} style={{ fontSize: 11, color: '#88ccff', marginRight: 6 }}>{c.name || '?'} ({c.pti} PTI)</span>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              <p style={{ fontSize: 12, color: '#aaa', marginBottom: 8 }}>Le tue carte (seleziona quella da cedere):</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {fantafinanzaPrompt.cards.map(c => {
                  const isSelected = fantafinanzaPrompt.selectedCardId === c.id;
                  return (
                    <button key={c.id} onClick={() => setFantafinanzaPrompt(prev => prev ? { ...prev, selectedCardId: c.id } : prev)}
                      style={{
                        padding: '8px 12px', borderRadius: 8,
                        border: isSelected ? '2px solid #ffd700' : '2px solid #444',
                        background: isSelected ? '#3a3000' : '#2a2a3a',
                        color: '#fff', cursor: 'pointer', fontSize: 13, textAlign: 'left',
                        minWidth: 120,
                      }}>
                      <div style={{ fontWeight: 'bold' }}>{c.name || '???'}</div>
                      <div style={{ fontSize: 11, color: '#aaa' }}>{c.pti} PTI</div>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  disabled={!fantafinanzaPrompt.selectedCardId}
                  onClick={() => {
                    if (!fantafinanzaPrompt.selectedCardId) return;
                    socket.emit('fantafinanza-apply', { chosenCardId: fantafinanzaPrompt.selectedCardId });
                    setFantafinanzaPrompt(null);
                  }}
                  style={{ background: fantafinanzaPrompt.selectedCardId ? '#22843a' : '#555', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: fantafinanzaPrompt.selectedCardId ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: 15 }}
                >
                  Cedi questa carta
                </button>
                <button
                  onClick={() => { socket.emit('fantafinanza-cancel'); setFantafinanzaPrompt(null); }}
                  style={{ background: '#600', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: 15 }}
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {/* FACCIO QUELLO CHE VOGLIO - HAND SWAP PANEL */}
        {faccioQuelloPrompt && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.80)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#1a1a2e', border: '2px solid #e94560', borderRadius: 12, padding: 24, maxWidth: 480, width: '90%', color: '#fff' }}>
              <h2 style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>🎲 FACCIO QUELLO CHE VOGLIO!</h2>
              <p style={{ fontSize: 13, color: '#aaa', marginBottom: 16, textAlign: 'center' }}>
                {faccioQuelloPrompt.isAlBano
                  ? 'AL BANO: seleziona le coppie di giocatori tra cui scambiare una singola carta (cieca). Clicca un giocatore, poi un altro per formare una coppia.'
                  : 'Seleziona le coppie di giocatori di cui vuoi scambiare le mani intere. Clicca un giocatore, poi un altro per formare una coppia.'}
              </p>

              {/* Current selection in progress */}
              {faccioQuelloPrompt.currentPick && (
                <p style={{ color: '#ffd700', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                  Hai selezionato <strong>{faccioQuelloPrompt.currentPick}</strong> — scegli il secondo giocatore
                </p>
              )}

              {/* Player buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginBottom: 16 }}>
                {faccioQuelloPrompt.players.map(p => {
                  const isInPair = faccioQuelloPrompt.selectedPairs.some(([a, b]) => a === p || b === p);
                  const isCurrentPick = faccioQuelloPrompt.currentPick === p;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setFaccioQuelloPrompt(prev => {
                          if (!prev) return prev;
                          if (prev.currentPick === null) {
                            return { ...prev, currentPick: p };
                          } else if (prev.currentPick === p) {
                            return { ...prev, currentPick: null };
                          } else {
                            const newPair: [string, string] = [prev.currentPick, p];
                            return { ...prev, selectedPairs: [...prev.selectedPairs, newPair], currentPick: null };
                          }
                        });
                      }}
                      style={{
                        padding: '8px 14px', borderRadius: 8, border: isCurrentPick ? '2px solid #ffd700' : '2px solid #444',
                        background: isCurrentPick ? '#5a4a00' : isInPair ? '#1a3a1a' : '#2a2a3a',
                        color: isInPair ? '#88ff88' : '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 'bold',
                      }}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              {/* Selected pairs list */}
              {faccioQuelloPrompt.selectedPairs.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 12, color: '#aaa', marginBottom: 6 }}>Scambi selezionati:</p>
                  {faccioQuelloPrompt.selectedPairs.map(([a, b], idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#88ff88' }}>{a} ↔ {b}</span>
                      <button onClick={() => setFaccioQuelloPrompt(prev => prev ? { ...prev, selectedPairs: prev.selectedPairs.filter((_, i) => i !== idx) } : prev)}
                        style={{ background: '#600', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button
                  onClick={() => {
                    socket.emit('faccio-quello-apply', { swapPairs: faccioQuelloPrompt.selectedPairs });
                    setFaccioQuelloPrompt(null);
                  }}
                  style={{ background: '#22843a', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: 15 }}
                >
                  Conferma scambio
                </button>
                <button
                  onClick={() => {
                    socket.emit('faccio-quello-cancel');
                    setFaccioQuelloPrompt(null);
                  }}
                  style={{ background: '#600', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', cursor: 'pointer', fontWeight: 'bold', fontSize: 15 }}
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
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

        {/* Cinematic Overlay — high-damage attacks and special bonus cards */}
        <CinematicOverlay
          data={cinematicOverlayData}
          onComplete={() => setCinematicOverlayData(null)}
        />

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

        {mossaFlyer && (
          <MossaFlyer
            key={mossaFlyer.key}
            fromRect={mossaFlyer.fromRect}
            toRect={mossaFlyer.toRect}
            cardImageSrc={mossaFlyer.cardImageSrc}
            damage={mossaFlyer.damage}
            onImpact={() => {
              pendingAttackEffectsRef.current?.();
              pendingAttackEffectsRef.current = null;
            }}
            onComplete={() => setMossaFlyer(null)}
          />
        )}

        {/* General in-game toast (replaces all browser alert() calls) */}
        <AnimatePresence>
          {gameToast && (
            <motion.div
              key="game-toast"
              initial={{ opacity: 0, y: -40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 460, damping: 30 }}
              className="fixed top-16 left-1/2 z-[99999] pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div
                className="flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-2xl max-w-sm text-center"
                style={{
                  background: gameToast.type === 'error'
                    ? 'linear-gradient(135deg, rgba(30,5,5,0.97), rgba(80,10,10,0.94))'
                    : gameToast.type === 'success'
                      ? 'linear-gradient(135deg, rgba(5,25,5,0.97), rgba(10,60,20,0.94))'
                      : 'linear-gradient(135deg, rgba(5,10,30,0.97), rgba(15,30,70,0.94))',
                  borderColor: gameToast.type === 'error'
                    ? 'rgba(239,68,68,0.5)'
                    : gameToast.type === 'success'
                      ? 'rgba(34,197,94,0.5)'
                      : 'rgba(99,102,241,0.5)',
                  boxShadow: gameToast.type === 'error'
                    ? '0 0 20px rgba(239,68,68,0.3)'
                    : gameToast.type === 'success'
                      ? '0 0 20px rgba(34,197,94,0.3)'
                      : '0 0 20px rgba(99,102,241,0.3)',
                }}
              >
                <span className="text-xl flex-shrink-0">{gameToast.emoji}</span>
                <span
                  className="font-bold text-sm tracking-wide"
                  style={{
                    color: gameToast.type === 'error' ? '#fca5a5' : gameToast.type === 'success' ? '#86efac' : '#a5b4fc'
                  }}
                >
                  {gameToast.msg}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cards-added in-game toast (replaces browser alert) */}
        <AnimatePresence>
          {cardsAddedToast && (
            <motion.div
              key="cards-added-toast"
              initial={{ opacity: 0, y: -32, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
              className="fixed top-6 left-1/2 z-[99999] pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-amber-400/50 backdrop-blur-md shadow-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(30,20,5,0.95), rgba(60,40,5,0.92))', boxShadow: '0 0 24px rgba(251,191,36,0.35)' }}>
                <span className="text-2xl">🃏</span>
                <span className="text-amber-200 font-bold text-sm tracking-wide">{cardsAddedToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Card Effect Banner — shown whenever a card effect activates */}
        <AnimatePresence>
          {cardEffectBanner && (
            <motion.div
              key={`card-effect-banner-${cardEffectBanner.effectName}-${cardEffectBanner.playerName}`}
              initial={{ opacity: 0, y: -50, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.92 }}
              transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              className="fixed top-32 left-1/2 z-[99990] pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl max-w-xs"
                style={{
                  background: 'linear-gradient(135deg, rgba(15,5,35,0.96), rgba(45,10,80,0.93))',
                  borderColor: 'rgba(167,139,250,0.55)',
                  boxShadow: '0 0 28px rgba(139,92,246,0.45), 0 4px 24px rgba(0,0,0,0.6)',
                }}
              >
                {cardEffectBanner.cardImage ? (
                  <img
                    src={cardEffectBanner.cardImage}
                    alt={cardEffectBanner.cardName}
                    className="w-10 h-14 object-cover rounded-lg border border-purple-400/40 flex-shrink-0 shadow-lg"
                  />
                ) : (
                  <span className="text-2xl flex-shrink-0">✨</span>
                )}
                <div className="flex flex-col min-w-0">
                  <span className="text-purple-200 font-black text-sm uppercase tracking-widest truncate leading-tight">
                    {cardEffectBanner.cardName}
                  </span>
                  <span className="text-purple-400 text-xs font-semibold">
                    ✨ {cardEffectBanner.playerName}
                  </span>
                  {cardEffectBanner.effectText && (
                    <span className="text-purple-300/80 text-xs mt-0.5 leading-snug line-clamp-2">
                      {cardEffectBanner.effectText}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cardShatter3D.visible && (
          <CardShatter3D
            isVisible={cardShatter3D.visible}
            cardImage={cardShatter3D.cardImage || undefined}
            cardName={cardShatter3D.cardName}
            onComplete={() => setCardShatter3D({ visible: false, cardImage: '', cardName: '' })}
          />
        )}

        {koBanner.visible && (
          <KOBanner
            cardName={koBanner.cardName}
            cardOwner={koBanner.cardOwner}
            cardImage={koBanner.cardImage}
            eliminationMode={koBanner.eliminationMode}
            isCurrentPlayer={koBanner.isCurrentPlayer}
            onComplete={() => {
              if (koBanner.eliminationMode) setTekkenMode(false);
              setKoBanner({ visible: false, cardName: '', cardOwner: '', cardImage: '', eliminationMode: false, isCurrentPlayer: false });
            }}
          />
        )}

        {cinematicFlash.visible && (
          <div className={cinematicFlash.type === 'attack' ? 'cinematic-attack-flash' : 'cinematic-heal-flash'} />
        )}
        {turnPhaseFlash.visible && (
          <div className={turnPhaseFlash.isMyTurn ? 'turn-phase-flash-my-turn' : 'turn-phase-flash-enemy-turn'} />
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
        {/* TEAM MODE: Team indicator badge */}
        {gameState?.isTeamMode && gameState?.teams && playerName && (() => {
          const myTeam = gameState.teams.teamA.includes(playerName) ? 'teamA' : gameState.teams.teamB.includes(playerName) ? 'teamB' : null;
          if (!myTeam) return null;
          const isTeamA = myTeam === 'teamA';
          const teammates = gameState.teams[myTeam].filter((p: string) => p !== playerName);
          return (
            <div className={`fixed top-16 right-3 z-[100] flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold ${isTeamA ? 'bg-blue-900/60 border-blue-500/40 text-blue-300' : 'bg-red-900/60 border-red-500/40 text-red-300'}`}>
              <Shield size={11} />
              {isTeamA ? 'Team A' : 'Team B'}
              {teammates.length > 0 && (
                <span className="text-white/50 font-normal">· {teammates.join(', ')}</span>
              )}
            </div>
          );
        })()}

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

        {/* LELLELLELELLE reveal animation modal */}
        <LellellelleModal
          state={lellelellleState}
          onClose={() => setLellelellleState(LELLELLELELLE_INIT)}
        />

        {/* Chat Notifications */}
        {chatNotifications.map((notification) => (
          <ChatNotification
            key={notification.id}
            message={notification.message}
            playerName={notification.playerName}
            isGymLeader={notification.isGymLeader}
            gymLeaderImageUrl={notification.gymLeaderImageUrl}
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

        {bobDylanPanel?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl p-6 shadow-2xl border border-red-700/60 max-w-sm w-full mx-4">
              <div className="text-center mb-5">
                <span className="text-5xl">😈</span>
                <h3 className="text-red-400 text-xl font-bold mt-2 uppercase tracking-widest">{bobDylanPanel.title}</h3>
                <p className="text-gray-200 text-sm mt-2">{bobDylanPanel.question}</p>
              </div>
              <div className="flex flex-col gap-3">
                {bobDylanPanel.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      socket.emit('choice-panel-response', { choiceId: bobDylanPanel.choiceId, value: opt.value, gameId });
                      setBobDylanPanel(null);
                    }}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition-all border ${opt.value === 'SI' ? 'bg-red-900/80 hover:bg-red-800 border-red-600 text-red-200' : 'bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-200'}`}
                  >
                    <div className="font-bold">{opt.label}</div>
                    {opt.description && <div className="text-xs opacity-70 mt-1 font-normal">{opt.description}</div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── STAKU Reactive Panel ─────────────────────────────────────────── */}
        {stakuOpportunity && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 pointer-events-auto">
            <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-xl p-6 shadow-2xl border border-yellow-500/70 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-5xl">⚡</span>
                <h3 className="text-yellow-400 text-xl font-bold mt-2 uppercase tracking-widest">STAKU!</h3>
                <p className="text-gray-200 text-sm mt-2">
                  <strong>{stakuOpportunity.casterName}</strong> usa <strong>"{stakuOpportunity.cardName}"</strong> contro di te.
                  Vuoi respingerlo?
                </p>
                <div className="mt-3 text-yellow-300 text-lg font-mono font-bold">{stakuCountdown}s</div>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    socket.emit('staku:activate', { playerName });
                    if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
                    setStakuOpportunity(null);
                  }}
                  className="py-3 px-4 rounded-lg font-bold text-sm transition-all border bg-yellow-900/80 hover:bg-yellow-800 border-yellow-600 text-yellow-100"
                >
                  ⚡ STAKU! Rispingo il bonus
                </button>
                <button
                  onClick={() => {
                    socket.emit('staku:decline', { playerName });
                    if (stakuTimerRef.current) clearInterval(stakuTimerRef.current);
                    setStakuOpportunity(null);
                  }}
                  className="py-3 px-4 rounded-lg font-bold text-sm transition-all border bg-gray-800 hover:bg-gray-700 border-gray-600 text-gray-300"
                >
                  Lascia passare
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── STAKU Mandatory Attack Warning Banner ───────────────────────── */}
        {stakuMustAttack && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9990] pointer-events-none">
            <div className="bg-yellow-900/95 border-2 border-yellow-400 rounded-xl px-6 py-3 shadow-2xl flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <div className="text-yellow-300 font-bold text-sm uppercase tracking-wider">STAKU attivo!</div>
                <div className="text-yellow-100 text-xs">Devi attaccare prima di chiudere il turno</div>
              </div>
              <span className="text-2xl">⚡</span>
            </div>
          </div>
        )}

        {/* ─── TRINITÀ Panel ────────────────────────────────────────────────── */}
        {trinitaPanel?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
            <div className="bg-gradient-to-b from-indigo-950 to-gray-900 rounded-xl p-6 shadow-2xl border border-indigo-400/50 max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto">
              <div className="text-center mb-4">
                <span className="text-4xl">✝️</span>
                <h3 className="text-white text-xl font-bold mt-2 uppercase tracking-widest">TRINITÀ</h3>
                <p className="text-indigo-200 text-sm mt-1">Scegli 3 personaggi da assegnare a te stesso</p>
                <p className="text-indigo-300 text-xs mt-1">Selezionati: <strong>{trinitaPanel.selected.length}/3</strong></p>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                {trinitaPanel.fieldChars.map((char) => {
                  const isSel = trinitaPanel.selected.includes(char.id);
                  return (
                    <button
                      key={char.id}
                      onClick={() => {
                        setTrinitaPanel(prev => {
                          if (!prev) return prev;
                          const sel = isSel
                            ? prev.selected.filter(id => id !== char.id)
                            : prev.selected.length < 3 ? [...prev.selected, char.id] : prev.selected;
                          return { ...prev, selected: sel };
                        });
                      }}
                      className={`w-full px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border ${isSel ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'}`}
                    >
                      {char.image && <img src={char.image} alt={char.name} className="w-8 h-8 rounded object-cover" />}
                      <span className="text-sm flex-1 text-left">{char.name} <span className="text-gray-400 text-xs">({char.owner}) — {char.pti ?? '?'} PTI ⭐{char.stars ?? '?'}</span></span>
                      {isSel && <span className="text-indigo-300 text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={trinitaPanel.selected.length !== 3}
                  onClick={() => {
                    socket.emit('trinita-response', { choiceId: trinitaPanel.choiceId, selectedIds: trinitaPanel.selected, gameId });
                    setTrinitaPanel(null);
                  }}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg"
                >
                  ✝️ Conferma selezione ({trinitaPanel.selected.length}/3)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── SCHEDINE Panel ───────────────────────────────────────────────── */}
        {schedinePanel?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
            <div className="bg-gradient-to-b from-green-950 to-gray-900 rounded-xl p-6 shadow-2xl border border-green-400/50 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🎲</span>
                <h3 className="text-white text-xl font-bold mt-2 uppercase tracking-widest">SCHEDINE{schedinePanel.isGoldenFreezer ? ' 🥶' : ''}</h3>
                <p className="text-green-200 text-sm mt-1">Scommetti su 2 finalisti{schedinePanel.isGoldenFreezer ? ' (Golden Freezer — gioco obbligatorio)' : ''}</p>
                <p className="text-green-300 text-xs mt-1">Selezionati: <strong>{schedinePanel.selected.length}/2</strong></p>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                {schedinePanel.allPlayers.map((pName) => {
                  const isSel = schedinePanel.selected.includes(pName);
                  return (
                    <button
                      key={pName}
                      onClick={() => {
                        setSchedinePanel(prev => {
                          if (!prev) return prev;
                          const sel = isSel
                            ? prev.selected.filter(n => n !== pName)
                            : prev.selected.length < 2 ? [...prev.selected, pName] : prev.selected;
                          return { ...prev, selected: sel };
                        });
                      }}
                      className={`w-full px-4 py-3 rounded-lg font-bold transition-all flex items-center justify-between border ${isSel ? 'bg-green-700 border-green-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'}`}
                    >
                      <span>{pName}</span>
                      {isSel && <span className="text-green-300 text-xs">✓ Finalista</span>}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={schedinePanel.selected.length !== 2}
                  onClick={() => {
                    socket.emit('schedine-response', { choiceId: schedinePanel.choiceId, finalists: schedinePanel.selected, gameId });
                    setSchedinePanel(null);
                  }}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg"
                >
                  🎲 Scommetti su {schedinePanel.selected.join(' e ') || '...'}
                </button>
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

        {camilloDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-orange-900 to-orange-800 rounded-xl p-6 shadow-2xl border border-orange-400/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🎭</span>
                <h3 className="text-white text-xl font-bold mt-2">CAMILLO</h3>
                <p className="text-orange-200 text-sm mt-1">Scegli a chi donare <strong>{camilloDialog.halfPTI} PTI</strong> (−1⭐ all'avversario scelto)</p>
              </div>
              <div className="flex flex-col gap-3">
                {camilloDialog.opponents.map((opp) => (
                  <button
                    key={opp.playerName}
                    onClick={() => {
                      socket.emit('camillo-kill-target-chosen', { gameId, targetPlayer: opp.playerName });
                      setCamilloDialog(null);
                    }}
                    className="w-full px-4 py-3 bg-orange-700 hover:bg-orange-600 text-white font-bold rounded-lg transition-all flex items-center gap-3"
                  >
                    {opp.charImage && <img src={opp.charImage} alt={opp.charName} className="w-10 h-10 rounded object-cover" />}
                    <span>{opp.charName} <span className="text-orange-200 text-xs">({opp.playerName})</span></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {evilFakeDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-red-950 to-gray-900 rounded-xl p-6 shadow-2xl border border-red-500/40 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="text-center mb-4">
                <span className="text-4xl">😈</span>
                <h3 className="text-white text-xl font-bold mt-2">EVIL FAKE</h3>
                <p className="text-red-200 text-sm mt-1">Scegli fino a 3 personaggi dai cimiteri avversari da assorbire</p>
                <p className="text-red-300 text-xs mt-1">Selezionati: {evilFakeDialog.selected.length}/3</p>
              </div>
              <div className="flex flex-col gap-2 mb-4">
                {evilFakeDialog.graveyard.map((card, idx) => {
                  const isSelected = evilFakeDialog.selected.includes(card.id);
                  return (
                    <button
                      key={`evilfake-${card.id}-${card.owner}-${idx}`}
                      onClick={() => {
                        setEvilFakeDialog(prev => {
                          if (!prev) return prev;
                          const sel = prev.selected.includes(card.id)
                            ? prev.selected.filter(id => id !== card.id)
                            : prev.selected.length < 3 ? [...prev.selected, card.id] : prev.selected;
                          return { ...prev, selected: sel };
                        });
                      }}
                      className={`w-full px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-2 border ${isSelected ? 'bg-red-600 border-red-400 text-white' : 'bg-gray-800 border-gray-600 text-gray-200 hover:bg-gray-700'}`}
                    >
                      {card.frontImage && <img src={card.frontImage} alt={card.name} className="w-8 h-8 rounded object-cover" />}
                      <span className="text-sm">{card.name} <span className="text-gray-400 text-xs">({card.owner}) — {card.pti} PTI ⭐{card.stars}</span></span>
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    socket.emit('evil-fake-chosen', { gameId, selectedIds: evilFakeDialog.selected });
                    setEvilFakeDialog(null);
                  }}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg"
                >
                  😈 Assorbi {evilFakeDialog.selected.length} personaggi
                </button>
                <button onClick={() => setEvilFakeDialog(null)} className="py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-lg">✕</button>
              </div>
            </div>
          </div>
        )}

        {cyberGeenaDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-blue-950 to-gray-900 rounded-xl p-6 shadow-2xl border border-blue-400/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🤖</span>
                <h3 className="text-white text-xl font-bold mt-2">CYBER GEENA</h3>
                <p className="text-blue-200 text-sm mt-1">Scegli un personaggio con cui scambiare i PTI</p>
                <p className="text-blue-300 text-xs mt-1">I tuoi PTI attuali: <strong>{cyberGeenaDialog.myPTI}</strong></p>
              </div>
              <div className="flex flex-col gap-3">
                {cyberGeenaDialog.opponents.map((opp) => (
                  <button
                    key={opp.id}
                    onClick={() => {
                      socket.emit('cyber-geena-target-chosen', { gameId, targetCardId: opp.id });
                      setCyberGeenaDialog(null);
                    }}
                    className="w-full px-4 py-3 bg-blue-700 hover:bg-blue-600 text-white font-bold rounded-lg transition-all flex items-center gap-3"
                  >
                    {opp.frontImage && <img src={opp.frontImage} alt={opp.name} className="w-10 h-10 rounded object-cover" />}
                    <span>{opp.name} <span className="text-blue-200 text-xs">({opp.owner}) — {opp.pti} PTI</span></span>
                  </button>
                ))}
              </div>
              <button onClick={() => setCyberGeenaDialog(null)} className="mt-3 w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">✕ Annulla</button>
            </div>
          </div>
        )}

        {acchiapptDialog?.visible && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70">
            <div className="bg-gradient-to-b from-yellow-900 to-gray-900 rounded-xl p-6 shadow-2xl border border-yellow-500/40 max-w-sm w-full mx-4">
              <div className="text-center mb-4">
                <span className="text-4xl">🎯</span>
                <h3 className="text-white text-xl font-bold mt-2">ACCHIAPPT CHESSA</h3>
                <p className="text-yellow-200 text-sm mt-1">Scegli un numero da 1 a 6!</p>
                <p className="text-yellow-300 text-xs mt-1">Chi indovina il dado è immune. Chi sbaglia prende {acchiapptDialog.damageValue} danni!</p>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[1,2,3,4,5,6].map(n => (
                  <button
                    key={n}
                    onClick={() => setAcchiapptDialog(prev => prev ? { ...prev, chosenNumber: n } : prev)}
                    className={`py-3 rounded-lg font-bold text-xl transition-all border ${acchiapptDialog.chosenNumber === n ? 'bg-yellow-500 border-yellow-300 text-black scale-110' : 'bg-gray-800 border-gray-600 text-white hover:bg-gray-700'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                disabled={acchiapptDialog.chosenNumber === null}
                onClick={() => {
                  if (acchiapptDialog.chosenNumber !== null) {
                    socket.emit('acchiappt-number-response', { gameId, number: acchiapptDialog.chosenNumber });
                    setAcchiapptDialog(null);
                  }
                }}
                className="w-full py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 text-white font-bold rounded-lg transition-all"
              >
                🎯 Conferma {acchiapptDialog.chosenNumber !== null ? `(hai scelto ${acchiapptDialog.chosenNumber})` : ''}
              </button>
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