'use strict';

const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

function getNpmInfo(npmName, registry) {
  if (!npmName) {
    return null;
  }
  const registryUrl = registry || getDefaultRegistry()
  const npmInfoUrl = urlJoin(registryUrl, npmName)
  console.log(npmInfoUrl)
  return axios.get(npmInfoUrl).then(response => {
    if (response.status === 200) {
      return response.data
    }
    return null
  }).catch(err => {
    return Promise.reject((err))
  })
}

function getDefaultRegistry(isOriginal = true) {
  return isOriginal ? 'https://registry.npmjs.org' : 'https://registry.npm.taobeo.org'
}

async function getNpmVersions(npmName, registry) {
  const data = await getNpmInfo(npmName, registry)
  if (data) {
    return Object.keys(data.versions)
  } else {
    return []
  }
}

function getNpmSemverVersions(baseVersion, versions) {
  return versions
    .filter(version => semver.satisfies(version, `^${baseVersion}`))
    .sort((a, b) => semver.gt(b, a))
}

async function getNpmSemverVersion(baseVersion, npmName, registry) {
  const versions = await getNpmVersions(npmName, registry)
  const newVersions = getNpmSemverVersions(baseVersion, versions)
  if (newVersions && newVersions.length) {
    return newVersions[0]
  }
}

module.exports = {
  getNpmInfo,
  getNpmVersions,
  getNpmSemverVersions,
  getNpmSemverVersion
};
