/*
	Reports which of the recommended container runtime settings are not applied, from /proc on Linux.
	These are set by the container runtime (podman, docker, kubernetes), not by the image:

	- a non-root user, no effective capabilities, and no_new_privs
	- kernel.yama.ptrace_scope of at least 1
	- a read-only root filesystem
	- noexec on the writable dirs, such as the OS temp dir and the cache dir, and on the mounts under them;
	  a mount with the ro option is not reported
	- read-only interpreter library dirs, such as /opt/venv
	- read-only app files: the app dir, its node_modules and client bundle dirs, and the app .mjs files,
	  which are owned by root in the image; the public dir may be written in debugmode, so it is not checked

	usage:
	  node runtimePosture.mjs [--strict] [writable-dir ...]
	  # such as in a running container
	  podman exec <container> node runtimePosture.mjs /home/root/pp/cache

	Prints a warning for each missing setting. With --strict, the settings in STRICT_CHECKS, and any check
	that cannot be done, are printed as errors instead, and the exit code is 1 when there is an error.
	The other settings, such as ptrace_scope, which is a host kernel setting, stay warnings.
	Reports a check as unchecked when its /proc file cannot be read, such as under the Node.js permission
	model, so this must run without the permission model to check everything.
*/

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// dirs of the interpreters that the server spawns, in the deps/Dockerfile image; the package dirs of a python
// venv, such as /opt/venv/lib/python3.14/site-packages, and any mount under these dirs are found at check time
export const IMAGE_LIB_DIRS = Object.freeze(['/opt/venv', '/usr/local/lib/R/site-library', '/usr/lib/R/site-library'])

// the dir with the server code, node_modules, and in the full image the client bundle in bin and public
export const APP_DIR = '/home/root/pp/app/active'

// the checks whose finding is an error in strict mode; every one of these can be applied by the container
// runtime, see the releaseRollout .container units
export const STRICT_CHECKS = Object.freeze(
	new Set([
		'user',
		'capabilities',
		'no-new-privileges',
		'read-only-root',
		'tmp-noexec',
		'dir-noexec',
		'lib-dirs',
		'app-files'
	])
)

// the accessSync(W_OK) errors that mean a dir is not writable, or does not exist
const PROBE_RESULT_CODES = new Set(['EACCES', 'EROFS', 'EPERM', 'ENOENT', 'ENOTDIR'])

// declared before this CLI block, which runs when the module loads
if (isMainModule()) {
	const args = process.argv.slice(2)
	const strict = args.includes('--strict')
	const writableDirs = args.filter(a => a != '--strict')
	const errors = logRuntimePosture(checkRuntimePosture({ writableDirs }), { strict })
	if (errors.length) process.exit(1)
}

