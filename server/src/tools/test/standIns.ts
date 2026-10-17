import fs from 'fs'
import os from 'os'
import path from 'path'

/*
Stand-in tools for the call-site specs. Each stand-in is an executable script that appends its argv to a log,
then runs the given shell lines, such as to print the output that the caller parses.

A stand-in replaces a tool that is configured in serverconfig, such as serverconfig.hicstraw, by its path,
or a tool that is run by name, such as h5dump, by prependPath().
*/

export class StandIns {
	dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-standins-'))
	#path = process.env.PATH

	/** writes the stand-in name and returns its path; script: shell lines that run after the argv is logged */
	add(name: string, script = '') {
		const bin = path.join(this.dir, name)
		// each argument is followed by \037, which an argument cannot have, since the tools module rejects control characters
		const log = `{ for a in "$@"; do printf '%s\\037' "$a"; done; printf '\\n'; } >> "$0.log"`
		fs.writeFileSync(bin, `#!/bin/sh\n${log}\n${script}\n`, { mode: 0o755 })
		return bin
	}

	/** the argv of each call of the stand-in name, in the order of the calls */
	calls(name: string): string[][] {
		const log = path.join(this.dir, name + '.log')
		if (!fs.existsSync(log)) return []
		return fs
			.readFileSync(log, 'utf8')
			.split('\n')
			.slice(0, -1)
			.map(line => line.split('\x1f').slice(0, -1))
	}

	/** clears the logs of all stand-ins */
	reset() {
		for (const f of fs.readdirSync(this.dir)) if (f.endsWith('.log')) fs.rmSync(path.join(this.dir, f))
	}

	/** so that a tool that is run by name is found in the stand-in dir first */
	prependPath() {
		process.env.PATH = this.dir + path.delimiter + this.#path
	}

	restorePath() {
		process.env.PATH = this.#path
	}

	remove() {
		this.restorePath()
		fs.rmSync(this.dir, { recursive: true, force: true })
	}
}
