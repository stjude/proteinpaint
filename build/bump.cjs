#!/usr/bin/env node
'use strict'

/*
	This script detects which workspace has relevant code/file changes,
	with different options on how to emit the results. 
	NOTE: If the output is missing a changed workspace that is known to have
	relevant changes, check the logic in `fileAffectsVersion()` or the commit reference.

	USAGE: 
	run from the pp dir as
		
		./build/bump.cjs <verType> [-o=outputType] [-w] [-x=workspaceNamePattern] [-c=referenceCommit]
	
	ARGUMENTS:
	verType: 
		see the allowed version types in https://docs.npmjs.com/cli/v8/commands/npm-version
		e.g., <newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease | from-git
	
	-o: one of these output types: 
		oneline: (default) list of changed workspaces, e.g., "client front server"
		vline: new version + oneline, may be useful as a commit message e.g., "v2.2.0 client front server"
		minjson: minimized object copy as JSON
		detailed: log errors/warnings and detailed object copy as JSON
	
	-w: boolean (defaults to false)
		- if true, update package.json of a changed workspace
	
	-x: list of workspace name patterns to exclude from processing, can use multiple -x arguments

	-c: the commit reference to use for git diff
		- defaults to the version in proteinpaint/package.json
*/

const path = require('path')
const fs = require('fs')
const execSync = require('child_process').execSync
const semver = require('semver')
const cwd = process.cwd()

process.removeAllListeners('warning')

// ************
// * ARGUMENTS
// ************

const verType = process.argv[2]
if (!verType) {
	throw `Missing version type argument, must be one of the allowed 'npm version [type]'`
}

// root package version
const rootPkg = require(path.join(cwd, '/package.json'))

// command-line options, `-${single_letter}=value`
const defaults = {
	verType,
	// -o argument
	output: 'oneline',
	// -w argument
	write: false,
	// -x argument
	exclude: [],
	// -c argument
	refCommit: `v${rootPkg.version}^{commit}`
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

// set a prerelease identifier option for semver.inc(), if applicable
const branch = ex(`git rev-parse --abbrev-ref HEAD`)
const preid =
	branch != 'master' && verType.startsWith('pre') && !rootPkg.version.includes('-')
		? ex(`git rev-parse --short HEAD`)
		: ''
const newVersion = semver.inc(rootPkg.version, verType, preid)

const pkgs = {}
const changedFiles = ex(`git diff --name-only ${opts.refCommit} HEAD`).split('\n')

for (const w of rootPkg.workspaces) {
	if (opts.exclude.find(s => w.includes(s))) continue
	const paths = fs.globSync(`${w}/package.json`, { cwd })
	for (const pkgPath of paths) {
		const pkgDir = pkgPath.replace('/package.json', '')
		const hasRelevantChangedFiles =
			changedFiles.findIndex(
				f =>
					(f.startsWith(pkgDir) || (f.startsWith('server/test/tp') && pkgDir == 'rust')) && // !!! quick fix !!!
					fileAffectsVersion(f)
			) !== -1
		const pkg = require(path.join(cwd, pkgPath))
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
			// !!! also remove the quick fix below for rust code change !!!
			selfChanged:
				hasRelevantChangedFiles && (wsHashOnRelease != wsHashCurrent || (pkgDir == 'rust' && hasRelevantChangedFiles)),
			changedDeps: new Set(),
			private: pkg.private
		}
	}
}

// ************************************
// * UPDATE IN-MEMORY WORKSPACE PACKAGE
// ************************************

const unpublishedFile = path.join(__dirname, 'unpublishedPkgs.txt')
fs.rmSync(unpublishedFile, { force: true })
const unpublishedPkgs = new Set()

// detect changed workspaces, including deps that have changed
let hasChanges = false
for (const name in pkgs) {
	setWsDeps(name)
	if (pkgs[name].hasChanged) {
		pkgs[name].version = newVersion
		hasChanges = true
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

if (opts.write && hasChanges) {
	ex(`npm pkg set version=${newVersion}`)
	ex(`npm i --package-lock-only`)
}

if (unpublishedPkgs.size) {
	fs.writeFileSync(unpublishedFile, [...unpublishedPkgs].join(' '), { encoding: 'utf8' })
}

// *******************
// * HELPER FUNCTIONS
// *******************

function setWsDeps(name) {
	const pkg = pkgs[name]
	pkg.checked = true
	for (const key of ['dependencies', 'devDependencies']) {
		const deps = pkg[key]
		for (const dname in deps) {
			if (dname === name) throw `package=${name} is dependent on itself`
			if (!(dname in pkgs)) {
				delete deps[dname]
				continue
			}
			if (!pkg.checked) setWsDeps(dname)
			if (pkgs[dname].selfChanged || pkgs[dname].changedDeps.size) {
				deps[dname] = newVersion
				pkg.changedDeps.add(dname)
			}
		}
	}
	pkg.hasChanged = pkg.selfChanged || pkg.changedDeps.size // && (!releaseTextFile /* check if releaseTxtFile is not empty */)

	// support the detection of unpublished packages, for example,
	// if a CI workflow was triggered from a tagged commit where
	// a previous CI run was interrupted and failed to publish all
	// updated workspaces after committing and tagging the version change
	if (!pkg.private && !pkg.hasChanged && pkg.version === rootPkg.version) {
		const publishedVersion = ex(`npm view ${pkg.name} version | tail -n1`)
		if (publishedVersion !== pkg.version) unpublishedPkgs.add(pkg.pkgDir)

		// --- uncomment for testing ---
		// if (pkg.pkgDir == 'client') unpublishedPkgs.add(pkg.pkgDir)
	}
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
		return execSync(cmd, { encoding: 'utf8' }).trim()
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
	// specific patterns to supercede the general not-matched pattern at the end of this function
	if (f.toUpperCase() === 'requirements.txt') return true
	if (f.endsWith('pkgs.txt')) return true
	if (f.includes('tp/files/hg38/TermdbTest')) return true

	// any filename not matching below indicates a relevant file that should cause a workspace package version bump
	return !f.endsWith('.md') && !f.endsWith('.txt') && !f.endsWith('ignore')
}
