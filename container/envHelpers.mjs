/*
	Runs a node or tsx command in a limited environment, where the server process

	1. has Node.js permission model restrictions. A node command gets them as --permission and --allow-* flags,
	   so nothing is written at startup, such as with a read-only root filesystem, and the allowed paths are
	   visible in the server process command line. A tsx command gets them from a generated node.config.json,
	   in ./ or else in the PP_NODE_CONFIG_DIR dir, since tsx would apply the flags to its own process too.
	   The allowed paths are logged at startup. The allow-fs-read and allow-fs-write paths are computed from the current working
	   directory, the node install, the OS temp dir, and ./serverconfig.json entries, so that
	   a path traversal bug in a server route cannot read or write files outside of those paths.
	   Additional paths may be set as colon-separated PP_ALLOW_FS_READ and PP_ALLOW_FS_WRITE values.

	2. does not need read access to any credentials file: each <NAME>_CREDS env variable is set
	   to the content of the file named by the corresponding <NAME>_CREDS_FILE env variable, e.g.
	     PP_CREDS_FILE      -> PP_CREDS      (parsed as serverconfig.dsCredentials in server/src/serverconfig.js)
	     PP_MMRF_CREDS_FILE -> PP_MMRF_CREDS (parsed by the MMRF dataset)
	   The code that reads a <NAME>_CREDS env variable must delete it from process.env right after
	   reading it. An existing <NAME>_CREDS env variable, such as one set from a k8s or podman secret, is
	   not overwritten. A credentials file must not be under any allow-fs-read path, such as the cwd or
	   /home/root/pp in a container, otherwise this script exits, since the server could still read it.

	3. does not have any credentials in its initial env, which is set when a process starts and is not
	   changed by deleting an env variable from process.env. So a node command replaces this script's
	   process with process.execve(), without any <NAME>_CREDS env variable, and receives all
	   credentials as JSON in a private temp file named by PP_CREDS_HANDOFF_FILE, which
	   server/src/serverconfig.js reads and removes before the server starts listening. This script is then no longer running, and the
	   server is PID 1 in a container. A tsx command, as used in a dev environment, or a node command with
	   a --watch or --watch-path option, still runs as a child process that receives the credentials as env
	   variables, since a watch mode restarts the server, which would no longer find a removed handoff file.

	4. in a container (PP_MODE=container*), logs a warning for each recommended container runtime setting
	   that is not applied, see runtimePosture.mjs; the warnings do not stop the server from starting.

	usage: node envHelpers.mjs <node | tsx> [args...]
	examples:
	  node envHelpers.mjs node --enable-source-maps app-server.mjs
	  node envHelpers.mjs tsx watch server.ts

	Do not include --permission or --experimental-default-config-file in the arguments: node detects
	--experimental-default-config-file anywhere in its argv, even after the script name, so it would apply
	./node.config.json to this script instead of only to the command. This script adds these to the command.

	The PP_ALLOW_FS_* and <NAME>_CREDS_FILE values are read from the environment, or else from
	./.env, such as in a dev environment where npm scripts do not load .env.

	This script must run without the permission model. process.execve() replaces it with a node
	command that runs with the permission model from the --permission and --allow-* flags.
	The credentials are passed only to the command, and are not set in this script's own process.env.
*/

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { spawn } from 'node:child_process'
// imported only without the permission model, which would deny reading it before envHelpers() can report that error
const runtimePosture = process.permission ? undefined : await import('./runtimePosture.mjs')

if (isMainModule()) {
	try {
		envHelpers(process.argv.slice(2))
	} catch (e) {
		// e.message is not expected to include credentials, since credentials file contents are not parsed here
		console.error(`envHelpers.mjs: ${e.message || e}`)
		process.exit(1)
	}
}

// deps are passed to createContext(), and may be fakes in tests; returns the spawned child process, or nothing
// after a process.execve() call, which does not return except with a fake in tests
export function envHelpers(args, deps = {}) {
	// checked before any file access, which would be denied by the permission model
	if (deps.hasPermissionModel ?? !!process.permission)
		throw 'must not run with the permission model, remove --permission or --experimental-default-config-file from the envHelpers.mjs arguments'
	const ctx = createContext(deps)
	const config = getNodeConfig(ctx)
	for (const conflict of findPrefixConflicts(config)) console.warn(`envHelpers.mjs: WARNING ${conflict}`)
	const credsFiles = getCredsFiles(ctx)
	assertCredsFilesNotAllowed(credsFiles, config, ctx)
	const command = routeCommand(args, config, ctx)
	logAllowedPaths(config)
	const creds = { ...getEnvCreds(ctx), ...readCreds(credsFiles, ctx) }
	mayCheckRuntimePosture(config, ctx)
	return runCommand(command, creds, ctx)
}

// the side-effecting dependencies and process details, injectable so that tests can run in-process
export function createContext({
	fs: _fs = fs,
	spawn: _spawn = spawn,
	execve = process.execve,
	env = process.env,
	cwd = process.cwd(),
	execPath = process.execPath,
	tmpdir = os.tmpdir(),
	homedir = os.homedir(),
	checkPosture = runtimePosture?.checkRuntimePosture
} = {}) {
	const dotenvFile = path.join(cwd, '.env')
	const dotenv = _fs.existsSync(dotenvFile) ? parseEnv(_fs.readFileSync(dotenvFile, 'utf8')) : {}
	return { fs: _fs, spawn: _spawn, execve, env, dotenv, cwd, execPath, tmpdir, homedir, checkPosture }
}

