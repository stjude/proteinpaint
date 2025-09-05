import Database from 'better-sqlite3'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
import path from 'path'

let connection: Database.Database | null = null

export function getDbConnection(ds: any): Database.Database | null {
	// TODO introduce new mount property
	const mount = serverconfig.features?.tileserver?.mount
	if (!mount) throw new Error('No mount available for TileServer')

	const dbFile = ds.queries.WSImages?.db?.file
	if (!dbFile) return null

	const dbPath = path.join(mount, dbFile)

	if (connection) return connection

	// Verify the file exists
	if (!fs.existsSync(dbPath)) {
		throw new Error(`SQLite database file not found at: ${dbPath}`)
	}

	// TODO use connect_db?
	// Open connection once and cache it
	connection = new Database(dbPath, { fileMustExist: true })
	connection.pragma('journal_mode = DELETE')
	connection.pragma('foreign_keys = ON')

	return connection
}

export function closeDbConnection(): void {
	if (connection) {
		try {
			connection.close()
		} catch {
			/* ignore */
		} finally {
			connection = null
		}
	}
}

// optional graceful cleanup
process.on('exit', () => closeDbConnection())
