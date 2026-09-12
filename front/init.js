#!/usr/bin/env node
'use strict'

const path = require('path')
const ps = require('child_process')
const fs = require('fs')
const { execSync } = require('child_process')

let URLPATH = process.argv[2] || '.'
if (URLPATH.endsWith('/')) URLPATH = URLPATH.slice(0, -1)
const publicBinOnly = process.argv.includes('--publicBinOnly')

const CWD = process.cwd()
const PUBLIC_DIR = `${CWD}/public`
const BIN_DIR = `${PUBLIC_DIR}/bin`
// The DEPLOYED revision is read from publicOrig/rev.txt — the copy BAKED INTO THIS IMAGE (build.sh
// moves the packed public/ to publicOrig/ so a host bind mount over active/public can't shadow it). It
// reflects the running image's code the instant this container starts, identically for every instance.
// The mounted public/rev.txt is NOT usable here: on a rollout the tool updates it (from publicOrig, via
// copyPublicOrigToActivePublic in rollout.js) only AFTER the restart's health gate, so at startup it
// still shows the PREVIOUS revision — reading it would skip regenerating a genuinely new bundle.
const DEPLOYED_REV_FILE = `${CWD}/publicOrig/rev.txt`
// public/bin/.build-key records the full set of inputs the current public/bin was built for (see
// buildKey below), so a reuse skip only happens when ALL of them still match.
const BIN_KEY_FILE = `${BIN_DIR}/.build-key`

// Read a file as text, or null if it does not exist (any other error is real and rethrown).
function readTextOrNull(file) {
	try {
		return fs.readFileSync(file, { encoding: 'utf8' })
	} catch (e) {
		if (e.code === 'ENOENT') return null
		throw e
	}
}

// The installed proteinpaint-front package version (this script IS that package's bin, so __dirname is
// its root). app-full.mjs can `npm install @sjcrh/proteinpaint-front@<releaseTag.front>` at runtime,
// which swaps bundles.tgz for a different version WITHOUT changing the image's publicOrig/rev.txt — so
// the bundle's identity must be keyed on this too, not the image rev alone. '' if it can't be read.
function frontPackageVersion() {
	try {
		return JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), { encoding: 'utf8' })).version || ''
	} catch (e) {
		return ''
	}
}

console.log('CWD', CWD)
try {
	if (!fs.existsSync(PUBLIC_DIR)) {
		console.log(`making a public directory at ${CWD}`)
		fs.mkdirSync(PUBLIC_DIR)
	}
	// index.html / cards are ensured independently of the public/bin guard below (idempotent, and needed
	// even when the bundle is reused), so a skipped regeneration still leaves the public scaffolding in place.
	if (!publicBinOnly) {
		if (!fs.existsSync(`${PUBLIC_DIR}/index.html`)) {
			console.log(`creating a public/index.html file`)
			fs.copyFileSync(path.join(__dirname, './public/index.html'), `${PUBLIC_DIR}/index.html`)
		}
		if (!fs.existsSync(`${PUBLIC_DIR}/cards`)) {
			console.log(`Copying cards into public/cards folder`)
			execSync(`cp -r ${CWD}/node_modules/@sjcrh/proteinpaint-front/public/cards ${PUBLIC_DIR}/cards`, {
				stdio: 'inherit'
			})
		}
	}

	// public/bin is a SHARED, server-generated bundle: in a multi-instance deployment every container
	// bind-mounts the SAME active/public, and public/bin (unlike the rest of public) is NOT baked into
	// the image — it is generated here at startup. Regenerating it on every start is wasteful and, when
	// two instances do it at once on the shared dir, destructive (one's recursive rmdir races the other's
	// tar extract -> "ENOTEMPTY, Directory not empty: .../public/bin"). So skip regeneration when the
	// bundle is already built for the same inputs AND is actually present. Then only the first instance
	// after a deployment rebuilds; every other instance, and every later restart/boot, reuses it. (This
	// makes restarts/boots race-free; the first post-deploy build is serialized by activateHost.sh
	// starting the instances one at a time.)
	//
	// The reuse key is EVERY input that determines public/bin's content: the image revision, the
	// installed front package version (a runtime releaseTag.front install changes the bundle without
	// touching the image rev), and the normalized URLPATH (embedded into proteinpaint.js as
	// __PP_URL__ -> <URLPATH>/bin/, so it can invalidate the bundle independently of the code). Keyed
	// only when there is an image revision to anchor on; without one (dev / a plain ppfull image) we
	// always regenerate, since the front version alone may not bump between local rebuilds.
	const deployedRev = readTextOrNull(DEPLOYED_REV_FILE)
	const buildKey =
		deployedRev === null ? null : `rev=${deployedRev.trim()}\nfront=${frontPackageVersion()}\nurl=${URLPATH}\n`
	const binKey = readTextOrNull(BIN_KEY_FILE)
	const bundleReady = fs.existsSync(`${BIN_DIR}/proteinpaint.js`)
	if (buildKey !== null && binKey === buildKey && bundleReady) {
		console.log(`public/bin already built for this revision/front/URL; reusing it`)
	} else {
		if (fs.existsSync(BIN_DIR)) {
			console.log(`removing the old public/bin at ${CWD}`)
			fs.rmSync(BIN_DIR, { recursive: true, force: true })
		}
		const tar = ps.spawnSync('tar', [`-xzf`, `${__dirname}/bundles.tgz`, `-C`, `${CWD}`], { encoding: 'utf8' })
		if (tar.status !== 0) {
			throw new Error(`Tar command failed with exit code ${tar.status}: ${tar.stderr}`)
		}
		if (tar.stderr) {
			console.warn('Tar command warnings:', tar.stderr)
		}
		console.log(`Setting the dynamic bundle path to ${URLPATH}`)
		const codeFile = `${BIN_DIR}/proteinpaint.js`
		// remember the modified time before setting the bundle public path
		const mtime = fs.statSync(codeFile).mtime
		const code = fs.readFileSync(codeFile, { encoding: 'utf8' })
		const newcode = code.replace(`__PP_URL__`, `${URLPATH}/bin/`)
		fs.writeFileSync(codeFile, newcode, { encoding: 'utf8' })
		try {
			// reset the atime and mtime to the original mtime before setting the bundle publit path
			fs.utimesSync(codeFile, mtime, mtime)
		} catch (e) {
			console.log('--- !!! unable to reset the mtime for the extracted proteinpaint bundle: ', e)
		}
		// Stamp the build key LAST — only after the bundle is fully built. A skip above then happens only
		// over a complete public/bin; a crash mid-build leaves no/old key, so the next start rebuilds
		// instead of serving a partial bundle forever. Only when there is an image rev to anchor on.
		if (buildKey !== null) {
			fs.writeFileSync(BIN_KEY_FILE, buildKey)
			console.log(`stamped public/bin build key (${buildKey.replace(/\n/g, ' ').trim()})`)
		} else {
			console.log(`no publicOrig/rev.txt to track; public/bin will be regenerated on every start`)
		}
	}
} catch (e) {
	console.error(e)
	throw e
}
