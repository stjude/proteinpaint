import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import serverconfig from '../serverconfig.js'
import { illegalUrlHost } from '../utils.js'
import { specs as bigbedSpecs } from './bigbed.ts'
import { specs as fimoSpecs } from './fimo.ts'
import { specs as gfClientSpecs } from './gfClient.ts'
import { specs as h5dumpSpecs } from './h5dump.ts'
import { specs as hicstrawSpecs } from './hicstraw.ts'
import { specs as rscriptSpecs } from './rscript.ts'
import { specs as samtoolsSpecs } from './samtools.ts'
import { specs as systemSpecs } from './system.ts'
import { specs as tabixSpecs } from './tabix.ts'
import { specs as versionSpecs } from './versions.ts'

/*
Starts an external tool from a named operation and its input fields, instead of from an argv array.

Each operation has a spec, in a file of this dir, with its input fields and an argv template. runTool():
- requires the input to be a plain object with exactly the fields of the spec
- checks each field value by the field type: an enum, an integer or number range, a string pattern, a file path
  under an allowed root dir, or a file path or url
- builds argv from the template, so that a field value can only be in the argv slot that the spec gives it; a slot
  may have a literal prefix, such as -chrom=$chr, and a list field fills consecutive slots, as ...$name
- checks every value slot again: a non-empty string of bounded length, with no control character, that does
  not start with "-"
- throws before the tool is started if any check fails

A spec may also give the working dir of the tool, as a file field under cachedir, such as the dir where tabix keeps the
index that it downloads for a url. That is the only field that may be optional. It is not an argument, and is checked
as an absolute path under cachedir, which may have the characters of a url, see checkCacheDir().

runToolOutput() does the same and resolves with the exit code and output of the tool.

The specs are checked when this module is loaded, see checkSpec().

see test/tools.unit.spec.ts for the specs of this module
*/

/** a root dir of a file field: tp is serverconfig.tpmasterdir, cache is serverconfig.cachedir */
export type FileRoot = 'tp' | 'cache'

export type Field =
	/** one of the listed strings */
	| { type: 'enum'; values: readonly string[] }
	/** a number that is an integer from min to max, where min >= 0 */
	| { type: 'int'; min: number; max: number }
	/** a finite number from min to max, where min >= 0 */
	| { type: 'number'; min: number; max: number }
	/** a string that matches the pattern, which must start with ^ and end with $ */
	| { type: 'string'; pattern: RegExp; maxLength: number }
	/** a path under one of the roots; with debugmodeAnyRoot, any absolute path is allowed when serverconfig.debugmode
	 * is true, for a dataset file that a dev environment may keep outside tp */
	| { type: 'file'; roots: readonly FileRoot[]; debugmodeAnyRoot?: boolean }
	/** a path under one of the roots, by default only tp, or an http, https, or ftp url with an allowed host */
	| { type: 'fileOrUrl'; roots?: readonly FileRoot[] }
	/** an array of 1 to maxItems values of the item field, which fill consecutive argv slots */
	| { type: 'list'; item: Field; maxItems: number }

/** optional: the field may be undefined or null, which is only allowed for the cwd field */
export type FieldSpec = Field & { optional?: boolean }

export type ToolSpec = {
	/** the binary, from serverconfig, which is read when the tool is started */
	bin: () => string
	fields: Readonly<Record<string, FieldSpec>>
	/** each item is a literal argument; "$name" for the value of the field name, after an optional literal prefix such
	 * as -chrom=; or "...$name" for the values of the list field name */
	argv: readonly string[]
	/** "$name" of a file field under cachedir that is the working dir of the tool */
	cwd?: string
}

/** an argv item that is a field slot */
type Slot = { prefix: string; name: string; spread: boolean }

export type ToolOutput = { code: number | null; stdout: string; stderr: string }

/** the upper limit of the length of an argument */
const maxArgLength = 4096

// a module-local copy, since serverconfig.cachedir is deleted before the server starts listening
const cachedir = serverconfig.cachedir

const fileRoots: Readonly<Record<FileRoot, () => string>> = Object.freeze({
	tp: () => serverconfig.tpmasterdir,
	cache: () => cachedir
})