// router: a node command gets the permission flags, and a tsx command gets a config file; each is inserted
// where the command parses it as an option
function routeCommand(args, config, ctx) {
	const cmd = path.basename(args[0] || '')
	if (cmd == 'node') return insertAt(args, 1, permissionFlags(config))
	if (cmd == 'tsx') return insertAt(args, args[1] == 'watch' ? 2 : 1, [writeConfigFile(config, ctx)])
	throw 'the command must be node or tsx, usage: node envHelpers.mjs <node | tsx> [args...]'
}

function insertAt(args, i, flags) {
	return [...args.slice(0, i), ...flags, ...args.slice(i)]
}

// such as --permission --allow-fs-read=/a --allow-fs-read=/b --allow-child-process, one path per flag
export function permissionFlags(config) {
	const flags = []
	for (const [key, value] of Object.entries(config.nodeOptions)) {
		if (Array.isArray(value)) for (const p of value) flags.push(`--${key}=${p}`)
		else if (value === true) flags.push(`--${key}`)
	}
	return flags
}

// returns the node flag that applies the written config file
function writeConfigFile(config, ctx) {
	const dir = getEnvValue('PP_NODE_CONFIG_DIR', ctx)
	const file = path.join(dir ? resolvePath(dir, ctx) : ctx.cwd, 'node.config.json')
	ctx.fs.writeFileSync(file, JSON.stringify(config, null, '\t') + '\n')
	return dir ? `--experimental-config-file=${file}` : '--experimental-default-config-file'
}

// to stderr, so that the stdout of the command, such as a message that a preListenScript detects, is unchanged
function logAllowedPaths(config) {
	for (const key of ['allow-fs-read', 'allow-fs-write'])
		console.error(`envHelpers.mjs: ${key} ${config.nodeOptions[key].join(' ')}`)
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

// in a container, logs the recommended runtime settings that are not applied; the allowed write dirs
// that exist are expected to be on noexec mounts
function mayCheckRuntimePosture(config, ctx) {
	if (!ctx.env.PP_MODE?.startsWith('container') || !ctx.checkPosture) return
	try {
		const writableDirs = config.nodeOptions['allow-fs-write'].filter(p => ctx.fs.existsSync(p))
		runtimePosture.logRuntimePosture(ctx.checkPosture({ tmpdir: ctx.tmpdir, writableDirs }))
	} catch (e) {
		console.warn(`envHelpers.mjs: WARNING unable to check the runtime settings: ${e.message || e}`)
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

// the <NAME>_CREDS env variable names, not including a <NAME>_CREDS_FILE path
function getEnvCredsNames(env) {
	return Object.keys(env).filter(name => name.endsWith('_CREDS'))
}

function getEnvCreds(ctx) {
	return Object.fromEntries(getEnvCredsNames(ctx.env).map(name => [name, ctx.env[name]]))
}

// router: a node command replaces this process, and a tsx command or node watch mode runs as a child process
function runCommand(command, creds, ctx) {
	if (path.basename(command[0]) != 'node' || isNodeWatchMode(command)) return spawnCommand(command, creds, ctx)
	if (typeof ctx.execve != 'function') {
		console.warn(
			`envHelpers.mjs: WARNING process.execve() is not supported, so the command runs as a child process, ` +
				`with the credentials in its initial env`
		)
		return spawnCommand(command, creds, ctx)
	}
	execCommand(command, creds, ctx)
}

// node --watch restarts the server with its initial env, which would name a removed handoff file; a matching
// argument after the script name, which is not a node option, also runs the command as a child process
function isNodeWatchMode([, ...args]) {
	return args.some(arg => /^--watch(-path)?(=|$)/.test(arg))
}

// replaces this process with the command, without any <NAME>_CREDS env variable in its initial env
function execCommand([cmd, ...cmdArgs], creds, ctx) {
	const env = { ...ctx.env }
	for (const name of getEnvCredsNames(env)) delete env[name]
	// an existing handoff file name, such as from a container env entry, is not passed
	delete env.PP_CREDS_HANDOFF_FILE
	let dir
	if (Object.keys(creds).length) {
		// a new dir with mode 0700, so readable only by this user, in the OS temp dir where the server is allowed
		// to remove it; a credentials file is otherwise not allowed under an allow-fs-read path, but this one is
		// removed before the server starts listening
		dir = ctx.fs.mkdtempSync(path.join(ctx.tmpdir, 'pp-creds-'))
		env.PP_CREDS_HANDOFF_FILE = path.join(dir, 'creds.json')
	}
	// process.execve() requires a path, and does not search PATH like spawn()
	const file = cmd.includes(path.sep) ? cmd : ctx.execPath
	try {
		if (dir) ctx.fs.writeFileSync(env.PP_CREDS_HANDOFF_FILE, JSON.stringify(creds), { mode: 0o600, flag: 'wx' })
		ctx.execve(file, [cmd, ...cmdArgs], env)
	} catch (e) {
		if (dir) ctx.fs.rmSync(dir, { recursive: true, force: true })
		throw e
	}
}

function spawnCommand([cmd, ...cmdArgs], creds, ctx) {
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
