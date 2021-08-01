'use strict';

const fs = require('fs')
const path = require('path')
const userHome = require('user-home')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const glob = require('glob')
const ejs = require('ejs')

const Command = require('@lz-cli/command')
const log = require('@lz-cli/log')
const Package = require('@lz-cli/package')
const { spinnerStart, execAsync } = require('@lz-cli/utils')

const getProjectTemplate = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

const TEMPLATE_TYPE_NORMAL = 'normal'
const TEMPLATE_TYPE_CUSTOM = 'custom'

const WHITE_COMMAND = ['npm', 'cnpm']

log.level = 'verbose';

class InitCommand extends Command {
  init() {
    this.projectName = this._argv[0] || ''
    this.force = !!this._cmd._optionValues.force
    log.verbose(this.projectName, this.force);
  }

  async exec() {
    try {
      // 1.准备阶段
      const projectInfo = await this.prepare()
      if (projectInfo) {
        log.verbose('projectInfo', projectInfo)
        // 2.下载模板
        this.projectInfo = projectInfo
        await this.downLoadTemplate()
        // 3.安装模板
        await this.installTemplate()
      }
    } catch (e) {
      log.error(e.message)
      if (process.env.LOG_LEVEL === 'verbose') {
        console.log(e)
      }
    }
  }

  async installTemplate() {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TEMPLATE_TYPE_NORMAL
      }

