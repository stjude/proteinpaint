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
// The client bundle is served at public/bin, but it must NOT be generated inside public/ when public/ is
// a SHARED mount: if several container instances bind-mount the same public/ and each regenerates
// public/bin at startup, they clobber one another — one instance's recursive rmdir races another's tar
// extract, throwing "ENOTEMPTY, Directory not empty: .../public/bin" and crashing a startup.
//
// So each container generates its bundle in its OWN bin at CWD/bin — a sibling of public/ that lives in
// the container's writable layer, NOT under any mount — and public/bin is a symlink to it. The symlink
// uses a RELATIVE target ("../bin"), so the single (possibly shared) public/bin entry resolves, inside
// every container, to that container's own CWD/bin. No shared directory is ever regenerated, so
// concurrent starts cannot conflict — no lock or cross-instance revision key is needed. (This symlink is
// created and followed inside the Linux container; a host that also sees the shared mount never needs to
// resolve it, since only the container serves these files.)
const BIN_DIR = `${CWD}/bin`
const PUBLIC_BIN = `${PUBLIC_DIR}/bin`
const PUBLIC_BIN_TARGET = '../bin' // relative to public/, i.e. CWD/bin, resolved per-container

// Point public/bin at this container's own CWD/bin. Idempotent and safe under concurrent starts: every
// instance writes the identical relative symlink, so a lost race just yields EEXIST (ignored). A
// public/bin that is NOT already this symlink (e.g. a real directory left by an older build) is removed
// and replaced — intended as a one-time migration to the symlink. A brief startup blip during that
// migration is acceptable; afterward the symlink persists on the host and this becomes a no-op.
function ensurePublicBinSymlink() {
	try {
		if (fs.readlinkSync(PUBLIC_BIN) === PUBLIC_BIN_TARGET) return // already the symlink we want
	} catch (e) {
		// EINVAL: public/bin exists but is not a symlink (e.g. a real dir); ENOENT: it is missing.
		// Anything else is a real error.
		if (e.code !== 'EINVAL' && e.code !== 'ENOENT') throw e
	}
	try {
		fs.rmSync(PUBLIC_BIN, { recursive: true, force: true }) // clear a wrong/real entry (no-op if missing)
	} catch (e) {}
	try {
		fs.symlinkSync(PUBLIC_BIN_TARGET, PUBLIC_BIN)
	} catch (e) {
		if (e.code !== 'EEXIST') throw e // another instance created it first; its symlink is identical
	}
}

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

	// Finally, point the served public/bin at the now-populated CWD/bin (after generation, so it never
	// briefly dangles).
	ensurePublicBinSymlink()
} catch (e) {
	console.error(e)
	throw e
}
