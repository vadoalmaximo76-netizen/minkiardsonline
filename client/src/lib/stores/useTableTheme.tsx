import { create } from 'zustand';

export interface TableTheme {
  id: string;
  name: string;
  description: string;
  emoji: string;
  tableSurface: string;
  tableBorder: string;
  cardGlow: string;
  ambientColor: string;
  particleColor: string;
  fogColor: string;
  lightIntensity: number;
  backgroundGradient: string;
}

export const TABLE_THEMES: TableTheme[] = [
  {
    id: 'classic_wood',
    name: 'Legno Classico',
    description: 'Il tavolo da gioco tradizionale in legno caldo',
    emoji: '🪵',
    tableSurface: 'radial-gradient(ellipse at center, #5c3d2e 0%, #3e2723 50%, #2c1810 100%)',
    tableBorder: '#8d6e4a',
    cardGlow: '0 0 15px rgba(139, 110, 74, 0.3)',
    ambientColor: '#d4a574',
    particleColor: '#c4956a',
    fogColor: 'rgba(92, 61, 46, 0.15)',
    lightIntensity: 0.7,
    backgroundGradient: 'linear-gradient(135deg, rgba(60, 30, 15, 0.3) 0%, rgba(40, 20, 10, 0.5) 100%)',
  },
  {
    id: 'black_marble',
    name: 'Marmo Nero',
    description: 'Elegante superficie in marmo nero con venature dorate',
    emoji: '🖤',
    tableSurface: 'radial-gradient(ellipse at center, #2a2a2a 0%, #1a1a1a 50%, #0d0d0d 100%)',
    tableBorder: '#c9a96e',
    cardGlow: '0 0 20px rgba(201, 169, 110, 0.4)',
    ambientColor: '#c9a96e',
    particleColor: '#ffd700',
    fogColor: 'rgba(20, 20, 20, 0.2)',
    lightIntensity: 0.6,
    backgroundGradient: 'linear-gradient(135deg, rgba(10, 10, 10, 0.4) 0%, rgba(20, 15, 5, 0.5) 100%)',
  },
  {
    id: 'green_felt',
    name: 'Stoffa Verde Poker',
    description: 'Il classico panno verde da tavolo da gioco',
    emoji: '♠️',
    tableSurface: 'radial-gradient(ellipse at center, #2d6b3f 0%, #1e5631 50%, #143d22 100%)',
    tableBorder: '#6b8f3b',
    cardGlow: '0 0 15px rgba(107, 143, 59, 0.3)',
    ambientColor: '#4caf50',
    particleColor: '#81c784',
    fogColor: 'rgba(30, 86, 49, 0.15)',
    lightIntensity: 0.75,
    backgroundGradient: 'linear-gradient(135deg, rgba(15, 40, 20, 0.3) 0%, rgba(10, 30, 15, 0.5) 100%)',
  },
  {
    id: 'fire_arena',
    name: 'Arena di Fuoco',
    description: "Un'arena infuocata per battaglie epiche",
    emoji: '🔥',
    tableSurface: 'radial-gradient(ellipse at center, #4a1a0a 0%, #3d0c02 50%, #1a0500 100%)',
    tableBorder: '#ff4500',
    cardGlow: '0 0 25px rgba(255, 69, 0, 0.5)',
    ambientColor: '#ff6b35',
    particleColor: '#ff4500',
    fogColor: 'rgba(74, 26, 10, 0.2)',
    lightIntensity: 0.8,
    backgroundGradient: 'linear-gradient(135deg, rgba(50, 10, 0, 0.4) 0%, rgba(30, 5, 0, 0.6) 100%)',
  },
  {
    id: 'cosmic_space',
    name: 'Spazio Cosmico',
    description: 'Un tavolo che fluttua nello spazio profondo',
    emoji: '🌌',
    tableSurface: 'radial-gradient(ellipse at center, #1a1a3e 0%, #0d0d2b 50%, #050518 100%)',
    tableBorder: '#7b68ee',
    cardGlow: '0 0 20px rgba(123, 104, 238, 0.4)',
    ambientColor: '#9370db',
    particleColor: '#e0e0ff',
    fogColor: 'rgba(13, 13, 43, 0.2)',
    lightIntensity: 0.5,
    backgroundGradient: 'linear-gradient(135deg, rgba(10, 5, 30, 0.4) 0%, rgba(5, 0, 20, 0.6) 100%)',
  },
];

interface TableThemeStore {
  currentThemeId: string;
  setTheme: (themeId: string) => void;
  getCurrentTheme: () => TableTheme;
}

const useTableTheme = create<TableThemeStore>((set, get) => ({
  currentThemeId: localStorage.getItem('minkiards_table_theme') || 'classic_wood',
  setTheme: (themeId: string) => {
    localStorage.setItem('minkiards_table_theme', themeId);
    set({ currentThemeId: themeId });
  },
  getCurrentTheme: () => {
    const { currentThemeId } = get();
    return TABLE_THEMES.find(t => t.id === currentThemeId) || TABLE_THEMES[0];
  },
}));

export default useTableTheme;
