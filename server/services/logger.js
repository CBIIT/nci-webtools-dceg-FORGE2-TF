const { createLogger, format, transports } = require('winston');
const { level: logLevel } = require('../config.json').logs;
const { Console } = transports;

// Console only; the FireLens sidecar ships stdout to Datadog.
module.exports = new createLogger({
  level: logLevel || 'info',
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.printf(info => `[${info.timestamp}] [${info.level}] ${info.stack ||
      (typeof info.message === 'string' ? info.message : JSON.stringify(info.message))
    }`)
  ),
  transports: [
    new Console(),
  ],
  exitOnError: false
});