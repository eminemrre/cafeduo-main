/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

describe('authority flag deployment contract', () => {
  // Production runs deploy/docker-compose.prod.yml through Deploy VPS
  // (deploy/scripts/deploy-production.sh); Dokploy uses its own file.
  it.each(['deploy/docker-compose.prod.yml', 'deploy/docker-compose.dokploy.yml'])(
    'passes the explicitly disabled-by-default flag into the API service of %s',
    (file) => {
      const compose = yaml.load(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8'));
      expect(compose.services.api.environment.GAME_ENGINE_V2_ENABLED).toBe(
        '${GAME_ENGINE_V2_ENABLED:-false}'
      );
    }
  );
  it('keeps both environment templates disabled', () => {
    for (const file of ['.env.example', '.env.production.example']) {
      expect(fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')).toMatch(
        /^GAME_ENGINE_V2_ENABLED=false$/m
      );
    }
  });
});