export const specs: Readonly<Record<string, ToolSpec>> = deepFreeze(
	mergeSpecs([
		bigbedSpecs,
		fimoSpecs,
		gfClientSpecs,
		h5dumpSpecs,
		hicstrawSpecs,
		rscriptSpecs,
		samtoolsSpecs,
		systemSpecs,
		tabixSpecs,
		versionSpecs
	])
)
for (const [op, spec] of Object.entries(specs)) checkSpec(op, spec)

/** op: a key of specs, such as 'hicstraw.query'; input: the field values of the op */
export function runTool(op: string, input: Record<string, unknown>): ChildProcessWithoutNullStreams {
	const spec = Object.hasOwn(specs, op) ? specs[op] : undefined
	if (!spec) throw `unknown tool operation: ${op}`
	const { argv, cwd } = getCall(op, spec, input)
	const bin = spec.bin()
	if (typeof bin != 'string' || !bin) throw `${op}: tool binary is not configured`
	// no shell option, so that the default of no shell is used and each argument reaches the tool as one literal string
	return cwd ? spawn(bin, argv, { cwd }) : spawn(bin, argv)
}

/** same as runTool(), and resolves with the exit code and output; rejects with the error if the tool cannot be started */
export function runToolOutput(op: string, input: Record<string, unknown>): Promise<ToolOutput> {
	return new Promise((resolve, reject) => {
		const ps = runTool(op, input)
		const stdout: Buffer[] = []
		const stderr: Buffer[] = []
		ps.stdout.on('data', d => stdout.push(d))
		ps.stderr.on('data', d => stderr.push(d))
		ps.on('error', reject)
		ps.on('close', code => {
			// a multibyte character may be split across chunks, so the chunks are joined before decoding
			resolve({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') })
		})
	})
}

/** returns the argv of an op from its input, or throws */
export function getArgv(op: string, spec: ToolSpec, input: Record<string, unknown>): string[] {
	return getCall(op, spec, input).argv
}

/** returns the argv and working dir of an op from its input, or throws */
export function getCall(op: string, spec: ToolSpec, input: Record<string, unknown>): { argv: string[]; cwd?: string } {
	if (!input || typeof input != 'object' || Object.getPrototypeOf(input) !== Object.prototype)
		throw `${op}: input must be a plain object`
	for (const k of Object.keys(input)) {
		if (!Object.hasOwn(spec.fields, k)) throw `${op}: unexpected input field ${k}`
	}
	const cwdName = spec.cwd ? parseSlot(spec.cwd)!.name : undefined
	const values = new Map<string, string | string[]>()
	for (const [name, field] of Object.entries(spec.fields)) {
		const msg = `${op}: invalid ${name}`
		if (field.optional && (input[name] === undefined || input[name] === null)) continue
		if (!Object.hasOwn(input, name)) throw `${op}: missing input field ${name}`
		const v = input[name]
		values.set(
			name,
			name === cwdName
				? checkCacheDir(v, msg)
				: field.type == 'list'
				? checkList(field, v, msg)
				: checkField(field, v, msg)
		)
	}
	const argv: string[] = []
	for (const a of spec.argv) {
		const slot = parseSlot(a)
		if (!slot) {
			argv.push(a)
			continue
		}
		const v = values.get(slot.name)!
		// every value is checked again here, whatever its field type, before it is put in its slot
		for (const s of Array.isArray(v) ? v : [v]) {
			if (!isSafeValueArg(s)) throw `${op}: invalid ${slot.name}`
			argv.push(slot.prefix + s)
		}
	}
	const cwd = cwdName ? (values.get(cwdName) as string | undefined) : undefined
	if (cwd !== undefined && !isSafeValueArg(cwd)) throw `${op}: invalid ${cwdName}`
	return { argv, cwd }
}

/** returns the argument strings of a list field value, or throws msg */
function checkList(field: Extract<Field, { type: 'list' }>, v: unknown, msg: string): string[] {
	if (!Array.isArray(v) || v.length == 0 || v.length > field.maxItems) throw msg
	return v.map(i => checkField(field.item, i, msg))
}

/** returns the slot of an argv item, or undefined for a literal argument */
function parseSlot(a: string): Slot | undefined {
	const m = /^(\.\.\.)?([^$]*)\$([A-Za-z_][A-Za-z0-9_]*)$/.exec(a)
	if (!m) return
	return { spread: !!m[1], prefix: m[2], name: m[3] }
}

/** returns the argument string of a field value, or throws msg */
function checkField(field: Field, v: unknown, msg: string): string {
	switch (field.type) {
		case 'enum':
			if (typeof v != 'string' || !field.values.includes(v)) throw msg
			return v
		case 'int':
			if (typeof v != 'number' || !Number.isSafeInteger(v) || v < field.min || v > field.max) throw msg
			return String(v)
		case 'number':
			if (typeof v != 'number' || !Number.isFinite(v) || v < field.min || v > field.max) throw msg
			return String(v)
		case 'string':
			// the whole value must match, since an anchored pattern with an alternation, such as /^a|b$/, matches part of xb
			if (typeof v != 'string' || v.length > field.maxLength || v.match(field.pattern)?.[0] !== v) throw msg
			return v
		case 'file':
			if (field.debugmodeAnyRoot && serverconfig.debugmode) return checkAbsoluteFile(v, msg)
			return checkFile(v, field.roots, msg)
		case 'fileOrUrl':
			if (typeof v == 'string' && v.includes('://')) return checkUrl(v, msg)
			return checkFile(v, field.roots || ['tp'], msg)
		default:
			throw msg
	}
}

/** returns the absolute path of a file under one of the roots, where a relative path is resolved under the first root */
function checkFile(v: unknown, roots: readonly FileRoot[], msg: string): string {
	if (!isFilePath(v)) throw msg
	// a ".." segment could leave the root
	if (v.split('/').includes('..')) throw msg
	for (const r of path.isAbsolute(v) ? roots : roots.slice(0, 1)) {
		const dir = fileRoots[r]()
		if (!dir) continue
		const root = path.resolve(dir)
		const file = path.resolve(root, v)
		if (file.startsWith(root + path.sep)) return file
	}
	throw msg
}

/*
returns the absolute path of a working dir under cachedir, or throws msg. The dir is not an argument, so its characters
are not limited like a file path: the cache dir of a url, from cache_index in utils.js, keeps the url body, which may have a port,
percent-encoded characters, or a query string. It must not have a ".." segment or a control character.
*/
export function checkCacheDir(v: unknown, msg: string): string {
	// eslint-disable-next-line no-control-regex
	if (typeof v != 'string' || v.length > maxArgLength || /[\x00-\x1f\x7f]/.test(v)) throw msg
	if (!path.isAbsolute(v) || v.split('/').includes('..')) throw msg
	const root = path.resolve(cachedir)
	const dir = path.resolve(v)
	if (!dir.startsWith(root + path.sep)) throw msg
	return dir
}

function checkAbsoluteFile(v: unknown, msg: string): string {
	if (!isFilePath(v) || !path.isAbsolute(v)) throw msg
	return path.resolve(v)
}

/** the characters of a file path, which include the space and parentheses that some dataset file names have */
const filePathChars = /^[A-Za-z0-9 _.,+=@~()/-]+$/

/** a file path of the allowed characters, where no segment starts with "-", which is not an expected file name */
function isFilePath(v: unknown): v is string {
	return (
		typeof v == 'string' && v.length <= maxArgLength && filePathChars.test(v) && !v.split('/').some(s => s[0] == '-')
	)
}

function checkUrl(v: string, msg: string): string {
	if (!serverconfig.features?.ALLOW_remotefilefromurl) throw msg
	let protocol
	try {
		protocol = new URL(v).protocol
	} catch (_) {
		throw msg
	}
	// the same protocols as fileurl and cache_index in utils.js, see cacheUrlProtocols
	if (protocol != 'http:' && protocol != 'https:' && protocol != 'ftp:') throw msg
	if (illegalUrlHost(v)) throw msg
	return v
}

/** the check of every value slot, whatever its field type */
function isSafeValueArg(s: unknown) {
	// eslint-disable-next-line no-control-regex
	return typeof s == 'string' && s.length > 0 && s.length <= maxArgLength && s[0] != '-' && !/[\x00-\x1f\x7f]/.test(s)
}

/** throws if a spec is malformed, so that a spec mistake stops the server at startup */
export function checkSpec(op: string, spec: ToolSpec) {
	if (typeof spec.bin != 'function') throw `tool spec ${op}: bin must be a function`
	const used = new Set<string>()
	const use = (name: string, item: string) => {
		if (!Object.hasOwn(spec.fields, name)) throw `tool spec ${op}: ${item} is not a field`
		if (used.has(name)) throw `tool spec ${op}: field ${name} is used more than once`
		used.add(name)
	}
	for (const a of spec.argv) {
		if (typeof a != 'string' || !a) throw `tool spec ${op}: argv item must be a non-empty string`
		const slot = parseSlot(a)
		if (!slot) {
			if (a.includes('$'))
				throw `tool spec ${op}: argv ${a} must be a literal without $, $name, prefix$name, or ...$name`
			continue
		}
		use(slot.name, `argv ${a}`)
		const field = spec.fields[slot.name]
		if (slot.spread != (field.type == 'list'))
			throw `tool spec ${op}: only a list field is used as ...$name, and always so`
		if (slot.spread && slot.prefix) throw `tool spec ${op}: argv ${a} must not have a prefix`
		if (field.optional) throw `tool spec ${op}: field ${slot.name} in argv must not be optional`
	}
	if (spec.cwd !== undefined) {
		const slot = parseSlot(spec.cwd)
		if (!slot || slot.prefix || slot.spread) throw `tool spec ${op}: cwd must be $name`
		use(slot.name, `cwd ${spec.cwd}`)
		const field = spec.fields[slot.name]
		if (field.type != 'file' || field.roots.join() != 'cache' || field.debugmodeAnyRoot)
			throw `tool spec ${op}: cwd must be a file field with only the cache root`
	}
	for (const [name, field] of Object.entries(spec.fields)) {
		if (!used.has(name)) throw `tool spec ${op}: field ${name} is not used in argv`
		if (field.type == 'list') {
			if (!Number.isInteger(field.maxItems) || field.maxItems < 1 || field.maxItems > 10000)
				throw `tool spec ${op}: maxItems of ${name} must be from 1 to 10000`
			if (field.item.type == 'list') throw `tool spec ${op}: item of ${name} must not be a list`
			checkField_spec(op, `${name} item`, field.item)
		} else checkField_spec(op, name, field)
	}
}

/** throws if the type options of a field that is not a list are malformed */
function checkField_spec(op: string, name: string, field: Field) {
	if (field.type == 'string') {
		const { source, flags } = field.pattern
		// an unanchored pattern would accept any string that contains a match; a g or y flag makes test() stateful
		if (source[0] != '^' || !source.endsWith('$')) throw `tool spec ${op}: pattern of ${name} must be anchored`
		if (/[gy]/.test(flags)) throw `tool spec ${op}: pattern of ${name} must not have the g or y flag`
		if (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > maxArgLength)
			throw `tool spec ${op}: maxLength of ${name} must be from 1 to ${maxArgLength}`
	} else if (field.type == 'int' || field.type == 'number') {
		// a negative value would start with "-", which every value slot rejects
		const isNum = field.type == 'int' ? Number.isSafeInteger : Number.isFinite
		if (!isNum(field.min) || !isNum(field.max) || field.min < 0 || field.min > field.max)
			throw `tool spec ${op}: min and max of ${name} must be ${
				field.type == 'int' ? 'integers' : 'numbers'
			}, with 0 <= min <= max`
	} else if (field.type == 'enum') {
		if (!field.values.length || !field.values.every(isSafeValueArg))
			throw `tool spec ${op}: values of ${name} must be safe arguments`
	} else if (field.type == 'file' || field.type == 'fileOrUrl') {
		const roots = field.type == 'file' ? field.roots : field.roots || ['tp']
		if (!roots.length || !roots.every(r => Object.hasOwn(fileRoots, r)))
			throw `tool spec ${op}: roots of ${name} must be one or more of ${Object.keys(fileRoots)}`
	} else throw `tool spec ${op}: unknown type of ${name}`
}

/** throws if an op is in more than one spec file, which a plain object spread would silently overwrite */
export function mergeSpecs(lst: Record<string, ToolSpec>[]): Record<string, ToolSpec> {
	const all: Record<string, ToolSpec> = {}
	for (const s of lst) {
		for (const [op, spec] of Object.entries(s)) {
			if (Object.hasOwn(all, op)) throw `tool spec ${op} is defined more than once`
			all[op] = spec
		}
	}
	return all
}

function deepFreeze<T>(o: T): T {
	// a RegExp is frozen too, so that RegExp.prototype.compile() cannot change its pattern
	if (o && typeof o == 'object' && !Object.isFrozen(o)) {
		Object.freeze(o)
		for (const v of Object.values(o)) deepFreeze(v)
	}
	return o
}
