export const haptic = {
  light: () => {
    if ('vibrate' in navigator) navigator.vibrate(10);
  },
  medium: () => {
    if ('vibrate' in navigator) navigator.vibrate(25);
  },
  heavy: () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
  },
  attack: () => {
    if ('vibrate' in navigator) navigator.vibrate([30, 50, 60]);
  },
  death: () => {
    if ('vibrate' in navigator) navigator.vibrate([50, 30, 50, 30, 100]);
  },
  evolution: () => {
    if ('vibrate' in navigator) navigator.vibrate([20, 40, 20, 40, 20, 40, 80]);
  },
  cardPlay: () => {
    if ('vibrate' in navigator) navigator.vibrate(15);
  },
  dice: () => {
    if ('vibrate' in navigator) navigator.vibrate([10, 20, 10, 20, 10]);
  },
  myTurn: () => {
    if ('vibrate' in navigator) navigator.vibrate([30, 60, 30]);
  },
};
