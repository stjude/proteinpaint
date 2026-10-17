import { spawn } from 'child_process'
import type { ChildProcessWithoutNullStreams } from 'child_process'
import path from 'path'
import serverconfig from '../serverconfig.js'
import { illegalUrlHost } from '../utils.js'
import { specs as hicstrawSpecs } from './hicstraw.ts'

/*
Starts an external tool from a named operation and its input fields, instead of from an argv array.

Each operation has a spec, in a file of this dir, with its input fields and an argv template. runTool():
- requires the input to be a plain object with exactly the fields of the spec
- checks each field value by the field type: an enum, an integer range, a string pattern, or a file path or url
- builds argv from the template, so that a field value can only be in the argv slot that the spec gives it
- checks every value slot again: a non-empty string of bounded length, with no control character, that does
  not start with "-"
- throws before the tool is started if any check fails

The specs are checked when this module is loaded, see checkSpec().

see test/tools.unit.spec.ts for the specs of this module
*/

export type Field =
	/** one of the listed strings */
	| { type: 'enum'; values: readonly string[] }
	/** a number that is an integer from min to max */
	| { type: 'int'; min: number; max: number }
	/** a string that matches the pattern, which must start with ^ and end with $ */
	| { type: 'string'; pattern: RegExp; maxLength: number }
	/** a path under serverconfig.tpmasterdir, or an http or https url with an allowed host */
	| { type: 'fileOrUrl' }

export type ToolSpec = {
	/** the binary, from serverconfig, which is read when the tool is started */
	bin: () => string
	fields: Readonly<Record<string, Field>>
	/** each item is a literal argument, or "$name" for the value of the field name */
	argv: readonly string[]
}

/** the upper limit of the length of an argument */
const maxArgLength = 4096

export const specs: Readonly<Record<string, ToolSpec>> = deepFreeze({ ...hicstrawSpecs })
for (const [op, spec] of Object.entries(specs)) checkSpec(op, spec)

/** op: a key of specs, such as 'hicstraw.query'; input: the field values of the op */
export function runTool(op: string, input: Record<string, unknown>): ChildProcessWithoutNullStreams {
	const spec = Object.hasOwn(specs, op) ? specs[op] : undefined
	if (!spec) throw `unknown tool operation: ${op}`
	const argv = getArgv(op, spec, input)
	const bin = spec.bin()
	if (typeof bin != 'string' || !bin) throw `${op}: tool binary is not configured`
	// no options: the default of no shell, so that each argument reaches the tool as one literal string
	return spawn(bin, argv)
}

/** returns the argv of an op from its input, or throws */
export function getArgv(op: string, spec: ToolSpec, input: Record<string, unknown>): string[] {
	if (!input || typeof input != 'object' || Object.getPrototypeOf(input) !== Object.prototype)
		throw `${op}: input must be a plain object`
	const names = Object.keys(spec.fields)
	for (const k of Object.keys(input)) {
		if (!Object.hasOwn(spec.fields, k)) throw `${op}: unexpected input field ${k}`
	}
	const values = new Map<string, string>()
	for (const name of names) {
		if (!Object.hasOwn(input, name)) throw `${op}: missing input field ${name}`
		values.set(name, checkField(spec.fields[name], input[name], `${op}: invalid ${name}`))
	}
	const argv = spec.argv.map(a => (a[0] == '$' ? values.get(a.slice(1))! : a))
	for (const [i, a] of spec.argv.entries()) {
		if (a[0] == '$' && !isSafeValueArg(argv[i])) throw `${op}: invalid ${a.slice(1)}`
	}
	return argv
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
		case 'string':
			// the whole value must match, since an anchored pattern with an alternation, such as /^a|b$/, matches part of xb
			if (typeof v != 'string' || v.length > field.maxLength || v.match(field.pattern)?.[0] !== v) throw msg
			return v
		case 'fileOrUrl':
			return checkFileOrUrl(v, msg)
		default:
			throw msg
	}
}

function checkFileOrUrl(v: unknown, msg: string): string {
	if (typeof v != 'string' || !v) throw msg
	if (v.includes('://')) {
		if (!serverconfig.features?.ALLOW_remotefilefromurl) throw msg
		let protocol
		try {
			protocol = new URL(v).protocol
		} catch (_) {
			throw msg
		}
		if (protocol != 'http:' && protocol != 'https:') throw msg
		if (illegalUrlHost(v)) throw msg
		return v
	}
	// a ".." segment could leave the root, and a segment that starts with "-" is not an expected file name
	if (v.split(/[/\\]/).some(s => s == '..' || s[0] == '-')) throw msg
	const root = path.resolve(serverconfig.tpmasterdir)
	const file = path.resolve(root, v)
	if (!file.startsWith(root + path.sep)) throw msg
	return file
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
	for (const a of spec.argv) {
		if (typeof a != 'string' || !a) throw `tool spec ${op}: argv item must be a non-empty string`
		if (a[0] != '$') continue
		const name = a.slice(1)
		if (!Object.hasOwn(spec.fields, name)) throw `tool spec ${op}: argv ${a} is not a field`
		if (used.has(name)) throw `tool spec ${op}: field ${name} is used more than once in argv`
		used.add(name)
	}
	for (const [name, field] of Object.entries(spec.fields)) {
		if (!used.has(name)) throw `tool spec ${op}: field ${name} is not used in argv`
		if (field.type == 'string') {
			const { source, flags } = field.pattern
			// an unanchored pattern would accept any string that contains a match; a g or y flag makes test() stateful
			if (source[0] != '^' || !source.endsWith('$')) throw `tool spec ${op}: pattern of ${name} must be anchored`
			if (/[gy]/.test(flags)) throw `tool spec ${op}: pattern of ${name} must not have the g or y flag`
			if (!Number.isInteger(field.maxLength) || field.maxLength < 1 || field.maxLength > maxArgLength)
				throw `tool spec ${op}: maxLength of ${name} must be from 1 to ${maxArgLength}`
		} else if (field.type == 'int') {
			if (!Number.isSafeInteger(field.min) || !Number.isSafeInteger(field.max) || field.min > field.max)
				throw `tool spec ${op}: min and max of ${name} must be integers, with min <= max`
		} else if (field.type == 'enum') {
			if (!field.values.length || !field.values.every(isSafeValueArg))
				throw `tool spec ${op}: values of ${name} must be safe arguments`
		} else if (field.type != 'fileOrUrl') throw `tool spec ${op}: unknown type of ${name}`
	}
}

function deepFreeze<T>(o: T): T {
	// a RegExp is frozen too, so that RegExp.prototype.compile() cannot change its pattern
	if (o && typeof o == 'object' && !Object.isFrozen(o)) {
		Object.freeze(o)
		for (const v of Object.values(o)) deepFreeze(v)
	}
	return o
}
