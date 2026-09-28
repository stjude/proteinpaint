/*
	Runs a node or tsx command in a limited environment, where the server process

	1. has Node.js permission model restrictions from a generated ./node.config.json, which
	   is applied by adding the --experimental-default-config-file flag to the node or tsx command.
	   The allow-fs-read and allow-fs-write paths are computed from the current working
	   directory, the node install, the OS temp dir, and ./serverconfig.json entries, so that
	   a path traversal bug in a server route cannot read or write files outside of those paths.
	   Additional paths may be set as colon-separated PP_ALLOW_FS_READ and PP_ALLOW_FS_WRITE values.

	2. does not need read access to any credentials file: each <NAME>_CREDS env variable is set
	   to the content of the file named by the corresponding <NAME>_CREDS_FILE env variable, e.g.
	     PP_CREDS_FILE      -> PP_CREDS      (parsed as serverconfig.dsCredentials in server/src/serverconfig.js)
	     PP_MMRF_CREDS_FILE -> PP_MMRF_CREDS (parsed by the MMRF dataset)
	   The code that reads a <NAME>_CREDS env variable must delete it from process.env right after
	   reading it. An existing <NAME>_CREDS env variable, such as one set from a k8s secret, is not
	   overwritten. A credentials file must not be under any allow-fs-read path, such as the cwd or
	   /home/root/pp in a container, otherwise this script exits, since the server could still read it.

	usage: node envHelpers.mjs <node | tsx> [args...]
	examples:
	  node envHelpers.mjs node --enable-source-maps app-server.mjs
	  node envHelpers.mjs tsx watch server.ts

	Do not include --experimental-default-config-file in the arguments: node detects that flag
	anywhere in its argv, even after the script name, so it would apply ./node.config.json to
	this script instead of only to the command. This script adds that flag to the command.

	The PP_ALLOW_FS_* and <NAME>_CREDS_FILE values are read from the environment, or else from
	./.env, such as in a dev environment where npm scripts do not load .env.

	This script must run without the permission model, and runs the command as a child process,
	since Node.js cannot replace its own process like a shell exec. The credentials are passed
	only in the child process env, and are not set in this script's own process.env.
*/

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'

if (isMainModule()) {
	try {
		envHelpers(process.argv.slice(2))
	} catch (e) {
		// e.message is not expected to include credentials, since credentials file contents are not parsed here
		console.error(`envHelpers.mjs: ${e.message || e}`)
		process.exit(1)
	}
}

// deps are passed to createContext(), and may be fakes in tests; returns the spawned child process
export function envHelpers(args, deps = {}) {
	// checked before any file access, which would be denied by the permission model
	if (deps.hasPermissionModel ?? !!process.permission)
		throw 'must not run with the permission model, remove --experimental-default-config-file from the envHelpers.mjs arguments'
	const ctx = createContext(deps)
	const command = routeCommand(args)
	const config = getNodeConfig(ctx)
	for (const conflict of findPrefixConflicts(config)) console.warn(`envHelpers.mjs: WARNING ${conflict}`)
	const credsFiles = getCredsFiles(ctx)
	assertCredsFilesNotAllowed(credsFiles, config, ctx)
	ctx.fs.writeFileSync(path.join(ctx.cwd, 'node.config.json'), JSON.stringify(config, null, '\t') + '\n')
	const creds = readCreds(credsFiles, ctx)
	return runCommand(command, creds, ctx)
}

// the side-effecting dependencies and process details, injectable so that tests can run in-process
export function createContext({
	fs: _fs = fs,
	spawn: _spawn = spawn,
	env = process.env,
	cwd = process.cwd(),
	execPath = process.execPath,
	tmpdir = os.tmpdir(),
	homedir = os.homedir()
} = {}) {
	const dotenvFile = path.join(cwd, '.env')
	const dotenv = _fs.existsSync(dotenvFile) ? parseEnv(_fs.readFileSync(dotenvFile, 'utf8')) : {}
	return { fs: _fs, spawn: _spawn, env, dotenv, cwd, execPath, tmpdir, homedir }
}

// router: each supported command has its own position for the config flag, where it is parsed as an option
function routeCommand(args) {
	const cmd = path.basename(args[0] || '')
	if (cmd == 'node') return insertConfigFlag(args, 1)
	if (cmd == 'tsx') return insertConfigFlag(args, args[1] == 'watch' ? 2 : 1)
	throw 'the command must be node or tsx, usage: node envHelpers.mjs <node | tsx> [args...]'
}

function insertConfigFlag(args, i) {
	return [...args.slice(0, i), '--experimental-default-config-file', ...args.slice(i)]
}

