const express = require('express');

const createSystemRoutes = ({ appVersion, appBuildTime, isDbConnected }) => {
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

  return router;
};

module.exports = { createSystemRoutes };
