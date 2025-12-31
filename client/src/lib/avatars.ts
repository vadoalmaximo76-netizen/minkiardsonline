export const AVATARS = [
  { id: 'dragon', emoji: '🐉', name: 'Drago' },
  { id: 'lion', emoji: '🦁', name: 'Leone' },
  { id: 'wolf', emoji: '🐺', name: 'Lupo' },
  { id: 'eagle', emoji: '🦅', name: 'Aquila' },
  { id: 'shark', emoji: '🦈', name: 'Squalo' },
  { id: 'tiger', emoji: '🐯', name: 'Tigre' },
  { id: 'bear', emoji: '🐻', name: 'Orso' },
  { id: 'fox', emoji: '🦊', name: 'Volpe' },
  { id: 'owl', emoji: '🦉', name: 'Gufo' },
  { id: 'snake', emoji: '🐍', name: 'Serpente' },
  { id: 'unicorn', emoji: '🦄', name: 'Unicorno' },
  { id: 'phoenix', emoji: '🔥', name: 'Fenice' },
  { id: 'wizard', emoji: '🧙', name: 'Mago' },
  { id: 'knight', emoji: '⚔️', name: 'Cavaliere' },
  { id: 'ninja', emoji: '🥷', name: 'Ninja' },
  { id: 'robot', emoji: '🤖', name: 'Robot' },
  { id: 'alien', emoji: '👽', name: 'Alieno' },
  { id: 'skull', emoji: '💀', name: 'Teschio' },
  { id: 'crown', emoji: '👑', name: 'Corona' },
  { id: 'star', emoji: '⭐', name: 'Stella' },
  { id: 'fire', emoji: '🔥', name: 'Fuoco' },
  { id: 'lightning', emoji: '⚡', name: 'Fulmine' },
  { id: 'diamond', emoji: '💎', name: 'Diamante' },
  { id: 'heart', emoji: '❤️', name: 'Cuore' },
];

export const DEFAULT_AVATAR = AVATARS[0];

export const getAvatarById = (id: string) => {
  return AVATARS.find(a => a.id === id) || DEFAULT_AVATAR;
};

export const getAvatarEmoji = (id: string) => {
  const avatar = getAvatarById(id);
  return avatar.emoji;
};