export function getNodeConfig(ctx) {
	const read = new Set()
	const write = new Set()
	const allow = (set, p) => addPath(set, p, ctx)

	// server code, node_modules, serverconfig.json, genome and dataset files
	allow(read, ctx.cwd)
	// tsx detects if the file system is case-sensitive by checking if an inverted-case cwd exists,
	// which the permission model sees as a different path in a case-insensitive file system, like in macOS
	if (isCaseInsensitive(ctx)) read.add(invertCase(ctx.cwd))
	// the node install that runs this script
	allow(read, path.dirname(path.dirname(ctx.execPath)))
	// per-user temp dir, such as for the tsx cache and server temp files
	allow(read, ctx.tmpdir)
	allow(write, ctx.tmpdir)

	const serverconfig = getServerconfigPaths(ctx)
	allow(read, serverconfig.tpmasterdir)
	allow(read, serverconfig.tp_native_dir)
	allow(read, serverconfig.cachedir)
	allow(write, serverconfig.cachedir)
	allow(write, serverconfig.tpWriteDir)
	allow(read, serverconfig.sslKey)
	allow(read, serverconfig.sslCert)
	// a bare command name, such as python3, is resolved from PATH when spawned
	if (serverconfig.python?.includes(path.sep)) allow(read, serverconfig.python)
	// server/genome/copyDataFilesFromRepo2Tp.js checks if this container dir exists
	read.add('/home/root/pp')

	for (const p of getEnvValue('PP_ALLOW_FS_READ', ctx).split(':')) allow(read, p)
	for (const p of getEnvValue('PP_ALLOW_FS_WRITE', ctx).split(':')) allow(write, p)

	return {
		// no comment key such as '//' to mark this file as generated: newer node versions, such as 24.21,
		// exit with 'Unknown namespace' for any top-level key other than nodeOptions and $schema
		nodeOptions: {
			permission: true,
			'allow-fs-read': removeCoveredPaths(read),
			'allow-fs-write': removeCoveredPaths(write),
			// needed for tsx, esbuild, rust/python/R and other tools, but these are not restricted by the permission model
			'allow-child-process': true,
			'allow-worker': true,
			// needed for native modules such as sqlite, which are also not restricted by the permission model
			'allow-addons': true
		}
	}
}

// router: a container uses fixed paths, same as the container overrides in server/src/serverconfig.js
function getServerconfigPaths(ctx) {
	const file = path.join(ctx.cwd, 'serverconfig.json')
	const serverconfig = ctx.fs.existsSync(file) ? JSON.parse(ctx.fs.readFileSync(file, 'utf8')) : {}
	const paths = {
		tpmasterdir: serverconfig.tpmasterdir,
		tp_native_dir: serverconfig.features?.tp_native_dir,
		cachedir: serverconfig.cachedir,
		sslKey: serverconfig.ssl?.key,
		sslCert: serverconfig.ssl?.cert,
		// python/index.js setPythonBinPath() checks that this file exists; other tool paths, such as
		// serverconfig.bigBedToBed or hicstraw, are only spawned, which the permission model does not restrict
		python: serverconfig.python
	}
	if (!ctx.env.PP_MODE?.startsWith('container')) return paths
	// do not also allow writing to /home/root/pp/cachedir, which some deployments mount: the permission
	// model then denies writing to /home/root/pp/cache itself, see findPrefixConflicts()
	return {
		...paths,
		tpmasterdir: '/home/root/pp/tp',
		cachedir: '/home/root/pp/cache',
		// a writable dir that some deployments mount, such as for a burden db; allowing it is harmless when
		// nothing is mounted on it, and it does not share a string prefix with any other allowed write path
		tpWriteDir: '/home/root/pp/tp_write'
	}
}

// returns {<NAME>_CREDS: file content} for each <NAME>_CREDS_FILE in the env or ./.env
export function getCreds(ctx) {
	return readCreds(getCredsFiles(ctx), ctx)
}

// returns [{name: <NAME>_CREDS_FILE, credsName: <NAME>_CREDS, file: absolute path}]
function getCredsFiles(ctx) {
	const credsFiles = []
	for (const name of new Set([...Object.keys(ctx.env), ...Object.keys(ctx.dotenv)])) {
		if (!name.endsWith('_CREDS_FILE')) continue
		const file = getEnvValue(name, ctx)
		const credsName = name.slice(0, -'_FILE'.length)
		// an existing <NAME>_CREDS env variable, even if empty, is not overwritten
		if (!file || credsName in ctx.env) continue
		credsFiles.push({ name, credsName, file: resolvePath(file, ctx) })
	}
	return credsFiles
}

