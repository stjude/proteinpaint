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
// The client bundle is generated into a PER-CONTAINER dir at CWD/bin — a sibling of public/, in the
// container's own writable layer, NOT under any mount — and is served at /bin by the server, which
// routes /bin to CWD/bin when it exists (see the server's serverconfig binDir + app.middlewares.js).
//
// It is deliberately NOT written into public/: when several instances bind-mount the SAME public/,
// regenerating a shared public/bin at startup makes them clobber one another (one instance's recursive
// rmdir races another's tar extract -> "ENOTEMPTY, Directory not empty: .../public/bin", crashing a
// startup). Generating per-container removes the shared write entirely, so concurrent starts can't race
// — no lock or cross-instance key needed. It also makes a rolling deploy safe: init never mutates the
// shared public/bin, so instances still on an older release keep serving their own public/bin while new
// instances serve their CWD/bin. An older image that has no CWD/bin also still works — the server falls
// back to serving /bin from public/bin.
const BIN_DIR = `${CWD}/bin`

console.log('CWD', CWD)
try {
	if (!fs.existsSync(PUBLIC_DIR)) {
		console.log(`making a public directory at ${CWD}`)
		fs.mkdirSync(PUBLIC_DIR)
	}
	// index.html / cards are ensured independently of the bundle below (idempotent, and needed even when
	// the bundle is reused), so a skipped regeneration still leaves the public scaffolding in place.
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

	// Generate the bundle into CWD/bin only if it isn't already there. CWD/bin is in the container's
	// writable layer, so it persists across restarts of THIS container (reuse) and is empty in any freshly
	// created container (regenerate) — including after an image update, which always yields a new
	// container. Because CWD/bin is per-container, there is no shared directory to race on.
	//
	// NOTE: reuse is keyed only on the bundle being present, not on its version or URL. That is correct
	// for the normal container lifecycle (a new image, or a changed URL, arrives with a new container and
	// hence an empty CWD/bin). It would be stale only if the SAME container were reused across a bundle or
	// URL change — e.g. CWD/bin persisted via a mounted volume, or serverconfig.json remounted with a
	// different URL and merely restarted — which is uncommon and outside this simple scheme.
	if (fs.existsSync(`${BIN_DIR}/proteinpaint.js`)) {
		console.log(`bundle already present at ${BIN_DIR}; reusing it`)
	} else {
		if (fs.existsSync(BIN_DIR)) {
			console.log(`removing an incomplete ${BIN_DIR}`)
			fs.rmSync(BIN_DIR, { recursive: true, force: true })
		}
		// bundles.tgz contains public/bin/*; --strip-components=1 drops the leading public/ so the files
		// land in CWD/bin/* (this container's private bin), not in the shared public/.
		const tar = ps.spawnSync('tar', [`-xzf`, `${__dirname}/bundles.tgz`, `-C`, `${CWD}`, `--strip-components=1`], {
			encoding: 'utf8'
		})
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
			// reset the atime and mtime to the original mtime before setting the bundle public path
			fs.utimesSync(codeFile, mtime, mtime)
		} catch (e) {
			console.log('--- !!! unable to reset the mtime for the extracted proteinpaint bundle: ', e)
		}
	}
} catch (e) {
	console.error(e)
	throw e
}
