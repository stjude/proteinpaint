/*
Safer construction of sql statements for better-sqlite3.

sql`...` is a tagged template that turns every ${} expression into a ? placeholder
and collects the expression values in order, so that values are always bound by
better-sqlite3 instead of being written into the sql text:

	db.prepare(sql`SELECT * FROM images WHERE sample = ${sampleId}`).all()

Nested fragments are merged, so statements can be composed from parts:

	const where = sql`WHERE term_id = ${termId}`
	db.prepare(sql`SELECT sample FROM anno_float ${where} AND value IN (${sql.list(keys)})`).all()

Identifiers such as table names cannot be bound as parameters, use sql.id() for those.

guardDb() wraps a better-sqlite3 connection so that its prepare() and exec() accept a
sql fragment, and check plain sql strings for manually quoted values, which are a sign
of values being interpolated into the sql text.

connect_db() opens a better-sqlite3 connection that is wrapped by guardDb(),
it is also exported by utils.js.
*/

import path from 'path'
import bettersqlite from 'better-sqlite3'
import serverconfig from './serverconfig.js'

export class SqlFragment {
	readonly text: string
	readonly values: unknown[]
	constructor(text: string, values: unknown[]) {
		this.text = text
		this.values = values
	}
}

export function sql(strings: TemplateStringsArray, ...exprs: unknown[]): SqlFragment {
	let text = strings[0]
	const values: unknown[] = []
	for (const [i, e] of exprs.entries()) {
		if (e instanceof SqlFragment) {
			text += e.text
			values.push(...e.values)
		} else {
			text += '?'
			values.push(e)
		}
		text += strings[i + 1]
	}
	return new SqlFragment(text, values)
}

/* a quoted identifier, such as a table or column name */
sql.id = (name: string) => new SqlFragment(`"${String(name).replaceAll('"', '""')}"`, [])

/* comma-separated placeholders for a list of values, for use in an IN (...) clause */
sql.list = (values: unknown[]) => {
	if (!values.length) throw 'sql.list(): empty list'
	return new SqlFragment(values.map(() => '?').join(','), [...values])
}

/* joins fragments with a separator that is written as-is into the sql text, so it must be static */
sql.join = (fragments: SqlFragment[], separator = ', ') =>
	new SqlFragment(
		fragments.map(f => f.text).join(separator),
		fragments.flatMap(f => f.values)
	)

export type SqlCheckMode = 'off' | 'warn' | 'throw'

export type PrepareOpts = {
	/** the plain sql string intentionally has quoted literals, such as type='table' */
	allowQuotedValues?: boolean
}

// matches non-empty '...' or "..." in the sql text; an empty '' is allowed since
// it is a static literal, such as in `type != ''`, and not an interpolated value
const quotedValue = /'[^']+'|"[^"]+"/

// call sites that were already warned about, to log each only once
const warnedSites = new Set<string>()

const tpdir = serverconfig.features?.tp_native_dir || serverconfig.tpmasterdir

/*
inputs:
file=str
	half or full path; if not starting with '/', join with tp dir
override={}
	better-sqlite3 options that override the defaults, plus
	.sqlCheck: 'off' | 'warn' | 'throw', see guardDb(); defaults to serverconfig.sqlCheck or 'warn'
returns:
	db connector
*/
export function connect_db(file: string, override: bettersqlite.Options & { sqlCheck?: SqlCheckMode } = {}) {
	const dbfile = file[0] == '/' ? file : path.join(tpdir, file)
	const { sqlCheck, ...opts } = override
	let db
	try {
		db = new bettersqlite(dbfile, Object.assign({ readonly: true, fileMustExist: true }, opts))
	} catch (e) {
		throw `error connecting to ${dbfile}: ${e}`
	}
	return guardDb(db, sqlCheck || serverconfig.sqlCheck || 'warn')
}

/* mode='off' only skips the check of plain sql strings, the proxy is still needed to support sql fragments */
export function guardDb(db: any, mode: SqlCheckMode = 'warn') {
	return new Proxy(db, {
		get(target, prop) {
			if (prop == 'prepare') {
				return (source: string | SqlFragment, opts?: PrepareOpts) => {
					if (source instanceof SqlFragment) {
						const stmt = target.prepare(source.text)
						// bound values persist on the statement, so .all()/.get()/.run() are called without arguments
						if (source.values.length) stmt.bind(...source.values)
						return stmt
					}
					checkSqlString(source, opts, mode, 'prepare')
					return target.prepare(source)
				}
			}
			if (prop == 'exec') {
				return (source: string | SqlFragment, opts?: PrepareOpts) => {
					if (source instanceof SqlFragment) {
						// exec() cannot bind values
						if (source.values.length) throw 'db.exec() does not support bound values, use db.prepare()'
						return target.exec(source.text)
					}
					checkSqlString(source, opts, mode, 'exec')
					return target.exec(source)
				}
			}
			const value = Reflect.get(target, prop, target)
			// native methods must be called on the actual connection, not the proxy
			return typeof value == 'function' ? value.bind(target) : value
		}
	})
}

function checkSqlString(source: string, opts: PrepareOpts | undefined, mode: SqlCheckMode, method: string) {
	if (mode == 'off') return
	if (typeof source != 'string') return // let better-sqlite3 report invalid arguments
	if (opts?.allowQuotedValues || !quotedValue.test(source)) return
	const site = getCallSite()
	const message = `db.${method}(): sql string has quoted values, use the sql\`\` tag to bind values as parameters, or pass { allowQuotedValues: true } if the quoted literals are intended. Call site: ${site}\nsql: ${source
		.trim()
		.slice(0, 300)}`
	if (mode == 'throw') throw new Error(message)
	if (warnedSites.has(site)) return
	warnedSites.add(site)
	console.warn(message)
}

function getCallSite() {
	// frames: getCallSite, checkSqlString, the proxied prepare/exec, then the caller;
	// a fixed depth also works when this module is bundled into another file
	const lines = new Error().stack?.split('\n').slice(1) || []
	return (lines[3] || '').trim().replace(/^at /, '')
}
