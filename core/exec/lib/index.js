'use strict';

const path = require('path')
const Package = require('@lz-cli/package')
const log = require('@lz-cli/log')
const { exec: spawn } = require('@lz-cli/utils')

const SETTINGS = {
  init: '@imooc-cli/init'
}

const CACHE_DIR = 'dependencies'

async function exec() {
  let targetPath = process.env.CLI_TAEGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  let storeDir = ''
  let pkg;
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)
  
  const cmdObj = arguments[arguments.length - 1]
  const cmdName = cmdObj.name()
  const packageName = SETTINGS[cmdName]
  const packageVersion = 'latest'

  if (!targetPath) {
    // 生成缓存路径
    targetPath = path.resolve(homePath, CACHE_DIR)
    storeDir = path.resolve(targetPath, 'node_modules')
    log.verbose('targetPath', targetPath)
    log.verbose('storeDir', storeDir)

    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
    if (await pkg.exists()) {
      // 更新package
      await pkg.update()
    } else {
      await pkg.install()
    }
  } else {
    pkg = new Package({
      targetPath,
      storeDir,
      packageName,
      packageVersion
    })
  }
  const rootFile = pkg.getRootFilePath()
  if (rootFile) {
    try {
      // 在当前进程
      // require(rootFile).call(null, Array.from(arguments));

      const args = Array.from(arguments)
      const cmd = args[args.length - 1]
      const o = Object.create(null)
      Object.keys(cmd).forEach(key => {
        if (cmd.hasOwnProperty(key) &&
          (!key.startsWith('_') || key === '_optionValues') &&
          key !== 'parent'
        ) {
          o[key] = cmd[key]
        }
      })
      args[args.length - 1] = o
      const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
      const child = spawn('node', ['-e', code], {
        cwd: process.cwd(),
        stdio: 'inherit'  // inherit就不需要std去监听
      })
      child.on('error', e => {
        log.error(e.message)
        process.exit(1)
      })
      child.on('exit', e => {
        log.verbose('命令执行成功:' + e)
        process.exit(e)
      })
      // child.stdout.on('data', (chunk => {

      // }))
      // child.stderr.on('data', (chunk => {
        
      // }))
    } catch (e) {
      log.error(e.message)
    }
  }
}

module.exports = exec;