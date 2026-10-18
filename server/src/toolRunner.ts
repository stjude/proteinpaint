import fs from 'fs'
import os from 'os'
import path from 'path'
import { setPythonBinPath } from '@sjcrh/proteinpaint-python'
import serverconfig from './serverconfig.js'
import { listenToolRunner } from './toolRunner/runner.ts'

/*
The tool runner process, which starts the processes that the server requests, see toolRunner/runner.ts.
container/envHelpers.mjs starts it right before the server, with process.env.PP_TOOL_RUNNER_SOCKET as the socket
path in a new dir that only this user may list, and without any credentials in its env.

It reads the same serverconfig.json as the server, for the tool paths and the tp and cache dirs. The cache subdir
of the server is derived from a key that this process does not have, so a cache file is checked to be under the
configured cachedir instead, see hideCachedir in serverconfig.js, which envHelpers.mjs turns off for this process.

Exits when the server closes its control connection, or when the process that started it exits, and then removes
the socket dir.

usage: PP_TOOL_RUNNER_SOCKET=<path> node src/toolRunner.js
*/

const socketPath = process.env.PP_TOOL_RUNNER_SOCKET
delete process.env.PP_TOOL_RUNNER_SOCKET
if (!socketPath) throw 'process.env.PP_TOOL_RUNNER_SOCKET is not set'

if (serverconfig.python) setPythonBinPath(serverconfig.python)

process.on('exit', () => removeSocketDir(socketPath))
// such as from Ctrl-C, which also reaches this process, so that the exit handler runs
for (const [signal, code] of [
	['SIGTERM', 143],
	['SIGINT', 130],
	['SIGHUP', 129]
] as const)
	process.once(signal, () => process.exit(code))

await listenToolRunner({ socketPath })
console.log(`the tool runner is listening`)
exitWithParent()

/** only a dir as created by envHelpers.mjs */
function removeSocketDir(p: string) {
	const dir = path.dirname(p)
	if (path.basename(p) != 'tools.sock' || path.dirname(dir) != path.resolve(os.tmpdir())) return
	if (!path.basename(dir).startsWith('pp-runner-')) return
	fs.rmSync(dir, { recursive: true, force: true })
}

/** such as when the server exits before it connects; the parent pid is unchanged when the parent replaces itself
 * with the server by process.execve() */
function exitWithParent() {
	const ppid = process.ppid
	setInterval(() => {
		if (process.ppid != ppid) process.exit(0)
	}, 1000).unref()
}