      if (this.templateInfo.type === TEMPLATE_TYPE_NORMAL) {
        // 标准模板
        await this.installNormalTemplate()
      } else if (this.templateInfo.type === TEMPLATE_TYPE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate()
      } else {
        throw new Error('无法识别项目模板类型')
      }
    } else {
      throw new Error('项目模板信息不存在！')
    }
  }

  checkCommand(cmd) {
    if (WHITE_COMMAND.includes(cmd)) {
      return cmd
    }
    return null
  }

  async execCommand(command, errMsg) {
    let ret
    if (command) {
      const cmdArray = command.split(' ')
      const cmd = this.checkCommand(cmdArray[0])
      if (!cmd) {
        throw new Error('命令不存在：' + command)
      }
      const args = cmdArray.slice(1)
      ret = await execAsync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd()
      })
      if (ret !== 0) {
        throw new Error(errMsg)
      }
    }
  }

  async ejsRender(options) {
    const dir = process.cwd()
    return new Promise((resolve, reject) => {
      glob('**', {
        cwd: dir,
        ignore: options.ignore || '',
        nodir: true
      }, (err, files) => {
        if (err) {
          reject(err)
        }
        Promise.all(files.map(file => {
          const filePath = path.join(dir, file)
          return new Promise((resolve1, reject1) => {
            ejs.renderFile(filePath, this.projectInfo, {}, (err, result) => {
              if (err) {
                reject1(err)
              } else {
                fse.writeFileSync(filePath, result)
                resolve1(result)
              }
            })
          })
        })).then(() => {
          resolve()
        }).catch(e => {
          reject(e)
        })
      })
    })
  }

  async installNormalTemplate() {
    // 拷贝模板代码至当前目录
    let spinner = spinnerStart('正在安装模板')
    try {
      const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
      const targetPath = process.cwd()
      fse.ensureDirSync(templatePath)
      fse.ensureDirSync(targetPath)
      fse.copySync(templatePath, targetPath)
    } catch (e) {
      throw e
    } finally {
      spinner.stop(true)
      log.success('模板安装成功')
    }
    const templateIgnore = this.templateInfo.ignore || []
    const ignore = ['node_modules/**', ...templateIgnore]
    await this.ejsRender({ ignore })
    // 依赖安装
    const { installCommand, startCommand } = this.templateInfo
    await this.execCommand(installCommand, '依赖安装失败')
    // 执行启动命令
    await this.execCommand(startCommand, '启动执行命令失败')
  }

  async installCustomTemplate() {
    if (await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath()
      if (fs.existsSync(rootFile)) {
        log.notice('开始执行自定义模板!')
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template');
        const options = {
          templateInfo: this.templateInfo,
          projectInfo: this.projectInfo,
          sourcePath: templatePath,
          targetPath: process.cwd(),
        };
        const code = `require('${rootFile}')(${JSON.stringify(options)})`;
        log.verbose('code', code)
        await execAsync('node', ['-e', code], { stdio: 'inherit', cwd: process.cwd() });
      } else {
        throw new Error('自定义模板入口文件不存在！')
      }
    }
  }

  async downLoadTemplate() {
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    const targetPath = path.resolve(userHome, '.lz-cli', 'template')
    const storeDir = path.resolve(userHome, '.lz-cli', 'template', 'node_modules')
    const { npmName, version } = templateInfo
    this.templateInfo = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    if (! await templateNpm.exists()) {
      const spinner = spinnerStart('正在下载模板...')
      try {
        await templateNpm.install()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('下载模板成功')
          this.templateNpm = templateNpm
        }
      }
    } else {
      const spinner = spinnerStart('正在更新模板...')
      try {
        await templateNpm.update()
      } catch (e) {
        throw e
      } finally {
        spinner.stop(true)
        if (await templateNpm.exists()) {
          log.success('更新模板成功')
          this.templateNpm = templateNpm
        }
      }
    }
  }

  async prepare() {
    // 0.判断项目模板是否存在
    const template = await getProjectTemplate()
    if (!template || template.length === 0) {
      throw new Error('项目模板不存在')
    }
    this.template = template
    // 或者 path.resolve('.')
    const localPath = process.cwd()
    // 1.判断当前目录是否为空
    if (!this.isDirEmpty(localPath)) {
      let ifContinue = false
      if (!this.force) {
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空，是否继续创建项目？'
        })).ifContinue
        if (!ifContinue) {
          return
        }
      }
      // 2.是否启动强制更新
      if (ifContinue || this.force) {
        // 二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？'
        })
        if (confirmDelete) {
          // 清空文件夹
          fse.emptyDirSync(localPath)
        }
      }
    }
    return this.getProjectInfo()
  }

  async getProjectInfo() {
    function isValidName(v) {
      return /^[a-zA-Z]+([-][a-zA-Z][a-zA-Z0-9]*|[_][a-zA-Z][a-zA-Z0-9]*|[a-zA-Z0-9])*$/.test(v)
    }

    let projectInfo = {}
    let isProjectNameValid = false
    if (isValidName(this.projectName)) {
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }

    // 3.选择创建项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      message: '请选择初始化类型',
      default: TYPE_PROJECT,
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT
        },
        {
          name: '组件',
          value: TYPE_COMPONENT
        }
      ]
    })
    log.verbose('type', type)
    this.template = this.template.filter(template => template.tag.includes(type))
    const title = type === TYPE_PROJECT ? '项目' : '组件'
    const projectPrompt = []
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        const done = this.async()

        setTimeout(() => {
          // \w  a-zA-Z0-9_
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`)
            return
          }
          done(null, true)
        }, 0);
      },
      filter: function (v) {
        return v
      }
    }
    if (!isProjectNameValid) {
      projectPrompt.push(projectNamePrompt)
    }
    projectPrompt.push(
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '',
        validate: function (v) {
          const done = this.async()
          setTimeout(() => {
            if (!(!!semver.valid(v))) {
              done('请输入合法的版本号')
              return
            }
            done(null, true)
          }, 0);
        },
        filter: function (v) {
          if (semver.valid(v)) {
            return semver.valid(v)
          } else {
            return v
          }
        }
      },
      {
        type: 'list',
        name: 'projectTemplate',
        message: `请选择${title}模板`,
        choices: this.createTemplateChoice()
      }
    )
    if (type === TYPE_PROJECT) {
      // 4.获取项目的基本信息
      const project = await inquirer.prompt(projectPrompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...project
      }
    } else if (type === TYPE_COMPONENT) {
      const descriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: `请输入${title}描述信息`,
        default: '',
        validate: function (v) {
          const done = this.async()
  
          setTimeout(() => {
            if (!v) {
              done(`请输入${title}描述信息`)
              return
            }
            done(null, true)
          }, 0);
        }
      }
      projectPrompt.push(descriptionPrompt)
      const component = await inquirer.prompt(projectPrompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...component
      }
    }

    if (projectInfo.projectName) {
      // 驼峰转-
      projectInfo.name = projectInfo.projectName
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '')
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription
    }
    return projectInfo
  }

  createTemplateChoice() {
    return this.template.map(item => ({
      value: item.npmName,
      name: item.name
    }))
  }

  isDirEmpty(localPath) {
    let fileList = fs.readdirSync(localPath)
    // 文件过滤逻辑
    fileList = fileList.filter(file => (
      !file.startsWith('.') &&
      ['node_modules'].indexOf(file) < 0
    ))

    return !fileList || fileList.length <= 0
  }
}

function init(argv) {

  return new InitCommand(argv)
}

module.exports = init
module.exports.InitCommand = InitCommand;