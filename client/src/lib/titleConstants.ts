export type TitleRarity = 'comune' | 'raro' | 'epico' | 'leggendario';

export interface TitleInfo {
  name: string;
  icon: string;
  color: string;
  rarity: TitleRarity;
}

export const TITLE_MAP: Record<string, TitleInfo> = {
  esordiente:      { name: 'Esordiente',       icon: '🎮', color: '#94a3b8', rarity: 'comune'      },
  guerriero:       { name: 'Guerriero',         icon: '⚔️', color: '#94a3b8', rarity: 'comune'      },
  veterano:        { name: 'Veterano',          icon: '🛡️', color: '#60a5fa', rarity: 'raro'        },
  campione:        { name: 'Campione',          icon: '🏆', color: '#60a5fa', rarity: 'raro'        },
  dominatore:      { name: 'Dominatore',        icon: '👑', color: '#c084fc', rarity: 'epico'       },
  campione_gym:    { name: 'Campione GymMode',  icon: '🏅', color: '#60a5fa', rarity: 'raro'        },
  maestro_gym:     { name: 'Maestro Gym',       icon: '🌟', color: '#c084fc', rarity: 'epico'       },
  sfidante:        { name: 'Sfidante',          icon: '🔥', color: '#60a5fa', rarity: 'raro'        },
  maestro_rank:    { name: 'Maestro',           icon: '💎', color: '#c084fc', rarity: 'epico'       },
  leggenda:        { name: 'Leggenda',          icon: '⭐', color: '#fbbf24', rarity: 'leggendario' },
  campione_torneo: { name: 'Campione Torneo',   icon: '🎖️', color: '#fbbf24', rarity: 'leggendario' },
  longevo:         { name: 'Longevo',           icon: '⏳', color: '#c084fc', rarity: 'epico'       },
};

export const RARITY_COLOR: Record<TitleRarity, string> = {
  comune:       '#94a3b8',
  raro:         '#60a5fa',
  epico:        '#c084fc',
  leggendario:  '#fbbf24',
};

export const RARITY_BORDER: Record<TitleRarity, string> = {
  comune:       'rgba(148,163,184,0.25)',
  raro:         'rgba(96,165,250,0.3)',
  epico:        'rgba(192,132,252,0.4)',
  leggendario:  'rgba(251,191,36,0.5)',
};

export const RARITY_LABEL: Record<TitleRarity, string> = {
  comune:       'Comune',
  raro:         'Raro',
  epico:        'Epico',
  leggendario:  'Leggendario',
};
