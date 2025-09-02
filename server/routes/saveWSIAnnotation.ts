import type { Mds3, RouteApi } from '#types'
import { saveWSIAnnotationPayload } from '#types/checkers'
import type { SaveWSIAnnotationRequest } from '@sjcrh/proteinpaint-types/routes/saveWSIAnnotation.js'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import type Database from 'better-sqlite3'

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
			// Accept from query (GET) or body (POST); prefer body if present
			const annotation: SaveWSIAnnotationRequest = (
				req.body && Object.keys(req.body).length ? req.body : req.query
			) as SaveWSIAnnotationRequest

			// these are fixed in your app; adjust if they come from request
			const g = genomes['hg38']
			if (!g) throw new Error('invalid genome name')
			const ds = g.datasets['AIAHistoLabeler']
			if (!ds) throw new Error('invalid dataset name')

			if (typeof ds.queries?.WSImages?.saveWSIAnnotation === 'function') {
				const result = await ds.queries.WSImages.saveWSIAnnotation(annotation)
				if (result?.status === 'error') {
					return res.status(500).send(result)
				}
			}

			res.status(200).send({ status: 'ok' })
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e?.message || String(e)
			})
		}
	}
}

export async function validate_query_saveWSIAnnotation(ds: Mds3) {
	// Only attach if not already provided
	if (typeof ds?.queries?.WSImages?.saveWSIAnnotation === 'function') return
	const connection = getDbConnection(ds)
	if (!connection) {
		// DB file missing
		return
	}
	validateQuery(ds, connection)
}

function validateQuery(ds: any, connection: Database.Database) {
	if (!ds.queries) ds.queries = {}
	if (!ds.queries.WSImages) ds.queries.WSImages = {}

	ds.queries.WSImages.saveWSIAnnotation = async (annotation: SaveWSIAnnotationRequest) => {
		try {
			const timestamp = new Date().toISOString()
			const projectId = annotation.projectId
			const wsimageFilename = annotation.wsimage // expected to exactly match project_images.image_path
			const coords = JSON.stringify(annotation.coordinates ?? [])
			const userId = annotation.userId
			const status = 1
			const classId = annotation.classId

			if (projectId == null || wsimageFilename == null) {
				return {
					status: 'error',
					error: 'Missing required fields: projectId and wsimage.'
				}
			}

			const getImageIdSql = `
				SELECT id
				FROM project_images
				WHERE project_id = ?
				  AND image_path = ?
				LIMIT 1
			`
			const getImageStmt = connection.prepare(getImageIdSql)
			const imageRow = getImageStmt.get(projectId, wsimageFilename) as { id: number } | undefined

			if (!imageRow?.id) {
				return {
					status: 'error',
					error: `Image not found for project_id=${projectId} and image_path="${wsimageFilename}".`
				}
			}

			const imageId = imageRow.id

			const insertSql = `
				INSERT INTO project_annotations (
					project_id, user_id, coordinates, timestamp, status, class_id, image_id
				) VALUES (?, ?, ?, ?, ?, ?, ?)
			`
			const insertStmt = connection.prepare(insertSql)
			insertStmt.run(projectId, userId, coords, timestamp, status, classId, imageId)

			return { status: 'ok' }
		} catch (error: any) {
			console.error('Error saving annotation:', error)
			return {
				status: 'error',
				error: error?.message || 'Failed to save annotation'
			}
		}
	}
}
