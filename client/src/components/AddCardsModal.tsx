import React, { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { X, Upload, Plus, Pencil, Trash2, Save, Shield, Sparkles, Search, RotateCcw, Volume2, Wand2, ChevronRight, ChevronLeft, Video } from "lucide-react";
import { socket } from "../lib/socket";
import { useGameState } from "../lib/stores/useGameState";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";

interface EffectWizardState {
  step: number;
  effectType: string;
  target: string;
  value: string;
  value2: string;
  duration: string;
  condition: string;
  customDescription: string;
  categoryFilter: string;
  effectSearchQuery: string;
  animationDescription: string;
  behaviorDescription: string;
  aiQuestions: AIQuestion[];
  aiAnswers: Record<string, string>;
  isAnalyzing: boolean;
  analysisComplete: boolean;
  aiInterpretation: string;
  needsMoreInfo: boolean;
  // Dice (Dado) system
  diceEnabled: boolean;
  diceMode: 'choice' | 'auto'; // 'choice' = players choose numbers, 'auto' = automatic roll with preset consequences
  diceCorrectEffect: string;
  diceCorrectCustom: string;
  diceWrongEffect: string;
  diceWrongCustom: string;
  // Auto dice: consequences for each number (1-6)
  diceAutoEffects: {
    1: { effect: string; custom: string };
    2: { effect: string; custom: string };
    3: { effect: string; custom: string };
    4: { effect: string; custom: string };
    5: { effect: string; custom: string };
    6: { effect: string; custom: string };
  };
  // Conditional usage settings
  requiresCharacter: boolean;
  requiredCharacterName: string;
  targetRestriction: 'none' | 'only' | 'except';
  targetCharacterName: string;
  fieldCondition: 'none' | 'requires' | 'blocked';
  fieldCardName: string;
}

// Predefined dice consequences
const DICE_EFFECTS = [
  { id: 'none', label: 'Nessun effetto', description: 'Non succede nulla' },
  { id: 'death', label: 'Morte del personaggio', description: 'Il personaggio muore immediatamente' },
  { id: 'zero_stars', label: 'Va a 0 stelle', description: 'Le stelle del personaggio diventano 0' },
  { id: 'halve_pti', label: 'Dimezza i PTI', description: 'I PTI del personaggio vengono dimezzati' },
  { id: 'halve_stars', label: 'Dimezza le stelle', description: 'Le stelle del personaggio vengono dimezzate' },
  { id: 'double_pti', label: 'Raddoppia i PTI', description: 'I PTI del personaggio raddoppiano' },
  { id: 'double_stars', label: 'Raddoppia le stelle', description: 'Le stelle del personaggio raddoppiano' },
  { id: 'double_both', label: 'Raddoppia PTI e stelle', description: 'Sia PTI che stelle raddoppiano' },
  { id: 'halve_both', label: 'Dimezza PTI e stelle', description: 'Sia PTI che stelle vengono dimezzati' },
  { id: 'gain_pti', label: 'Guadagna PTI', description: 'Guadagna una certa quantità di PTI' },
  { id: 'lose_pti', label: 'Perde PTI', description: 'Perde una certa quantità di PTI' },
  { id: 'gain_stars', label: 'Guadagna stelle', description: 'Guadagna stelle' },
  { id: 'lose_stars', label: 'Perde stelle', description: 'Perde stelle' },
  { id: 'skip_turn', label: 'Salta il turno', description: 'Il personaggio salta il prossimo turno' },
  { id: 'extra_turn', label: 'Turno extra', description: 'Il personaggio ottiene un turno extra' },
  { id: 'dies_in_1', label: 'Muore tra 1 turno', description: 'Il personaggio morirà tra 1 turno' },
  { id: 'dies_in_2', label: 'Muore tra 2 turni', description: 'Il personaggio morirà tra 2 turni' },
  { id: 'dies_in_3', label: 'Muore tra 3 turni', description: 'Il personaggio morirà tra 3 turni' },
  { id: 'dies_in_4', label: 'Muore tra 4 turni', description: 'Il personaggio morirà tra 4 turni' },
  { id: 'dies_in_5', label: 'Muore tra 5 turni', description: 'Il personaggio morirà tra 5 turni' },
  { id: 'dies_in_6', label: 'Muore tra 6 turni', description: 'Il personaggio morirà tra 6 turni' },
  { id: 'custom', label: 'Personalizzato...', description: 'Descrivi tu l\'effetto' },
];

const DEFAULT_DICE_AUTO_EFFECTS = {
  1: { effect: 'none', custom: '' },
  2: { effect: 'none', custom: '' },
  3: { effect: 'none', custom: '' },
  4: { effect: 'none', custom: '' },
  5: { effect: 'none', custom: '' },
  6: { effect: 'none', custom: '' },
};

interface AIQuestion {
  id: string;
  question: string;
  type: 'text' | 'choice' | 'number';
  options?: string[];
  placeholder?: string;
}

const EFFECT_TYPES = [
  // === ATTACCO ===
  { id: 'damage', label: 'Danno', description: 'Infligge danni a carte nemiche', icon: '⚔️', category: 'attacco' },
  { id: 'damage_all', label: 'Danno a Tutti', description: 'Infligge danni a tutti i personaggi in campo', icon: '💥', category: 'attacco' },
  { id: 'damage_random', label: 'Danno Casuale', description: 'Infligge danni a un bersaglio casuale', icon: '🎲', category: 'attacco' },
  { id: 'execute', label: 'Esecuzione', description: 'Elimina istantaneamente se PTI sotto soglia', icon: '⚡', category: 'attacco' },
  { id: 'pierce', label: 'Penetrazione', description: 'Ignora scudi e protezioni', icon: '🗡️', category: 'attacco' },
  { id: 'critical', label: 'Colpo Critico', description: 'Possibilità di infliggere danni doppi', icon: '💢', category: 'attacco' },
  { id: 'weaken', label: 'Indebolimento', description: 'Riduce le statistiche nemiche', icon: '📉', category: 'attacco' },
  { id: 'lifesteal', label: 'Furto Vita', description: 'I danni inflitti curano il proprietario', icon: '🧛', category: 'attacco' },
  { id: 'drain', label: 'Assorbimento', description: 'Ruba PTI o stelle agli avversari', icon: '🌀', category: 'attacco' },
  { id: 'poison', label: 'Veleno', description: 'Infligge danni ogni turno', icon: '☠️', category: 'attacco' },
  { id: 'burn', label: 'Bruciatura', description: 'Brucia la carta per danni nel tempo', icon: '🔥', category: 'attacco' },
  { id: 'bleed', label: 'Sanguinamento', description: 'Causa perdita di PTI continua', icon: '🩸', category: 'attacco' },
  { id: 'curse', label: 'Maledizione', description: 'Applica effetto negativo persistente', icon: '🔮', category: 'attacco' },
  { id: 'explosion', label: 'Esplosione', description: 'Danni ad area a più bersagli', icon: '💣', category: 'attacco' },
  
  // === DIFESA ===
  { id: 'protection', label: 'Protezione', description: 'La carta non può essere attaccata', icon: '🛡️', category: 'difesa' },
  { id: 'immunity', label: 'Immunità', description: 'Immune a certi tipi di effetti', icon: '🔒', category: 'difesa' },
  { id: 'shield', label: 'Scudo', description: 'Assorbe una certa quantità di danni', icon: '🔰', category: 'difesa' },
  { id: 'barrier', label: 'Barriera', description: 'Blocca il primo attacco completamente', icon: '🧱', category: 'difesa' },
  { id: 'delay_defense', label: 'Ritarda Danno', description: 'Quando attaccato, ritarda il danno di X turni su di te', icon: '⏳', category: 'difesa' },
  { id: 'counter', label: 'Contrattacco', description: 'Infligge danni quando viene attaccato', icon: '↩️', category: 'difesa' },
  { id: 'reflect', label: 'Rifletti Danno', description: 'Restituisce parte del danno ricevuto', icon: '🪞', category: 'difesa' },
  { id: 'dodge', label: 'Schivata', description: 'Possibilità di evitare attacchi', icon: '💨', category: 'difesa' },
  { id: 'armor', label: 'Armatura', description: 'Riduce tutti i danni ricevuti', icon: '🦾', category: 'difesa' },
  { id: 'regeneration', label: 'Rigenerazione', description: 'Recupera PTI ogni turno', icon: '💗', category: 'difesa' },
  { id: 'taunt', label: 'Provocazione', description: 'I nemici devono attaccare questa carta', icon: '😤', category: 'difesa' },
  { id: 'stealth', label: 'Invisibilità', description: 'Non può essere bersagliato', icon: '👻', category: 'difesa' },
  
  // === SUPPORTO ===
  { id: 'heal', label: 'Cura', description: 'Ripristina PTI', icon: '💚', category: 'supporto' },
  { id: 'heal_all', label: 'Cura di Gruppo', description: 'Cura tutti gli alleati', icon: '💖', category: 'supporto' },
  { id: 'powerup', label: 'Potenziamento', description: 'Aumenta temporaneamente le statistiche', icon: '📈', category: 'supporto' },
  { id: 'buff', label: 'Buff', description: 'Migliora le statistiche di un alleato', icon: '⬆️', category: 'supporto' },
  { id: 'cleanse', label: 'Purificazione', description: 'Rimuove effetti negativi', icon: '✨', category: 'supporto' },
  { id: 'bless', label: 'Benedizione', description: 'Conferisce bonus temporanei', icon: '🙏', category: 'supporto' },
  { id: 'inspire', label: 'Ispirazione', description: 'Potenzia carte alleate vicine', icon: '🎺', category: 'supporto' },
  { id: 'aura', label: 'Aura', description: 'Effetto che si applica a carte alleate vicine', icon: '✴️', category: 'supporto' },
  { id: 'revive_boost', label: 'Rinascita Potenziata', description: 'Resuscita con PTI extra', icon: '🌟', category: 'supporto' },
  
  // === CONTROLLO ===
  { id: 'freeze', label: 'Congelamento', description: 'La carta non può agire per X turni', icon: '❄️', category: 'controllo' },
  { id: 'stun', label: 'Stordimento', description: 'La carta salta il prossimo turno', icon: '💫', category: 'controllo' },
  { id: 'silence', label: 'Silenzio', description: 'Disabilita gli effetti di una carta', icon: '🤐', category: 'controllo' },
  { id: 'sleep', label: 'Sonno', description: 'La carta non può agire finché non viene colpita', icon: '😴', category: 'controllo' },
  { id: 'confuse', label: 'Confusione', description: 'La carta può colpire alleati', icon: '😵', category: 'controllo' },
  { id: 'fear', label: 'Paura', description: 'La carta non può attaccare', icon: '😨', category: 'controllo' },
  { id: 'charm', label: 'Charme', description: 'Controlla temporaneamente una carta nemica', icon: '💕', category: 'controllo' },
  { id: 'skip', label: 'Salta Turno', description: 'Fa saltare il turno all\'avversario', icon: '⏭️', category: 'controllo' },
  { id: 'extra_turn', label: 'Turno Extra', description: 'Ottieni un turno aggiuntivo', icon: '🔄', category: 'controllo' },
  { id: 'nullify', label: 'Nullifica', description: 'Annulla l\'effetto di una carta nemica', icon: '🚫', category: 'controllo' },
  { id: 'banish', label: 'Esilio', description: 'Rimuove temporaneamente una carta dal gioco', icon: '🌀', category: 'controllo' },
  { id: 'slow', label: 'Rallentamento', description: 'Riduce la velocità di azione', icon: '🐌', category: 'controllo' },
  { id: 'lock', label: 'Blocco', description: 'Impedisce l\'uso di abilità', icon: '🔐', category: 'controllo' },
  
  // === CARTE ===
  { id: 'draw', label: 'Pesca', description: 'Fa pescare carte', icon: '🎴', category: 'carte' },
  { id: 'draw_specific', label: 'Pesca Specifica', description: 'Pesca un tipo specifico di carta', icon: '🎯', category: 'carte' },
  { id: 'discard', label: 'Scarta', description: 'Fa scartare carte agli avversari', icon: '🗑️', category: 'carte' },
  { id: 'steal', label: 'Ruba Carta', description: 'Ruba una carta dalla mano avversaria', icon: '🤏', category: 'carte' },
  { id: 'reveal', label: 'Rivela', description: 'Mostra le carte in mano dell\'avversario', icon: '👁️', category: 'carte' },
  { id: 'shuffle', label: 'Mescola', description: 'Rimescola carte nel mazzo', icon: '🔀', category: 'carte' },
  { id: 'search', label: 'Cerca', description: 'Cerca una carta specifica nel mazzo', icon: '🔍', category: 'carte' },
  { id: 'return_hand', label: 'Ritorno in Mano', description: 'Riporta una carta dal campo alla mano', icon: '✋', category: 'carte' },
  { id: 'return_deck', label: 'Ritorno nel Mazzo', description: 'Riporta una carta nel mazzo', icon: '📚', category: 'carte' },
  { id: 'mill', label: 'Milling', description: 'Fa scartare carte dal mazzo al cimitero', icon: '⚙️', category: 'carte' },
  
  // === RISORSE ===
  { id: 'stars', label: 'Modifica Stelle', description: 'Aggiunge o rimuove stelle', icon: '⭐', category: 'risorse' },
  { id: 'pti', label: 'Modifica PTI', description: 'Aumenta o diminuisce i PTI', icon: '💪', category: 'risorse' },
  { id: 'energy', label: 'Energia', description: 'Genera o consuma energia', icon: '⚡', category: 'risorse' },
  { id: 'mana', label: 'Mana', description: 'Genera o consuma mana', icon: '🔵', category: 'risorse' },
  { id: 'gold', label: 'Oro', description: 'Guadagna o spendi oro', icon: '🪙', category: 'risorse' },
  { id: 'exp', label: 'Esperienza', description: 'Guadagna punti esperienza', icon: '📊', category: 'risorse' },
  
  // === SPECIALE ===
  { id: 'copy', label: 'Copia Effetto', description: 'Copia l\'effetto di un\'altra carta', icon: '📋', category: 'speciale' },
  { id: 'resurrect', label: 'Resuscita', description: 'Riporta una carta dal cimitero', icon: '👼', category: 'speciale' },
  { id: 'resurrect_choice', label: 'Resuscita a Scelta', description: 'Scegli quale carta riportare dal cimitero', icon: '🪦', category: 'speciale' },
  { id: 'swap', label: 'Scambio', description: 'Scambia carte o statistiche', icon: '🔀', category: 'speciale' },
  { id: 'transform', label: 'Trasformazione', description: 'Trasforma una carta in un\'altra', icon: '🦋', category: 'speciale' },
  { id: 'clone', label: 'Clone', description: 'Crea una copia di una carta', icon: '👯', category: 'speciale' },
  { id: 'sacrifice', label: 'Sacrificio', description: 'Sacrifica PTI o carte per un effetto', icon: '💀', category: 'speciale' },
  { id: 'summon', label: 'Evocazione', description: 'Evoca una carta aggiuntiva', icon: '✨', category: 'speciale' },
  { id: 'double', label: 'Raddoppia', description: 'Raddoppia danni, cure o effetti', icon: '✖️', category: 'speciale' },
  { id: 'triple', label: 'Triplica', description: 'Triplica danni, cure o effetti', icon: '3️⃣', category: 'speciale' },
  { id: 'revenge', label: 'Vendetta', description: 'Effetto si attiva quando la carta muore', icon: '👊', category: 'speciale' },
  { id: 'chain', label: 'Concatenazione', description: 'Attiva un effetto su più bersagli in sequenza', icon: '⛓️', category: 'speciale' },
  { id: 'combo', label: 'Combo', description: 'Effetto potenziato se combinato con altre carte', icon: '🎰', category: 'speciale' },
  { id: 'random_effect', label: 'Effetto Casuale', description: 'Applica un effetto casuale', icon: '🎲', category: 'speciale' },
  { id: 'conditional', label: 'Condizionale', description: 'Effetto si attiva solo se condizione è vera', icon: '❓', category: 'speciale' },
  { id: 'triggered', label: 'Innescato', description: 'Si attiva quando succede qualcosa', icon: '🎯', category: 'speciale' },
  { id: 'passive', label: 'Passivo', description: 'Effetto sempre attivo', icon: '♾️', category: 'speciale' },
  { id: 'fusion', label: 'Fusione', description: 'Combina due carte in una più potente', icon: '🔗', category: 'speciale' },
  { id: 'split', label: 'Divisione', description: 'Divide una carta in più carte', icon: '✂️', category: 'speciale' },
  { id: 'teleport', label: 'Teletrasporto', description: 'Sposta una carta in una posizione diversa', icon: '🌀', category: 'speciale' },
  { id: 'time_travel', label: 'Viaggio nel Tempo', description: 'Riporta il gioco a uno stato precedente', icon: '⏰', category: 'speciale' },
  { id: 'baratto', label: 'Baratto', description: 'Scambia tutte le carte (campo e mano) con un avversario', icon: '🔄', category: 'speciale' },
  { id: 'ciclone', label: 'Ciclone', description: 'Le carte in campo ruotano al giocatore successivo', icon: '🌪️', category: 'speciale' },
  { id: 'cimitero_vuoto', label: 'Cimitero Vuoto', description: 'Chi ha meno carte nel cimitero raddoppia i PTI', icon: '⚰️', category: 'speciale' },
  { id: 'comunismo', label: 'Comunismo', description: 'Tutti i personaggi hanno la media dei PTI e stelle', icon: '☭', category: 'speciale' },
  { id: 'conversione_danno', label: 'Conversione Danno', description: 'Recupera PTI pari all\'ultimo danno subito', icon: '🔄', category: 'supporto' },
  { id: 'corruzione', label: 'Corruzione', description: 'Dai PTI a un avversario, non può attaccarti per N turni', icon: '💰', category: 'controllo' },
  { id: 'deminkiatore', label: 'Deminkiatore', description: 'Dimezza i danni del prossimo attacco ricevuto', icon: '🛡️', category: 'difesa' },
  { id: 'transform_weakest', label: 'Trasforma in Debole', description: 'Trasforma un nemico nel personaggio più debole', icon: '🦋', category: 'attacco' },
  { id: 'avvoltoio', label: 'Avvoltoio', description: 'Guadagna i PTI dell\'ultimo personaggio morto', icon: '🦅', category: 'speciale' },
  { id: 'return_on_death', label: 'Ritorno alla Morte', description: 'Quando muore, torna in mano invece del cimitero', icon: '🔄', category: 'difesa' },
  { id: 'dittatura', label: 'Dittatura', description: 'Personaggi con meno di X PTI non possono essere giocati', icon: '👑', category: 'controllo' },
  { id: 'asta', label: 'Asta', description: 'Asta tra i giocatori per un personaggio dal mazzo usando punti Rankiard', icon: '🔨', category: 'speciale' },
  
  // === MODIFICHE STATISTICHE ===
  { id: 'halve_pti', label: 'Dimezza PTI', description: 'Dimezza i PTI del bersaglio', icon: '➗', category: 'risorse' },
  { id: 'halve_stars', label: 'Dimezza Stelle', description: 'Dimezza le stelle del bersaglio', icon: '⭐➗', category: 'risorse' },
  { id: 'double_pti', label: 'Raddoppia PTI', description: 'Raddoppia i PTI del bersaglio', icon: '💪✖️', category: 'risorse' },
  { id: 'double_stars', label: 'Raddoppia Stelle', description: 'Raddoppia le stelle del bersaglio', icon: '⭐✖️', category: 'risorse' },
  { id: 'add_half_pti', label: 'Aggiungi Metà PTI', description: 'Aggiunge la metà dei PTI attuali', icon: '💪➕', category: 'risorse' },
  { id: 'add_half_stars', label: 'Aggiungi Metà Stelle', description: 'Aggiunge la metà delle stelle attuali', icon: '⭐➕', category: 'risorse' },
  { id: 'zero_stars', label: 'Azzera Stelle', description: 'Porta le stelle a 0', icon: '⭐0️⃣', category: 'risorse' },
  { id: 'absorb_pti', label: 'Assorbi PTI', description: 'Assorbe PTI da un avversario e li aggiunge a te', icon: '🧲', category: 'attacco' },
  
  // === CONTROLLO AVANZATO ===
  { id: 'control_turn', label: 'Controlla Turno', description: 'Controlla un avversario al suo prossimo turno', icon: '🎮👤', category: 'controllo' },
  { id: 'send_to_deck', label: 'Manda nel Mazzo', description: 'Rimanda una carta nel mazzo', icon: '📥', category: 'carte' },
  { id: 'reflect_attack', label: 'Respingi Attacco', description: 'Respinge un attacco al mittente', icon: '🔄⚔️', category: 'difesa' },
  
  // === ALTRO ===
  { id: 'weather', label: 'Meteo', description: 'Cambia le condizioni del campo', icon: '🌦️', category: 'altro' },
  { id: 'terrain', label: 'Terreno', description: 'Modifica il terreno di gioco', icon: '🏔️', category: 'altro' },
  { id: 'trap', label: 'Trappola', description: 'Si attiva quando un nemico fa un\'azione', icon: '🪤', category: 'altro' },
  { id: 'counter_spell', label: 'Contromagia', description: 'Annulla la prossima mossa nemica', icon: '🛑', category: 'altro' },
  { id: 'gamble', label: 'Scommessa', description: 'Effetto casuale con rischio/ricompensa', icon: '🎰', category: 'altro' },
  { id: 'mimic', label: 'Mimetismo', description: 'Copia le statistiche di un\'altra carta', icon: '🎭', category: 'altro' },
  { id: 'custom', label: 'Personalizzato', description: 'Descrivi tu l\'effetto liberamente', icon: '🖊️', category: 'altro' },
];

const EFFECT_CATEGORIES = [
  { id: 'all', label: 'Tutti', icon: '📋' },
  { id: 'attacco', label: 'Attacco', icon: '⚔️' },
  { id: 'difesa', label: 'Difesa', icon: '🛡️' },
  { id: 'supporto', label: 'Supporto', icon: '💚' },
  { id: 'controllo', label: 'Controllo', icon: '🎮' },
  { id: 'carte', label: 'Carte', icon: '🎴' },
  { id: 'risorse', label: 'Risorse', icon: '⭐' },
  { id: 'speciale', label: 'Speciale', icon: '✨' },
  { id: 'altro', label: 'Altro', icon: '🖊️' },
];

const TARGET_OPTIONS = [
  { id: 'self', label: 'Se stesso', description: 'Questa carta' },
  { id: 'owner', label: 'Proprietario', description: 'Il giocatore che possiede la carta' },
  { id: 'opponents', label: 'Avversari', description: 'Tutti i giocatori avversari' },
  { id: 'all', label: 'Tutti', description: 'Tutti i giocatori incluso il proprietario' },
  { id: 'random', label: 'Casuale', description: 'Un bersaglio casuale' },
  { id: 'choice', label: 'Personaggi a scelta', description: 'Scegli i personaggi bersaglio durante la partita' },
];

const DURATION_OPTIONS = [
  { id: 'instant', label: 'Istantaneo', description: 'Si attiva una volta quando la carta viene giocata' },
  { id: 'permanent', label: 'Permanente', description: 'Rimane attivo finché la carta è in campo' },
  { id: 'turns', label: 'A tempo', description: 'Dura un certo numero di turni' },
];

function generateEffectDescription(wizard: EffectWizardState): string {
  if (wizard.effectType === 'custom') {
    let customDesc = wizard.customDescription;
    
    if (wizard.animationDescription) {
      customDesc += ` [ANIMAZIONE: ${wizard.animationDescription}]`;
    }
    
    if (wizard.behaviorDescription) {
      customDesc += ` [COMPORTAMENTO: ${wizard.behaviorDescription}]`;
    }
    
    if (wizard.aiAnswers && Object.keys(wizard.aiAnswers).length > 0) {
      const answers = Object.entries(wizard.aiAnswers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
      customDesc += ` [DETTAGLI: ${answers}]`;
    }
    
    return customDesc;
  }

  let description = '';
  const value = wizard.value ? parseInt(wizard.value) : 0;
  const value2 = wizard.value2 ? parseInt(wizard.value2) : 0;
  const getTargetText = (t: string) => {
    switch (t) {
      case 'opponents': return 'agli avversari';
      case 'all': return 'a tutti';
      case 'random': return 'a un bersaglio casuale';
      case 'self': return '';
      case 'owner': return 'al proprietario';
      case 'enemy_card': return 'a una carta nemica';
      case 'ally_card': return 'a una carta alleata';
      case 'choice': return 'ai personaggi scelti';
      default: return '';
    }
  };

  switch (wizard.effectType) {
    // === ATTACCO ===
    case 'damage':
      description = `Infligge ${value || 100} danni ${getTargetText(wizard.target)}`.trim();
      break;
    case 'damage_all':
      description = `Infligge ${value || 100} danni a tutti i personaggi in campo`;
      break;
    case 'damage_random':
      description = `Infligge ${value || 100} danni a un bersaglio casuale`;
      break;
    case 'execute':
      description = `Esecuzione: elimina istantaneamente se i PTI sono sotto ${value || 300}`;
      break;
    case 'pierce':
      description = `Penetrazione: infligge ${value || 100} danni ignorando scudi e protezioni`;
      break;
    case 'critical':
      description = `Colpo Critico: ${value || 50}% di possibilità di infliggere danni doppi`;
      break;
    case 'weaken':
      description = `Indebolisce: -${value || 100} PTI ${getTargetText(wizard.target)}`;
      break;
    case 'lifesteal':
      description = `Furto Vita: infligge ${value || 100} danni e cura questa carta dello stesso ammontare`;
      break;
    case 'drain':
      description = `Assorbe ${value || 100} ${wizard.target === 'stars' ? 'stelle' : 'PTI'} da un avversario`;
      break;
    case 'poison':
      description = `Avvelena: infligge ${value || 50} danni ogni turno per ${value2 || 3} turni`;
      break;
    case 'burn':
      description = `Brucia: infligge ${value || 30} danni ogni turno finché non viene curato`;
      break;
    case 'bleed':
      description = `Sanguinamento: infligge ${value || 40} danni ogni turno per ${value2 || 3} turni`;
      break;
    case 'curse':
      description = `Maledizione: applica effetto negativo per ${value || 3} turni`;
      break;
    case 'explosion':
      description = `Esplosione: infligge ${value || 150} danni a tutti i nemici nell'area`;
      break;
    
    // === DIFESA ===
    case 'protection':
      description = 'Non può essere attaccato';
      if (wizard.duration === 'turns' && wizard.value) {
        description += ` per ${wizard.value} turni`;
      }
      break;
    case 'immunity':
      description = `Immune a effetti negativi per ${value || 2} turni`;
      break;
    case 'shield':
      description = `Scudo: assorbe i prossimi ${value || 200} danni`;
      break;
    case 'barrier':
      description = `Barriera: blocca completamente il primo attacco ricevuto`;
      break;
    case 'delay_defense':
      description = `Ritarda il danno di ${value || 3} turni su di te quando vieni attaccato`;
      break;
    case 'counter':
      description = `Contrattacco: quando viene attaccato, infligge ${value || 50} danni all'attaccante`;
      break;
    case 'reflect':
      description = `Riflette il ${value || 50}% dei danni ricevuti all'attaccante`;
      break;
    case 'dodge':
      description = `Schivata: ${value || 30}% di possibilità di evitare gli attacchi`;
      break;
    case 'armor':
      description = `Armatura: riduce tutti i danni ricevuti di ${value || 50}`;
      break;
    case 'regeneration':
      description = `Rigenerazione: recupera ${value || 50} PTI ogni turno`;
      break;
    case 'taunt':
      description = `Provocazione: i nemici devono attaccare questa carta`;
      break;
    case 'stealth':
      description = `Invisibilità: non può essere bersagliato per ${value || 2} turni`;
      break;
    
    // === SUPPORTO ===
    case 'heal':
      description = `Cura ${value || 100} PTI ${getTargetText(wizard.target)}`.trim();
      break;
    case 'heal_all':
      description = `Cura ${value || 100} PTI a tutti gli alleati`;
      break;
    case 'powerup':
      description = `Potenziamento: +${value || 100} PTI per ${wizard.duration === 'turns' ? `${value2 || 2} turni` : 'permanentemente'}`;
      break;
    case 'buff':
      description = `Buff: +${value || 100} PTI a una carta alleata`;
      break;
    case 'cleanse':
      description = `Purificazione: rimuove tutti gli effetti negativi`;
      break;
    case 'bless':
      description = `Benedizione: conferisce +${value || 50} PTI e immunità per 1 turno`;
      break;
    case 'inspire':
      description = `Ispirazione: tutte le carte alleate guadagnano +${value || 30} PTI`;
      break;
    case 'aura':
      description = `Aura: tutte le carte alleate guadagnano +${value || 50} PTI`;
      break;
    case 'revive_boost':
      description = `Rinascita Potenziata: resuscita con +${value || 200} PTI extra`;
      break;
    
    // === CONTROLLO ===
    case 'freeze':
      description = `Congela una carta nemica: non può agire per ${value || 2} turni`;
      break;
    case 'stun':
      description = `Stordisce una carta nemica: salta il prossimo turno`;
      break;
    case 'silence':
      description = `Silenzio: disabilita gli effetti di una carta nemica per ${value || 2} turni`;
      break;
    case 'sleep':
      description = `Sonno: la carta nemica non può agire finché non viene colpita`;
      break;
    case 'confuse':
      description = `Confusione: la carta nemica può colpire i propri alleati per ${value || 2} turni`;
      break;
    case 'fear':
      description = `Paura: la carta nemica non può attaccare per ${value || 2} turni`;
      break;
    case 'charm':
      description = `Charme: controlla temporaneamente una carta nemica per ${value || 1} turno`;
      break;
    case 'skip':
      description = `L'avversario salta il prossimo turno`;
      break;
    case 'extra_turn':
      description = `Ottieni un turno extra dopo questo`;
      break;
    case 'nullify':
      description = `Nullifica l'effetto della prossima carta nemica`;
      break;
    case 'banish':
      description = `Esilio: rimuove una carta dal gioco per ${value || 2} turni`;
      break;
    case 'slow':
      description = `Rallentamento: riduce la velocità di azione del nemico`;
      break;
    case 'lock':
      description = `Blocco: impedisce l'uso di abilità per ${value || 2} turni`;
      break;
    
    // === CARTE ===
    case 'draw':
      description = `Pesca ${value || 1} carte`;
      break;
    case 'draw_specific':
      description = `Pesca ${value || 1} carta di tipo specifico dal mazzo`;
      break;
    case 'discard':
      description = `Gli avversari scartano ${value || 1} carte`;
      break;
    case 'steal':
      description = `Ruba ${value || 1} carta casuale dalla mano di un avversario`;
      break;
    case 'reveal':
      description = `Rivela le carte in mano dell'avversario`;
      break;
    case 'shuffle':
      description = `Rimescola ${value || 1} carte nel mazzo`;
      break;
    case 'search':
      description = `Cerca una carta specifica nel mazzo e aggiungila alla mano`;
      break;
    case 'return_hand':
      description = `Riporta ${value || 1} carta dal campo alla mano`;
      break;
    case 'return_deck':
      description = `Riporta ${value || 1} carta nel mazzo`;
      break;
    case 'mill':
      description = `L'avversario scarta ${value || 3} carte dal mazzo al cimitero`;
      break;
    
    // === RISORSE ===
    case 'stars':
      if (value >= 0) {
        description = `Guadagna ${value || 1} stelle`;
      } else {
        description = `Rimuove ${Math.abs(value)} stelle agli avversari`;
      }
      break;
    case 'pti':
      if (value >= 0) {
        description = `Aumenta i PTI di ${value || 100}`;
      } else {
        description = `Diminuisce i PTI di ${Math.abs(value)}`;
      }
      break;
    case 'energy':
      description = `Genera ${value || 1} energia`;
      break;
    case 'mana':
      description = `Genera ${value || 1} mana`;
      break;
    case 'gold':
      description = `Guadagna ${value || 100} oro`;
      break;
    case 'exp':
      description = `Guadagna ${value || 50} punti esperienza`;
      break;
    
    // === SPECIALE ===
    case 'copy':
      description = `Copia l'effetto dell'ultima carta giocata`;
      break;
    case 'resurrect':
      description = `Riporta una carta casuale dal cimitero`;
      break;
    case 'resurrect_choice':
      description = `Scegli quale carta riportare dal cimitero`;
      break;
    case 'swap':
      description = `Scambia ${wizard.target === 'pti' ? 'i PTI' : wizard.target === 'stars' ? 'le stelle' : 'le carte in mano'} con un avversario`;
      break;
    case 'transform':
      description = `Trasforma una carta nemica in una carta casuale più debole`;
      break;
    case 'clone':
      description = `Crea una copia di questa carta`;
      break;
    case 'sacrifice':
      description = `Sacrifica ${value || 100} PTI per ${value2 > 0 ? `infliggere ${value2} danni a tutti i nemici` : 'pescare 2 carte'}`;
      break;
    case 'summon':
      description = `Evoca una carta personaggio casuale dal mazzo`;
      break;
    case 'double':
      description = `Raddoppia ${wizard.target === 'damage' ? 'i danni del prossimo attacco' : wizard.target === 'heal' ? 'la prossima cura' : 'l\'effetto della prossima carta giocata'}`;
      break;
    case 'triple':
      description = `Triplica ${wizard.target === 'damage' ? 'i danni del prossimo attacco' : wizard.target === 'heal' ? 'la prossima cura' : 'l\'effetto della prossima carta giocata'}`;
      break;
    case 'revenge':
      description = `Vendetta: quando muore, infligge ${value || 200} danni all'uccisore`;
      break;
    case 'chain':
      description = `Concatenazione: l'effetto colpisce ${value || 3} bersagli in sequenza`;
      break;
    case 'combo':
      description = `Combo: effetto potenziato del ${value || 50}% se combinato con altre carte`;
      break;
    case 'random_effect':
      description = `Applica un effetto casuale`;
      break;
    case 'conditional':
      description = wizard.condition ? `Se ${wizard.condition}: attiva l'effetto` : `Effetto condizionale`;
      break;
    case 'triggered':
      description = wizard.condition ? `Quando ${wizard.condition}: attiva l'effetto` : `Effetto innescato`;
      break;
    case 'passive':
      description = `Effetto passivo sempre attivo`;
      break;
    case 'fusion':
      description = `Fusione: combina con un'altra carta per creare una carta più potente`;
      break;
    case 'split':
      description = `Divisione: divide questa carta in ${value || 2} carte più deboli`;
      break;
    case 'teleport':
      description = `Teletrasporto: sposta una carta in una posizione diversa`;
      break;
    case 'time_travel':
      description = `Viaggio nel Tempo: riporta il gioco a ${value || 1} turni fa`;
      break;
    case 'baratto':
      description = `Baratto: scambia tutte le carte (campo e mano) con un avversario`;
      break;
    case 'ciclone':
      description = `Ciclone: le carte in campo ruotano al giocatore successivo`;
      break;
    case 'cimitero_vuoto':
      description = `Cimitero Vuoto: chi ha meno carte nel cimitero raddoppia i PTI dei propri personaggi`;
      break;
    case 'comunismo':
      description = `Comunismo: tutti i personaggi in campo hanno la media dei PTI e delle stelle`;
      break;
    case 'conversione_danno':
      description = `Conversione: recupera PTI pari all'ultimo danno subito`;
      break;
    case 'corruzione':
      description = `Corruzione: dai ${value || 50} PTI a un avversario, che non può attaccarti per ${value2 || 3} turni`;
      break;
    case 'deminkiatore':
      description = `Deminkiatore: dimezza i danni del prossimo attacco ricevuto`;
      break;
    case 'transform_weakest':
      description = `Trasforma un personaggio nemico nel personaggio più debole (50 PTI, 1 stella)`;
      break;
    case 'avvoltoio':
      description = `Avvoltoio: guadagna i PTI dell'ultimo personaggio morto nel cimitero`;
      break;
    case 'return_on_death':
      description = `Quando muore, torna in mano invece del cimitero`;
      break;
    case 'dittatura':
      description = `Dittatura: i personaggi con meno di ${value || 100} PTI non possono essere giocati per ${value2 || 5} turni`;
      break;
    case 'asta':
      description = `Asta: parte un'asta tra i partecipanti per un personaggio dal mazzo. I soldi utilizzati sono i punti Rankiard`;
      break;
    
    // === MODIFICHE STATISTICHE ===
    case 'halve_pti':
      description = `Dimezza i PTI ${getTargetText(wizard.target)}`.trim();
      break;
    case 'halve_stars':
      description = `Dimezza le stelle ${getTargetText(wizard.target)}`.trim();
      break;
    case 'double_pti':
      description = `Raddoppia i PTI ${getTargetText(wizard.target)}`.trim();
      break;
    case 'double_stars':
      description = `Raddoppia le stelle ${getTargetText(wizard.target)}`.trim();
      break;
    case 'add_half_pti':
      description = `Aggiunge la metà dei PTI attuali ${getTargetText(wizard.target)}`.trim();
      break;
    case 'add_half_stars':
      description = `Aggiunge la metà delle stelle attuali ${getTargetText(wizard.target)}`.trim();
      break;
    case 'zero_stars':
      description = `Porta le stelle a 0 ${getTargetText(wizard.target)}`.trim();
      break;
    case 'absorb_pti':
      description = `Assorbe ${value || 100} PTI da un avversario e li aggiunge a te`;
      break;
    
    // === CONTROLLO AVANZATO ===
    case 'control_turn':
      description = `Controlla un avversario quando sarà il suo turno`;
      break;
    case 'send_to_deck':
      description = `Manda una carta ${wizard.target === 'enemy_card' ? 'nemica' : 'alleata'} nel mazzo`;
      break;
    case 'reflect_attack':
      description = `Respinge l'attacco ricevuto al mittente`;
      break;
    
    // === ALTRO ===
    case 'weather':
      description = `Meteo: cambia le condizioni del campo per ${value || 3} turni`;
      break;
    case 'terrain':
      description = `Terreno: modifica il terreno di gioco`;
      break;
    case 'trap':
      description = `Trappola: si attiva quando un nemico ${wizard.condition || 'attacca'}`;
      break;
    case 'counter_spell':
      description = `Contromagia: annulla la prossima mossa nemica`;
      break;
    case 'gamble':
      description = `Scommessa: 50% possibilità di guadagnare o perdere ${value || 100} PTI`;
      break;
    case 'mimic':
      description = `Mimetismo: copia le statistiche di un'altra carta`;
      break;
  }

  if (wizard.condition) {
    description += `. Condizione: ${wizard.condition}`;
  }
  
  if (wizard.animationDescription) {
    description += ` [ANIMAZIONE: ${wizard.animationDescription}]`;
  }
  
  if (wizard.behaviorDescription) {
    description += ` [COMPORTAMENTO: ${wizard.behaviorDescription}]`;
  }
  
  if (wizard.aiAnswers && Object.keys(wizard.aiAnswers).length > 0) {
    const answers = Object.entries(wizard.aiAnswers)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
    description += ` [DETTAGLI: ${answers}]`;
  }

  // Add target info when "Personaggi a scelta" is selected
  if (wizard.target === 'choice') {
    description += ` [BERSAGLIO: scelta]`;
  }

  // Add dice system info if enabled
  if (wizard.diceEnabled) {
    const getDiceEffectLabel = (effectId: string, custom: string) => {
      if (effectId === 'custom' && custom) return custom;
      const effect = DICE_EFFECTS.find(e => e.id === effectId);
      return effect?.label || 'Nessun effetto';
    };
    
    if (wizard.diceMode === 'auto') {
      // Automatic dice - describe consequences for each number
      const autoEffects = [1, 2, 3, 4, 5, 6]
        .map(num => `${num}: ${getDiceEffectLabel(wizard.diceAutoEffects[num as 1|2|3|4|5|6].effect, wizard.diceAutoEffects[num as 1|2|3|4|5|6].custom)}`)
        .join('; ');
      description += ` [DADO_AUTOMATICO: ${autoEffects}]`;
    } else {
      // Choice-based dice
      description += ` [DADO: Se indovina: ${getDiceEffectLabel(wizard.diceCorrectEffect, wizard.diceCorrectCustom)}; Se sbaglia: ${getDiceEffectLabel(wizard.diceWrongEffect, wizard.diceWrongCustom)}]`;
    }
  }

  // Add conditional usage rules
  if (wizard.requiresCharacter && wizard.requiredCharacterName.trim()) {
    description += ` [RICHIEDE_PERSONAGGIO: ${wizard.requiredCharacterName.trim()}]`;
  }
  
  if (wizard.targetRestriction !== 'none' && wizard.targetCharacterName.trim()) {
    if (wizard.targetRestriction === 'only') {
      description += ` [SOLO_SU: ${wizard.targetCharacterName.trim()}]`;
    } else if (wizard.targetRestriction === 'except') {
      description += ` [NON_SU: ${wizard.targetCharacterName.trim()}]`;
    }
  }
  
  if (wizard.fieldCondition !== 'none' && wizard.fieldCardName.trim()) {
    if (wizard.fieldCondition === 'requires') {
      description += ` [RICHIEDE_IN_CAMPO: ${wizard.fieldCardName.trim()}]`;
    } else if (wizard.fieldCondition === 'blocked') {
      description += ` [BLOCCATA_SE_IN_CAMPO: ${wizard.fieldCardName.trim()}]`;
    }
  }

  return description;
}

interface AddCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type DeckType = 'personaggi' | 'mosse' | 'bonus' | 'personaggi_speciali';

// Character override for MOSSE cards - specific damage/effects when used by or on specific characters
interface MosseCharacterOverride {
  characterId: string;
  characterName: string;
  usedBy?: { damageValue: number | null; effect: string | null };
  usedOn?: { damageValue: number | null; effect: string | null };
}

interface UploadedCardData {
  file: File;
  name: string;
  pti: number | null;
  stars: number | null;
  effect: string;
  audioUrl: string;
  attackLowAudioUrl: string;
  attackHighAudioUrl: string;
  youtubeUrl: string;
  isPermanent: boolean;
  mosseDamageValue: number | null;
  mosseDamageEffect: string | null;
  mosseCharacterOverrides: MosseCharacterOverride[];
  mosseRestrictedFrom: string[];
  mosseRestrictedAgainst: string[];
  mosseTargetingMode: string | null;
  mosseTargetCount: number | null;
  mosseCanCounter: boolean;
  mosseCanBeCountered: boolean;
}

interface PermanentCard {
  id: number;
  name: string;
  deckType: string;
  imageData: string;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  attackLowAudioUrl: string | null;
  attackHighAudioUrl: string | null;
  youtubeUrl: string | null;
  mosseDamageValue: number | null;
  mosseDamageEffect: string | null;
  mosseCharacterOverrides: MosseCharacterOverride[] | null;
  mosseRestrictedFrom: string[] | null;
  mosseRestrictedAgainst: string[] | null;
  mosseTargetingMode: string | null;
  mosseTargetCount: number | null;
  mosseCanCounter: boolean | null;
  mosseCanBeCountered: boolean | null;
  createdBy: string | null;
  createdAt: string;
}

interface ExistingCard {
  id: string;
  deckType: string;
  originalName: string;
  originalImageUrl: string;
  name: string | null;
  imageUrl: string | null;
  pti: number | null;
  stars: number | null;
  effect: string | null;
  audioUrl: string | null;
  attackLowAudioUrl: string | null;
  attackHighAudioUrl: string | null;
  youtubeUrl: string | null;
  mosseDamageValue: number | null;
  mosseDamageEffect: string | null;
  mosseCharacterOverrides: MosseCharacterOverride[] | null;
  mosseRestrictedFrom: string[] | null;
  mosseRestrictedAgainst: string[] | null;
  mosseTargetingMode: string | null;
  mosseTargetCount: number | null;
  mosseCanCounter: boolean | null;
  mosseCanBeCountered: boolean | null;
  evolvesInto: string | null;
  evolutionVariants: { [key: string]: string } | null;
  transformsInto: string | null;
  transformsFrom: string | null;
  cheatsInto: string | null;
  specialCategory: string | null;
  evolvedMoves: any | null;
  superAttacco: any | null;
  isDeleted: boolean;
  isModified: boolean;
  draftCost: number | null;
}

export const AddCardsModal: React.FC<AddCardsModalProps> = ({ isOpen, onClose }) => {
  const [selectedDeck, setSelectedDeck] = useState<DeckType>('personaggi');
  const [uploadedCards, setUploadedCards] = useState<UploadedCardData[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [permanentCards, setPermanentCards] = useState<PermanentCard[]>([]);
  const [loadingPermanent, setLoadingPermanent] = useState(false);
  const [editingCard, setEditingCard] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ 
    name: '', pti: '', stars: '', effect: '', audioUrl: '', attackLowAudioUrl: '', attackHighAudioUrl: '', youtubeUrl: '', 
    mosseDamageValue: '', mosseDamageEffect: '',
    mosseCharacterOverrides: [] as MosseCharacterOverride[],
    mosseRestrictedFrom: [] as string[],
    mosseRestrictedAgainst: [] as string[],
    mosseTargetingMode: '',
    mosseTargetCount: '',
    mosseCanCounter: false,
    mosseCanBeCountered: false
  });
  const [activeTab, setActiveTab] = useState<'add' | 'manage' | 'existing'>('add');
  const { gameId, playerName } = useGameState();
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [existingCards, setExistingCards] = useState<ExistingCard[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [editingExistingCard, setEditingExistingCard] = useState<string | null>(null);
  const [existingEditForm, setExistingEditForm] = useState({ 
    name: '', imageUrl: '', pti: '', stars: '', effect: '', audioUrl: '', attackLowAudioUrl: '', attackHighAudioUrl: '', youtubeUrl: '', 
    mosseDamageValue: '', mosseDamageEffect: '',
    mosseCharacterOverrides: [] as MosseCharacterOverride[],
    mosseRestrictedFrom: [] as string[],
    mosseRestrictedAgainst: [] as string[],
    mosseTargetingMode: '',
    mosseTargetCount: '',
    mosseCanCounter: false,
    mosseCanBeCountered: false,
    evolvesInto: '',
    evolutionVariants: null as { [key: string]: string } | null,
    transformsInto: '',
    transformsFrom: '',
    cheatsInto: '',
    specialCategory: '',
    evolvedMoves: { range1: { name: '', damage: '' }, range2: { name: '', damage: '' } },
    superAttacco: { name: '', damage: '' },
    draftCost: '0'
  });
  const [pendingChanges, setPendingChanges] = useState<Map<string, {card: ExistingCard, formData: typeof existingEditForm}>>(new Map());
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Available characters for MOSSE character-specific settings
  const [availableCharacters, setAvailableCharacters] = useState<{id: string, name: string, imageUrl: string}[]>([]);
  const [allCharacterCards, setAllCharacterCards] = useState<{cardId: string, name: string, deckType: string}[]>([]);
  
  const [isApplyingWizard, setIsApplyingWizard] = useState(false);

  // Effect Wizard state
  const [showEffectWizard, setShowEffectWizard] = useState(false);
  const [effectWizardTarget, setEffectWizardTarget] = useState<'new' | 'permanent' | 'existing'>('new');
  const [effectWizardCardIndex, setEffectWizardCardIndex] = useState<number | null>(null);
  const [savedEffects, setSavedEffects] = useState<string[]>([]); // Array di effetti già aggiunti
  const [effectWizard, setEffectWizard] = useState<EffectWizardState>({
    step: 1,
    effectType: '',
    target: 'self',
    value: '',
    value2: '',
    duration: 'instant',
    condition: '',
    customDescription: '',
    categoryFilter: 'all',
    effectSearchQuery: '',
    animationDescription: '',
    behaviorDescription: '',
    aiQuestions: [],
    aiAnswers: {},
    isAnalyzing: false,
    analysisComplete: false,
    aiInterpretation: '',
    needsMoreInfo: false,
    diceEnabled: false,
    diceMode: 'choice',
    diceCorrectEffect: 'none',
    diceCorrectCustom: '',
    diceWrongEffect: 'none',
    diceWrongCustom: '',
    diceAutoEffects: { ...DEFAULT_DICE_AUTO_EFFECTS },
    requiresCharacter: false,
    requiredCharacterName: '',
    targetRestriction: 'none',
    targetCharacterName: '',
    fieldCondition: 'none',
    fieldCardName: ''
  });

  const resetEffectWizard = () => {
    setEffectWizard({
      step: 1,
      effectType: '',
      target: 'self',
      value: '',
      value2: '',
      duration: 'instant',
      condition: '',
      customDescription: '',
      categoryFilter: 'all',
      effectSearchQuery: '',
      animationDescription: '',
      behaviorDescription: '',
      aiQuestions: [],
      aiAnswers: {},
      isAnalyzing: false,
      analysisComplete: false,
      aiInterpretation: '',
      needsMoreInfo: false,
      diceEnabled: false,
      diceMode: 'choice',
      diceCorrectEffect: 'none',
      diceCorrectCustom: '',
      diceWrongEffect: 'none',
      diceWrongCustom: '',
      diceAutoEffects: { ...DEFAULT_DICE_AUTO_EFFECTS },
      requiresCharacter: false,
      requiredCharacterName: '',
      targetRestriction: 'none',
      targetCharacterName: '',
      fieldCondition: 'none',
      fieldCardName: ''
    });
  };

  const openEffectWizard = (target: 'new' | 'permanent' | 'existing', cardIndex: number | null) => {
    resetEffectWizard();
    setSavedEffects([]); // Reset saved effects when opening wizard
    setEffectWizardTarget(target);
    setEffectWizardCardIndex(cardIndex);
    setShowEffectWizard(true);
  };

  // Add current effect to the list and reset wizard for next effect
  const addEffectToList = () => {
    const effectDescription = generateEffectDescription(effectWizard);
    if (effectDescription.trim()) {
      setSavedEffects(prev => [...prev, effectDescription]);
    }
    resetEffectWizard();
  };

  // Remove an effect from the list
  const removeEffectFromList = (index: number) => {
    setSavedEffects(prev => prev.filter((_, i) => i !== index));
  };

  // Apply all saved effects (combined) to the card, and auto-configure structured MOSSE fields
  const applyEffectFromWizard = async () => {
    const currentEffect = generateEffectDescription(effectWizard);
    const allEffects = currentEffect.trim() 
      ? [...savedEffects, currentEffect]
      : savedEffects;
    
    const combinedEffect = allEffects.join(' | ');

    // Determine if the target card is a MOSSE so we can auto-configure structured fields
    let isMosseCard = false;
    if (effectWizardTarget === 'existing' && editingExistingCard) {
      const card = existingCards.find(c => c.id === editingExistingCard);
      isMosseCard = card?.deckType === 'mosse';
    } else if (effectWizardTarget === 'new' && effectWizardCardIndex !== null) {
      isMosseCard = (cards[effectWizardCardIndex] as any)?.deckType === 'mosse';
    }

    // Parse structured fields via AI for MOSSE cards
    let structuredFields: {
      mosseDamageValue: number | null;
      mosseDamageEffect: string | null;
      mosseTargetingMode: string | null;
      mosseTargetCount: number | null;
      mosseCanCounter: boolean;
      mosseCanBeCountered: boolean;
    } | null = null;

    if (isMosseCard && combinedEffect.trim()) {
      setIsApplyingWizard(true);
      try {
        const response = await fetch('/api/parse-mosse-structured-fields', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ effectText: combinedEffect, deckType: 'mosse' })
        });
        const data = await response.json();
        if (data.success && data.fields) {
          structuredFields = data.fields;
          console.log('🧠 Structured MOSSE fields from AI:', structuredFields, 'Reason:', data.reasoning);
        }
      } catch (err) {
        console.error('Failed to parse MOSSE structured fields:', err);
      } finally {
        setIsApplyingWizard(false);
      }
    }
    
    if (effectWizardTarget === 'new' && effectWizardCardIndex !== null) {
      updateCardData(effectWizardCardIndex, 'effect', combinedEffect);
      if (structuredFields) {
        if (structuredFields.mosseDamageValue !== null) updateCardData(effectWizardCardIndex, 'mosseDamageValue', String(structuredFields.mosseDamageValue));
        if (structuredFields.mosseDamageEffect) updateCardData(effectWizardCardIndex, 'mosseDamageEffect', structuredFields.mosseDamageEffect);
        if (structuredFields.mosseTargetingMode) updateCardData(effectWizardCardIndex, 'mosseTargetingMode', structuredFields.mosseTargetingMode);
        if (structuredFields.mosseTargetCount !== null) updateCardData(effectWizardCardIndex, 'mosseTargetCount', String(structuredFields.mosseTargetCount));
        updateCardData(effectWizardCardIndex, 'mosseCanCounter', structuredFields.mosseCanCounter);
        updateCardData(effectWizardCardIndex, 'mosseCanBeCountered', structuredFields.mosseCanBeCountered);
      }
    } else if (effectWizardTarget === 'permanent') {
      setEditForm(prev => ({
        ...prev,
        effect: combinedEffect,
        ...(structuredFields ? {
          mosseDamageValue: structuredFields.mosseDamageValue !== null ? String(structuredFields.mosseDamageValue) : prev.mosseDamageValue,
          mosseDamageEffect: structuredFields.mosseDamageEffect || prev.mosseDamageEffect,
          mosseTargetingMode: structuredFields.mosseTargetingMode || prev.mosseTargetingMode,
          mosseTargetCount: structuredFields.mosseTargetCount !== null ? String(structuredFields.mosseTargetCount) : prev.mosseTargetCount,
          mosseCanCounter: structuredFields.mosseCanCounter,
          mosseCanBeCountered: structuredFields.mosseCanBeCountered
        } : {})
      }));
    } else if (effectWizardTarget === 'existing') {
      setExistingEditForm(prev => {
        const updatedForm = {
          ...prev,
          effect: combinedEffect,
          ...(structuredFields ? {
            mosseDamageValue: structuredFields.mosseDamageValue !== null ? String(structuredFields.mosseDamageValue) : prev.mosseDamageValue,
            mosseDamageEffect: structuredFields.mosseDamageEffect || prev.mosseDamageEffect,
            mosseTargetingMode: structuredFields.mosseTargetingMode || prev.mosseTargetingMode,
            mosseTargetCount: structuredFields.mosseTargetCount !== null ? String(structuredFields.mosseTargetCount) : prev.mosseTargetCount,
            mosseCanCounter: structuredFields.mosseCanCounter,
            mosseCanBeCountered: structuredFields.mosseCanBeCountered
          } : {})
        };
        
        if (editingExistingCard) {
          const currentCard = existingCards.find(c => c.id === editingExistingCard);
          if (currentCard) {
            setPendingChanges(prevChanges => {
              const newMap = new Map(prevChanges);
              newMap.set(editingExistingCard, { card: currentCard, formData: updatedForm });
              return newMap;
            });
          }
        }
        
        return updatedForm;
      });
    }
    
    setShowEffectWizard(false);
    resetEffectWizard();
  };

  const getStepCount = () => {
    const noValueEffects = ['protection', 'copy', 'extra_turn', 'nullify', 'summon', 'resurrect', 'asta'];
    const noTargetEffects = ['protection', 'custom', 'copy', 'extra_turn', 'skip', 'nullify', 'summon', 'resurrect', 'revenge', 'asta'];
    
    if (effectWizard.effectType === 'custom') {
      return effectWizard.aiQuestions.length > 0 ? 4 : 3;
    }
    if (noValueEffects.includes(effectWizard.effectType)) {
      return noTargetEffects.includes(effectWizard.effectType) ? 2 : 3;
    }
    return noTargetEffects.includes(effectWizard.effectType) ? 3 : 4;
  };

  const needsTarget = () => {
    const noTargetEffects = ['protection', 'custom', 'copy', 'extra_turn', 'skip', 'nullify', 'summon', 'resurrect', 'revenge', 'counter', 'reflect', 'shield', 'stun', 'lifesteal'];
    return !noTargetEffects.includes(effectWizard.effectType);
  };

  const needsValue = () => {
    const noValueEffects = ['copy', 'extra_turn', 'nullify', 'summon', 'resurrect', 'skip', 'stun', 'transform'];
    return !noValueEffects.includes(effectWizard.effectType);
  };

  const needsSecondValue = () => {
    return ['poison', 'powerup', 'sacrifice'].includes(effectWizard.effectType);
  };

  const canProceedToNextStep = () => {
    switch (effectWizard.step) {
      case 1: return effectWizard.effectType !== '';
      case 2: 
        if (effectWizard.effectType === 'custom') return effectWizard.customDescription.trim() !== '';
        if (!needsTarget()) return true;
        return effectWizard.target !== '';
      case 3:
        if (effectWizard.effectType === 'custom') {
          return effectWizard.analysisComplete || effectWizard.aiQuestions.length > 0;
        }
        return true;
      case 4:
        const allQuestionsAnswered = effectWizard.aiQuestions.every(q => 
          effectWizard.aiAnswers[q.id] && effectWizard.aiAnswers[q.id].trim() !== ''
        );
        return allQuestionsAnswered;
      default: return true;
    }
  };

  const analyzeEffectWithAI = async (includeAnswers: boolean = false) => {
    if (!effectWizard.customDescription.trim()) return;
    
    setEffectWizard(prev => ({ ...prev, isAnalyzing: true }));
    
    try {
      const response = await fetch('/api/analyze-effect', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          description: effectWizard.customDescription,
          animation: effectWizard.animationDescription,
          behavior: effectWizard.behaviorDescription,
          previousAnswers: includeAnswers ? effectWizard.aiAnswers : undefined
        })
      });
      
      if (!response.ok) throw new Error('Analysis failed');
      
      const data = await response.json();
      
      if (data.questions && data.questions.length > 0) {
        setEffectWizard(prev => ({
          ...prev,
          aiQuestions: data.questions,
          isAnalyzing: false,
          analysisComplete: false,
          aiInterpretation: data.interpretation || '',
          needsMoreInfo: data.needsMoreInfo ?? true
        }));
      } else {
        setEffectWizard(prev => ({
          ...prev,
          aiQuestions: [],
          isAnalyzing: false,
          analysisComplete: true,
          aiInterpretation: data.interpretation || '',
          needsMoreInfo: false
        }));
      }
    } catch (error) {
      console.error('Effect analysis error:', error);
      setEffectWizard(prev => ({
        ...prev,
        aiQuestions: [],
        isAnalyzing: false,
        analysisComplete: true,
        aiInterpretation: '',
        needsMoreInfo: false
      }));
    }
  };

  const handleAIAnswer = (questionId: string, answer: string) => {
    setEffectWizard(prev => ({
      ...prev,
      aiAnswers: { ...prev.aiAnswers, [questionId]: answer }
    }));
  };

  // Auto-trigger analysis when entering step 3 for custom effects
  useEffect(() => {
    if (effectWizard.step === 3 && 
        effectWizard.effectType === 'custom' && 
        !effectWizard.isAnalyzing && 
        !effectWizard.analysisComplete && 
        effectWizard.aiQuestions.length === 0 &&
        effectWizard.customDescription.trim()) {
      analyzeEffectWithAI();
    }
  }, [effectWizard.step, effectWizard.effectType]);

  const isCharacterDeck = selectedDeck === 'personaggi' || selectedDeck === 'personaggi_speciali';
  const authToken = localStorage.getItem('authToken') || '';

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`
  });

  useEffect(() => {
    const checkAdmin = async () => {
      if (!authToken) {
        setIsAdmin(false);
        return;
      }
      try {
        const res = await fetch('/api/admin/check', {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const data = await res.json();
        setIsAdmin(data.isAdmin);
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      }
    };
    
    if (isOpen) {
      checkAdmin();
    }
  }, [isOpen, authToken]);

  const fetchPermanentCards = async () => {
    setLoadingPermanent(true);
    try {
      const response = await fetch('/api/custom-cards');
      const data = await response.json();
      if (data.success) {
        setPermanentCards(data.cards);
      }
    } catch (error) {
      console.error('Error fetching permanent cards:', error);
    } finally {
      setLoadingPermanent(false);
    }
  };

  const fetchExistingCards = async () => {
    if (!isAdmin || !authToken) return;
    setLoadingExisting(true);
    try {
      const response = await fetch(`/api/admin/existing-cards?deckType=${selectedDeck}`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await response.json();
      if (data.success) {
        setExistingCards(data.cards);
      }
    } catch (error) {
      console.error('Error fetching existing cards:', error);
    } finally {
      setLoadingExisting(false);
    }
  };

  // Fetch available characters for MOSSE character-specific settings
  const fetchAvailableCharacters = async () => {
    try {
      const res = await fetch('/api/characters');
      const data = await res.json();
      
      if (data.success && data.characters) {
        setAvailableCharacters(data.characters.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name
        })));
      }
    } catch (error) {
      console.error('Error fetching available characters:', error);
    }
  };

  const fetchAllCharacterCards = async () => {
    try {
      const [persRes, specRes] = await Promise.all([
        fetch(`/api/admin/existing-cards?deckType=personaggi`, { headers: getAuthHeaders() }),
        fetch(`/api/admin/existing-cards?deckType=personaggi_speciali`, { headers: getAuthHeaders() })
      ]);
      const [persData, specData] = await Promise.all([persRes.json(), specRes.json()]);
      const cards: {cardId: string, name: string, deckType: string}[] = [];
      if (persData.success) {
        persData.cards.filter((c: any) => !c.isDeleted).forEach((c: any) => {
          cards.push({ cardId: c.id, name: c.name || c.originalName, deckType: 'personaggi' });
        });
      }
      if (specData.success) {
        specData.cards.filter((c: any) => !c.isDeleted).forEach((c: any) => {
          cards.push({ cardId: c.id, name: c.name || c.originalName, deckType: 'personaggi_speciali' });
        });
      }
      cards.sort((a, b) => a.name.localeCompare(b.name));
      setAllCharacterCards(cards);
    } catch (error) {
      console.error('Error fetching character cards:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPermanentCards();
      fetchAvailableCharacters();
      fetchAllCharacterCards();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isAdmin && activeTab === 'existing') {
      fetchExistingCards();
    }
  }, [isOpen, isAdmin, activeTab, selectedDeck]);

  useEffect(() => {
    const handleCardsAdded = () => {
      setUploadedCards([]);
      setIsUploading(false);
      fetchPermanentCards();
      onClose();
    };

    socket.on('cards-added', handleCardsAdded);
    return () => { socket.off('cards-added', handleCardsAdded); };
  }, [onClose]);

  if (!isOpen) return null;

  const deckOptions = [
    { value: 'personaggi', label: 'PERSONAGGI', color: 'bg-blue-600' },
    { value: 'mosse', label: 'MOSSE', color: 'bg-red-600' },
    { value: 'bonus', label: 'BONUS', color: 'bg-black' },
    { value: 'personaggi_speciali', label: 'PERSONAGGI SPECIALI', color: 'bg-yellow-500' }
  ];

  const getDeckLabel = (deckType: string) => {
    const option = deckOptions.find(d => d.value === deckType);
    return option?.label || deckType.toUpperCase();
  };

  const getDeckColor = (deckType: string) => {
    const option = deckOptions.find(d => d.value === deckType);
    return option?.color || 'bg-gray-600';
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    const newCards: UploadedCardData[] = imageFiles.map(file => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ""),
      pti: null,
      stars: null,
      effect: '',
      audioUrl: '',
      attackLowAudioUrl: '',
      attackHighAudioUrl: '',
      youtubeUrl: '',
      isPermanent: false,
      mosseDamageValue: null,
      mosseDamageEffect: null,
      mosseCharacterOverrides: [],
      mosseRestrictedFrom: [],
      mosseRestrictedAgainst: [],
      mosseTargetingMode: null,
      mosseTargetCount: null,
      mosseCanCounter: false,
      mosseCanBeCountered: false
    }));
    
    setUploadedCards(prev => [...prev, ...newCards]);
  };

  const removeCard = (index: number) => {
    setUploadedCards(prev => prev.filter((_, i) => i !== index));
  };

  const updateCardData = (index: number, field: keyof UploadedCardData, value: any) => {
    setUploadedCards(prev => prev.map((card, i) => 
      i === index ? { ...card, [field]: value } : card
    ));
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error(`Immagine troppo grande: ${file.name}. Limite 5MB.`));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleAddCards = async () => {
    if (uploadedCards.length === 0) {
      alert('Seleziona almeno un\'immagine!');
      return;
    }

    const missingNames = uploadedCards.some(card => !card.name.trim());
    if (missingNames) {
      alert('Inserisci il nome per tutte le carte!');
      return;
    }

    setIsUploading(true);
    
    try {
      const cardsData = await Promise.all(
        uploadedCards.map(async (card) => {
          const base64 = await convertToBase64(card.file);
          return {
            name: card.name.trim(),
            data: base64,
            pti: isCharacterDeck ? card.pti : null,
            stars: isCharacterDeck ? card.stars : null,
            effect: card.effect.trim() || null,
            audioUrl: card.audioUrl.trim() || null,
            attackLowAudioUrl: card.attackLowAudioUrl?.trim() || null,
            attackHighAudioUrl: card.attackHighAudioUrl?.trim() || null,
            youtubeUrl: card.youtubeUrl.trim() || null,
            isPermanent: card.isPermanent,
            mosseDamageValue: selectedDeck === 'mosse' ? card.mosseDamageValue : null,
            mosseDamageEffect: selectedDeck === 'mosse' ? card.mosseDamageEffect : null,
            mosseCharacterOverrides: selectedDeck === 'mosse' ? card.mosseCharacterOverrides : null,
            mosseRestrictedFrom: selectedDeck === 'mosse' ? card.mosseRestrictedFrom : null,
            mosseRestrictedAgainst: selectedDeck === 'mosse' ? card.mosseRestrictedAgainst : null,
            mosseTargetingMode: selectedDeck === 'mosse' ? card.mosseTargetingMode : null,
            mosseTargetCount: selectedDeck === 'mosse' ? card.mosseTargetCount : null,
            mosseCanCounter: selectedDeck === 'mosse' ? card.mosseCanCounter : false,
            mosseCanBeCountered: selectedDeck === 'mosse' ? card.mosseCanBeCountered : false
          };
        })
      );

      socket.emit('add-custom-cards', {
        gameId,
        playerName,
        deckType: selectedDeck,
        cards: cardsData
      });
    } catch (error) {
      console.error('Error uploading images:', error);
      alert('Errore durante il caricamento delle immagini');
      setIsUploading(false);
    }
  };

  const setAllPermanent = (permanent: boolean) => {
    setUploadedCards(prev => prev.map(card => ({ ...card, isPermanent: permanent })));
  };

  const handleEditCard = (card: PermanentCard) => {
    setEditingCard(card.id);
    setEditForm({
      name: card.name,
      pti: card.pti?.toString() || '',
      stars: card.stars?.toString() || '',
      effect: card.effect || '',
      audioUrl: card.audioUrl || '',
      attackLowAudioUrl: card.attackLowAudioUrl || '',
      attackHighAudioUrl: card.attackHighAudioUrl || '',
      youtubeUrl: card.youtubeUrl || '',
      mosseDamageValue: card.mosseDamageValue?.toString() || '',
      mosseDamageEffect: card.mosseDamageEffect || '',
      mosseCharacterOverrides: card.mosseCharacterOverrides || [],
      mosseRestrictedFrom: card.mosseRestrictedFrom || [],
      mosseRestrictedAgainst: card.mosseRestrictedAgainst || [],
      mosseTargetingMode: card.mosseTargetingMode || '',
      mosseTargetCount: card.mosseTargetCount?.toString() || '',
      mosseCanCounter: card.mosseCanCounter || false,
      mosseCanBeCountered: card.mosseCanBeCountered || false
    });
  };

  const handleSaveEdit = async (cardId: number) => {
    try {
      const response = await fetch(`/api/custom-cards/${cardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          pti: editForm.pti ? parseInt(editForm.pti) : null,
          stars: editForm.stars ? parseInt(editForm.stars) : null,
          effect: editForm.effect || null,
          audioUrl: editForm.audioUrl || null,
          attackLowAudioUrl: editForm.attackLowAudioUrl || null,
          attackHighAudioUrl: editForm.attackHighAudioUrl || null,
          youtubeUrl: editForm.youtubeUrl || null,
          mosseDamageValue: editForm.mosseDamageValue ? parseInt(editForm.mosseDamageValue) : null,
          mosseDamageEffect: editForm.mosseDamageEffect || null,
          mosseCharacterOverrides: editForm.mosseCharacterOverrides.length > 0 ? editForm.mosseCharacterOverrides : null,
          mosseRestrictedFrom: editForm.mosseRestrictedFrom.length > 0 ? editForm.mosseRestrictedFrom : null,
          mosseRestrictedAgainst: editForm.mosseRestrictedAgainst.length > 0 ? editForm.mosseRestrictedAgainst : null,
          mosseTargetingMode: editForm.mosseTargetingMode || null,
          mosseTargetCount: editForm.mosseTargetCount ? parseInt(editForm.mosseTargetCount) : null,
          mosseCanCounter: editForm.mosseCanCounter || false,
          mosseCanBeCountered: editForm.mosseCanBeCountered || false
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchPermanentCards();
        setEditingCard(null);
      } else {
        alert('Errore durante il salvataggio');
      }
    } catch (error) {
      console.error('Error updating card:', error);
      alert('Errore durante il salvataggio');
    }
  };

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa carta permanente?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/custom-cards/${cardId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchPermanentCards();
      } else {
        alert('Errore durante l\'eliminazione');
      }
    } catch (error) {
      console.error('Error deleting card:', error);
      alert('Errore durante l\'eliminazione');
    }
  };

  const handleEditExistingCard = (card: ExistingCard) => {
    if (editingExistingCard) {
      const currentCard = existingCards.find(c => c.id === editingExistingCard);
      if (currentCard) {
        setPendingChanges(prev => {
          const newMap = new Map(prev);
          newMap.set(editingExistingCard, { card: currentCard, formData: { ...existingEditForm } });
          return newMap;
        });
      }
    }
    
    const pending = pendingChanges.get(card.id);
    if (pending) {
      setExistingEditForm(pending.formData);
    } else {
      setExistingEditForm({
        name: card.name || '',
        imageUrl: card.imageUrl || '',
        pti: card.pti?.toString() || '',
        stars: card.stars?.toString() || '',
        effect: card.effect || '',
        audioUrl: card.audioUrl || '',
        attackLowAudioUrl: card.attackLowAudioUrl || '',
        attackHighAudioUrl: card.attackHighAudioUrl || '',
        youtubeUrl: card.youtubeUrl || '',
        mosseDamageValue: card.mosseDamageValue?.toString() || '',
        mosseDamageEffect: card.mosseDamageEffect || '',
        mosseCharacterOverrides: card.mosseCharacterOverrides || [],
        mosseRestrictedFrom: card.mosseRestrictedFrom || [],
        mosseRestrictedAgainst: card.mosseRestrictedAgainst || [],
        mosseTargetingMode: card.mosseTargetingMode || '',
        mosseTargetCount: card.mosseTargetCount?.toString() || '',
        mosseCanCounter: card.mosseCanCounter || false,
        mosseCanBeCountered: card.mosseCanBeCountered || false,
        evolvesInto: card.evolvesInto || '',
        evolutionVariants: card.evolutionVariants || null,
        transformsInto: card.transformsInto || '',
        transformsFrom: card.transformsFrom || '',
        cheatsInto: card.cheatsInto || '',
        specialCategory: card.specialCategory || '',
        evolvedMoves: card.evolvedMoves || { range1: { name: '', damage: '' }, range2: { name: '', damage: '' } },
        superAttacco: card.superAttacco || { name: '', damage: '' },
        draftCost: (card.draftCost ?? 0).toString()
      });
    }
    setEditingExistingCard(card.id);
  };

  const handleSaveExistingEdit = async (card: ExistingCard) => {
    setPendingChanges(prev => {
      const newMap = new Map(prev);
      newMap.set(card.id, { card, formData: { ...existingEditForm } });
      return newMap;
    });
    setEditingExistingCard(null);
  };

  const handleBulkSave = async () => {
    let allChanges = new Map(pendingChanges);
    
    if (editingExistingCard) {
      const currentCard = existingCards.find(c => c.id === editingExistingCard);
      if (currentCard) {
        allChanges.set(editingExistingCard, { card: currentCard, formData: { ...existingEditForm } });
      }
      setEditingExistingCard(null);
    }
    
    setPendingChanges(allChanges);
    
    if (allChanges.size === 0) return;
    
    setIsBulkSaving(true);
    try {
      const modifications = Array.from(allChanges.values()).map(({ card, formData }) => ({
        originalCardId: card.id,
        deckType: card.deckType,
        name: formData.name || null,
        imageUrl: formData.imageUrl || null,
        pti: formData.pti || null,
        stars: formData.stars || null,
        effect: formData.effect || null,
        audioUrl: formData.audioUrl || null,
        attackLowAudioUrl: formData.attackLowAudioUrl || null,
        attackHighAudioUrl: formData.attackHighAudioUrl || null,
        youtubeUrl: formData.youtubeUrl || null,
        mosseDamageValue: formData.mosseDamageValue ? parseInt(formData.mosseDamageValue) : null,
        mosseDamageEffect: formData.mosseDamageEffect || null,
        mosseCharacterOverrides: formData.mosseCharacterOverrides.length > 0 ? formData.mosseCharacterOverrides : null,
        mosseRestrictedFrom: formData.mosseRestrictedFrom.length > 0 ? formData.mosseRestrictedFrom : null,
        mosseRestrictedAgainst: formData.mosseRestrictedAgainst.length > 0 ? formData.mosseRestrictedAgainst : null,
        mosseTargetingMode: formData.mosseTargetingMode || null,
        mosseTargetCount: formData.mosseTargetCount ? parseInt(formData.mosseTargetCount) : null,
        mosseCanCounter: formData.mosseCanCounter || false,
        mosseCanBeCountered: formData.mosseCanBeCountered || false,
        evolvesInto: formData.evolvesInto || null,
        evolutionVariants: formData.evolutionVariants || null,
        transformsInto: formData.transformsInto || null,
        transformsFrom: formData.transformsFrom || null,
        cheatsInto: formData.cheatsInto || null,
        specialCategory: formData.specialCategory || null,
        evolvedMoves: (formData.evolvedMoves?.range1?.name || formData.evolvedMoves?.range1?.damage || formData.evolvedMoves?.range2?.name || formData.evolvedMoves?.range2?.damage) ? formData.evolvedMoves : null,
        superAttacco: (formData.superAttacco?.name || formData.superAttacco?.damage) ? formData.superAttacco : null,
        draftCost: formData.draftCost ? parseInt(formData.draftCost) : 0
      }));
      
      const response = await fetch('/api/admin/card-modifications-bulk', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ modifications })
      });
      
      const data = await response.json();
      if (data.success) {
        setPendingChanges(new Map());
        await fetchExistingCards();
        alert(`${data.count} carte salvate con successo!`);
      } else {
        alert('Errore durante il salvataggio: ' + (data.error || 'errore sconosciuto'));
      }
    } catch (error) {
      console.error('Error bulk saving:', error);
      alert('Errore durante il salvataggio in batch');
    } finally {
      setIsBulkSaving(false);
    }
  };

  const handleToggleDeleteExisting = async (card: ExistingCard) => {
    const newDeletedState = !card.isDeleted;
    const confirmMsg = newDeletedState 
      ? `Vuoi eliminare "${card.name || card.originalName}" dal gioco? La carta non apparira piu nelle partite.`
      : `Vuoi ripristinare "${card.name || card.originalName}"? La carta tornera disponibile nelle partite.`;
    
    if (!confirm(confirmMsg)) return;

    try {
      const response = await fetch('/api/admin/card-delete', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          originalCardId: card.id,
          deckType: card.deckType,
          isDeleted: newDeletedState
        })
      });
      
      const data = await response.json();
      if (data.success) {
        await fetchExistingCards();
        alert(newDeletedState ? 'Carta eliminata!' : 'Carta ripristinata!');
      } else {
        alert('Errore durante l\'operazione');
      }
    } catch (error) {
      console.error('Error toggling card deletion:', error);
      alert('Errore durante l\'operazione');
    }
  };

  const filteredPermanentCards = permanentCards.filter(card => card.deckType === selectedDeck);
  
  const filteredExistingCards = existingCards.filter(card => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      card.originalName.toLowerCase().includes(query) ||
      (card.name && card.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-bold text-xl">GESTIONE CARTE</h3>
          {isAdmin && (
            <span className="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
              <Shield size={12} />
              ADMIN
            </span>
          )}
        </div>
        <Button
          onClick={onClose}
          className="bg-red-600 hover:bg-red-700 text-white p-2"
          size="sm"
        >
          <X size={16} />
        </Button>
      </div>

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <div className="w-56 bg-gray-800/60 border-r border-white/10 flex flex-col p-4 gap-6 overflow-y-auto flex-shrink-0">
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Mazzo</p>
            <div className="flex flex-col gap-2">
              {deckOptions.map((deck) => (
                <button
                  key={deck.value}
                  onClick={() => { setSelectedDeck(deck.value as DeckType); setUploadedCards([]); }}
                  className={`${deck.color} hover:opacity-90 text-white font-bold py-2 px-3 rounded-lg border-2 text-sm text-left transition-all ${
                    selectedDeck === deck.value ? 'border-yellow-400 ring-1 ring-yellow-400/40' : 'border-transparent opacity-70'
                  }`}
                >
                  {deck.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Sezione</p>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => setActiveTab('add')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                  activeTab === 'add' ? 'bg-green-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Plus size={15} />
                Aggiungi Carte
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                  activeTab === 'manage' ? 'bg-purple-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                <Pencil size={15} />
                Permanenti ({permanentCards.length})
              </button>
              {isAdmin && (
                <button
                  onClick={() => setActiveTab('existing')}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left w-full ${
                    activeTab === 'existing' ? 'bg-yellow-600 text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Shield size={15} />
                  Modifica Carte Gioco
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

        {activeTab === 'add' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h4 className="text-white font-semibold mb-3">Carica immagini:</h4>
              <div className="border-2 border-dashed border-gray-400 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="image-upload"
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload size={40} className="text-gray-400" />
                  <span className="text-white">
                    Clicca per selezionare immagini
                  </span>
                  <span className="text-gray-400 text-sm">
                    Formati supportati: JPG, PNG, GIF, WEBP
                  </span>
                </label>
              </div>
            </div>

            {uploadedCards.length > 0 && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white font-semibold">
                    Carte da aggiungere ({uploadedCards.length}):
                  </h4>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setAllPermanent(true)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1"
                      size="sm"
                    >
                      Tutte permanenti
                    </Button>
                    <Button
                      onClick={() => setAllPermanent(false)}
                      className="bg-orange-600 hover:bg-orange-700 text-white text-xs px-2 py-1"
                      size="sm"
                    >
                      Tutte temporanee
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-4 pr-2">
                  {uploadedCards.map((card, index) => (
                    <div key={index} className="bg-gray-700 rounded-lg p-4 relative">
                      <Button
                        onClick={() => removeCard(index)}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 h-6 w-6"
                        size="sm"
                      >
                        <X size={12} />
                      </Button>
                      
                      <div className="flex gap-3">
                        <img
                          src={URL.createObjectURL(card.file)}
                          alt={card.name}
                          className="w-16 h-24 object-cover rounded border-2 border-orange-500 flex-shrink-0"
                        />
                        
                        <div className="flex-1 space-y-2.5">
                          <div className="flex gap-2 items-end">
                            <div className="flex-1">
                              <label className="text-gray-400 text-xs mb-1 block">Nome carta *</label>
                              <Input
                                type="text"
                                value={card.name}
                                onChange={(e) => updateCardData(index, 'name', e.target.value)}
                                placeholder="Inserisci nome carta"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                          </div>
                          
                          {isCharacterDeck && (
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-gray-400 text-xs mb-1 block">PTI</label>
                                <Input
                                  type="number"
                                  value={card.pti ?? ''}
                                  onChange={(e) => updateCardData(index, 'pti', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="PTI"
                                  className="bg-gray-600 text-white border-gray-500"
                                />
                              </div>
                              <div>
                                <label className="text-gray-400 text-xs mb-1 block">Stelle</label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={card.stars ?? ''}
                                  onChange={(e) => updateCardData(index, 'stars', e.target.value ? parseInt(e.target.value) : null)}
                                  placeholder="Stelle (1-10)"
                                  className="bg-gray-600 text-white border-gray-500"
                                />
                              </div>
                            </div>
                          )}
                          
                          <div>
                            <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                              <Sparkles size={11} className="text-purple-400" />
                              Effetto (elaborato da AI)
                            </label>
                            <div className="flex gap-2">
                              <textarea
                                value={card.effect}
                                onChange={(e) => updateCardData(index, 'effect', e.target.value)}
                                placeholder="Descrivi l'effetto..."
                                className="flex-1 bg-gray-600 text-white border border-gray-500 rounded-md p-2 text-sm resize-none"
                                rows={2}
                              />
                              <Button
                                type="button"
                                onClick={() => openEffectWizard('new', index)}
                                className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 flex items-center gap-1 self-start"
                                title="Usa la procedura guidata"
                              >
                                <Wand2 size={14} />
                                <span className="text-xs">AI</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                <Volume2 size={11} className="text-cyan-400" />
                                Audio URL
                              </label>
                              <Input
                                type="text"
                                value={card.audioUrl}
                                onChange={(e) => updateCardData(index, 'audioUrl', e.target.value)}
                                placeholder="https://..."
                                className="bg-gray-600 text-white border-gray-500 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                                <Video size={11} className="text-red-400" />
                                YouTube URL
                              </label>
                              <Input
                                type="text"
                                value={card.youtubeUrl}
                                onChange={(e) => updateCardData(index, 'youtubeUrl', e.target.value)}
                                placeholder="https://youtu.be/..."
                                className="bg-gray-600 text-white border-gray-500 text-sm"
                              />
                            </div>
                          </div>
                          
                          {/* MOSSE Damage Settings - Only for MOSSE cards */}
                          {selectedDeck === 'mosse' && (
                            <div className="p-3 bg-red-900/30 rounded-lg border border-red-500/50">
                              <div className="text-red-400 text-sm font-bold mb-2 flex items-center gap-1">
                                ⚔️ DANNO MOSSA (opzionale)
                              </div>
                              <p className="text-gray-400 text-xs mb-3">
                                Imposta il danno che questa mossa infligge. Se impostato, il pannello di input danni verrà pre-compilato automaticamente.
                              </p>
                              
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-white text-xs mb-1 block">Danno PTI (numerico)</label>
                                  <Input
                                    type="number"
                                    value={card.mosseDamageValue || ''}
                                    onChange={(e) => updateCardData(index, 'mosseDamageValue', e.target.value ? parseInt(e.target.value) : null)}
                                    placeholder="Es: 100"
                                    className="bg-gray-600 text-white border-gray-500"
                                  />
                                  <p className="text-gray-500 text-xs mt-1">Sarà moltiplicato per le stelle dell'attaccante</p>
                                </div>
                                
                                <div>
                                  <label className="text-white text-xs mb-1 block">Effetto speciale</label>
                                  <select
                                    value={card.mosseDamageEffect || ''}
                                    onChange={(e) => updateCardData(index, 'mosseDamageEffect', e.target.value || null)}
                                    className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-sm"
                                  >
                                    <option value="">Nessun effetto</option>
                                    <option value="death">💀 Morte istantanea</option>
                                    <option value="halve_pti">➗ PTI dimezzati</option>
                                    <option value="zero_stars">⭐ Manda a 0 stelle</option>
                                    <option value="set_5_pti">5️⃣ Manda a 5 PTI</option>
                                    <option value="remove_1_star">⭐ Elimina 1 stella</option>
                                  </select>
                                </div>
                              </div>
                              
                              {/* Counter Attack Settings */}
                              <div className="mt-4 border-t border-red-500/30 pt-4">
                                <div className="text-cyan-400 text-sm font-bold mb-2 flex items-center gap-1">
                                  ↩️ SISTEMA RESPINTA
                                </div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Configura se questa mossa può essere usata per respingere attacchi o se può essere respinta.
                                </p>
                                
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`can-counter-${index}`}
                                      checked={card.mosseCanCounter || false}
                                      onCheckedChange={(checked) => updateCardData(index, 'mosseCanCounter', !!checked)}
                                    />
                                    <label htmlFor={`can-counter-${index}`} className="text-white text-sm cursor-pointer">
                                      Può respingere
                                    </label>
                                    <span className="text-gray-500 text-xs">(questa mossa può essere usata per respingere attacchi nemici)</span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`can-be-countered-${index}`}
                                      checked={card.mosseCanBeCountered || false}
                                      onCheckedChange={(checked) => updateCardData(index, 'mosseCanBeCountered', !!checked)}
                                    />
                                    <label htmlFor={`can-be-countered-${index}`} className="text-white text-sm cursor-pointer">
                                      Può essere respinta
                                    </label>
                                    <span className="text-gray-500 text-xs">(questa mossa può essere respinta da altre mosse nemiche)</span>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Character-Specific Damage Overrides */}
                              <div className="mt-4 border-t border-red-500/30 pt-4">
                                <div className="text-orange-400 text-sm font-bold mb-2 flex items-center gap-1">
                                  🎯 DANNO SPECIFICO PER PERSONAGGIO
                                </div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Imposta danni o effetti diversi quando questa mossa viene usata DA o SU specifici personaggi.
                                </p>
                                
                                {/* Overrides List */}
                                {card.mosseCharacterOverrides.map((override, overrideIdx) => (
                                  <div key={overrideIdx} className="bg-gray-800/50 p-3 rounded-lg mb-2">
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-white text-sm font-bold">{override.characterName}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newOverrides = [...card.mosseCharacterOverrides];
                                          newOverrides.splice(overrideIdx, 1);
                                          updateCardData(index, 'mosseCharacterOverrides', newOverrides);
                                        }}
                                        className="text-red-400 hover:text-red-300 text-xs"
                                      >
                                        Rimuovi
                                      </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="bg-blue-900/30 p-2 rounded">
                                        <p className="text-blue-400 text-xs font-bold mb-1">Quando usata DA questo:</p>
                                        <Input
                                          type="number"
                                          value={override.usedBy?.damageValue || ''}
                                          onChange={(e) => {
                                            const newOverrides = [...card.mosseCharacterOverrides];
                                            newOverrides[overrideIdx] = {
                                              ...newOverrides[overrideIdx],
                                              usedBy: {
                                                ...newOverrides[overrideIdx].usedBy,
                                                damageValue: e.target.value ? parseInt(e.target.value) : null,
                                                effect: newOverrides[overrideIdx].usedBy?.effect || null
                                              }
                                            };
                                            updateCardData(index, 'mosseCharacterOverrides', newOverrides);
                                          }}
                                          placeholder="Danno PTI"
                                          className="bg-gray-600 text-white border-gray-500 mb-1 text-xs h-8"
                                        />
                                        <select
                                          value={override.usedBy?.effect || ''}
                                          onChange={(e) => {
                                            const newOverrides = [...card.mosseCharacterOverrides];
                                            newOverrides[overrideIdx] = {
                                              ...newOverrides[overrideIdx],
                                              usedBy: {
                                                damageValue: newOverrides[overrideIdx].usedBy?.damageValue || null,
                                                effect: e.target.value || null
                                              }
                                            };
                                            updateCardData(index, 'mosseCharacterOverrides', newOverrides);
                                          }}
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-1 py-1 text-xs"
                                        >
                                          <option value="">Nessun effetto</option>
                                          <option value="death">Morte</option>
                                          <option value="halve_pti">PTI dimezzati</option>
                                          <option value="zero_stars">0 stelle</option>
                                          <option value="set_5_pti">5 PTI</option>
                                          <option value="remove_1_star">-1 stella</option>
                                        </select>
                                      </div>
                                      
                                      <div className="bg-purple-900/30 p-2 rounded">
                                        <p className="text-purple-400 text-xs font-bold mb-1">Quando usata SU questo:</p>
                                        <Input
                                          type="number"
                                          value={override.usedOn?.damageValue || ''}
                                          onChange={(e) => {
                                            const newOverrides = [...card.mosseCharacterOverrides];
                                            newOverrides[overrideIdx] = {
                                              ...newOverrides[overrideIdx],
                                              usedOn: {
                                                ...newOverrides[overrideIdx].usedOn,
                                                damageValue: e.target.value ? parseInt(e.target.value) : null,
                                                effect: newOverrides[overrideIdx].usedOn?.effect || null
                                              }
                                            };
                                            updateCardData(index, 'mosseCharacterOverrides', newOverrides);
                                          }}
                                          placeholder="Danno PTI"
                                          className="bg-gray-600 text-white border-gray-500 mb-1 text-xs h-8"
                                        />
                                        <select
                                          value={override.usedOn?.effect || ''}
                                          onChange={(e) => {
                                            const newOverrides = [...card.mosseCharacterOverrides];
                                            newOverrides[overrideIdx] = {
                                              ...newOverrides[overrideIdx],
                                              usedOn: {
                                                damageValue: newOverrides[overrideIdx].usedOn?.damageValue || null,
                                                effect: e.target.value || null
                                              }
                                            };
                                            updateCardData(index, 'mosseCharacterOverrides', newOverrides);
                                          }}
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-1 py-1 text-xs"
                                        >
                                          <option value="">Nessun effetto</option>
                                          <option value="death">Morte</option>
                                          <option value="halve_pti">PTI dimezzati</option>
                                          <option value="zero_stars">0 stelle</option>
                                          <option value="set_5_pti">5 PTI</option>
                                          <option value="remove_1_star">-1 stella</option>
                                        </select>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                
                                {/* Add new override */}
                                <select
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      const selectedChar = availableCharacters.find(c => c.id === e.target.value);
                                      if (selectedChar && !card.mosseCharacterOverrides.some(o => o.characterId === selectedChar.id)) {
                                        updateCardData(index, 'mosseCharacterOverrides', [
                                          ...card.mosseCharacterOverrides,
                                          { characterId: selectedChar.id, characterName: selectedChar.name }
                                        ]);
                                      }
                                    }
                                  }}
                                  className="w-full bg-gray-700 text-white border border-gray-500 rounded px-2 py-2 text-sm"
                                >
                                  <option value="">+ Aggiungi personaggio...</option>
                                  {availableCharacters
                                    .filter(c => !card.mosseCharacterOverrides.some(o => o.characterId === c.id))
                                    .map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))
                                  }
                                </select>
                              </div>
                              
                              {/* Targeting Mode */}
                              <div className="mt-4 border-t border-red-500/30 pt-4">
                                <div className="text-cyan-400 text-sm font-bold mb-2 flex items-center gap-1">
                                  🎯 TARGETING AUTOMATICO
                                </div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Scegli come questa mossa seleziona automaticamente i bersagli.
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Modalità</label>
                                    <select
                                      value={card.mosseTargetingMode || ''}
                                      onChange={(e) => updateCardData(index, 'mosseTargetingMode', e.target.value || null)}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-sm"
                                    >
                                      <option value="">Manuale (selezione giocatore)</option>
                                      <option value="single">🎯 Singolo avversario casuale</option>
                                      <option value="highest_pti">⬆️ Avversario con PTI più alti</option>
                                      <option value="all_enemies">👥 Tutti gli avversari</option>
                                      <option value="all_characters">🌍 Tutti i personaggi (incluso attaccante)</option>
                                      <option value="specific_count">🔢 Numero specifico di bersagli</option>
                                    </select>
                                  </div>
                                  
                                  {card.mosseTargetingMode === 'specific_count' && (
                                    <div>
                                      <label className="text-white text-xs mb-1 block">Numero bersagli</label>
                                      <Input
                                        type="number"
                                        min="1"
                                        value={card.mosseTargetCount || ''}
                                        onChange={(e) => updateCardData(index, 'mosseTargetCount', e.target.value ? parseInt(e.target.value) : null)}
                                        placeholder="es. 2"
                                        className="bg-gray-600 text-white border-gray-500"
                                      />
                                      <p className="text-gray-500 text-xs mt-1">Si applica anche se ci sono meno bersagli</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              {/* Move Restrictions */}
                              <div className="mt-4 border-t border-red-500/30 pt-4">
                                <div className="text-yellow-400 text-sm font-bold mb-2 flex items-center gap-1">
                                  🚫 RESTRIZIONI MOSSA
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Non può essere usata DA:</label>
                                    <div className="max-h-24 overflow-y-auto bg-gray-800/50 rounded p-2">
                                      {card.mosseRestrictedFrom.map((charName, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs text-white py-1">
                                          <span>{charName}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRestricted = [...card.mosseRestrictedFrom];
                                              newRestricted.splice(i, 1);
                                              updateCardData(index, 'mosseRestrictedFrom', newRestricted);
                                            }}
                                            className="text-red-400 hover:text-red-300"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value && !card.mosseRestrictedFrom.includes(e.target.value)) {
                                          updateCardData(index, 'mosseRestrictedFrom', [...card.mosseRestrictedFrom, e.target.value]);
                                        }
                                      }}
                                      className="w-full bg-gray-700 text-white border border-gray-500 rounded px-1 py-1 text-xs mt-1"
                                    >
                                      <option value="">+ Aggiungi...</option>
                                      {availableCharacters
                                        .filter(c => !card.mosseRestrictedFrom.includes(c.name))
                                        .map(c => (
                                          <option key={c.id} value={c.name}>{c.name}</option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                  
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Non può essere usata SU:</label>
                                    <div className="max-h-24 overflow-y-auto bg-gray-800/50 rounded p-2">
                                      {card.mosseRestrictedAgainst.map((charName, i) => (
                                        <div key={i} className="flex items-center justify-between text-xs text-white py-1">
                                          <span>{charName}</span>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const newRestricted = [...card.mosseRestrictedAgainst];
                                              newRestricted.splice(i, 1);
                                              updateCardData(index, 'mosseRestrictedAgainst', newRestricted);
                                            }}
                                            className="text-red-400 hover:text-red-300"
                                          >
                                            ×
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value && !card.mosseRestrictedAgainst.includes(e.target.value)) {
                                          updateCardData(index, 'mosseRestrictedAgainst', [...card.mosseRestrictedAgainst, e.target.value]);
                                        }
                                      }}
                                      className="w-full bg-gray-700 text-white border border-gray-500 rounded px-1 py-1 text-xs mt-1"
                                    >
                                      <option value="">+ Aggiungi...</option>
                                      {availableCharacters
                                        .filter(c => !card.mosseRestrictedAgainst.includes(c.name))
                                        .map(c => (
                                          <option key={c.id} value={c.name}>{c.name}</option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center gap-3">
                            <div 
                              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer transition-colors ${
                                card.isPermanent 
                                  ? 'bg-green-600/30 border border-green-500' 
                                  : 'bg-orange-600/30 border border-orange-500'
                              }`}
                              onClick={() => updateCardData(index, 'isPermanent', !card.isPermanent)}
                            >
                              <Checkbox 
                                checked={card.isPermanent}
                                onCheckedChange={(checked) => updateCardData(index, 'isPermanent', checked)}
                                className="border-white"
                              />
                              <span className="text-white text-sm">
                                {card.isPermanent ? 'Carta permanente' : 'Solo questa partita'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleAddCards}
                disabled={uploadedCards.length === 0 || isUploading}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 flex items-center justify-center gap-2"
              >
                <Plus size={20} />
                {isUploading ? 'CARICAMENTO...' : `AGGIUNGI ${uploadedCards.length} CARTE`}
              </Button>
              
              <Button
                onClick={onClose}
                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6"
              >
                ANNULLA
              </Button>
            </div>

            <div className="mt-4 text-gray-400 text-xs text-center space-y-1">
              <p><strong>Temporanea:</strong> La carta sara disponibile solo per questa partita</p>
              <p><strong>Permanente:</strong> La carta sara salvata e disponibile in tutte le partite future</p>
              <p><strong>Effetto:</strong> Descrivi come funziona la carta - il sistema lo elaborera automaticamente</p>
            </div>
          </div>
        )}


        {activeTab === 'manage' && (
          <div className="flex flex-1 min-h-0">
            {/* Left panel: compact card list */}
            <div className="w-60 flex-shrink-0 border-r border-white/10 flex flex-col">
              <div className="px-3 py-2 border-b border-white/10 flex-shrink-0">
                <p className="text-white text-xs font-semibold">Carte permanenti ({filteredPermanentCards.length})</p>
              </div>
              <div className="flex-1 overflow-y-auto">
                {loadingPermanent ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-xs">Caricamento...</div>
                ) : filteredPermanentCards.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-gray-400 text-xs text-center px-4">
                    Nessuna carta permanente in {getDeckLabel(selectedDeck)}
                  </div>
                ) : filteredPermanentCards.map(card => (
                  <button
                    key={card.id}
                    onClick={() => handleEditCard(card)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-left border-b border-white/5 transition-colors ${
                      editingCard === card.id ? 'bg-blue-600/20 border-l-2 border-l-blue-500' : 'hover:bg-white/5'
                    }`}
                  >
                    <img
                      src={card.imageData}
                      alt={card.name}
                      className={`w-8 h-11 object-cover rounded border flex-shrink-0 ${getDeckColor(card.deckType).replace('bg-', 'border-')}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{card.name}</p>
                      {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && card.pti && (
                        <p className="text-blue-300 text-[10px]">PTI {card.pti}{card.stars ? ` • ★${card.stars}` : ''}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right panel: edit form */}
            <div className="flex-1 overflow-y-auto">
              {editingCard !== null ? (() => {
                const card = filteredPermanentCards.find(c => c.id === editingCard);
                if (!card) return (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carta non trovata</div>
                );
                return (
                  <div className="p-5 space-y-4">
                    {/* Card preview header */}
                    <div className="flex items-center gap-3 bg-gray-800/60 rounded-lg p-3 border border-white/10">
                      <img
                        src={card.imageData}
                        alt={card.name}
                        className={`w-12 h-16 object-cover rounded border-2 flex-shrink-0 ${getDeckColor(card.deckType).replace('bg-', 'border-')}`}
                      />
                      <div>
                        <p className="text-white font-bold">{card.name}</p>
                        <span className={`text-xs text-white px-2 py-0.5 rounded ${getDeckColor(card.deckType)}`}>
                          {getDeckLabel(card.deckType)}
                        </span>
                        {card.createdBy && <p className="text-gray-400 text-xs mt-0.5">di {card.createdBy}</p>}
                      </div>
                    </div>

                    {/* Nome */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Nome carta</label>
                      <Input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nome carta"
                        className="bg-gray-700 text-white border-gray-600"
                      />
                    </div>

                    {/* PTI + Stelle */}
                    {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">PTI</label>
                          <Input
                            type="number"
                            value={editForm.pti}
                            onChange={(e) => setEditForm(prev => ({ ...prev, pti: e.target.value }))}
                            placeholder="PTI"
                            className="bg-gray-700 text-white border-gray-600"
                          />
                        </div>
                        <div>
                          <label className="text-gray-400 text-xs mb-1 block">Stelle</label>
                          <Input
                            type="number"
                            value={editForm.stars}
                            onChange={(e) => setEditForm(prev => ({ ...prev, stars: e.target.value }))}
                            placeholder="Stelle"
                            className="bg-gray-700 text-white border-gray-600"
                          />
                        </div>
                      </div>
                    )}

                    {/* Effetto + AI Wizard */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                        <Sparkles size={11} className="text-purple-400" />
                        Effetto (AI)
                      </label>
                      <div className="flex gap-2">
                        <textarea
                          value={editForm.effect}
                          onChange={(e) => setEditForm(prev => ({ ...prev, effect: e.target.value }))}
                          placeholder="Descrivi l'effetto..."
                          className="flex-1 bg-gray-700 text-white border border-gray-600 rounded-md p-2 text-sm resize-none"
                          rows={3}
                        />
                        <Button
                          type="button"
                          onClick={() => openEffectWizard('permanent', null)}
                          className="bg-purple-600 hover:bg-purple-700 text-white px-2.5 flex items-center gap-1 self-start"
                        >
                          <Wand2 size={14} /><span className="text-xs">AI</span>
                        </Button>
                      </div>
                    </div>

                    {/* Audio + YouTube */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                          <Volume2 size={11} className="text-cyan-400" />Audio URL
                        </label>
                        <Input
                          type="text"
                          value={editForm.audioUrl}
                          onChange={(e) => setEditForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                          placeholder="https://..."
                          className="bg-gray-700 text-white border-gray-600"
                        />
                      </div>
                      <div>
                        <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                          <Video size={11} className="text-red-400" />YouTube URL
                        </label>
                        <Input
                          type="text"
                          value={editForm.youtubeUrl}
                          onChange={(e) => setEditForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                          placeholder="https://youtu.be/..."
                          className="bg-gray-700 text-white border-gray-600"
                        />
                      </div>
                    </div>

                    {/* Audio attacchi (personaggi) - collapsibile */}
                    {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                      <details className="bg-orange-900/20 rounded-lg border border-orange-500/30">
                        <summary className="px-3 py-2 text-orange-400 text-xs font-bold cursor-pointer select-none">
                          🔊 Audio Attacchi Personaggio
                        </summary>
                        <div className="px-3 pb-3 space-y-2 mt-2">
                          <div>
                            <label className="text-white text-xs mb-1 block">Attacco Debole ({'<'} 150 PTI)</label>
                            <Input
                              type="text"
                              value={editForm.attackLowAudioUrl}
                              onChange={(e) => setEditForm(prev => ({ ...prev, attackLowAudioUrl: e.target.value }))}
                              placeholder="URL audio attacco debole"
                              className="bg-gray-700 text-white border-gray-600"
                            />
                          </div>
                          <div>
                            <label className="text-white text-xs mb-1 block">Attacco Forte ({'≥'} 150 PTI)</label>
                            <Input
                              type="text"
                              value={editForm.attackHighAudioUrl}
                              onChange={(e) => setEditForm(prev => ({ ...prev, attackHighAudioUrl: e.target.value }))}
                              placeholder="URL audio attacco forte"
                              className="bg-gray-700 text-white border-gray-600"
                            />
                          </div>
                        </div>
                      </details>
                    )}

                    {/* Impostazioni Mossa - collapsibile */}
                    {card.deckType === 'mosse' && (
                      <details className="bg-red-900/20 rounded-lg border border-red-500/30">
                        <summary className="px-3 py-2 text-red-400 text-xs font-bold cursor-pointer select-none">
                          ⚔️ Impostazioni Mossa
                        </summary>
                        <div className="px-3 pb-3 space-y-3 mt-2">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-white text-xs mb-1 block">Danno PTI</label>
                              <Input
                                type="number"
                                value={editForm.mosseDamageValue}
                                onChange={(e) => setEditForm(prev => ({ ...prev, mosseDamageValue: e.target.value }))}
                                placeholder="Es: 100"
                                className="bg-gray-700 text-white border-gray-600"
                              />
                              <p className="text-gray-500 text-xs mt-1">× stelle attaccante</p>
                            </div>
                            <div>
                              <label className="text-white text-xs mb-1 block">Effetto speciale</label>
                              <select
                                value={editForm.mosseDamageEffect}
                                onChange={(e) => setEditForm(prev => ({ ...prev, mosseDamageEffect: e.target.value }))}
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded px-2 py-2 text-sm"
                              >
                                <option value="">Nessun effetto</option>
                                <option value="death">💀 Morte istantanea</option>
                                <option value="halve_pti">➗ PTI dimezzati</option>
                                <option value="zero_stars">⭐ 0 stelle</option>
                                <option value="set_5_pti">5️⃣ 5 PTI</option>
                                <option value="remove_1_star">⭐ -1 stella</option>
                              </select>
                            </div>
                          </div>

                          <div className="border-t border-red-500/30 pt-3">
                            <div className="text-cyan-400 text-xs font-bold mb-2">↩️ Sistema Respinta</div>
                            <div className="space-y-2">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  id="edit-can-counter"
                                  checked={editForm.mosseCanCounter || false}
                                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, mosseCanCounter: !!checked }))}
                                />
                                <span className="text-white text-xs">Può respingere</span>
                              </label>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  id="edit-can-be-countered"
                                  checked={editForm.mosseCanBeCountered || false}
                                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, mosseCanBeCountered: !!checked }))}
                                />
                                <span className="text-white text-xs">Può essere respinta</span>
                              </label>
                            </div>
                          </div>

                          <div className="border-t border-red-500/30 pt-3">
                            <div className="text-orange-400 text-xs font-bold mb-2">🎯 Danno specifico per personaggio</div>
                            {editForm.mosseCharacterOverrides.map((override, idx) => (
                              <div key={idx} className="bg-gray-800/50 p-2 rounded mb-2 text-xs">
                                <div className="flex justify-between mb-1">
                                  <span className="text-white font-bold">{override.characterName}</span>
                                  <button
                                    type="button"
                                    onClick={() => setEditForm(prev => ({ ...prev, mosseCharacterOverrides: prev.mosseCharacterOverrides.filter((_, i) => i !== idx) }))}
                                    className="text-red-400"
                                  >×</button>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <p className="text-blue-400 text-xs mb-1">Usata DA:</p>
                                    <Input
                                      type="number"
                                      value={override.usedBy?.damageValue || ''}
                                      onChange={(e) => {
                                        const o = [...editForm.mosseCharacterOverrides];
                                        o[idx] = { ...o[idx], usedBy: { ...o[idx].usedBy, damageValue: e.target.value ? parseInt(e.target.value) : null, effect: o[idx].usedBy?.effect || null } };
                                        setEditForm(prev => ({ ...prev, mosseCharacterOverrides: o }));
                                      }}
                                      placeholder="PTI"
                                      className="bg-gray-600 text-white text-xs h-7 mb-1"
                                    />
                                    <select
                                      value={override.usedBy?.effect || ''}
                                      onChange={(e) => {
                                        const o = [...editForm.mosseCharacterOverrides];
                                        o[idx] = { ...o[idx], usedBy: { damageValue: o[idx].usedBy?.damageValue || null, effect: e.target.value || null } };
                                        setEditForm(prev => ({ ...prev, mosseCharacterOverrides: o }));
                                      }}
                                      className="w-full bg-gray-600 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                    >
                                      <option value="">Nessun effetto</option>
                                      <option value="death">Morte</option>
                                      <option value="halve_pti">PTI dimezzati</option>
                                    </select>
                                  </div>
                                  <div>
                                    <p className="text-purple-400 text-xs mb-1">Usata SU:</p>
                                    <Input
                                      type="number"
                                      value={override.usedOn?.damageValue || ''}
                                      onChange={(e) => {
                                        const o = [...editForm.mosseCharacterOverrides];
                                        o[idx] = { ...o[idx], usedOn: { ...o[idx].usedOn, damageValue: e.target.value ? parseInt(e.target.value) : null, effect: o[idx].usedOn?.effect || null } };
                                        setEditForm(prev => ({ ...prev, mosseCharacterOverrides: o }));
                                      }}
                                      placeholder="PTI"
                                      className="bg-gray-600 text-white text-xs h-7 mb-1"
                                    />
                                    <select
                                      value={override.usedOn?.effect || ''}
                                      onChange={(e) => {
                                        const o = [...editForm.mosseCharacterOverrides];
                                        o[idx] = { ...o[idx], usedOn: { damageValue: o[idx].usedOn?.damageValue || null, effect: e.target.value || null } };
                                        setEditForm(prev => ({ ...prev, mosseCharacterOverrides: o }));
                                      }}
                                      className="w-full bg-gray-600 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                    >
                                      <option value="">Nessun effetto</option>
                                      <option value="death">Morte</option>
                                      <option value="halve_pti">PTI dimezzati</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  const char = availableCharacters.find(c => c.id === e.target.value);
                                  if (char && !editForm.mosseCharacterOverrides.some(o => o.characterId === char.id)) {
                                    setEditForm(prev => ({ ...prev, mosseCharacterOverrides: [...prev.mosseCharacterOverrides, { characterId: char.id, characterName: char.name }] }));
                                  }
                                }
                              }}
                              className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-500"
                            >
                              <option value="">+ Aggiungi personaggio...</option>
                              {availableCharacters.filter(c => !editForm.mosseCharacterOverrides.some(o => o.characterId === c.id)).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="border-t border-red-500/30 pt-3">
                            <div className="text-cyan-400 text-xs font-bold mb-2">🎯 Targeting Automatico</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-white text-xs mb-1 block">Modalità</label>
                                <select
                                  value={editForm.mosseTargetingMode || ''}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, mosseTargetingMode: e.target.value }))}
                                  className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                >
                                  <option value="">Manuale</option>
                                  <option value="single">🎯 Singolo casuale</option>
                                  <option value="highest_pti">⬆️ PTI più alti</option>
                                  <option value="all_enemies">👥 Tutti nemici</option>
                                  <option value="all_characters">🌍 Tutti</option>
                                  <option value="specific_count">🔢 Numero specifico</option>
                                </select>
                              </div>
                              {editForm.mosseTargetingMode === 'specific_count' && (
                                <div>
                                  <label className="text-white text-xs mb-1 block">N° bersagli</label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editForm.mosseTargetCount}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, mosseTargetCount: e.target.value }))}
                                    placeholder="es. 2"
                                    className="bg-gray-700 text-white border-gray-600"
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="border-t border-red-500/30 pt-3">
                            <div className="text-yellow-400 text-xs font-bold mb-2">🚫 Restrizioni</div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-white text-xs mb-1">Non usabile DA:</p>
                                <div className="max-h-16 overflow-y-auto bg-gray-800/50 rounded p-1 mb-1">
                                  {editForm.mosseRestrictedFrom.map((name, i) => (
                                    <div key={i} className="flex justify-between text-xs text-white py-0.5">
                                      <span>{name}</span>
                                      <button type="button" onClick={() => setEditForm(prev => ({ ...prev, mosseRestrictedFrom: prev.mosseRestrictedFrom.filter((_, idx) => idx !== i) }))} className="text-red-400">×</button>
                                    </div>
                                  ))}
                                </div>
                                <select
                                  value=""
                                  onChange={(e) => { if (e.target.value && !editForm.mosseRestrictedFrom.includes(e.target.value)) setEditForm(prev => ({ ...prev, mosseRestrictedFrom: [...prev.mosseRestrictedFrom, e.target.value] })); }}
                                  className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                >
                                  <option value="">+ Aggiungi...</option>
                                  {availableCharacters.filter(c => !editForm.mosseRestrictedFrom.includes(c.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              </div>
                              <div>
                                <p className="text-white text-xs mb-1">Non usabile SU:</p>
                                <div className="max-h-16 overflow-y-auto bg-gray-800/50 rounded p-1 mb-1">
                                  {editForm.mosseRestrictedAgainst.map((name, i) => (
                                    <div key={i} className="flex justify-between text-xs text-white py-0.5">
                                      <span>{name}</span>
                                      <button type="button" onClick={() => setEditForm(prev => ({ ...prev, mosseRestrictedAgainst: prev.mosseRestrictedAgainst.filter((_, idx) => idx !== i) }))} className="text-red-400">×</button>
                                    </div>
                                  ))}
                                </div>
                                <select
                                  value=""
                                  onChange={(e) => { if (e.target.value && !editForm.mosseRestrictedAgainst.includes(e.target.value)) setEditForm(prev => ({ ...prev, mosseRestrictedAgainst: [...prev.mosseRestrictedAgainst, e.target.value] })); }}
                                  className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                >
                                  <option value="">+ Aggiungi...</option>
                                  {availableCharacters.filter(c => !editForm.mosseRestrictedAgainst.includes(c.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </details>
                    )}

                    {/* Pulsanti azione */}
                    <div className="flex gap-2 pt-3 border-t border-gray-700">
                      <Button
                        onClick={() => handleSaveEdit(card.id)}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center gap-1.5"
                      >
                        <Save size={14} />
                        Salva Modifiche
                      </Button>
                      <Button
                        onClick={() => setEditingCard(null)}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2"
                      >
                        Annulla
                      </Button>
                      <Button
                        onClick={() => handleDeleteCard(card.id)}
                        className="ml-auto bg-red-700 hover:bg-red-600 text-white px-4 py-2 flex items-center gap-1.5"
                      >
                        <Trash2 size={14} />
                        Elimina
                      </Button>
                    </div>
                  </div>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                  <Pencil size={48} className="opacity-20" />
                  <p className="text-sm">Seleziona una carta dalla lista per modificarla</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'existing' && isAdmin && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-700 flex-shrink-0 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Shield size={14} className="text-yellow-400" />
                <span className="text-yellow-300 text-sm font-semibold">Modalità Admin</span>
                <span className="text-gray-500 text-xs">— modifiche permanenti</span>
              </div>
              {pendingChanges.size > 0 && (
                <div className="ml-auto flex gap-2">
                  <Button onClick={() => { setPendingChanges(new Map()); setEditingExistingCard(null); }} className="bg-gray-600 hover:bg-gray-700 text-white text-xs px-3 py-1.5" size="sm">Annulla tutto</Button>
                  <Button onClick={handleBulkSave} disabled={isBulkSaving} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 flex items-center gap-1.5" size="sm">
                    <Save size={13} />
                    {isBulkSaving ? 'Salvataggio...' : `Salva tutti (${pendingChanges.size})`}
                  </Button>
                </div>
              )}
            </div>
            <div className="px-5 py-2 border-b border-gray-700 flex-shrink-0">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={`Cerca in ${getDeckLabel(selectedDeck)}... (${filteredExistingCards.length} carte)`} className="bg-gray-700 text-white border-gray-600 pl-9 text-sm" />
              </div>
            </div>

            {loadingExisting ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">Caricamento...</div>
            ) : (
              <div className="flex flex-1 min-h-0">
                {/* Left: compact card list */}
                <div className="w-64 flex-shrink-0 border-r border-gray-700 overflow-y-auto">
                  {filteredExistingCards.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-gray-500 text-sm">Nessuna carta trovata</div>
                  ) : filteredExistingCards.map(card => (
                    <button
                      key={card.id}
                      onClick={() => handleEditExistingCard(card)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left border-b border-gray-700/40 transition-colors ${
                        editingExistingCard === card.id ? 'bg-yellow-600/20 border-l-2 border-l-yellow-500' : 'hover:bg-gray-700/40'
                      }`}
                    >
                      <div className="relative flex-shrink-0">
                        <img src={card.imageUrl || card.originalImageUrl} className={`w-9 h-12 object-cover rounded border ${card.isDeleted ? 'grayscale opacity-50' : ''} ${getDeckColor(card.deckType).replace('bg-', 'border-')}`} alt="" />
                        {card.isDeleted && <div className="absolute inset-0 flex items-center justify-center bg-red-900/60 rounded"><Trash2 size={9} className="text-red-300" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${card.isDeleted ? 'text-red-400 line-through' : 'text-white'}`}>{card.name || card.originalName}</p>
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {card.isDeleted && <span className="text-[9px] bg-red-500/20 text-red-400 px-1 rounded">eliminata</span>}
                          {card.isModified && !card.isDeleted && <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1 rounded">modif.</span>}
                          {pendingChanges.has(card.id) && <span className="text-[9px] bg-green-500/20 text-green-400 px-1 rounded">✓ in attesa</span>}
                          {isCharacterDeck && card.pti && <span className="text-[9px] text-blue-300">PTI {card.pti}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Right: Edit form */}
                <div className="flex-1 overflow-y-auto">
                  {editingExistingCard ? (() => {
                    const card = filteredExistingCards.find(c => c.id === editingExistingCard);
                    if (!card) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Carta non trovata</div>;
                    return (
                      <div className="p-5 space-y-4">
                            {/* Real-time Card Preview */}
                            <div className="bg-gray-900/60 rounded-lg p-3 border border-white/10">
                              <label className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2 block">Anteprima in tempo reale</label>
                              <div className="flex gap-4 items-start">
                                <div className="relative flex-shrink-0 w-28 rounded-lg overflow-hidden shadow-lg border-2 border-white/20" style={{ aspectRatio: '2/3' }}>
                                  <img
                                    src={existingEditForm.imageUrl || card.imageUrl || ''}
                                    alt={existingEditForm.name || card.name}
                                    className="w-full h-full object-cover"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/112x168?text=?'; }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                  <div className="absolute bottom-0 left-0 right-0 p-1.5">
                                    <p className="text-white text-[10px] font-bold leading-tight line-clamp-2 text-center">
                                      {existingEditForm.name || card.name}
                                    </p>
                                    {isCharacterDeck && (
                                      <div className="flex justify-center gap-1 mt-0.5">
                                        {existingEditForm.pti && <span className="text-[9px] bg-blue-600/80 text-white px-1 rounded">PTI {existingEditForm.pti}</span>}
                                        {existingEditForm.stars && <span className="text-[9px] bg-yellow-500/80 text-white px-1 rounded">★ {existingEditForm.stars}</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="text-xs">
                                    <span className="text-gray-400">Nome: </span>
                                    <span className="text-white font-medium">{existingEditForm.name || card.name}</span>
                                  </div>
                                  {isCharacterDeck && (
                                    <>
                                      <div className="text-xs">
                                        <span className="text-gray-400">PTI: </span>
                                        <span className="text-blue-300 font-medium">{existingEditForm.pti || card.pti || '—'}</span>
                                      </div>
                                      <div className="text-xs">
                                        <span className="text-gray-400">Stelle: </span>
                                        <span className="text-yellow-300 font-medium">{existingEditForm.stars || card.stars || '—'}</span>
                                      </div>
                                    </>
                                  )}
                                  {existingEditForm.effect && (
                                    <div className="text-xs">
                                      <span className="text-gray-400">Effetto: </span>
                                      <span className="text-green-300 text-[10px] line-clamp-3">{existingEditForm.effect}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-gray-400 text-xs">Nome originale: {card.originalName}</label>
                              <Input
                                type="text"
                                value={existingEditForm.name}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="Nuovo nome (lascia vuoto per originale)"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            <div>
                              <label className="text-gray-400 text-xs">URL Immagine personalizzata</label>
                              <Input
                                type="text"
                                value={existingEditForm.imageUrl}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                                placeholder="URL nuova immagine (lascia vuoto per originale)"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            {isCharacterDeck && (
                              <div className="flex gap-3">
                                <div className="flex-1">
                                  <label className="text-gray-400 text-xs">PTI</label>
                                  <Input
                                    type="number"
                                    value={existingEditForm.pti}
                                    onChange={(e) => setExistingEditForm(prev => ({ ...prev, pti: e.target.value }))}
                                    placeholder="PTI"
                                    className="bg-gray-600 text-white border-gray-500"
                                  />
                                </div>
                                <div className="flex-1">
                                  <label className="text-gray-400 text-xs">Stelle</label>
                                  <Input
                                    type="number"
                                    value={existingEditForm.stars}
                                    onChange={(e) => setExistingEditForm(prev => ({ ...prev, stars: e.target.value }))}
                                    placeholder="Stelle"
                                    className="bg-gray-600 text-white border-gray-500"
                                  />
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Sparkles size={14} className="text-purple-400" />
                                Effetto (elaborato da AI)
                              </label>
                              <div className="flex gap-2">
                                <textarea
                                  value={existingEditForm.effect}
                                  onChange={(e) => setExistingEditForm(prev => ({ ...prev, effect: e.target.value }))}
                                  placeholder="Descrivi l'effetto della carta... Il sistema lo elaborera automaticamente durante il gioco."
                                  className="flex-1 bg-gray-600 text-white border border-gray-500 rounded-md p-2 text-sm resize-none"
                                  rows={3}
                                />
                                <Button
                                  type="button"
                                  onClick={() => openEffectWizard('existing', null)}
                                  className="bg-purple-600 hover:bg-purple-700 text-white px-3 flex items-center gap-1"
                                  title="Usa la procedura guidata per configurare l'effetto"
                                >
                                  <Wand2 size={16} />
                                  <span className="text-xs">Wizard</span>
                                </Button>
                              </div>
                            </div>
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Volume2 size={14} className="text-cyan-400" />
                                Audio URL
                              </label>
                              <Input
                                type="text"
                                value={existingEditForm.audioUrl}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, audioUrl: e.target.value }))}
                                placeholder="https://... link audio da riprodurre quando la carta viene giocata"
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                              <div className="p-3 bg-orange-900/30 rounded-lg border border-orange-500/50">
                                <div className="text-orange-400 text-sm font-bold mb-2">🔊 AUDIO ATTACCHI PERSONAGGIO</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Audio personalizzati che si attivano quando questo personaggio usa una MOSSA in base al danno originale (senza moltiplicazione stelle).
                                </p>
                                <div className="grid grid-cols-1 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Audio Attacco Debole (danno {'<'} 150 PTI)</label>
                                    <Input
                                      type="text"
                                      value={existingEditForm.attackLowAudioUrl}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, attackLowAudioUrl: e.target.value }))}
                                      placeholder="https://... audio per attacchi con danno < 150 PTI"
                                      className="bg-gray-600 text-white border-gray-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Audio Attacco Forte (danno {'≥'} 150 PTI)</label>
                                    <Input
                                      type="text"
                                      value={existingEditForm.attackHighAudioUrl}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, attackHighAudioUrl: e.target.value }))}
                                      placeholder="https://... audio per attacchi con danno ≥ 150 PTI"
                                      className="bg-gray-600 text-white border-gray-500"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div>
                              <label className="text-white text-sm mb-1 flex items-center gap-1">
                                <Video size={14} className="text-red-500" />
                                Video YouTube URL
                              </label>
                              <Input
                                type="text"
                                value={existingEditForm.youtubeUrl}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, youtubeUrl: e.target.value }))}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="bg-gray-600 text-white border-gray-500"
                              />
                            </div>
                            
                            {(card.deckType === 'personaggi' || card.deckType === 'personaggi_speciali') && (
                              <div className="p-3 bg-emerald-900/30 rounded-lg border border-emerald-500/50">
                                <div className="text-emerald-400 text-sm font-bold mb-2">🔄 EVOLUZIONI E TRASFORMAZIONI</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Configura le trasformazioni di questo personaggio. Quando un BONUS con la dicitura corrispondente viene usato, il personaggio viene sostituito.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Si evolve in</label>
                                    <select
                                      value={existingEditForm.evolvesInto || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, evolvesInto: e.target.value }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    >
                                      <option value="">Nessuna evoluzione</option>
                                      {allCharacterCards.map(c => (
                                        <option key={c.cardId} value={c.cardId}>{c.name} ({c.deckType === 'personaggi_speciali' ? 'Speciale' : 'Personaggio'})</option>
                                      ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">BONUS: "Si evolve" / "Effettua l'evoluzione"</p>
                                    
                                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={!!existingEditForm.evolutionVariants}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setExistingEditForm(prev => ({
                                              ...prev,
                                              evolutionVariants: { '1': '', '2': '', '3': '', '4': '', '5': '', '6': '' },
                                              evolvesInto: ''
                                            }));
                                          } else {
                                            setExistingEditForm(prev => ({
                                              ...prev,
                                              evolutionVariants: null
                                            }));
                                          }
                                        }}
                                        className="accent-emerald-500"
                                      />
                                      <span className="text-emerald-300 text-xs font-bold">Varianti di evoluzione (dado)</span>
                                    </label>
                                  </div>
                                  
                                  {existingEditForm.evolutionVariants && (
                                    <div className="col-span-2 p-3 bg-emerald-800/20 rounded-lg border border-emerald-400/40">
                                      <div className="text-emerald-300 text-xs font-bold mb-2">🎲 VARIANTI DI EVOLUZIONE</div>
                                      <p className="text-gray-400 text-xs mb-3">
                                        Quando questo personaggio si evolve, viene lanciato automaticamente un dado. In base al numero uscito, si evolverà nel personaggio corrispondente.
                                      </p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {[1, 2, 3, 4, 5, 6].map(num => (
                                          <div key={num}>
                                            <label className="text-white text-xs mb-1 block">Se esce {num} 🎲</label>
                                            <select
                                              value={existingEditForm.evolutionVariants?.[String(num)] || ''}
                                              onChange={(e) => setExistingEditForm(prev => ({
                                                ...prev,
                                                evolutionVariants: {
                                                  ...prev.evolutionVariants!,
                                                  [String(num)]: e.target.value
                                                }
                                              }))}
                                              className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-1.5 text-xs"
                                            >
                                              <option value="">-- Nessuno --</option>
                                              {allCharacterCards.map(c => (
                                                <option key={c.cardId} value={c.cardId}>{c.name} ({c.deckType === 'personaggi_speciali' ? 'Speciale' : 'Personaggio'})</option>
                                              ))}
                                            </select>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  <div>
                                    <label className="text-white text-xs mb-1 block">Si trasforma in</label>
                                    <select
                                      value={existingEditForm.transformsInto || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, transformsInto: e.target.value }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    >
                                      <option value="">Nessuna trasformazione</option>
                                      {allCharacterCards.map(c => (
                                        <option key={c.cardId} value={c.cardId}>{c.name} ({c.deckType === 'personaggi_speciali' ? 'Speciale' : 'Personaggio'})</option>
                                      ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">BONUS: "Si trasforma" / "Effettua la trasformazione"</p>
                                  </div>
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Si trasforma da</label>
                                    <select
                                      value={existingEditForm.transformsFrom || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, transformsFrom: e.target.value }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    >
                                      <option value="">Nessuna</option>
                                      {allCharacterCards.map(c => (
                                        <option key={c.cardId} value={c.cardId}>{c.name} ({c.deckType === 'personaggi_speciali' ? 'Speciale' : 'Personaggio'})</option>
                                      ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">BONUS: "Si tarocca" / "Effettua la taroccata"</p>
                                  </div>
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Si tarocca in</label>
                                    <select
                                      value={existingEditForm.cheatsInto || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, cheatsInto: e.target.value }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    >
                                      <option value="">Nessuna taroccata</option>
                                      {allCharacterCards.map(c => (
                                        <option key={c.cardId} value={c.cardId}>{c.name} ({c.deckType === 'personaggi_speciali' ? 'Speciale' : 'Personaggio'})</option>
                                      ))}
                                    </select>
                                    <p className="text-gray-500 text-xs mt-1">BONUS: "Si tarocca" / "Effettua la taroccata"</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {card.deckType === 'personaggi_speciali' && (
                              <div className="p-3 bg-yellow-900/30 rounded-lg border border-yellow-500/50">
                                <div className="text-yellow-400 text-sm font-bold mb-2">⭐ CATEGORIA SPECIALE</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Seleziona la categoria di questo personaggio speciale.
                                </p>
                                <div className="flex gap-3 flex-wrap">
                                  {['', 'supremi', 'super', 'evoluti', 'tarocchi'].map(cat => (
                                    <label key={cat || 'none'} className="flex items-center gap-1 cursor-pointer">
                                      <input
                                        type="radio"
                                        name={`specialCategory-${card.id}`}
                                        value={cat}
                                        checked={existingEditForm.specialCategory === cat}
                                        onChange={() => setExistingEditForm(prev => ({ ...prev, specialCategory: cat }))}
                                        className="accent-yellow-500"
                                      />
                                      <span className="text-white text-xs font-bold">
                                        {cat === '' ? 'Nessuna' : cat.toUpperCase()}
                                      </span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {card.deckType === 'personaggi_speciali' && (
                              <div className="p-3 bg-purple-900/30 rounded-lg border border-purple-500/50">
                                <div className="text-purple-400 text-sm font-bold mb-2">🔥 MOSSE SPECIALI EVOLUTE</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Configura nomi e danni personalizzati per le mosse in base al range di danno base. Il danno assegnato verrà moltiplicato per le stelle attuali del personaggio.
                                </p>
                                
                                <div className="space-y-3">
                                  <div className="p-2 bg-gray-800/50 rounded border border-purple-500/30">
                                    <div className="text-purple-300 text-xs font-bold mb-2">DA 1 A 150 PTI</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-white text-xs mb-1 block">Nome mossa</label>
                                        <input
                                          type="text"
                                          value={existingEditForm.evolvedMoves?.range1?.name || ''}
                                          onChange={(e) => setExistingEditForm(prev => ({
                                            ...prev,
                                            evolvedMoves: {
                                              ...prev.evolvedMoves,
                                              range1: { ...prev.evolvedMoves?.range1, name: e.target.value }
                                            }
                                          }))}
                                          placeholder="Es: KAMEHAMEHA"
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-white text-xs mb-1 block">Danno PTI</label>
                                        <input
                                          type="number"
                                          value={existingEditForm.evolvedMoves?.range1?.damage || ''}
                                          onChange={(e) => setExistingEditForm(prev => ({
                                            ...prev,
                                            evolvedMoves: {
                                              ...prev.evolvedMoves,
                                              range1: { ...prev.evolvedMoves?.range1, damage: e.target.value }
                                            }
                                          }))}
                                          placeholder="Es: 100"
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-1 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-1">Quando usa una mossa con danno base 1-150, viene sostituita con questo nome e danno × stelle</p>
                                  </div>
                                  
                                  <div className="p-2 bg-gray-800/50 rounded border border-purple-500/30">
                                    <div className="text-purple-300 text-xs font-bold mb-2">DA 151 A 300 PTI</div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-white text-xs mb-1 block">Nome mossa</label>
                                        <input
                                          type="text"
                                          value={existingEditForm.evolvedMoves?.range2?.name || ''}
                                          onChange={(e) => setExistingEditForm(prev => ({
                                            ...prev,
                                            evolvedMoves: {
                                              ...prev.evolvedMoves,
                                              range2: { ...prev.evolvedMoves?.range2, name: e.target.value }
                                            }
                                          }))}
                                          placeholder="Es: GENKIDAMA"
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-1 text-xs"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-white text-xs mb-1 block">Danno PTI</label>
                                        <input
                                          type="number"
                                          value={existingEditForm.evolvedMoves?.range2?.damage || ''}
                                          onChange={(e) => setExistingEditForm(prev => ({
                                            ...prev,
                                            evolvedMoves: {
                                              ...prev.evolvedMoves,
                                              range2: { ...prev.evolvedMoves?.range2, damage: e.target.value }
                                            }
                                          }))}
                                          placeholder="Es: 250"
                                          className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-1 text-xs"
                                        />
                                      </div>
                                    </div>
                                    <p className="text-gray-500 text-xs mt-1">Quando usa una mossa con danno base 151-300, viene sostituita con questo nome e danno × stelle</p>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {card.deckType === 'personaggi_speciali' && (
                              <div className="p-3 bg-orange-900/30 rounded-lg border border-orange-500/50">
                                <div className="text-orange-400 text-sm font-bold mb-2">💥 SUPER ATTACCO</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Configura un attacco speciale che si attiva quando questo personaggio usa la mossa "ATTACCO". Il danno verrà moltiplicato per le stelle attuali.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Nome attacco speciale</label>
                                    <input
                                      type="text"
                                      value={existingEditForm.superAttacco?.name || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({
                                        ...prev,
                                        superAttacco: { ...prev.superAttacco, name: e.target.value }
                                      }))}
                                      placeholder="Es: FINAL FLASH"
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Danno PTI base</label>
                                    <input
                                      type="number"
                                      value={existingEditForm.superAttacco?.damage || ''}
                                      onChange={(e) => setExistingEditForm(prev => ({
                                        ...prev,
                                        superAttacco: { ...prev.superAttacco, damage: e.target.value }
                                      }))}
                                      placeholder="Es: 200"
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-xs"
                                    />
                                    <p className="text-gray-500 text-xs mt-1">Sarà moltiplicato per le stelle attuali</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Draft Cost */}
                            <div className="p-3 bg-teal-900/30 rounded-lg border border-teal-500/50">
                              <div className="text-teal-400 text-sm font-bold mb-2">🪙 COSTO DRAFT</div>
                              <p className="text-gray-400 text-xs mb-2">Crediti necessari per acquistare questa carta nella modalità Draft (0 = gratuita).</p>
                              <Input
                                type="number"
                                min="0"
                                value={existingEditForm.draftCost}
                                onChange={(e) => setExistingEditForm(prev => ({ ...prev, draftCost: e.target.value }))}
                                placeholder="0"
                                className="bg-gray-600 text-white border-gray-500 w-40"
                              />
                            </div>
                            
                            {/* MOSSE Damage Settings */}
                            {card.deckType === 'mosse' && (
                              <div className="p-3 bg-red-900/30 rounded-lg border border-red-500/50">
                                <div className="text-red-400 text-sm font-bold mb-2">⚔️ DANNO MOSSA</div>
                                <p className="text-gray-400 text-xs mb-3">
                                  Imposta il danno che questa mossa infligge. Il pannello input danni verrà pre-compilato.
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Danno PTI (numerico)</label>
                                    <Input
                                      type="number"
                                      value={existingEditForm.mosseDamageValue}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, mosseDamageValue: e.target.value }))}
                                      placeholder="Es: 100"
                                      className="bg-gray-600 text-white border-gray-500"
                                    />
                                    <p className="text-gray-500 text-xs mt-1">Sarà moltiplicato per le stelle dell'attaccante</p>
                                  </div>
                                  <div>
                                    <label className="text-white text-xs mb-1 block">Effetto speciale</label>
                                    <select
                                      value={existingEditForm.mosseDamageEffect}
                                      onChange={(e) => setExistingEditForm(prev => ({ ...prev, mosseDamageEffect: e.target.value }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded px-2 py-2 text-sm"
                                    >
                                      <option value="">Nessun effetto</option>
                                      <option value="death">💀 Morte istantanea</option>
                                      <option value="halve_pti">➗ PTI dimezzati</option>
                                      <option value="zero_stars">⭐ Manda a 0 stelle</option>
                                      <option value="set_5_pti">5️⃣ Manda a 5 PTI</option>
                                      <option value="remove_1_star">⭐ Elimina 1 stella</option>
                                    </select>
                                  </div>
                                </div>
                                
                                {/* Character-Specific Overrides */}
                                <div className="mt-3 border-t border-red-500/30 pt-3">
                                  <div className="text-orange-400 text-xs font-bold mb-2">🎯 Danno specifico per personaggio</div>
                                  {existingEditForm.mosseCharacterOverrides.map((override, idx) => (
                                    <div key={idx} className="bg-gray-800/50 p-2 rounded mb-2 text-xs">
                                      <div className="flex justify-between mb-1">
                                        <span className="text-white font-bold">{override.characterName}</span>
                                        <button type="button" onClick={() => setExistingEditForm(prev => ({
                                          ...prev,
                                          mosseCharacterOverrides: prev.mosseCharacterOverrides.filter((_, i) => i !== idx)
                                        }))} className="text-red-400 text-xs">×</button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <p className="text-blue-400 text-xs mb-1">Usata DA:</p>
                                          <Input type="number" value={override.usedBy?.damageValue || ''} 
                                            onChange={(e) => {
                                              const newOverrides = [...existingEditForm.mosseCharacterOverrides];
                                              newOverrides[idx] = { ...newOverrides[idx], usedBy: { ...newOverrides[idx].usedBy, damageValue: e.target.value ? parseInt(e.target.value) : null, effect: newOverrides[idx].usedBy?.effect || null }};
                                              setExistingEditForm(prev => ({ ...prev, mosseCharacterOverrides: newOverrides }));
                                            }} placeholder="PTI" className="bg-gray-600 text-white text-xs h-7 mb-1" />
                                          <select value={override.usedBy?.effect || ''} onChange={(e) => {
                                            const newOverrides = [...existingEditForm.mosseCharacterOverrides];
                                            newOverrides[idx] = { ...newOverrides[idx], usedBy: { damageValue: newOverrides[idx].usedBy?.damageValue || null, effect: e.target.value || null }};
                                            setExistingEditForm(prev => ({ ...prev, mosseCharacterOverrides: newOverrides }));
                                          }} className="w-full bg-gray-600 text-white text-xs px-1 py-1 rounded border border-gray-500">
                                            <option value="">Nessun effetto</option>
                                            <option value="death">Morte</option>
                                            <option value="halve_pti">PTI dimezzati</option>
                                          </select>
                                        </div>
                                        <div>
                                          <p className="text-purple-400 text-xs mb-1">Usata SU:</p>
                                          <Input type="number" value={override.usedOn?.damageValue || ''} 
                                            onChange={(e) => {
                                              const newOverrides = [...existingEditForm.mosseCharacterOverrides];
                                              newOverrides[idx] = { ...newOverrides[idx], usedOn: { ...newOverrides[idx].usedOn, damageValue: e.target.value ? parseInt(e.target.value) : null, effect: newOverrides[idx].usedOn?.effect || null }};
                                              setExistingEditForm(prev => ({ ...prev, mosseCharacterOverrides: newOverrides }));
                                            }} placeholder="PTI" className="bg-gray-600 text-white text-xs h-7 mb-1" />
                                          <select value={override.usedOn?.effect || ''} onChange={(e) => {
                                            const newOverrides = [...existingEditForm.mosseCharacterOverrides];
                                            newOverrides[idx] = { ...newOverrides[idx], usedOn: { damageValue: newOverrides[idx].usedOn?.damageValue || null, effect: e.target.value || null }};
                                            setExistingEditForm(prev => ({ ...prev, mosseCharacterOverrides: newOverrides }));
                                          }} className="w-full bg-gray-600 text-white text-xs px-1 py-1 rounded border border-gray-500">
                                            <option value="">Nessun effetto</option>
                                            <option value="death">Morte</option>
                                            <option value="halve_pti">PTI dimezzati</option>
                                          </select>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  <select value="" onChange={(e) => {
                                    if (e.target.value) {
                                      const char = availableCharacters.find(c => c.id === e.target.value);
                                      if (char && !existingEditForm.mosseCharacterOverrides.some(o => o.characterId === char.id)) {
                                        setExistingEditForm(prev => ({ ...prev, mosseCharacterOverrides: [...prev.mosseCharacterOverrides, { characterId: char.id, characterName: char.name }]}));
                                      }
                                    }
                                  }} className="w-full bg-gray-700 text-white text-xs px-2 py-1 rounded border border-gray-500">
                                    <option value="">+ Aggiungi personaggio...</option>
                                    {availableCharacters.filter(c => !existingEditForm.mosseCharacterOverrides.some(o => o.characterId === c.id)).map(c => (
                                      <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                  </select>
                                </div>
                                
                                {/* Targeting Mode */}
                                <div className="mt-3 border-t border-red-500/30 pt-3">
                                  <div className="text-cyan-400 text-xs font-bold mb-2">🎯 Targeting Automatico</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-white text-xs mb-1">Modalità</p>
                                      <select 
                                        value={existingEditForm.mosseTargetingMode || ''} 
                                        onChange={(e) => setExistingEditForm(prev => ({ ...prev, mosseTargetingMode: e.target.value }))} 
                                        className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500"
                                      >
                                        <option value="">Manuale</option>
                                        <option value="single">🎯 Singolo casuale</option>
                                        <option value="highest_pti">⬆️ PTI più alti</option>
                                        <option value="all_enemies">👥 Tutti nemici</option>
                                        <option value="all_characters">🌍 Tutti</option>
                                        <option value="specific_count">🔢 Numero specifico</option>
                                      </select>
                                    </div>
                                    {existingEditForm.mosseTargetingMode === 'specific_count' && (
                                      <div>
                                        <p className="text-white text-xs mb-1">Numero bersagli</p>
                                        <Input 
                                          type="number" 
                                          min="1"
                                          value={existingEditForm.mosseTargetCount || ''} 
                                          onChange={(e) => setExistingEditForm(prev => ({ ...prev, mosseTargetCount: e.target.value }))} 
                                          placeholder="es. 2"
                                          className="bg-gray-600 text-white border-gray-500 text-xs h-7"
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Counter Attack Settings */}
                                <div className="mt-3 border-t border-red-500/30 pt-3">
                                  <div className="text-cyan-400 text-xs font-bold mb-2">↩️ Sistema Respinta</div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id="existing-can-counter"
                                        checked={existingEditForm.mosseCanCounter || false}
                                        onCheckedChange={(checked) => setExistingEditForm(prev => ({ ...prev, mosseCanCounter: !!checked }))}
                                      />
                                      <label htmlFor="existing-can-counter" className="text-white text-xs cursor-pointer">
                                        Può respingere
                                      </label>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Checkbox
                                        id="existing-can-be-countered"
                                        checked={existingEditForm.mosseCanBeCountered || false}
                                        onCheckedChange={(checked) => setExistingEditForm(prev => ({ ...prev, mosseCanBeCountered: !!checked }))}
                                      />
                                      <label htmlFor="existing-can-be-countered" className="text-white text-xs cursor-pointer">
                                        Può essere respinta
                                      </label>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Restrictions */}
                                <div className="mt-3 border-t border-red-500/30 pt-3">
                                  <div className="text-yellow-400 text-xs font-bold mb-2">🚫 Restrizioni</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <p className="text-white text-xs mb-1">Non usabile DA:</p>
                                      <div className="max-h-16 overflow-y-auto bg-gray-800/50 rounded p-1 mb-1">
                                        {existingEditForm.mosseRestrictedFrom.map((name, i) => (
                                          <div key={i} className="flex justify-between text-xs text-white py-0.5">
                                            <span>{name}</span>
                                            <button type="button" onClick={() => setExistingEditForm(prev => ({ ...prev, mosseRestrictedFrom: prev.mosseRestrictedFrom.filter((_, idx) => idx !== i) }))} className="text-red-400">×</button>
                                          </div>
                                        ))}
                                      </div>
                                      <select value="" onChange={(e) => { if (e.target.value && !existingEditForm.mosseRestrictedFrom.includes(e.target.value)) setExistingEditForm(prev => ({ ...prev, mosseRestrictedFrom: [...prev.mosseRestrictedFrom, e.target.value] })); }} className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500">
                                        <option value="">+ Aggiungi...</option>
                                        {availableCharacters.filter(c => !existingEditForm.mosseRestrictedFrom.includes(c.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-white text-xs mb-1">Non usabile SU:</p>
                                      <div className="max-h-16 overflow-y-auto bg-gray-800/50 rounded p-1 mb-1">
                                        {existingEditForm.mosseRestrictedAgainst.map((name, i) => (
                                          <div key={i} className="flex justify-between text-xs text-white py-0.5">
                                            <span>{name}</span>
                                            <button type="button" onClick={() => setExistingEditForm(prev => ({ ...prev, mosseRestrictedAgainst: prev.mosseRestrictedAgainst.filter((_, idx) => idx !== i) }))} className="text-red-400">×</button>
                                          </div>
                                        ))}
                                      </div>
                                      <select value="" onChange={(e) => { if (e.target.value && !existingEditForm.mosseRestrictedAgainst.includes(e.target.value)) setExistingEditForm(prev => ({ ...prev, mosseRestrictedAgainst: [...prev.mosseRestrictedAgainst, e.target.value] })); }} className="w-full bg-gray-700 text-white text-xs px-1 py-1 rounded border border-gray-500">
                                        <option value="">+ Aggiungi...</option>
                                        {availableCharacters.filter(c => !existingEditForm.mosseRestrictedAgainst.includes(c.name)).map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            <div className="flex gap-2 pt-3 border-t border-gray-700">
                              <Button
                                onClick={() => handleSaveExistingEdit(card)}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center gap-1.5"
                              >
                                <Save size={14} />
                                Salva Modifiche
                              </Button>
                              <Button
                                onClick={() => setEditingExistingCard(null)}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2"
                              >
                                Annulla
                              </Button>
                              <Button
                                onClick={() => handleToggleDeleteExisting(card)}
                                className={`ml-auto px-4 py-2 flex items-center gap-1.5 ${card.isDeleted ? 'bg-green-600 hover:bg-green-700' : 'bg-red-700 hover:bg-red-600'} text-white`}
                              >
                                {card.isDeleted ? <><RotateCcw size={14} />Ripristina</> : <><Trash2 size={14} />Elimina</>}
                              </Button>
                            </div>
                          </div>
                    );
                  })() : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                      <Pencil size={48} className="opacity-20" />
                      <p className="text-sm">Seleziona una carta dalla lista per modificarla</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        </div>{/* end main content */}
      </div>{/* end body */}

      {/* Effect Wizard Dialog */}
      {showEffectWizard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4">
          <div className="bg-gray-800 rounded-xl border border-purple-500 max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Wand2 className="text-purple-400" size={24} />
                <h3 className="text-xl font-bold text-white">Configura Effetto</h3>
              </div>
              <button
                onClick={() => setShowEffectWizard(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mb-6">
              {Array.from({ length: getStepCount() }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded ${
                    i + 1 <= effectWizard.step ? 'bg-purple-500' : 'bg-gray-600'
                  }`}
                />
              ))}
            </div>

            {/* Step 1: Effect Type */}
            {effectWizard.step === 1 && (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm mb-2">Che tipo di effetto vuoi creare?</p>
                
                {/* Search Field */}
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Cerca effetto..."
                    value={effectWizard.effectSearchQuery}
                    onChange={(e) => setEffectWizard(prev => ({ ...prev, effectSearchQuery: e.target.value }))}
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:border-purple-500"
                  />
                </div>
                
                {/* Category Filter */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {EFFECT_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setEffectWizard(prev => ({ ...prev, categoryFilter: cat.id }))}
                      className={`px-2 py-1 rounded text-xs transition-all ${
                        effectWizard.categoryFilter === cat.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  ))}
                </div>
                
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {EFFECT_TYPES.filter(e => {
                    const matchesCategory = effectWizard.categoryFilter === 'all' || e.category === effectWizard.categoryFilter;
                    const searchTerm = effectWizard.effectSearchQuery.toLowerCase().trim();
                    const matchesSearch = !searchTerm || 
                      e.label.toLowerCase().includes(searchTerm) || 
                      e.description.toLowerCase().includes(searchTerm) ||
                      e.id.toLowerCase().includes(searchTerm);
                    return matchesCategory && matchesSearch;
                  }).map(effect => (
                    <button
                      key={effect.id}
                      onClick={() => setEffectWizard(prev => ({ ...prev, effectType: effect.id }))}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        effectWizard.effectType === effect.id
                          ? 'border-purple-500 bg-purple-600/30'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{effect.icon}</span>
                        <div>
                          <div className="text-white font-medium text-xs">{effect.label}</div>
                          <div className="text-gray-400 text-[10px] leading-tight">{effect.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Target, Custom description, or No-target confirmation */}
            {effectWizard.step === 2 && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                {effectWizard.effectType === 'custom' ? (
                  <>
                    <p className="text-gray-300 text-sm mb-2">Descrivi l'effetto che vuoi creare:</p>
                    <textarea
                      value={effectWizard.customDescription}
                      onChange={(e) => setEffectWizard(prev => ({ ...prev, customDescription: e.target.value }))}
                      placeholder="Es: Quando questa carta viene giocata, il giocatore pesca 2 carte e tutti gli avversari perdono 50 PTI..."
                      className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-sm resize-none"
                      rows={3}
                    />
                    
                    <div className="border-t border-gray-600 pt-3 mt-3">
                      <p className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                        <span className="text-xl">✨</span> Animazione (opzionale):
                      </p>
                      <textarea
                        value={effectWizard.animationDescription}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, animationDescription: e.target.value }))}
                        placeholder="Es: Un'esplosione di energia dorata che si espande dal centro della carta, seguito da raggi di luce che colpiscono i bersagli..."
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-sm resize-none"
                        rows={2}
                      />
                    </div>
                    
                    <div className="border-t border-gray-600 pt-3 mt-3">
                      <p className="text-gray-300 text-sm mb-2 flex items-center gap-2">
                        <span className="text-xl">🎮</span> Comportamento (opzionale):
                      </p>
                      <textarea
                        value={effectWizard.behaviorDescription}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, behaviorDescription: e.target.value }))}
                        placeholder="Es: Questa carta puo essere giocata solo se hai meno di 500 PTI. Dopo l'attivazione, non puoi giocare altre carte per 2 turni..."
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-sm resize-none"
                        rows={2}
                      />
                    </div>
                    
                    <p className="text-gray-500 text-xs mt-2">Descrivi l'effetto in dettaglio. Se qualcosa non e chiaro, il sistema ti fara delle domande per capire meglio.</p>
                  </>
                ) : !needsTarget() ? (
                  <>
                    <p className="text-gray-300 text-sm mb-4">Configurazione effetto:</p>
                    <div className="bg-purple-600/20 border border-purple-500 rounded-lg p-4">
                      <div className="text-2xl mb-2">{EFFECT_TYPES.find(e => e.id === effectWizard.effectType)?.icon}</div>
                      <p className="text-white font-medium">{EFFECT_TYPES.find(e => e.id === effectWizard.effectType)?.label}</p>
                      <p className="text-gray-300 text-sm mt-2">{EFFECT_TYPES.find(e => e.id === effectWizard.effectType)?.description}</p>
                    </div>
                    {['protection', 'shield', 'freeze', 'burn', 'poison'].includes(effectWizard.effectType) && (
                      <div className="mt-4">
                        <p className="text-gray-300 text-sm mb-2">Durata:</p>
                        <div className="space-y-2">
                          {DURATION_OPTIONS.map(dur => (
                            <button
                              key={dur.id}
                              onClick={() => setEffectWizard(prev => ({ ...prev, duration: dur.id }))}
                              className={`w-full p-2 rounded-lg border text-left transition-all ${
                                effectWizard.duration === dur.id
                                  ? 'border-purple-500 bg-purple-600/30'
                                  : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                              }`}
                            >
                              <div className="text-white font-medium text-sm">{dur.label}</div>
                              <div className="text-gray-400 text-xs">{dur.description}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-gray-300 text-sm mb-4">Chi sara il bersaglio dell'effetto?</p>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {TARGET_OPTIONS.map(target => (
                        <button
                          key={target.id}
                          onClick={() => setEffectWizard(prev => ({ ...prev, target: target.id }))}
                          className={`w-full p-2 rounded-lg border text-left transition-all ${
                            effectWizard.target === target.id
                              ? 'border-purple-500 bg-purple-600/30'
                              : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                          }`}
                        >
                          <div className="text-white font-medium text-sm">{target.label}</div>
                          <div className="text-gray-400 text-xs">{target.description}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Value */}
            {effectWizard.step === 3 && needsValue() && effectWizard.effectType !== 'custom' && (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm mb-2">
                  {effectWizard.effectType === 'damage' && 'Quanti danni vuoi infliggere?'}
                  {effectWizard.effectType === 'heal' && 'Quanti PTI vuoi curare?'}
                  {effectWizard.effectType === 'draw' && 'Quante carte vuoi far pescare?'}
                  {effectWizard.effectType === 'discard' && 'Quante carte vuoi far scartare?'}
                  {effectWizard.effectType === 'stars' && 'Quante stelle? (numeri negativi per rimuovere)'}
                  {effectWizard.effectType === 'pti' && 'Di quanto modificare i PTI? (negativi per diminuire)'}
                  {effectWizard.effectType === 'counter' && 'Quanti danni infligge al contrattacco?'}
                  {effectWizard.effectType === 'reflect' && 'Che percentuale di danni riflette?'}
                  {effectWizard.effectType === 'steal' && 'Quante carte ruba?'}
                  {effectWizard.effectType === 'powerup' && 'Di quanto aumentare i PTI?'}
                  {effectWizard.effectType === 'weaken' && 'Di quanto ridurre i PTI nemici?'}
                  {effectWizard.effectType === 'poison' && 'Quanti danni per turno?'}
                  {effectWizard.effectType === 'burn' && 'Quanti danni per turno?'}
                  {effectWizard.effectType === 'freeze' && 'Per quanti turni congelare?'}
                  {effectWizard.effectType === 'lifesteal' && 'Quanti danni (che curano)?'}
                  {effectWizard.effectType === 'sacrifice' && 'Quanti PTI sacrificare?'}
                  {effectWizard.effectType === 'delay_defense' && 'Di quanti turni ritardare il danno?'}
                  {effectWizard.effectType === 'shield' && 'Quanti danni assorbire?'}
                  {effectWizard.effectType === 'drain' && 'Quanto assorbire?'}
                  {effectWizard.effectType === 'revenge' && 'Quanti danni alla morte?'}
                  {effectWizard.effectType === 'aura' && 'Di quanto potenziare gli alleati?'}
                  {effectWizard.effectType === 'protection' && 'Per quanti turni?'}
                </p>
                <Input
                  type="number"
                  value={effectWizard.value}
                  onChange={(e) => setEffectWizard(prev => ({ ...prev, value: e.target.value }))}
                  placeholder={['draw', 'discard', 'steal', 'freeze'].includes(effectWizard.effectType) ? '1' : effectWizard.effectType === 'reflect' ? '50' : '100'}
                  className="bg-gray-700 text-white border-gray-600 text-lg"
                />
                
                {/* Second value for complex effects */}
                {needsSecondValue() && (
                  <div className="mt-3">
                    <p className="text-gray-300 text-sm mb-2">
                      {effectWizard.effectType === 'poison' && 'Per quanti turni?'}
                      {effectWizard.effectType === 'powerup' && 'Quante stelle in piu?'}
                      {effectWizard.effectType === 'sacrifice' && 'Quanti danni infliggere?'}
                    </p>
                    <Input
                      type="number"
                      value={effectWizard.value2}
                      onChange={(e) => setEffectWizard(prev => ({ ...prev, value2: e.target.value }))}
                      placeholder={effectWizard.effectType === 'poison' ? '3' : effectWizard.effectType === 'powerup' ? '1' : '200'}
                      className="bg-gray-700 text-white border-gray-600"
                    />
                  </div>
                )}
                
                <p className="text-gray-500 text-xs">
                  {effectWizard.effectType === 'damage' && 'Consigliato: 50-300'}
                  {effectWizard.effectType === 'heal' && 'Consigliato: 50-200'}
                  {effectWizard.effectType === 'draw' && 'Consigliato: 1-3'}
                  {effectWizard.effectType === 'discard' && 'Consigliato: 1-2'}
                  {effectWizard.effectType === 'reflect' && 'Consigliato: 25-75%'}
                  {effectWizard.effectType === 'shield' && 'Consigliato: 100-300'}
                  {effectWizard.effectType === 'poison' && 'Consigliato: 30-100 per 2-4 turni'}
                </p>
              </div>
            )}

            {/* Step 3 for Custom: AI Analysis */}
            {effectWizard.step === 3 && effectWizard.effectType === 'custom' && (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-gray-300 text-sm mb-4">
                    {effectWizard.isAnalyzing 
                      ? 'Analisi in corso...' 
                      : effectWizard.analysisComplete 
                        ? 'Effetto analizzato con successo!'
                        : 'Analizzo la tua descrizione per verificare se serve qualche chiarimento.'}
                  </p>
                </div>
                
                {effectWizard.isAnalyzing && (
                  <div className="flex justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
                  </div>
                )}
                
                {!effectWizard.isAnalyzing && !effectWizard.analysisComplete && (
                  <Button
                    onClick={() => analyzeEffectWithAI()}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    <Sparkles size={16} className="mr-2" />
                    Analizza Effetto
                  </Button>
                )}
                
                {effectWizard.analysisComplete && effectWizard.aiQuestions.length === 0 && (
                  <div className="bg-green-600/20 border border-green-500 rounded-lg p-4">
                    <p className="text-green-400 text-sm text-center">
                      La descrizione e sufficientemente chiara. Puoi procedere!
                    </p>
                  </div>
                )}
                
                {effectWizard.aiQuestions.length > 0 && !effectWizard.analysisComplete && (
                  <div className="bg-amber-600/20 border border-amber-500 rounded-lg p-4">
                    <p className="text-amber-400 text-sm text-center">
                      Ho alcune domande per capire meglio l'effetto. Clicca Avanti per rispondere.
                    </p>
                  </div>
                )}
                
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
                  <p className="text-gray-400 text-xs mb-2">Riepilogo:</p>
                  <p className="text-white text-sm"><strong>Effetto:</strong> {effectWizard.customDescription}</p>
                  {effectWizard.animationDescription && (
                    <p className="text-white text-sm mt-2"><strong>Animazione:</strong> {effectWizard.animationDescription}</p>
                  )}
                  {effectWizard.behaviorDescription && (
                    <p className="text-white text-sm mt-2"><strong>Comportamento:</strong> {effectWizard.behaviorDescription}</p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4 for Custom: AI Questions */}
            {effectWizard.step === 4 && effectWizard.effectType === 'custom' && effectWizard.aiQuestions.length > 0 && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">❓</span>
                  <p className="text-gray-300 text-sm">Rispondi a queste domande per completare l'effetto:</p>
                </div>
                
                {effectWizard.aiQuestions.map((q, index) => (
                  <div key={q.id} className="bg-gray-700/50 border border-gray-600 rounded-lg p-4">
                    <p className="text-white text-sm font-medium mb-2">
                      {index + 1}. {q.question}
                    </p>
                    
                    {q.type === 'choice' && q.options ? (
                      <div className="space-y-2">
                        {q.options.map(option => (
                          <button
                            key={option}
                            onClick={() => handleAIAnswer(q.id, option)}
                            className={`w-full p-2 rounded-lg border text-left text-sm transition-all ${
                              effectWizard.aiAnswers[q.id] === option
                                ? 'border-purple-500 bg-purple-600/30 text-white'
                                : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                            }`}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    ) : q.type === 'number' ? (
                      <Input
                        type="number"
                        value={effectWizard.aiAnswers[q.id] || ''}
                        onChange={(e) => handleAIAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder || 'Inserisci un numero'}
                        className="bg-gray-700 text-white border-gray-600"
                      />
                    ) : (
                      <textarea
                        value={effectWizard.aiAnswers[q.id] || ''}
                        onChange={(e) => handleAIAnswer(q.id, e.target.value)}
                        placeholder={q.placeholder || 'Scrivi la tua risposta...'}
                        className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-sm resize-none"
                        rows={2}
                      />
                    )}
                  </div>
                ))}
                
                {/* Re-analyze button after answering questions */}
                {effectWizard.aiQuestions.every(q => effectWizard.aiAnswers[q.id]) && (
                  <div className="mt-4 space-y-3">
                    {effectWizard.aiInterpretation && (
                      <div className="bg-blue-600/20 border border-blue-500 rounded-lg p-3">
                        <p className="text-blue-400 text-xs mb-1">La mia interpretazione:</p>
                        <p className="text-white text-sm">{effectWizard.aiInterpretation}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => analyzeEffectWithAI(true)}
                        disabled={effectWizard.isAnalyzing}
                        className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        {effectWizard.isAnalyzing ? (
                          <>
                            <span className="animate-spin mr-2">⏳</span>
                            Verifico...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} className="mr-2" />
                            Verifica se servono altri dettagli
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => setEffectWizard(prev => ({ ...prev, analysisComplete: true, needsMoreInfo: false }))}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Conferma e procedi
                      </Button>
                    </div>
                    
                    {/* DICE OPTION for Custom Effects */}
                    <div className="border-t border-gray-600 pt-4 mt-4">
                      <div className="flex items-center gap-3 mb-3">
                        <Checkbox
                          id="dice-enabled-custom"
                          checked={effectWizard.diceEnabled}
                          onCheckedChange={(checked) => setEffectWizard(prev => ({ ...prev, diceEnabled: !!checked }))}
                        />
                        <label htmlFor="dice-enabled-custom" className="text-white font-medium flex items-center gap-2 cursor-pointer">
                          🎲 Attiva opzione DADO
                        </label>
                      </div>
                      
                      {effectWizard.diceEnabled && (
                        <div className="bg-gray-800 border border-amber-500/30 rounded-lg p-4 space-y-4">
                          {/* Dice Mode Selection */}
                          <div className="flex gap-4 mb-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="diceMode-custom"
                                checked={effectWizard.diceMode === 'choice'}
                                onChange={() => setEffectWizard(prev => ({ ...prev, diceMode: 'choice' }))}
                                className="accent-amber-500"
                              />
                              <span className="text-amber-300 text-sm">🎯 Dado CON scelta</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="diceMode-custom"
                                checked={effectWizard.diceMode === 'auto'}
                                onChange={() => setEffectWizard(prev => ({ ...prev, diceMode: 'auto' }))}
                                className="accent-purple-500"
                              />
                              <span className="text-purple-300 text-sm">🎲 Dado SENZA scelta</span>
                            </label>
                          </div>

                          {effectWizard.diceMode === 'choice' && (
                            <>
                              <p className="text-amber-300 text-sm">
                                I personaggi coinvolti dovranno scegliere un numero (1-6) o Pari/Dispari prima del lancio del dado.
                              </p>
                              
                              <div className="space-y-2">
                                <label className="text-green-400 text-sm font-medium flex items-center gap-2">
                                  ✅ Se INDOVINA il numero:
                                </label>
                                <select
                                  value={effectWizard.diceCorrectEffect}
                                  onChange={(e) => setEffectWizard(prev => ({ ...prev, diceCorrectEffect: e.target.value }))}
                                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm"
                                >
                                  {DICE_EFFECTS.map(effect => (
                                    <option key={effect.id} value={effect.id}>{effect.label}</option>
                                  ))}
                                </select>
                                {effectWizard.diceCorrectEffect === 'custom' && (
                                  <textarea
                                    value={effectWizard.diceCorrectCustom}
                                    onChange={(e) => setEffectWizard(prev => ({ ...prev, diceCorrectCustom: e.target.value }))}
                                    placeholder="Descrivi l'effetto personalizzato se indovina..."
                                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm resize-none"
                                    rows={2}
                                  />
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-red-400 text-sm font-medium flex items-center gap-2">
                                  ❌ Se SBAGLIA il numero:
                                </label>
                                <select
                                  value={effectWizard.diceWrongEffect}
                                  onChange={(e) => setEffectWizard(prev => ({ ...prev, diceWrongEffect: e.target.value }))}
                                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm"
                                >
                                  {DICE_EFFECTS.map(effect => (
                                    <option key={effect.id} value={effect.id}>{effect.label}</option>
                                  ))}
                                </select>
                                {effectWizard.diceWrongEffect === 'custom' && (
                                  <textarea
                                    value={effectWizard.diceWrongCustom}
                                    onChange={(e) => setEffectWizard(prev => ({ ...prev, diceWrongCustom: e.target.value }))}
                                    placeholder="Descrivi l'effetto personalizzato se sbaglia..."
                                    className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm resize-none"
                                    rows={2}
                                  />
                                )}
                              </div>
                            </>
                          )}

                          {effectWizard.diceMode === 'auto' && (
                            <>
                              <p className="text-purple-300 text-sm">
                                Il dado viene lanciato automaticamente e ogni personaggio riceve la conseguenza del numero uscito.
                              </p>
                              
                              <div className="space-y-3 max-h-64 overflow-y-auto">
                                {([1, 2, 3, 4, 5, 6] as const).map(num => (
                                  <div key={num} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                    <label className="text-white text-sm font-medium flex items-center gap-2 mb-2">
                                      🎲 Se esce {num}:
                                    </label>
                                    <select
                                      value={effectWizard.diceAutoEffects[num].effect}
                                      onChange={(e) => setEffectWizard(prev => ({
                                        ...prev,
                                        diceAutoEffects: {
                                          ...prev.diceAutoEffects,
                                          [num]: { ...prev.diceAutoEffects[num], effect: e.target.value }
                                        }
                                      }))}
                                      className="w-full bg-gray-600 text-white border border-gray-500 rounded-lg p-2 text-sm"
                                    >
                                      {DICE_EFFECTS.map(effect => (
                                        <option key={effect.id} value={effect.id}>{effect.label}</option>
                                      ))}
                                    </select>
                                    {effectWizard.diceAutoEffects[num].effect === 'custom' && (
                                      <textarea
                                        value={effectWizard.diceAutoEffects[num].custom}
                                        onChange={(e) => setEffectWizard(prev => ({
                                          ...prev,
                                          diceAutoEffects: {
                                            ...prev.diceAutoEffects,
                                            [num]: { ...prev.diceAutoEffects[num], custom: e.target.value }
                                          }
                                        }))}
                                        placeholder={`Descrivi cosa succede se esce ${num}...`}
                                        className="w-full bg-gray-600 text-white border border-gray-500 rounded-lg p-2 text-sm resize-none mt-2"
                                        rows={2}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Final Step: Condition (optional) */}
            {effectWizard.step === getStepCount() && effectWizard.effectType !== 'custom' && (
              <div className="space-y-3">
                <p className="text-gray-300 text-sm mb-4">Vuoi aggiungere una condizione? (opzionale)</p>
                <textarea
                  value={effectWizard.condition}
                  onChange={(e) => setEffectWizard(prev => ({ ...prev, condition: e.target.value }))}
                  placeholder="Es: Solo se il giocatore ha meno di 500 PTI..."
                  className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-3 text-sm resize-none"
                  rows={3}
                />
                <p className="text-gray-500 text-xs">Lascia vuoto se non ci sono condizioni particolari.</p>
                
                {/* DICE OPTION */}
                <div className="border-t border-gray-600 pt-4 mt-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Checkbox
                      id="dice-enabled"
                      checked={effectWizard.diceEnabled}
                      onCheckedChange={(checked) => setEffectWizard(prev => ({ ...prev, diceEnabled: !!checked }))}
                    />
                    <label htmlFor="dice-enabled" className="text-white font-medium flex items-center gap-2 cursor-pointer">
                      🎲 Attiva opzione DADO
                    </label>
                  </div>
                  
                  {effectWizard.diceEnabled && (
                    <div className="bg-gray-800 border border-amber-500/30 rounded-lg p-4 space-y-4">
                      {/* Dice Mode Selection */}
                      <div className="flex gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="diceMode"
                            checked={effectWizard.diceMode === 'choice'}
                            onChange={() => setEffectWizard(prev => ({ ...prev, diceMode: 'choice' }))}
                            className="accent-amber-500"
                          />
                          <span className="text-amber-300 text-sm">🎯 Dado CON scelta</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="diceMode"
                            checked={effectWizard.diceMode === 'auto'}
                            onChange={() => setEffectWizard(prev => ({ ...prev, diceMode: 'auto' }))}
                            className="accent-purple-500"
                          />
                          <span className="text-purple-300 text-sm">🎲 Dado SENZA scelta</span>
                        </label>
                      </div>

                      {effectWizard.diceMode === 'choice' && (
                        <>
                          <p className="text-amber-300 text-sm">
                            I personaggi coinvolti dovranno scegliere un numero (1-6) o Pari/Dispari prima del lancio del dado.
                          </p>
                          
                          <div className="space-y-2">
                            <label className="text-green-400 text-sm font-medium flex items-center gap-2">
                              ✅ Se INDOVINA il numero:
                            </label>
                            <select
                              value={effectWizard.diceCorrectEffect}
                              onChange={(e) => setEffectWizard(prev => ({ ...prev, diceCorrectEffect: e.target.value }))}
                              className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm"
                            >
                              {DICE_EFFECTS.map(effect => (
                                <option key={effect.id} value={effect.id}>{effect.label}</option>
                              ))}
                            </select>
                            {effectWizard.diceCorrectEffect === 'custom' && (
                              <textarea
                                value={effectWizard.diceCorrectCustom}
                                onChange={(e) => setEffectWizard(prev => ({ ...prev, diceCorrectCustom: e.target.value }))}
                                placeholder="Descrivi l'effetto personalizzato se indovina..."
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm resize-none"
                                rows={2}
                              />
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-red-400 text-sm font-medium flex items-center gap-2">
                              ❌ Se SBAGLIA il numero:
                            </label>
                            <select
                              value={effectWizard.diceWrongEffect}
                              onChange={(e) => setEffectWizard(prev => ({ ...prev, diceWrongEffect: e.target.value }))}
                              className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm"
                            >
                              {DICE_EFFECTS.map(effect => (
                                <option key={effect.id} value={effect.id}>{effect.label}</option>
                              ))}
                            </select>
                            {effectWizard.diceWrongEffect === 'custom' && (
                              <textarea
                                value={effectWizard.diceWrongCustom}
                                onChange={(e) => setEffectWizard(prev => ({ ...prev, diceWrongCustom: e.target.value }))}
                                placeholder="Descrivi l'effetto personalizzato se sbaglia..."
                                className="w-full bg-gray-700 text-white border border-gray-600 rounded-lg p-2 text-sm resize-none"
                                rows={2}
                              />
                            )}
                          </div>
                        </>
                      )}

                      {effectWizard.diceMode === 'auto' && (
                        <>
                          <p className="text-purple-300 text-sm">
                            Il dado viene lanciato automaticamente e ogni personaggio riceve la conseguenza del numero uscito.
                          </p>
                          
                          <div className="space-y-3 max-h-64 overflow-y-auto">
                            {([1, 2, 3, 4, 5, 6] as const).map(num => (
                              <div key={num} className="bg-gray-700/50 rounded-lg p-3 border border-gray-600">
                                <label className="text-white text-sm font-medium flex items-center gap-2 mb-2">
                                  🎲 Se esce {num}:
                                </label>
                                <select
                                  value={effectWizard.diceAutoEffects[num].effect}
                                  onChange={(e) => setEffectWizard(prev => ({
                                    ...prev,
                                    diceAutoEffects: {
                                      ...prev.diceAutoEffects,
                                      [num]: { ...prev.diceAutoEffects[num], effect: e.target.value }
                                    }
                                  }))}
                                  className="w-full bg-gray-600 text-white border border-gray-500 rounded-lg p-2 text-sm"
                                >
                                  {DICE_EFFECTS.map(effect => (
                                    <option key={effect.id} value={effect.id}>{effect.label}</option>
                                  ))}
                                </select>
                                {effectWizard.diceAutoEffects[num].effect === 'custom' && (
                                  <textarea
                                    value={effectWizard.diceAutoEffects[num].custom}
                                    onChange={(e) => setEffectWizard(prev => ({
                                      ...prev,
                                      diceAutoEffects: {
                                        ...prev.diceAutoEffects,
                                        [num]: { ...prev.diceAutoEffects[num], custom: e.target.value }
                                      }
                                    }))}
                                    placeholder={`Descrivi cosa succede se esce ${num}...`}
                                    className="w-full bg-gray-600 text-white border border-gray-500 rounded-lg p-2 text-sm resize-none mt-2"
                                    rows={2}
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Conditional Usage Options */}
                <div className="bg-gray-800/50 rounded-lg p-3 mt-4 border border-gray-600">
                  <p className="text-orange-400 text-xs font-medium mb-3">⚙️ Condizioni d'uso (opzionale)</p>
                  
                  {/* Requires specific character to use */}
                  <div className="mb-3">
                    <label className="flex items-center gap-2 text-gray-300 text-xs mb-1">
                      <input
                        type="checkbox"
                        checked={effectWizard.requiresCharacter}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, requiresCharacter: e.target.checked }))}
                        className="rounded bg-gray-700 border-gray-500"
                      />
                      Effetto attivo solo se usata con un personaggio specifico
                    </label>
                    {effectWizard.requiresCharacter && (
                      <input
                        type="text"
                        value={effectWizard.requiredCharacterName}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, requiredCharacterName: e.target.value }))}
                        placeholder="Nome del personaggio richiesto..."
                        className="w-full bg-gray-700 text-white border border-gray-500 rounded-lg p-2 text-xs mt-1"
                      />
                    )}
                  </div>
                  
                  {/* Target restriction */}
                  <div className="mb-3">
                    <label className="text-gray-300 text-xs mb-1 block">Restrizione bersaglio:</label>
                    <select
                      value={effectWizard.targetRestriction}
                      onChange={(e) => setEffectWizard(prev => ({ ...prev, targetRestriction: e.target.value as 'none' | 'only' | 'except' }))}
                      className="w-full bg-gray-700 text-white border border-gray-500 rounded-lg p-2 text-xs"
                    >
                      <option value="none">Nessuna restrizione</option>
                      <option value="only">Può essere usata SOLO su...</option>
                      <option value="except">NON può essere usata su...</option>
                    </select>
                    {effectWizard.targetRestriction !== 'none' && (
                      <input
                        type="text"
                        value={effectWizard.targetCharacterName}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, targetCharacterName: e.target.value }))}
                        placeholder="Nome del personaggio..."
                        className="w-full bg-gray-700 text-white border border-gray-500 rounded-lg p-2 text-xs mt-1"
                      />
                    )}
                  </div>
                  
                  {/* Field condition */}
                  <div>
                    <label className="text-gray-300 text-xs mb-1 block">Condizione campo:</label>
                    <select
                      value={effectWizard.fieldCondition}
                      onChange={(e) => setEffectWizard(prev => ({ ...prev, fieldCondition: e.target.value as 'none' | 'requires' | 'blocked' }))}
                      className="w-full bg-gray-700 text-white border border-gray-500 rounded-lg p-2 text-xs"
                    >
                      <option value="none">Nessuna condizione</option>
                      <option value="requires">Può essere usata SOLO SE in campo c'è...</option>
                      <option value="blocked">NON può essere usata se in campo c'è...</option>
                    </select>
                    {effectWizard.fieldCondition !== 'none' && (
                      <input
                        type="text"
                        value={effectWizard.fieldCardName}
                        onChange={(e) => setEffectWizard(prev => ({ ...prev, fieldCardName: e.target.value }))}
                        placeholder="Nome della carta..."
                        className="w-full bg-gray-700 text-white border border-gray-500 rounded-lg p-2 text-xs mt-1"
                      />
                    )}
                  </div>
                </div>
                
                {/* Preview */}
                <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mt-4">
                  <p className="text-gray-400 text-xs mb-2">Anteprima effetto:</p>
                  <p className="text-white font-medium text-sm">{generateEffectDescription(effectWizard)}</p>
                </div>
              </div>
            )}

            {/* Saved effects list */}
            {savedEffects.length > 0 && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4 border border-gray-600">
                <p className="text-gray-300 text-xs mb-2 font-medium">Effetti aggiunti ({savedEffects.length}):</p>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {savedEffects.map((effect, index) => (
                    <div key={index} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1">
                      <span className="text-green-400 text-xs flex-1 truncate">{effect.substring(0, 50)}...</span>
                      <button
                        onClick={() => removeEffectFromList(index)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex justify-between mt-6">
              <Button
                onClick={() => setEffectWizard(prev => ({ ...prev, step: Math.max(1, prev.step - 1) }))}
                disabled={effectWizard.step === 1}
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                <ChevronLeft size={16} className="mr-1" />
                Indietro
              </Button>

              {effectWizard.step < getStepCount() ? (
                <Button
                  onClick={() => setEffectWizard(prev => ({ ...prev, step: prev.step + 1 }))}
                  disabled={!canProceedToNextStep()}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  Avanti
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={addEffectToList}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    title="Aggiungi questo effetto e creane un altro"
                  >
                    <Plus size={16} className="mr-1" />
                    Aggiungi +
                  </Button>
                  <Button
                    onClick={applyEffectFromWizard}
                    disabled={isApplyingWizard}
                    className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-60"
                  >
                    <Sparkles size={16} className="mr-1" />
                    {isApplyingWizard ? 'Analisi in corso...' : (savedEffects.length > 0 ? `Applica ${savedEffects.length + 1} Effetti` : 'Applica Effetto')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
