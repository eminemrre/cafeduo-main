const { isCompetitiveEngineGameType, isGameEngineV2Enabled } = require('./gameEngineConfig');

describe('gameEngineConfig', () => {
  const original = process.env.GAME_ENGINE_V2_ENABLED;

  afterEach(() => {
    if (original === undefined) delete process.env.GAME_ENGINE_V2_ENABLED;
    else process.env.GAME_ENGINE_V2_ENABLED = original;
  });

  it('is closed unless explicitly enabled', () => {
    delete process.env.GAME_ENGINE_V2_ENABLED;
    expect(isGameEngineV2Enabled()).toBe(false);
    process.env.GAME_ENGINE_V2_ENABLED = 'false';
    expect(isGameEngineV2Enabled()).toBe(false);
    process.env.GAME_ENGINE_V2_ENABLED = '1';
    expect(isGameEngineV2Enabled()).toBe(true);
    process.env.GAME_ENGINE_V2_ENABLED = ' TRUE ';
    expect(isGameEngineV2Enabled()).toBe(true);
  });

  it('classifies only quiz and aim as competitive engine games', () => {
    expect(isCompetitiveEngineGameType('Bilgi Yarışı')).toBe(true);
    expect(isCompetitiveEngineGameType('Nişancı Düellosu')).toBe(true);
    expect(isCompetitiveEngineGameType('Retro Satranç')).toBe(false);
    expect(isCompetitiveEngineGameType('bilinmeyen')).toBe(false);
  });
});
