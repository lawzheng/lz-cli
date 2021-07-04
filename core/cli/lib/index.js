'use strict';

module.exports = core;

const path =  require('path')
const semver = require('semver')
const userHome = require('user-home')
const pathExists = require('path-exists')
const colors = require('colors/safe')
const commander = require('commander')
const log = require('@lz-cli/log')
const init = require('@lz-cli/init')
const exec = require('@lz-cli/exec')

const constant = require('./const')
const pkg = require('../package.json')

let args, config

const program = new commander.Command()

async function core() {
  try {
    await prepare()
    registerCommand()
  } catch (e) {
    log.error(e)
  }
}

function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '');

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec)

  // 开启debug模式
  program.on('option:debug', function() {
    if (this._optionValues.debug) {
      process.env.LOG_LEVEL = 'verbose'
    } else {
      process.env.LOG_LEVEL = 'info'
    }
    log.setLogLevel()
  })

  program.on('option:targetPath', function() {
    process.env.CLI_TAEGET_PATH = program._optionValues.targetPath
  })

  // 对未知命令监听
  program.on('command:*', function(obj) {
    const avaliableCommands = program.commands.map(cmd => cmd.name())
    console.log(colors.red('未知的命令：' + obj[0]))
    if (avaliableCommands.length > 0) {
      console.log(colors.red('可用命令：' + avaliableCommands.join(',')))
    }
  })

  program.parse(process.argv)
  
  if (program.args && program.args.length < 1) {
    program.outputHelp()
  }
}

async function prepare() {
  checkPkgVersion()
  checkNodeVersion()
  // checkRoot()
  checkUserHome()
  // checkInputArgs()
  checkEnv()
  await checkGlobalUpdate()
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
