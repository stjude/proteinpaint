#!/usr/bin/env node
'use strict'

/*
 The allowed arguments and command-line options are listed in the ARGUMENTS section below  
*/

const glob = require('glob')
const path = require('path')
const fs = require('fs')
const execSync = require('child_process').execSync
const semver = require('semver')
const cwd = process.cwd()

// ************
// * ARGUMENTS
// ************

// see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
// e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
const verType = process.argv[2]
if (!verType) {
	throw `Missing version type argument, must be one of the allowed 'npm version [type]'`
}

// root package version
const rootPkg = require(path.join(cwd, '/package.json'))

// command-line options, `-${single_letter}=value`
const defaults = {
	verType,
	// -o
	output: 'oneline',
	// oneline: list of changed workspaces,
	//          e.g., "client front server"
	// vline: new version + oneline, may be useful as a commit message
	//          e.g., "v2.2.0 client front server"
	// minjson: minimized object copy as JSON
	// detailed: log errors/warnings and detailed object copy as JSON
	// -w
	write: false, // if true, update package.json as needed
	// -x
	exclude: [], // list of workspace name patterns to exclude from processing,
	// -c
	refCommit: `v${rootPkg.version}^{commit}`
	//
}
const opts = JSON.parse(JSON.stringify(defaults))
for (const k of process.argv.slice(3)) {
	if (k[0] == '-') {
		if (k[1] == 'w') opts.write = true
		if (k[1] == 'o') {
			opts.output = k.split('=')[1]
			if (!opts.output) throw `Empty output -o value`
			if (!['oneline', 'vline', 'minjson', 'detailed'].includes(opts.output))
				throw `Unknown opts.output value '${opts.output}'`
		}
		if (k[1] == 'x') {
			const [o, pattern] = k.split('=')
			if (!pattern) throw `Empty exclude -x value`
			opts.exclude.push(pattern)
		}
		if (k[1] == 'c') {
			const [o, refCommit] = k.split('=')
			if (!refCommit) throw `Empty commit sha/reference`
			opts.refCommit = refCommit
		}
	}
}

// ******************************************
// * WORKSPACE VERSIONS, DEPS, CHANGE STATUS
// ******************************************

if (opts.refCommit.endsWith('^{commit}')) {
	try {
		const tagExists = ex(`git tag -l v${rootPkg.version}`)
		if (!tagExists) {
			const errorMsg = ex(`git fetch --depth 1 origin tag v${rootPkg.version}`, {
				message: `Error fetching the tag v${rootPkg.version}: cannot diff for changes`
			})
			if (errorMsg) throw errorMsg
			const commitMsg = ex(`git tag -l --format='%(contents)' v${rootPkg.version}`, {
				message: `Error finding a commit message prefixed with v${rootPkg.version}: cannot verify tag`
			})
			if (!commitMsg) throw `error in finding commit message`
			if (!commitMsg.startsWith(`v${rootPkg.version} `)) {
				const commitMsgTag = commitMsg.split(' ')[0]
				if (!commitMsgTag.startsWith(`v${rootPkg.version}-`)) {
					// allow a back-applied unique tag to be matched against a tag with the same version, but having a SHA suffix
					throw `the reference tag's commit message does not start with v${rootPkg.version}`
				}
			}
		}
	} catch (e) {
		throw e
	}
}
const newVersion = semver.inc(rootPkg.version, verType)

const pkgs = {}
const changedFiles = ex(`git diff --name-only ${opts.refCommit} HEAD`).split('\n')
for (const w of rootPkg.workspaces) {
	if (opts.exclude.find(s => w.includes(s))) continue
	const hasRelevantChangedFiles = changedFiles.find(f => f.startsWith(w) && fileAffectsVersion(f))
	const paths = glob.sync(`${w}/package.json`, { cwd })
	for (const pkgPath of paths) {
		const pkg = require(path.join(cwd, pkgPath))
		const pkgDir = pkgPath.replace('/package.json', '')
		const wsHashOnRelease = ex(`git rev-parse --verify -q ${opts.refCommit}:"${pkgDir}"`, {
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
			// so that a package release is created only if there are notable changes
			selfChanged: wsHashOnRelease != wsHashCurrent && hasRelevantChangedFiles,
			changedDeps: new Set()
		}
	}
}

// ************************************
// * UPDATE IN-MEMORY WORKSPACE PACKAGE
// ************************************

// detect changed workspaces, including deps that have changed
for (const name in pkgs) {
	setWsDeps(name)
	if (pkgs[name].hasChanged) {
		pkgs[name].version = newVersion
	}
}

// ***********************************
// * EMIT OUTPUT, UPDATE PACKAGE.JSON
// ***********************************

if (opts.output == 'detailed') console.log(JSON.stringify(pkgs, null, '   ')) // echo before minimizing
for (const name in pkgs) {
	// this may also update a changed workspace's package.json file
	minWrite(name)
}
if (opts.output == 'minjson') console.log(JSON.stringify(pkgs, null, '   ')) // echo only after minimizing
else if (opts.output.endsWith('line')) {
	// list of changed packages
	const updated = Object.keys(pkgs).join(' ')
	if (updated) {
		if (opts.output == 'oneline') console.log(`${updated}`)
		else if (opts.output == 'vline') console.log(`${newVersion} ${updated}`)
	}
}

if (opts.write) {
	ex(`npm pkg set version=${newVersion}`)
	ex(`npm i --package-lock-only`)
}

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
	if (opts.output != 'detailed') return
	console.log(`package='${pkgDir}': git-rev-parse error is assumed to be for a new package dir with no commit history`)
}

function fileAffectsVersion(f) {
	return !f.endsWith('.md') && !f.endsWith('.txt') && !f.endsWith('ignore')
}
