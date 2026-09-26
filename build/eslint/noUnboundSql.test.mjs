// run from the proteinpaint dir: npm run test:eslint-rules
import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import path from 'path'
import rule from './noUnboundSql.mjs'

// linted file names, to resolve a relative or #src/ import of server/src/sql.ts
const srcFile = path.resolve(import.meta.dirname, '../../server/src/x.ts')
const routeFile = path.resolve(import.meta.dirname, '../../server/src/routes/x.ts')

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
const template = [{ messageId: 'template' }]
const concat = [{ messageId: 'concat' }]

ruleTester.run('no-unbound-sql', rule, {
	valid: [
		// values bound with the sql`` tag that is imported from server/src/sql.ts
		{ code: 'import { sql } from "./sql.ts"; const q = sql`update t set a = 1 where id = ${id}`', filename: srcFile },
		{
			code: 'import { sql } from "../sql.ts"; const q = sql`update t set a = 1 where id = ${id}`',
			filename: routeFile
		},
		{
			code: 'import { sql } from "#src/sql.ts"; const q = sql`select ${sql.id(column)} from users`',
			filename: routeFile
		},
		// static sql with ? placeholders
		'db.prepare("SELECT * FROM t WHERE id = ?").all(id)',
		// concatenation of only static strings, including resolved local variables
		'const q = "SELECT a " + "FROM t WHERE id = ?"',
		'const base = "select * from t"; const q = base + " where id = ?"',
		'let q = "select * from t"; q += " where id = ?"',
		// a static value that is reassigned
		"let q = 'select * from t'; q = 'update t set a = 1'",
		// a static variable that is used more than once in the same concatenation
		"const part = 'SELECT * FROM t'; const q = part + part",
		"const part = 'select * from t'; let q = part; q += part",
		// another tag without interpolation
		'const q = String.raw`SELECT * FROM t WHERE name = ?`',
		// ordinary messages that are not sql
		'console.log(`error from server: ${e}`)',
		'const m = `no term found where the id is missing: ${id}` + " (order of terms)"',
		'const m = "please select a file: " + name',
		// note: an ordinary message with 'select ... from' is detected as sql, such as "select a file from the list: " + name
		// no interpolation or concatenation
		'const q = `SELECT * FROM t`'
	],
	invalid: [
		// interpolation
		{ code: 'db.prepare(`SELECT * FROM t WHERE id = ${n}`)', errors: template },
		{ code: 'const q = `update t set a = 1 where id = ${n}`', errors: template },
		// a sql phrase that is split by an interpolation
		{ code: 'const q = `select ${column} from users`', errors: template },
		{ code: 'const q = `update ${table} set value = 1`', errors: template },
		{ code: 'const q = `delete from t where ${col} = 1`', errors: template },
		// concatenation, also outside of prepare()
		{ code: 'const q = "SELECT * FROM t WHERE id = " + n', errors: concat },
		{ code: 'const q = "delete from t where id=" + n', errors: concat },
		// nested concatenation with a sql phrase that is split across static strings
		{ code: "const q = 'select ' + '* from t where id=' + userId", errors: concat },
		// a static template operand
		{ code: 'const q = `select * from t where id=` + userId', errors: concat },
		// a template and concatenation mix is reported once, as a concatenation
		{ code: 'const q = `select * from t` + ` where id = ${n}`', errors: concat },
		// += onto a variable with static sql text
		{ code: "let q = 'select * from t where id='; q += userId", errors: concat },
		{ code: "let q = ''; q += 'select * from t where id='; q += userId", errors: concat },
		// += of a sql-like concatenation is reported once
		{ code: 'let q = "SELECT a FROM t"; q += " WHERE id = " + n', errors: concat },
		// a local variable with static sql text
		{ code: 'const base = "select * from t where id="; const q = base + id', errors: concat },
		// only the sql`` tag is exempt, another tag does not bind the values
		{ code: 'db.prepare(String.raw`select * from t where id = ${id}`)', errors: template },
		{ code: 'const q = html`update ${table} set a = 1`', errors: template },
		// a tagged template in a concatenation is reported once, as a concatenation
		{ code: 'const q = String.raw`select * from t where id = ${id}` + " limit 1"', errors: concat },
		{ code: "let q = 'select * from t'; q += String.raw` where id = ${id}`", errors: template },
		// a sql tag that is not imported from server/src/sql.ts
		{ code: 'const sql = String.raw; const q = sql`update t set a = 1 where id = ${id}`', errors: template },
		{ code: 'const q = sql`update t set a = 1 where id = ${id}`', errors: template },
		{ code: 'import { sql } from "./other.ts"; const q = sql`update t set a = 1 where id = ${id}`', errors: template },
		// another module named sql.ts, not server/src/sql.ts
		{
			code: 'import { sql } from "./helpers/sql.ts"; const q = sql`update t set a = 1 where id = ${id}`',
			filename: srcFile,
			errors: template
		},
		{
			code: 'import { sql } from "./sql.ts"; const q = sql`update t set a = 1 where id = ${id}`',
			filename: routeFile, // resolves to server/src/routes/sql.ts
			errors: template
		},
		// a partially dynamic initializer keeps its text for a later concatenation
		{ code: "const head = 'update ' + table; const q = head + ' set value=' + value", errors: concat },
		// a later reassignment does not hide the earlier construction
		{ code: "let q = 'update users set role='; q += role; db.prepare(q); q = ''", errors: concat },
		// the latest = assignment before an append is its base
		{ code: "let q = ''; q = 'select * from t where id='; q += id", errors: concat },
		// sql that is split across several += appends, reported at each dynamic append
		{
			code: "let q = 'update '; q += table; q += ' set value = '; q += value",
			errors: [...concat, ...concat]
		},
		// a phrase that is completed by a later static append
		{ code: "let q = 'update '; q += table; q += ' set a = 1'", errors: concat }
	]
})
