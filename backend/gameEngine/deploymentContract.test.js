/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('Dokploy authority flag contract', () => {
  it('passes the explicitly disabled-by-default flag into the API service', () => {
    const compose = yaml.load(
      fs.readFileSync(path.resolve(__dirname, '../..', 'deploy/docker-compose.dokploy.yml'), 'utf8')
    );
    expect(compose.services.api.environment.GAME_ENGINE_V2_ENABLED).toBe(
      '${GAME_ENGINE_V2_ENABLED:-false}'
    );
  });
  it('keeps both environment templates disabled', () => {
    for (const file of ['.env.example', '.env.production.example']) {
      expect(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')).toMatch(
        /^GAME_ENGINE_V2_ENABLED=false$/m
      );
    }
  });
});
