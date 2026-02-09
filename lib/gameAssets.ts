export const GAME_ASSETS = {
  backgrounds: {
    reflexRush: '/assets/games/retro-kit/reflex-puzzle.webp',
    rhythmCopy: '/assets/games/retro-kit/war-tanks.webp',
    oddEvenSprint: '/assets/games/retro-kit/strategy-hex.webp',
    strategyChess: '/assets/games/retro-kit/strategy-hex.webp',
    knowledgeQuiz: '/assets/games/retro-kit/knowledge-board.webp',
  },
  hud: {
    coin: '/assets/games/kenney/hud/hudCoin.png',
    heart: '/assets/games/kenney/hud/hudHeart_full.png',
    jewel: '/assets/games/kenney/hud/hudJewel_blue.png',
  },
  sfx: {
    select: '/assets/games/sfx/select.wav',
    success: '/assets/games/sfx/success.wav',
    fail: '/assets/games/sfx/fail.wav',
    hit: '/assets/games/sfx/hit.wav',
  },
} as const;

export type GameSfxKey = keyof typeof GAME_ASSETS.sfx;
