#!/usr/bin/env node
'use strict'

const glob = require('glob')
const path = require('path')
const fs = require('fs')
const execSync = require('child_process').execSync
const semver = require('semver')
const cwd = process.cwd()

// ************
// * ARGUMENTS
// ************

const verType = process.argv[2]
if (!verType) {
	throw `Missing version type argument, must be one of the allowed 'npm version [type]'`
}

const defaults = {
	verbose: false, // if true, `git restore each workspace package.json before processing`
	write: false, // if true, update package.json as needed
	exclude: [] // list of workspace name patterns to exclude from processing
}

const opts = process.argv.slice(3).reduce((opts, k) => {
	if (k[0] == '-') {
		if (k[1] == 'v') opts.verbose = true
		if (k[1] == 'w') opts.write = true
		if (k[1] == 'x') {
			const [o, pattern] = k.split('=')
			opts.exclude.push(pattern)
		}
	}
	return opts
}, defaults)

// ******************************************
// * WORKSPACE VERSIONS, DEPS, CHANGE STATUS
// ******************************************

// root package version
const rootPkg = require(path.join(cwd, '/package.json'))
const commitMsg = ex(`git log --format=%B -n 1 v${rootPkg.version}`, {
	message: `Error finding a commit message prefixed with v${rootPkg.version}: cannot diff for changes`
})
const newVersion = semver.inc(rootPkg.version, verType)
console.log('New version:', newVersion)

const pkgs = {}
for (const w of rootPkg.workspaces) {
	if (opts.exclude.find(s => w.includes(s))) continue
	const paths = glob.sync(`${w}/package.json`, { cwd })
	for (const pkgPath of paths) {
		const pkg = require(path.join(cwd, pkgPath))
		const pkgDir = pkgPath.replace('/package.json', '')
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

// ******************************************
// * UPDATE WORKSPACE PACKAGE.JSON IF CHANGED
// ******************************************

// detect changed workspaces, including deps that have changed
for (const name in pkgs) {
	setWsDeps(name)
	if (pkgs[name].hasChanged) {
		pkgs[name].version = newVersion
	}
}

if (opts.verbose) console.log(pkgs) // echo before shortening
for (const name in pkgs) {
	// this may also update a changed workspace's package.json file
	minWrite(name)
}
if (opts.write) {
	ex(`npm pkg set version=${newVersion}`)
	ex(`npm i --package-lock-only`)
}
if (!opts.verbose) console.log(pkgs) // echo only after shortening

// list of changed packages
console.log(Object.keys(pkgs))

// *******************
// * HELPER FUNCTIONS
// *******************

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

// minimize the pkg object as needed by removinng uninformative attributes
// write version changes if opts.write == true
function minWrite(name) {
	if (!pkgs[name].hasChanged) {
		delete pkgs[name]
		return
	}
	const pkg = pkgs[name]
	pkgs[pkg.pkgDir] = pkg
	delete pkgs[name]
	delete pkg.name
	delete pkg.selfChanged
	delete pkg.changedDeps
	delete pkg.hasChanged
	delete pkg.checked
	delete pkg.pkgPath
	for (const key of ['dependencies', 'devDependencies']) {
		const deps = pkg[key]
		if (typeof deps != 'object') {
			delete pkg[key]
			continue
		}
		for (const dname in deps) {
			if (deps[dname] != newVersion) delete deps[dname]
			else if (opts.write) {
				ex(`cd ${pkg.pkgDir}; npm pkg set ${key}.${dname}=${newVersion}`)
			}
		}
		if (!Object.keys(deps).length) delete pkg[key]
	}
	if (opts.write) ex(`cd ${pkg.pkgDir}; npm pkg set version=${newVersion}`)
	delete pkg.pkgDir
}

function ex(cmd, opts = {}) {
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
