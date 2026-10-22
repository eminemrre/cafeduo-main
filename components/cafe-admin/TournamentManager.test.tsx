import { GAME_TYPE_OPTIONS } from './TournamentManager';
import { SUPPORTED_GAME_TYPES } from '../../shared/gameRegistry';

describe('TournamentManager game types', () => {
  it('offers every game the backend accepts, plus "all games"', () => {
    const offered = GAME_TYPE_OPTIONS.map((option) => option.value).filter(Boolean);
    expect(new Set(offered)).toEqual(new Set(SUPPORTED_GAME_TYPES));
    expect(GAME_TYPE_OPTIONS[0]).toEqual({ value: '', label: 'Tüm oyunlar' });
  });
});
