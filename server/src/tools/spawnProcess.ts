import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'

/*
Starts the external tools of the server, see runTool() in index.ts and spawnTool() in ../utils.js. The only server/src
module that imports child_process, see test/childProcessImports.unit.spec.js.
*/

/** the error of a computation that this server build cannot run, without the details of the build, which are logged */
export const unsupportedComputation = 'this server build does not support this data computation request'

/**
 * spawn(), or throws unsupportedComputation when the node permission model does not allow a child process, such as in
 * an image without the tools; the tool name is only logged
 */
export function spawnProcess(bin: string, args: string[], opts?: { cwd?: string }): ChildProcessWithoutNullStreams {
	if (process.permission && !process.permission.has('child')) {
		console.warn(`${path.basename(bin)}: not started, since the node permission model does not allow a child process`)
		throw unsupportedComputation
	}
	// no options object when there are none, the same as the spawn(bin, argv) call that this replaced
	return opts ? spawn(bin, args, opts) : spawn(bin, args)
}
