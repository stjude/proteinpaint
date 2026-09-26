/*
Tests the combined server sql lint rules of eslint.config.js: the no-restricted-syntax selector (sqlRule)
that prohibits a direct sql() call, and the sql/no-unbound-sql rule, see build/eslint/noUnboundSql.mjs

run from the proteinpaint dir: npm run test:eslint-rules
*/
import { describe, it } from 'node:test'
import assert from 'node:assert'
import path from 'path'
import { ESLint } from 'eslint'

const root = path.resolve(import.meta.dirname, '../..')
const eslint = new ESLint({ cwd: root })
const sqlRules = new Set(['no-restricted-syntax', 'sql/no-unbound-sql'])

/* the sql rule ids that are reported for code in a server source file, one entry per message */
async function lint(code, file = 'server/src/probe.ts') {
	const [result] = await eslint.lintText(code, { filePath: path.join(root, file) })
	return result.messages.filter(m => sqlRules.has(m.ruleId)).map(m => m.ruleId)
}

describe('eslint.config.js server sql rules', () => {
	it('allows a static concatenation passed to prepare()', async () => {
		assert.deepEqual(
			await lint('export const f = db => db.prepare("SELECT a " + "FROM t " + "WHERE id = ?").all()'),
			[]
		)
		// a template without interpolation and a typescript assertion are static too
		assert.deepEqual(await lint('export const f = db => db.prepare(("SELECT a " as string) + `FROM t`).all()'), [])
	})
	it('allows the sql`` tag imported from server/src/sql.ts', async () => {
		const code =
			'import { sql } from "./sql.ts"\nexport const f = (db, id) => db.prepare(sql`SELECT * FROM t WHERE id = ${id}`).all()'
		assert.deepEqual(await lint(code), [])
	})
	it('rejects a dynamic concatenation passed to prepare(), even if it does not look like sql', async () => {
		assert.deepEqual(await lint('export const f = (db, base, id) => db.prepare(base + id).all()'), [
			'sql/no-unbound-sql'
		])
	})
	it('rejects an interpolated template passed to prepare()', async () => {
		const ids = await lint('export const f = (db, id) => db.prepare(`SELECT * FROM t WHERE id = ${id}`).all()')
		// reported once
		assert.deepEqual(ids, ['sql/no-unbound-sql'])
	})
	it('rejects sql built in a variable before prepare()', async () => {
		const code =
			"export const f = (db, table, v) => { let q = 'update '; q += table; q += ' set a = ' + v; return db.prepare(q).run() }"
		assert.ok((await lint(code)).includes('sql/no-unbound-sql'))
	})
	it('rejects sql text wrapped in a typescript assertion', async () => {
		const code = "export const f = (db, id) => db.prepare(('SELECT * FROM t WHERE id = ' as string) + id).all()"
		assert.deepEqual(await lint(code), ['sql/no-unbound-sql'])
	})
	it('rejects a direct call of sql()', async () => {
		const code = 'import { sql } from "./sql.ts"\nexport const f = s => sql([s])'
		assert.deepEqual(await lint(code), ['no-restricted-syntax'])
	})
	it('does not apply the sql rules outside of server/', async () => {
		assert.deepEqual(
			await lint(
				'export const f = (db, id) => db.prepare(`SELECT * FROM t WHERE id = ${id}`).all()',
				'shared/utils/src/probe.ts'
			),
			[]
		)
	})
})