// deps may be fakes in tests; returns {skipped} on a non-Linux platform, otherwise
// {findings: [{check, message}], unchecked: [file or dir]}
export function checkRuntimePosture({
	fs: _fs = fs,
	platform = process.platform,
	uid = process.getuid?.(),
	tmpdir = os.tmpdir(),
	writableDirs = [],
	libDirs = IMAGE_LIB_DIRS,
	appDir = APP_DIR
} = {}) {
	if (platform != 'linux') return { skipped: `not checked on platform='${platform}'` }
	const findings = []
	const unchecked = []
	const add = (check, message) => findings.push({ check, message })
	const read = file => {
		try {
			return _fs.readFileSync(file, 'utf8')
		} catch {
			unchecked.push(file)
		}
	}

	if (uid === 0) add('user', 'the process runs as root (uid=0)')

	const status = read('/proc/self/status')
	if (status !== undefined) {
		const capEff = /^CapEff:\s*([0-9a-f]+)$/im.exec(status)?.[1]
		if (capEff && BigInt('0x' + capEff) != 0n)
			add('capabilities', `the process has effective capabilities (CapEff=${capEff}), drop all capabilities`)
		if (/^NoNewPrivs:\s*0$/m.test(status))
			add('no-new-privileges', 'no_new_privs is not set, set the no-new-privileges option')
	}

	const ptraceFile = '/proc/sys/kernel/yama/ptrace_scope'
	const ptraceScope = readOptional(_fs, ptraceFile)
	if (ptraceScope === null) unchecked.push(ptraceFile)
	else if (ptraceScope === undefined) add('ptrace-scope', 'the Yama LSM is not enabled')
	else if (ptraceScope.trim() == '0') add('ptrace-scope', 'kernel.yama.ptrace_scope=0, set it to 1 or higher')

	const mountinfo = read('/proc/self/mountinfo')
	const mounts = mountinfo === undefined ? [] : parseMountinfo(mountinfo)
	if (mountinfo !== undefined) {
		// the same selection as for the other dirs, the last of any stacked mounts on /
		const root = findMount(mounts, '/')
		if (root && !root.options.includes('ro'))
			add('read-only-root', 'the root filesystem is writable, mount it read-only')
		const realTmpdir = realpath(_fs, tmpdir)
		const dirs = new Map([tmpdir, ...writableDirs].map(dir => [realpath(_fs, dir), dir]))
		const reported = new Set()
		for (const [real, dir] of dirs) {
			const check = real == realTmpdir ? 'tmp-noexec' : 'dir-noexec'
			// the dir's own mount, then the mounts under the dir that the process sees, since a write allowance
			// for a dir also covers the paths under it
			const mount = findMount(mounts, real)
		const under = mounts.filter(
			m =>
				m.mountPoint != real &&
				(real == '/' || m.mountPoint.startsWith(real + '/')) &&
				findMount(mounts, m.mountPoint) === m
		)
			for (const m of mount ? [mount, ...under] : under) {
				// the noexec option does not matter for a ro mount, where nothing can be written
				if (m.options.includes('noexec') || m.options.includes('ro') || reported.has(m)) continue
				reported.add(m)
				add(
					check,
					m === mount
						? `${dir} is on a mount without noexec (mount point ${m.mountPoint})`
						: `${dir} has a mount without noexec under it (mount point ${m.mountPoint})`
				)
			}
		}
	}

	// existsSync() also throws for a path that the permission model denies
	const probe = (check, p) => {
		try {
			if (!_fs.existsSync(p)) return
			_fs.accessSync(p, fs.constants.W_OK)
			add(check, `${p} is writable by the process, it should be read-only`)
		} catch (e) {
			// an expected result: not writable, or the path does not exist; any other error, such as EIO, or
			// ERR_ACCESS_DENIED from the permission model, leaves the path unchecked
			if (!PROBE_RESULT_CODES.has(e.code)) unchecked.push(p)
		}
	}
	for (const dir of findLibDirs(_fs, libDirs, mounts, unchecked)) probe('lib-dirs', dir)
	for (const p of findAppFiles(_fs, appDir, unchecked)) probe('app-files', p)

	return { findings, unchecked }
}

// returns the lib dirs and the dirs in them whose write access may differ from the parent dir's: the package
// dirs of a python venv, lib/python<version>/site-packages, and the mount points under any of these dirs
function findLibDirs(_fs, libDirs, mounts, unchecked) {
	const dirs = new Set()
	for (const dir of libDirs) {
		dirs.add(dir)
		const venvLib = path.join(dir, 'lib')
		try {
			for (const name of _fs.readdirSync(venvLib))
				if (/^python\d/.test(name)) dirs.add(path.join(venvLib, name, 'site-packages'))
		} catch (e) {
			// ENOENT or ENOTDIR for a dir that is not a venv; another error, such as EACCES, EIO, or ERR_ACCESS_DENIED
			// from the permission model, leaves the package dirs unknown
			if (e.code != 'ENOENT' && e.code != 'ENOTDIR') unchecked.push(venvLib)
		}
	}
	for (const m of mounts) {
		// only a mount that the process sees, not one that a later mount hides
		if (findMount(mounts, m.mountPoint) !== m) continue
		if ([...dirs].some(dir => m.mountPoint.startsWith(dir + '/'))) dirs.add(m.mountPoint)
	}
	return dirs
}

