import type Database from 'better-sqlite3'

/** Run multiple SQL statements in a transaction
 * More performant than running .prepare().run() each time */
export function runMultiStmtSQL(
	connection: Database.Database,
	stmts: { sql: string; params: any[] }[],
	errorText = 'fetch'
) {
	const transaction = connection.transaction((batch: typeof stmts) => {
		for (const { sql, params = [] } of batch) {
			//Reuse the same prepared statement for memory efficiency
			const sqlStmt = connection.prepare(sql)
			for (const item of params) {
				sqlStmt.run(item)
			}
		}
	})

	try {
		transaction(stmts)
	} catch (e: any) {
		console.error(`Error executing SQL transaction for ${errorText}: ${e.message || e}`)
		throw new Error(`Failed to ${errorText}`)
	}
}

/** Run only one SQL statement at a time */
export function runSQL(
	connection: Database.Database,
	sql: string,
	params: string[] = [],
	errorText = 'fetch'
): Database.RunResult | any[] {
	try {
		if (!params.length) {
			return connection.prepare(sql).all() satisfies any[]
		}
		return connection.prepare(sql).run(params) satisfies Database.RunResult
	} catch (e: any) {
		console.error(`Error executing SQL for ${errorText}: ${e.message || e}`)
		throw new Error(`Failed to ${errorText}`)
	}
}
