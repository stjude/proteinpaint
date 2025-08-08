import type { Mds3, RouteApi, SampleWSImagesRequest } from '#types'
import { saveWSIAnnotationPayload } from '#types/checkers'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.js'
import Database from 'better-sqlite3'
import path from 'path'
import serverconfig from '#src/serverconfig.js'

const routePath = 'saveWSIAnnotation'
export const api: RouteApi = {
	endpoint: `${routePath}`,
	methods: {
		get: {
			...saveWSIAnnotationPayload,
			init
		},
		post: {
			...saveWSIAnnotationPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const annotation: SampleWSImagesRequest = req.query
			const g = genomes['hg38']
			if (!g) throw 'invalid genome name'
			const ds = g.datasets['AIAHistoLabeler']
			if (!ds) throw 'invalid dataset name'
			if (ds.queries.WSImages.saveWSIAnnotation) {
				await ds.queries.WSImages.saveWSIAnnotation(annotation)
			}
			res.status(200).send({ testKey: 'completed' })
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e.message || e
			})
		}
	}
}

export async function validate_query_saveWSIAnnotation(ds: Mds3) {
	const q = ds.queries?.WSImages?.db
	if (!q) return
	validateQuery(ds)
}

function validateQuery(ds: any) {
	ds.queries.WSImages.saveWSIAnnotation = async (annotation: SaveWSIAnnotationRequest) => {
		try {
			const timestamp = new Date().toISOString() // current UTC time

			// Get SQLite DB file path
			const dbRelativePath = ds.queries?.WSImages?.db?.file

			if (!dbRelativePath) {
				throw new Error('SQLite database path not found in ds.queries.WSImages.db')
			}

			const dbPath = path.join(serverconfig.tpmasterdir, dbRelativePath)

			// Open connection
			const connection = new Database(dbPath)

			const stmt = connection.prepare(`
				INSERT INTO project_annotations (
					project_id, user_id, coordinates, timestamp, status
				) VALUES (?, ?, ?, ?, ?)
			`)

			stmt.run(1, 1, `[${annotation.coordinates[0]},${annotation.coordinates[1]}]`, timestamp, 1)

			return { status: 'ok' }
		} catch (error: any) {
			console.error('Error saving annotation:', error)
			return {
				status: 'error',
				error: error.message || 'Failed to save annotation'
			}
		}
	}
}
