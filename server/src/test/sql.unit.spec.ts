import tape from 'tape'
import Database from 'better-sqlite3'
import { sql, guardDb } from '../sql.ts'

/*
Tests:
	sql`` tag binds interpolated values as parameters
	sql.id(), sql.list(), sql.join() and nested fragments
	guardDb() in 'throw' mode
	guardDb() in 'warn' mode logs once per call site
	guardDb() passes through other connection methods and properties
*/

function getDb(mode) {
	const db = new Database(':memory:')
	db.exec('CREATE TABLE t (id INTEGER, name TEXT)')
	const ins = db.prepare('INSERT INTO t VALUES (?, ?)')
	for (const [id, name] of [
		[1, 'a'],
		[2, "b'c"],
		[3, 'd']
	])
		ins.run(id, name)
	return guardDb(db, mode)
}

tape('\n', t => {
	t.comment('-***- server/src/sql specs -***-')
	t.end()
})

tape('sql`` tag binds interpolated values as parameters', t => {
	const f = sql`SELECT * FROM t WHERE id = ${2} AND name = ${"b'c"}`
	t.equal(f.text, 'SELECT * FROM t WHERE id = ? AND name = ?', 'should replace ${} with ? placeholders')
	t.deepEqual(f.values, [2, "b'c"], 'should collect the values in order')

	const db = getDb('throw')
	t.deepEqual(db.prepare(f).all(), [{ id: 2, name: "b'c" }], 'should bind the values to the prepared statement')
	const injected = '1 OR 1=1'
	t.deepEqual(db.prepare(sql`SELECT * FROM t WHERE id = ${injected}`).all(), [], 'should not execute an injected value')
	t.end()
})

tape('sql.id(), sql.list(), sql.join() and nested fragments', t => {
	t.equal(sql.id('my"table').text, '"my""table"', 'should quote an identifier and escape its double quotes')
	t.throws(() => sql.list([]), /empty list/, 'should throw on an empty list')

	const db = getDb('throw')
	const where = sql`WHERE id IN (${sql.list([1, 3])})`
	const f = sql`SELECT name FROM ${sql.id('t')} ${where} AND name != ${'x'} ORDER BY id`
	t.deepEqual(f.values, [1, 3, 'x'], 'should merge the values of nested fragments in order')
	t.deepEqual(
		db
			.prepare(f)
			.all()
			.map(r => r.name),
		['a', 'd'],
		'should run a statement composed from fragments'
	)

	const joined = sql.join([sql`id = ${1}`, sql`id = ${3}`], ' OR ')
	t.equal(joined.text, 'id = ? OR id = ?', 'should join fragment texts with the separator')
	t.deepEqual(joined.values, [1, 3], 'should concatenate the values of joined fragments')
	t.end()
})

tape("guardDb() in 'throw' mode", t => {
	const db = getDb('throw')
	t.throws(
		() => db.prepare("SELECT * FROM t WHERE name = 'a'"),
		/quoted values/,
		'should throw on a plain sql string with a quoted value'
	)
	t.throws(() => db.exec("DELETE FROM t WHERE name = 'a'"), /quoted values/, 'should also check db.exec()')
	t.deepEqual(
		db.prepare("SELECT id FROM t WHERE name = 'a'", { allowQuotedValues: true }).all(),
		[{ id: 1 }],
		'should allow quoted values when opted in'
	)
	t.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 3, 'should allow a plain sql string without quotes')
	t.equal(
		db.prepare("SELECT count(*) AS n FROM t WHERE name != '' AND name IS NOT NULL").get().n,
		3,
		"should allow an empty '' literal"
	)
	t.throws(() => db.exec(sql`DELETE FROM t WHERE id = ${1}`), /bound values/, 'should not allow bound values in exec()')
	t.end()
})

tape("guardDb() in 'warn' mode logs once per call site", t => {
	const db = getDb('warn')
	const warn = console.warn
	const messages: string[] = []
	console.warn = (m: string) => messages.push(m)
	try {
		// eslint-disable-next-line no-restricted-syntax -- intentionally unsafe sql to trigger the warning
		for (let i = 0; i < 3; i++) db.prepare(`SELECT * FROM t WHERE name = '${'a'}'`).all()
	} finally {
		console.warn = warn
	}
	t.equal(messages.length, 1, 'should warn once for repeated calls from the same call site')
	t.match(messages[0], /sql\.unit\.spec\.ts/, 'should report the caller as the call site')
	t.end()
})

tape('guardDb() passes through other connection methods and properties', t => {
	const db = getDb('throw')
	t.equal(db.open, true, 'should read properties of the connection')
	t.ok(db instanceof Database, 'should still be an instance of Database')
	const insertMany = db.transaction(rows => {
		const s = db.prepare('INSERT INTO t VALUES (?, ?)')
		for (const r of rows) s.run(r)
	})
	insertMany([
		[4, 'e'],
		[5, 'f']
	])
	t.equal(db.prepare('SELECT count(*) AS n FROM t').get().n, 5, 'should run a transaction')
	const raw = new Database(':memory:')
	t.equal(guardDb(raw, 'off'), raw, "should return the connection as-is in 'off' mode")
	t.end()
})
