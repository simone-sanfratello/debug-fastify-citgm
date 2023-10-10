#!/bin/env node

const path = require('path')
const fs = require('fs')

const attempt = 12 // TODO from argv

const pullRequest = {
  // url: 'https://github.com/fastify/fastify/pull/5075',
  branch: 'fix/fastify-citgm',
  dir: '../fastify'
}

const auxRepo = {
  url: 'https://github.com/simone-sanfratello/fastify-citgm.git',
  branch: 'main',
  dir: '../fastify-citgm',
}

const npm = {
  package: 'fastify-citgm'
}

async function run(cmd, options) {
  const { execaCommandSync } = await import('execa')

  console.log('>', cmd)
  return execaCommandSync(cmd, options)
}

const cwd = path.join(process.cwd(), '../')
pullRequest.fullpath = path.join(process.cwd(), pullRequest.dir)
auxRepo.fullpath = path.join(process.cwd(), auxRepo.dir)


async function main() {
  // from PR branch
  const fastifyJson = require(path.join(pullRequest.fullpath, 'package.json'))
  const debugVersion = fastifyJson.version + '-dev-' + attempt

  // TODO check if npm package version already exists > quit

  // copy from pr repo to aut repo
  await run(`rsync -a ${pullRequest.fullpath}/ ${auxRepo.fullpath}/ --exclude .git --exclude .github`, { cwd })

  // patch values and remove things to point to the debugging module
  const citgmJson = {
    ...fastifyJson,
    name: npm.package,
    version: debugVersion,
    repository: {
      type: 'git',
      url: auxRepo.url
    },
    scripts: {
      ...fastifyJson.scripts,
      prepublishOnly: undefined
    }
  }
  fs.rmSync(path.join(auxRepo.fullpath, '.github'), { recursive: true, force: true })

  fs.writeFileSync(path.join(auxRepo.fullpath, 'package.json'), JSON.stringify(citgmJson, null, 2), 'utf8')
  fs.writeFileSync(path.join(auxRepo.fullpath, 'README.md'), '\n# DO NOT USE - for debugging purpose only\n', 'utf8')
  fs.writeFileSync(path.join(auxRepo.fullpath, 'fastify.js'),
    fs.readFileSync(path.join(auxRepo.fullpath, 'fastify.js'), 'utf8')
      .replace(/const VERSION = '[\d.-\w]+'/, `const VERSION = '${debugVersion}'`), 'utf8')

  // commit and push to auxiliary repo as main
  await run(`git add .`, { cwd: auxRepo.fullpath })
  
  await run('git commit -am ' + debugVersion, { cwd: auxRepo.fullpath })
  await run(`git push`, { cwd: auxRepo.fullpath })

  // publish to npm
  await run(`npm publish`, { cwd: auxRepo.fullpath })

  console.log('*** DONE')
  console.log('now run')

  const lookup = JSON.parse(fs.readFileSync(path.join(__dirname, 'lookup.json'), 'utf8'))
  console.log(`echo "${JSON.stringify(lookup).replaceAll('"', '\\"')}" > lookup.json`)
  console.log(`citgm ${npm.package} -l lookup.json`)
}

main()