import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import type { Command } from './requests.ts'

/*
Starts the command of a request, see getCommand() in requests.ts. The only server module that imports
child_process, see test/childProcessImports.unit.spec.js. It is used by the tool runner process, and by the
server process when it does not use a tool runner, see client.ts.
*/

export function spawnCommand(cmd: Command): ChildProcessWithoutNullStreams {
	// no shell option, so that the default of no shell is used and each argument reaches the tool as one literal string
	return cmd.cwd ? spawn(cmd.file, cmd.args, { cwd: cmd.cwd }) : spawn(cmd.file, cmd.args)
}
