#!/usr/bin/env node
'use strict'

const glob = require('glob')
const path = require('path')
const fs = require('fs')
const execSync = require('child_process').execSync
const semver = require('semver')
const cwd = process.cwd()
const verType = process.argv[2]
if (!verType) {
	throw `Missing version argument.`
}
const releaseTextFile = process.argv[3] || ''
const verbose = false //true

// root package version
const rootPkg = require(path.join(cwd, '/package.json'))
const commitMsg = ex(`git log --format=%B -n 1 v${rootPkg.version}`, {
	message: `Error finding a commit message prefixed with v${rootPkg.version}: cannot diff for changes`
})
const newVersion = semver.inc(rootPkg.version, verType)
console.log('New version:', newVersion)

const pkgs = {}
for (const w of rootPkg.workspaces) {
	const paths = glob.sync(`${w}/package.json`, { cwd })
	for (const pkgPath of paths) {
		const pkg = require(path.join(cwd, pkgPath))
		const pkgDir = pkgPath.replace('/package.json', '')
		// in
		const wsHashOnRelease = ex(`git rev-parse --verify -q v${rootPkg.version}^{commit}:"${pkgDir}"`, {
			handler(e) {
				gitRevParseErrHandler(pkgDir)
			}
		})
		const wsHashCurrent = ex(`git rev-parse --verify -q HEAD:"${pkgDir}"`)
		pkgs[pkg.name] = {
			name: pkg.name,
			version: pkg.version,
			dependencies: pkg.dependencies,
			devDependencies: pkg.devDependencies,
			pkgPath,
			pkgDir,
			// TODO: should also check for non-empty workspace/release.txt???
			// so that a package releases is created only if there are notable changes
			selfChanged: wsHashOnRelease != wsHashCurrent,
			changedDeps: new Set()
		}
	}
}

// detect changed workspaces, including deps that have changed
for (const name in pkgs) {
	setWsDeps(name)
	if (pkgs[name].hasChanged) {
		pkgs[name].version = newVersion
	}
}

if (!verbose) {
	for (const name in pkgs) {
		short(name)
	}
}

console.log(pkgs)
// list of changed packages
console.log(Object.keys(pkgs))

function setWsDeps(name) {
	pkgs[name].checked = true
	for (const key of ['dependencies', 'devDependencies']) {
		const deps = pkgs[name][key]
		for (const dname in deps) {
			if (dname === name) throw `package=${name} is dependent on itself`
			if (!(dname in pkgs)) {
				delete deps[dname]
				continue
			}
			if (!pkgs[dname].checked) setWsDeps(dname)
			if (pkgs[dname].selfChanged || pkgs[dname].changedDeps.size) {
				deps[dname] = newVersion
				pkgs[name].changedDeps.add(dname)
			}
		}
	}
	pkgs[name].hasChanged = pkgs[name].selfChanged || pkgs[name].changedDeps.size // && (!releaseTextFile /* check if releaseTxtFile is not empty */)
}

function short(name) {
	if (!pkgs[name].hasChanged) {
		delete pkgs[name]
		return
	}
	const pkg = pkgs[name]
	pkgs[pkg.pkgDir] = pkg
	delete pkgs[name]
	delete pkg.name
	delete pkg.pkgPath
	delete pkg.selfChanged
	delete pkg.changedDeps
	delete pkg.hasChanged
	delete pkg.checked
	delete pkg.pkgDir
	for (const key of ['dependencies', 'devDependencies']) {
		const deps = pkg[key]
		if (typeof deps != 'object') {
			delete pkg[key]
			continue
		}
		for (const dname in deps) {
			if (deps[dname] != newVersion) delete deps[dname]
		}
		if (!Object.keys(deps).length) delete pkg[key]
	}
}

function ex(cmd, opts) {
	try {
		return execSync(cmd, { encoding: 'utf8' })
	} catch (e) {
		if (opts.handler) opts.handler(e)
		else if (opts.message) throw opts.message + ': ' + e
		else throw e
	}
}

function gitRevParseErrHandler(pkgDir) {
	console.log(`package='${pkgDir}': git-rev-parse error is assumed to be for a new package dir with no commit history`)
}
