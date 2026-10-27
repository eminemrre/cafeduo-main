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

describe('deploy script readiness gate', () => {
  const script = fs.readFileSync(path.resolve(__dirname, '../../deploy/scripts/deploy-production.sh'), 'utf8');

  it('rolls back unless e-mail and the word bank are ready, not only the database', () => {
    // The readiness assert runs inside the ERR trap, so a failure triggers rollback().
    const assertLine = script.split('\n').find((line) => line.includes("body['status']=='ready'"));
    expect(assertLine).toMatch(/checks'\]\.get\('email'\) is True/);
    expect(assertLine).toMatch(/checks'\]\.get\('wordBank'\) is True/);
    // The last 'trap - ERR' ends the guarded section (the first is inside rollback()).
    expect(script.indexOf(assertLine)).toBeGreaterThan(script.indexOf('trap rollback ERR'));
    expect(script.indexOf(assertLine)).toBeLessThan(script.lastIndexOf('trap - ERR'));
  });
});
