export const VALID_AVATAR_IDS = [
  'dragon', 'lion', 'wolf', 'eagle', 'shark', 'tiger', 'bear', 'fox',
  'owl', 'snake', 'unicorn', 'phoenix', 'wizard', 'knight', 'ninja',
  'robot', 'alien', 'skull', 'crown', 'star', 'fire', 'lightning',
  'diamond', 'heart'
];

export const isValidAvatarId = (avatarId: string): boolean => {
  return VALID_AVATAR_IDS.includes(avatarId);
};