// returns the app dir, its node_modules dir, the @sjcrh package dirs, the client bundle dir, and the .mjs files in
// the app dir; not the public dir, which the server writes to in debugmode, or other dirs that a deployment mounts
function findAppFiles(_fs, appDir, unchecked) {
	const nodeModules = path.join(appDir, 'node_modules')
	const sjcrh = path.join(nodeModules, '@sjcrh')
	const paths = [appDir, nodeModules, sjcrh, path.join(appDir, 'bin')]
	for (const [dir, select] of [
		[appDir, name => name.endsWith('.mjs')],
		[sjcrh, () => true]
	]) {
		try {
			for (const name of _fs.readdirSync(dir)) if (select(name)) paths.push(path.join(dir, name))
		} catch (e) {
			// ENOENT or ENOTDIR for a missing dir, such as outside of the image; another error leaves the dir
			// entries unknown
			if (e.code != 'ENOENT' && e.code != 'ENOTDIR') unchecked.push(dir)
		}
	}
	return paths
}

// logs each finding as a warning, or in strict mode as an error for a STRICT_CHECKS finding or a check that
// cannot be done; returns the error messages
export function logRuntimePosture(result, { strict = false, log = console.warn } = {}) {
	const errors = []
	if (result.skipped) return errors
	const report = (isError, message) => {
		log(`runtimePosture.mjs: ${isError ? 'ERROR' : 'WARNING'} ${message}`)
		if (isError) errors.push(message)
	}
	for (const { check, message } of result.findings) report(strict && STRICT_CHECKS.has(check), message)
	if (result.unchecked.length) report(strict, `unable to check ${result.unchecked.join(', ')}`)
	return errors
}

// returns [{id, parentId, mountPoint, options[]}] in mountinfo order; the mount options are the per-mount ones,
// such as ro and noexec, in the 6th field of each /proc/self/mountinfo line
export function parseMountinfo(text) {
	const mounts = []
	for (const line of text.split('\n')) {
		const fields = line.split(' ')
		if (fields.length < 6) continue
		// the kernel escapes a space, tab, newline, or backslash in a path as an octal \ooo sequence
		const mountPoint = fields[4].replace(/\\([0-7]{3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
		mounts.push({ id: fields[0], parentId: fields[1], mountPoint, options: fields[5].split(',') })
	}
	return mounts
}

// returns the mount that the process sees at a path, following the mount tree from the root mount: a mount over
// the same mount point as its parent mount hides that parent, and a later mount at a sibling's mount point or at
// one of its parent dirs hides that sibling and the mounts under it
export function findMount(mounts, p) {
	const contains = (mountPoint, dir) => mountPoint == '/' || dir == mountPoint || dir.startsWith(mountPoint + '/')
	const ids = new Set(mounts.map(m => m.id))
	// the root of this mount namespace, whose parent is outside of it; the last one, if / is mounted again
	let current = mounts.filter(m => m.mountPoint == '/' && !ids.has(m.parentId)).at(-1)
	const visited = new Set()
	while (current && !visited.has(current)) {
		visited.add(current)
		const children = mounts.filter(m => m.parentId == current.id && m !== current)
		const over = children.filter(m => m.mountPoint == current.mountPoint).at(-1)
		if (over) {
			current = over
			continue
		}
		let next
		for (const [i, child] of children.entries()) {
			if (!contains(child.mountPoint, p)) continue
			const hidden = children.slice(i + 1).some(later => contains(later.mountPoint, child.mountPoint))
			if (!hidden && (!next || child.mountPoint.length > next.mountPoint.length)) next = child
		}
		if (!next) return current
		current = next
	}
	return current
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
