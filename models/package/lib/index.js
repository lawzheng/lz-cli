'use strict';
const pkgDir = require('pkg-dir').sync
const path =require('path')
const npminstall = require('npminstall')
const pathExists = require('path-exists').sync
const fse = require('fs-extra')

const { isObject } = require('@lz-cli/utils')
const formatPath = require('@lz-cli/format-path')
const { getDefaultRegistry, getNpmLatestVersion} = require('@lz-cli/get-npm-info')


class Package {
  constructor(options) {
    if (!options) {
      throw new Error('Package类的options参数不能为空!')
    }
    if (!isObject(options)) {
      throw new Error('Package类的options参数必须为对象!')
    }

    this.targetPath = options.targetPath
    this.storeDir = options.storeDir
    this.packageName = options.packageName
    this.packageVersion = options.packageVersion
    this.cacheFilePathPrefix = this.packageName.replace('/', '_')
  }

  async prepare() {
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir)
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLatestVersion(this.packageName)
    }
  }

  get cacheFilePath() {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
  }

  /**
   * 获取本地存储路径名
   * @param {*} packageVersion 
   * @returns 
   */
  getSpecificCacheFilePath(packageVersion) {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
  }

  async exists() {
    if (this.storeDir) {
      await this.prepare()
      return pathExists(this.cacheFilePath)
    } else {
      return pathExists(this.targetPath)
    }
  }

  async install() {
    await this.prepare()
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(),
      pkgs: [
        { 
          name: this.packageName,
          version: this.packageVersion
        }
      ]
    })
  }

  /**
   * 更新流程
   */
  async update() {
    await this.prepare()
    const lastestVersion = await getNpmLatestVersion(this.packageName)
    const latestFilePath = this.getSpecificCacheFilePath(lastestVersion)
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(),
        pkgs: [
          { 
            name: this.packageName,
            version: lastestVersion
          }
        ]
      })
      this.packageVersion = lastestVersion
    } else {
      this.packageVersion = lastestVersion
    }
  }

  getRootFilePath() {
    function _getRootFilePath(targetPath) {
      const dir = pkgDir(targetPath)
      if (dir) {
        const pkgFile = require(path.resolve(dir, 'package.json'))
        if (pkgFile && (pkgFile.main)) {
          return formatPath(path.resolve(dir, pkgFile.main))
        }
      }
      return null;
    }
    if (this.storeDir) {
      return _getRootFilePath(this.cacheFilePath)
    } else {
      return _getRootFilePath(this.targetPath)
    }
  }
}

module.exports = Package;