// fail closed: a credentials file under an allow-fs-read path, such as when mounted under the cwd or
// /home/root/pp, could still be read by the server process after its content is passed as <NAME>_CREDS
function assertCredsFilesNotAllowed(credsFiles, config, ctx) {
	const allowed = config.nodeOptions['allow-fs-read']
	// the permission model compares path strings, but a case-insensitive file system, like in macOS,
	// resolves a differently-cased path to the same file
	const normalize = isCaseInsensitive(ctx) ? p => p.toLowerCase() : p => p
	for (const { name, file } of credsFiles) {
		const paths = [file]
		try {
			// a symlinked credentials file is readable through either path
			paths.push(ctx.fs.realpathSync(file))
		} catch {
			// an unreadable file is reported by readCreds()
		}
		for (const p of paths) {
			const root = allowed.find(a => isCoveredBy(normalize(p), normalize(a)))
			if (root)
				throw `${name}='${p}' must not be under an allowed read path '${root}', since the server could still read that file`
		}
	}
}

function readCreds(credsFiles, ctx) {
	const creds = {}
	for (const { credsName, file } of credsFiles) creds[credsName] = ctx.fs.readFileSync(file, 'utf8')
	return creds
}

function runCommand([cmd, ...cmdArgs], creds, ctx) {
	const child = ctx.spawn(cmd, cmdArgs, { stdio: 'inherit', env: { ...ctx.env, ...creds } })
	child.on('error', e => {
		console.error(`envHelpers.mjs: unable to run '${cmd}': ${e.message}`)
		process.exit(1)
	})
	// forward termination signals, such as from `docker stop` to this script as the container's PID 1
	for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
		process.on(signal, () => child.kill(signal))
	}
	child.on('exit', (code, signal) => {
		if (!signal) process.exit(code ?? 1)
		// exit the same way as the child process, without triggering the forwarding listener above
		process.removeAllListeners(signal)
		process.kill(process.pid, signal)
	})
	return child
}

// true when this file is run as a CLI script, not imported, such as by tests
function isMainModule() {
	if (!process.argv[1]) return false
	try {
		// resolves a symlinked script path, such as from node_modules/.bin
		return import.meta.filename == fs.realpathSync(process.argv[1])
	} catch {
		// such as when realpathSync() is denied by the permission model, which envHelpers() then reports
		return import.meta.filename == path.resolve(process.argv[1])
	}
}

// the value of an env variable, or else of its entry in ./.env only when the env variable is absent,
// so that an explicitly empty env variable, such as PP_ALLOW_FS_READ='', overrides a .env value
function getEnvValue(name, ctx) {
	return (name in ctx.env ? ctx.env[name] : ctx.dotenv[name]) ?? ''
}

function addPath(set, p, ctx) {
	if (!p || typeof p != 'string') return
	const abspath = resolvePath(p, ctx)
	set.add(abspath)
	// the permission model checks resolved paths, such as /private/var/... for /var/... in macOS
	try {
		set.add(ctx.fs.realpathSync(abspath))
	} catch {
		// ok if the path does not exist yet
	}
}

// returns the paths without the ones already covered by an allowed ancestor dir, shortest first;
// otherwise the permission model denies access to an allowed dir itself when a subpath of it
// is listed first, such as for /home/root/pp after /home/root/pp/tp in a container
function removeCoveredPaths(paths) {
	const kept = []
	for (const p of [...paths].sort((a, b) => a.length - b.length)) {
		if (!kept.some(k => isCoveredBy(p, k))) kept.push(p)
	}
	return kept
}

// the permission model denies access to an allowed path, or to paths under it, when another allowed path
// has it as a string prefix without being under it, such as /home/root/pp/cache and /home/root/pp/cachedir,
// in either order and with or without a trailing slash; returns a message for each such pair
export function findPrefixConflicts(config) {
	const conflicts = []
	for (const key of ['allow-fs-read', 'allow-fs-write']) {
		const paths = config.nodeOptions[key]
		for (const a of paths) {
			for (const b of paths) {
				if (a != b && b.startsWith(a) && !isCoveredBy(b, a))
					conflicts.push(`${key} paths '${a}' and '${b}' share a prefix, so node may deny access to either`)
			}
		}
	}
	return conflicts
}

// true if p is the same as, or under, the dir path
function isCoveredBy(p, dir) {
	return p == dir || p.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep)
}

// tsx and the case-sensitivity check in getNodeConfig() use the same inverted-case cwd test
function isCaseInsensitive(ctx) {
	const invertedCwd = invertCase(ctx.cwd)
	return invertedCwd != ctx.cwd && ctx.fs.existsSync(invertedCwd)
}

function resolvePath(p, ctx) {
	return path.resolve(ctx.cwd, p.replace(/^~(?=\/|$)/, ctx.homedir))
}

function invertCase(s) {
	return [...s].map(c => (c == c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join('')
}
