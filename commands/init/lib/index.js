'use strict';

const Command = require('@lz-cli/command')
const log = require('@lz-cli/log')

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd._optionValues.force
    log.verbose(this.projectName, this.force);
  }

  exec() {
    console.log('initluoji')
  }
}

function init(argv) {
 
  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand= InitCommand;