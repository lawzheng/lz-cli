'use strict';

module.exports = core;

const path =  require('path')
const semver = require('semver')
const log = require('@lz-cli/log')
const userHome = require('user-home')
const pathExists = require('path-exists')
const colors = require('colors/safe')

const constant = require('./const')
const pkg = require('../package.json')

let args, config

async function core() {
  try {
    checkPkgVersion()
    checkNodeVersion()
    // checkRoot()
    checkUserHome()
    checkInputArgs()
    checkEnv()
    await checkGlobalUpdate()
  } catch (e) {
    log.error(e)
  }
}

async function checkGlobalUpdate() {
  const currentVersion = pkg.version
  const npmName = pkg.name

  const { getNpmSemverVersion } = require('@lz-cli/get-npm-info')
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn('更新提示', colors.yellow(`请手动更新 ${npmName}，当前版本：${currentVersion}，最新版本：${lastVersion}
      更新命令:   npm install -g ${npmName}
    `))
  }
}

function checkEnv() {
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(__dirname, '../../../.env')
  if (pathExists(dotenvPath)) {
    dotenv.config({
      path: dotenvPath
    })
  }
  createDefaultConfig()
  log.verbose('环境变量', process.env.CLI_HOME_PATH)
}

function createDefaultConfig() {
  const cliConfig = {
    home: userHome,
  }
  if (process.env.CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}

function checkInputArgs() {
  const minimist = require('minimist')
  args = minimist(process.argv.slice(2))
  checkArgs()
}

function checkArgs() {
  if (args.debug) {
    process.env.LOG_LEVEL = 'verbose'
  } else {
    process.env.LOG_LEVEL = 'info'
  }
  log.setLogLevel()
}

function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在'))
  }
}

function checkRoot() {
  // 此方法仅适用于POSIX平台
  // console.log(process.geteuid())

  const rootCheck = require('root-check')
  rootCheck()
}

function checkNodeVersion() {
  const currentVersion = process.version;
  const lowestVersion = constant.LOWEST_NODE_VERSION
  if (!semver.gte(currentVersion, lowestVersion)) {
    throw new Error(colors.red(`lz-cli 需要安装 v${lowestVersion} 以上版本的 Node.js`));
  }
}

function checkPkgVersion() {
  log.notice('cli', pkg.version)
}
