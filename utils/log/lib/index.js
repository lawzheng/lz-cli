'use strict';


const log = require('npmlog')


log.setLogLevel = function() {
  log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info';
}

log.heading = 'lz'
log.addLevel('success', 2000, { fg: 'green', bold: true })


module.exports = log;
