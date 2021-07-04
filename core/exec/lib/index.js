'use strict';

module.exports = exec;

const Package = require('@lz-cli/package')

function exec() {
  const pkg = new Package()
  console.log(pkg)
  console.log(process.env.CLI_TAEGET_PATH);
  console.log(process.env.CLI_HOME_PATH);
}
