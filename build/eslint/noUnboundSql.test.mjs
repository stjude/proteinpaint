// run from the proteinpaint dir: npm run test:eslint-rules
import { describe, it } from 'node:test'
import { RuleTester } from 'eslint'
import rule from './noUnboundSql.mjs'

RuleTester.describe = describe
RuleTester.it = it
RuleTester.itOnly = it.only

const ruleTester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } })
const template = [{ messageId: 'template' }]
const concat = [{ messageId: 'concat' }]

ruleTester.run('no-unbound-sql', rule, {
	valid: [
		// values bound with the sql`` tag
		'const q = sql`update t set a = 1 where id = ${id}`',
		'const q = sql`select ${sql.id(column)} from users`',
		// static sql with ? placeholders
		'db.prepare("SELECT * FROM t WHERE id = ?").all(id)',
		// concatenation of only static strings, including resolved local variables
		'const q = "SELECT a " + "FROM t WHERE id = ?"',
		'const base = "select * from t"; const q = base + " where id = ?"',
		'let q = "select * from t"; q += " where id = ?"',
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
		{ code: 'const base = "select * from t where id="; const q = base + id', errors: concat }
	]
})
