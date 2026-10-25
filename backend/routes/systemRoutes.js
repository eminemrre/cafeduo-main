const express = require('express');
const { isWordBankReady: defaultWordBankReady } = require('../gameEngine/wordBank');

const createSystemRoutes = ({
  appVersion,
  appBuildTime,
  isDbConnected,
  getRedisStatus = () => ({ status: 'unknown' }),
  getSocketStatus = () => ({ connectedClients: 0 }),
  isWordBankReady = defaultWordBankReady,
}) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.send('✅ CafeDuo API Sunucusu Aktif!');
  });

  router.get('/api/meta/version', (req, res) => {
    res.json({
      commit: appVersion || 'local',
      buildTime: appBuildTime || null,
      nodeEnv: process.env.NODE_ENV || 'development',
    });
  });

  const healthHandler = async (req, res) => {
    const healthcheck = {
      uptime: process.uptime(),
      message: 'OK',
      timestamp: Date.now(),
      database: false,
    };

    try {
      healthcheck.database = await isDbConnected();
      if (healthcheck.database) {
        return res.status(200).json(healthcheck);
      }
      healthcheck.message = 'Database disconnected - Running in memory mode';
      return res.status(200).json(healthcheck);
    } catch (err) {
      healthcheck.message = err.message;
      return res.status(503).json(healthcheck);
    }
  };

  router.get('/health', healthHandler);
  router.get('/api/health', healthHandler);

  const readinessHandler = async (req, res) => {
    const checks = {
      database: false,
      redis: getRedisStatus(),
      socket: getSocketStatus(),
      // Adam Asmaca's private word bank (WORD_BANK_PATH); without it that game stays closed.
      wordBank: isWordBankReady(),
    };

    try {
      checks.database = await isDbConnected();
    } catch {
      checks.database = false;
    }

    const ready = Boolean(checks.database);

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'degraded',
      version: appVersion || 'local',
      buildTime: appBuildTime || null,
      nodeEnv: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
    });
  };

  router.get('/readiness', readinessHandler);
  router.get('/api/readiness', readinessHandler);

  return router;
};

module.exports = { createSystemRoutes };
