const { createLogger, format, transports } = require('winston');
const { level: logLevel } = require('../config.json').logs;
const { Console } = transports;

// Logs go to stdout/stderr only; on Fargate the FireLens (fluent-bit) sidecar
// ships them to Datadog. No on-disk log files / rotation (nothing persists the
// container filesystem, and we don't mount an EFS logs folder).
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