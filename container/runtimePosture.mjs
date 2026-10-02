/*
	Reports which of the recommended container runtime settings are not applied, from /proc on Linux.
	These are set by the container runtime (podman, docker, kubernetes), not by the image:

	- a non-root user, no effective capabilities, and no_new_privs
	- kernel.yama.ptrace_scope of at least 1
	- a read-only root filesystem
	- noexec on the writable dirs, such as the OS temp dir and the cache dir
	- read-only interpreter library dirs, such as /opt/venv

	usage:
	  node runtimePosture.mjs [--strict] [writable-dir ...]
	  # such as in a running container
	  podman exec <container> node runtimePosture.mjs /home/root/pp/cache

	Prints a warning for each missing setting. With --strict, exits with code 1 when there is a warning.
	Reports a check as unchecked when its /proc file cannot be read, such as under the Node.js permission
	model, so this must run without the permission model to check everything.
*/

import fs from 'node:fs'
import os from 'node:os'

// dirs of the interpreters that the server spawns, in the deps/Dockerfile image
export const IMAGE_LIB_DIRS = Object.freeze(['/opt/venv', '/usr/local/lib/R/site-library', '/usr/lib/R/site-library'])

if (isMainModule()) {
	const args = process.argv.slice(2)
	const strict = args.includes('--strict')
	const writableDirs = args.filter(a => a != '--strict')
	const result = checkRuntimePosture({ writableDirs })
	logRuntimePosture(result)
	if (strict && result.warnings?.length) process.exit(1)
}

// deps may be fakes in tests; returns {skipped} on a non-Linux platform, otherwise {warnings[], unchecked[]}
export function checkRuntimePosture({
	fs: _fs = fs,
	platform = process.platform,
	uid = process.getuid?.(),
	tmpdir = os.tmpdir(),
	writableDirs = [],
	libDirs = IMAGE_LIB_DIRS
} = {}) {
	if (platform != 'linux') return { skipped: `not checked on platform='${platform}'` }
	const warnings = []
	const unchecked = []
	const read = file => {
		try {
			return _fs.readFileSync(file, 'utf8')
		} catch {
			unchecked.push(file)
		}
	}

	if (uid === 0) warnings.push('the process runs as root (uid=0)')

	const status = read('/proc/self/status')
	if (status !== undefined) {
		const capEff = /^CapEff:\s*([0-9a-f]+)$/im.exec(status)?.[1]
		if (capEff && BigInt('0x' + capEff) != 0n)
			warnings.push(`the process has effective capabilities (CapEff=${capEff}), drop all capabilities`)
		if (/^NoNewPrivs:\s*0$/m.test(status)) warnings.push('no_new_privs is not set, set the no-new-privileges option')
	}

	const ptraceFile = '/proc/sys/kernel/yama/ptrace_scope'
	const ptraceScope = readOptional(_fs, ptraceFile)
	if (ptraceScope === null) unchecked.push(ptraceFile)
	else if (ptraceScope === undefined) warnings.push('the Yama LSM is not enabled')
	else if (ptraceScope.trim() == '0') warnings.push('kernel.yama.ptrace_scope=0, set it to 1 or higher')

	const mountinfo = read('/proc/self/mountinfo')
	if (mountinfo !== undefined) {
		const mounts = parseMountinfo(mountinfo)
		const root = mounts.find(m => m.mountPoint == '/')
		if (root && !root.options.includes('ro')) warnings.push('the root filesystem is writable, mount it read-only')
		for (const dir of new Set([tmpdir, ...writableDirs])) {
			const mount = findMount(mounts, realpath(_fs, dir))
			if (mount && !mount.options.includes('noexec'))
				warnings.push(`${dir} is on a mount without noexec (mount point ${mount.mountPoint})`)
		}
	}

	for (const dir of libDirs) {
		// existsSync() also throws for a dir that the permission model denies
		try {
			if (!_fs.existsSync(dir)) continue
			_fs.accessSync(dir, fs.constants.W_OK)
			warnings.push(`${dir} is writable by the process, it should be read-only`)
		} catch (e) {
			if (e.code == 'ERR_ACCESS_DENIED') unchecked.push(dir)
		}
	}

	return { warnings, unchecked }
}

export function logRuntimePosture(result, log = console.warn) {
	if (result.skipped) return
	for (const w of result.warnings) log(`runtimePosture.mjs: WARNING ${w}`)
	if (result.unchecked.length) log(`runtimePosture.mjs: unable to check ${result.unchecked.join(', ')}`)
}

// returns [{mountPoint, options[]}]; the mount options are the per-mount ones, such as ro and noexec,
// in the 6th field of each /proc/self/mountinfo line
export function parseMountinfo(text) {
	const mounts = []
	for (const line of text.split('\n')) {
		const fields = line.split(' ')
		if (fields.length < 6) continue
		// the kernel escapes a space, tab, newline, or backslash in a path as an octal \ooo sequence
		const mountPoint = fields[4].replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
		mounts.push({ mountPoint, options: fields[5].split(',') })
	}
	return mounts
}

// the mount that contains a path is the one with the longest matching mount point; for a mount point
// that is mounted over more than once, the last one in mountinfo is the visible one
export function findMount(mounts, p) {
	let found
	for (const m of mounts) {
		const contains = m.mountPoint == '/' || p == m.mountPoint || p.startsWith(m.mountPoint + '/')
		if (contains && (!found || m.mountPoint.length >= found.mountPoint.length)) found = m
	}
	return found
}

// returns undefined for a missing file, which is a result, such as no Yama LSM, and null for
// a file that cannot be read, such as one denied by the permission model
function readOptional(_fs, file) {
	try {
		return _fs.readFileSync(file, 'utf8')
	} catch (e) {
		return e.code == 'ENOENT' ? undefined : null
	}
}

function realpath(_fs, p) {
	try {
		return _fs.realpathSync(p)
	} catch {
		return p
	}
}

// true when this file is run as a CLI script, not imported, such as by tests
function isMainModule() {
	if (!process.argv[1]) return false
	try {
		return import.meta.filename == fs.realpathSync(process.argv[1])
	} catch {
		// such as '-' for a script from stdin, or a path that the permission model denies
		return false
	}
}
