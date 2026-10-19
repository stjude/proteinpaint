import { getRCommand } from '@sjcrh/proteinpaint-r'
import { getPythonCommand } from '@sjcrh/proteinpaint-python'
import { getRustCommand } from '@sjcrh/proteinpaint-rust'
import serverconfig from '../serverconfig.js'
import { specs, getCall, checkCacheDir } from '../tools/index.ts'

/*
The requests to start a process, and the command that each one starts. A request names what to run, such as a tool
operation and its input fields, or an R script, and never has a command or argv. getCommand() checks a request and
builds its command, in the server process when it starts the process itself, and in the tool runner process when
the server sends it the request, see runner.ts. So the runner starts only the commands that the server may start.

- tool: an operation of the specs in server/src/tools, see runTool()
- R, python, rust: a script or binary of the R, python or rust package, without arguments; each package builds the
  command, see getRCommand(), getPythonCommand(), and getRustCommand()
- hts: a samtools or bcftools subcommand with its arguments, see spawnTool() in utils.js; these reads do not have
  a spec yet, so each argument is only checked to be a bounded string without a control character, and a region
  must not start with "-"
*/

export type ToolRequest =
	| { kind: 'tool'; op: string; input: Record<string, unknown> }
	| { kind: 'R'; script: string; subdir: string }
	| { kind: 'python'; script: string }
	| { kind: 'rust'; binary: string }
	| { kind: 'hts'; tool: HtsTool; args: string[]; cwd: string | null }

export type HtsTool = 'samtools' | 'bcftools'

export type Command = { file: string; args: string[]; cwd?: string }

/** the keys of each request kind, all required */
const requestKeys: Readonly<Record<ToolRequest['kind'], readonly string[]>> = Object.freeze({
	tool: ['kind', 'op', 'input'],
	R: ['kind', 'script', 'subdir'],
	python: ['kind', 'script'],
	rust: ['kind', 'binary'],
	hts: ['kind', 'tool', 'args', 'cwd']
})

/** the subcommands that the server runs */
const htsSubcommands: Readonly<Record<HtsTool, readonly string[]>> = Object.freeze({
	samtools: Object.freeze(['view', 'depth', 'quickcheck']),
	bcftools: Object.freeze(['query', 'view'])
})

/** the upper limits of the number and length of the arguments of an hts request */
const maxHtsArgs = 1000
/* an argument may be a joined list, such as the regions after -r or the sample names after -s of a bcftools query,
so the limit is the one of Linux for an argument of a new process, MAX_ARG_STRLEN with its terminating NUL, which
would otherwise fail when the tool is started; the total keeps the request within one frame, see maxPayload */
const maxArgLength = 128 * 1024 - 1
const maxArgsLength = 768 * 1024
// eslint-disable-next-line no-control-regex
const anyControlChar = /[\x00-\x1f\x7f]/
/** a control character other than a tab or newline */
// eslint-disable-next-line no-control-regex
const formatControlChars = /[\x00-\x08\x0b-\x1f\x7f]/

/** returns the command of a request, or throws */
export function getCommand(req: unknown): Command {
	const kind = checkRequestKeys(req)
	const r = req as ToolRequest
	switch (r.kind) {
		case 'tool':
			return getToolCommand(r.op, r.input)
		case 'R':
			return getRCommand(r.script, [], r.subdir)
		case 'python':
			return getPythonCommand(r.script)
		case 'rust':
			return getRustCommand(r.binary, [])
		case 'hts':
			return getHtsCommand(r)
		default:
			throw `unknown request kind ${kind}`
	}
}

/** returns the kind of a request that is a plain object with exactly the keys of its kind, or throws */
function checkRequestKeys(req: unknown): string {
	if (!req || typeof req != 'object' || Object.getPrototypeOf(req) !== Object.prototype)
		throw 'request must be a plain object'
	const kind = (req as { kind?: unknown }).kind
	if (typeof kind != 'string' || !Object.hasOwn(requestKeys, kind)) throw 'unknown request kind'
	const keys = requestKeys[kind as ToolRequest['kind']]
	const found = Object.keys(req)
	if (found.length != keys.length || !keys.every(k => found.includes(k))) throw `invalid ${kind} request keys`
	return kind
}

function getToolCommand(op: unknown, input: unknown): Command {
	if (typeof op != 'string' || !Object.hasOwn(specs, op)) throw `unknown tool operation: ${op}`
	const spec = specs[op]
	const { argv, cwd } = getCall(op, spec, input as Record<string, unknown>)
	const file = spec.bin()
	if (typeof file != 'string' || !file) throw `${op}: tool binary is not configured`
	return cwd ? { file, args: argv, cwd } : { file, args: argv }
}

function getHtsCommand(r: Extract<ToolRequest, { kind: 'hts' }>): Command {
	if (!Object.hasOwn(htsSubcommands, r.tool)) throw 'invalid hts tool'
	const file = serverconfig[r.tool]
	if (typeof file != 'string' || !file) throw `${r.tool} is not configured`
	const { args } = r
	if (!Array.isArray(args) || args.length == 0 || args.length > maxHtsArgs) throw `${r.tool}: invalid args`
	if (!htsSubcommands[r.tool].includes(args[0])) throw `${r.tool}: unsupported subcommand`
	if (args.reduce((n, a) => n + (typeof a == 'string' ? a.length : 0), 0) > maxArgsLength)
		throw `${r.tool}: invalid args`
	for (const [i, a] of args.entries()) {
		// the bcftools output format, such as '%POS\t%ID\n', is the only argument with a tab or newline
		const controlChars = r.tool == 'bcftools' && args[i - 1] == '-f' ? formatControlChars : anyControlChar
		if (typeof a != 'string' || !a || a.length > maxArgLength || controlChars.test(a))
			throw `${r.tool}: invalid argument`
		// a region built from a request chr, such as "-o/path:1-2", which the tool would parse as an option
		if (a[0] == '-' && a.includes(':')) throw 'invalid region argument'
	}
	if (r.cwd === null) return { file, args: [...args] }
	// the cache dir of a url file, where the tool keeps the index that it downloads
	return { file, args: [...args], cwd: checkCacheDir(r.cwd, `${r.tool}: invalid cwd`) }
}
