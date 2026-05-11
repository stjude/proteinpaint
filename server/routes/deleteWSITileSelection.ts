import { deleteWSITileSelectionPayload } from '#types/checkers'
import { checkSelectionType, SelectionPrefixes, FlagStatus } from '#shared'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import type { Mds3, RouteApi, DeleteWSITileSelectionRequest, DeleteWSITileSelectionResponse } from '#types'
import type Database from 'better-sqlite3'

export const api: RouteApi = {
	endpoint: `deleteWSITileSelection`,
	methods: {
		delete: {
			...deleteWSITileSelectionPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query = req.query satisfies DeleteWSITileSelectionRequest

			if (!query.genome) throw new Error('.genome is required for deleteWSITileSelection request.')
			if (!query.dslabel) throw new Error('.dslabel is required for deleteWSITileSelection request.')
			if (!query.tileSelection) throw new Error('.annotation:{} is required for deleteWSITileSelection request.')
			if (!query.projectId) throw new Error('.projectId is required for deleteWSITileSelection request.')
			if (!query.wsimage) throw new Error('.wsimage is required for deleteWSITileSelection request.')

			const g = genomes[query.genome]
			if (!g) throw new Error('invalid genome name')

			const ds = g.datasets[query.dslabel]
			if (!ds) throw new Error('invalid dataset name')

			if (typeof ds.queries?.WSImages?.deleteAnnotation === 'function') {
				const result = await ds.queries.WSImages.deleteAnnotation(query)
				if (result?.status === 'error') {
					return res.status(500).send(result)
				}
			}

			res.status(200).send({ status: `Annotation = ${query.tileSelection.zoomCoordinates} deleted.` })
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e?.message || String(e)
			} satisfies DeleteWSITileSelectionResponse)
		}
	}
}

export async function validate_query_deleteWSIAnnotation(ds: Mds3) {
	if (!ds.queries?.WSImages?.db) return
	const connection = getDbConnection(ds)
	if (!connection) {
		// DB file missing
		return
	}
	validateQuery(ds, connection)
}

function validateQuery(ds: any, connection: Database.Database) {
	ds.queries.WSImages.deleteAnnotation = async (query: DeleteWSITileSelectionRequest) => {
		const zoomCoordinates = JSON.stringify(query.tileSelection.zoomCoordinates)

		if (
			checkSelectionType(query.tileSelection, SelectionPrefixes.Prediction) &&
			query.tileSelection.flag !== FlagStatus.Normal
		) {
			try {
				const projectId = query.projectId

				if (projectId == null) {
					return {
						status: 'error',
						error: 'Missing required field: projectId'
					}
				}

				const predictionId = query.classID
				const flagType = query.tileSelection.flag

				if (predictionId == null) {
					return {
						status: 'error',
						error: 'Missing prediction id in tileSelection (expected predictionId, prediction.id, or id).'
					}
				}

				const getImageIdSql = `
				SELECT id FROM project_images 
				WHERE project_id = ? AND image_path = ? LIMIT 1
`
				const imageRow = connection.prepare(getImageIdSql).get(projectId, query.wsimage) as { id: number } | undefined
				const imageId = imageRow?.id

				if (!imageId) {
					return { status: 'error', error: 'Image not found' }
				}

				connection
					.prepare(
						`
					DELETE FROM project_flagged_predictions 
					WHERE project_id = ?  AND coordinates = ? 
					AND image_id = (
                        SELECT id FROM project_images
                        WHERE project_id = ?
                          AND image_path = ?
                      )
				`
					)
					.run(projectId, zoomCoordinates, projectId, query.wsimage)

				// Insert new flagged prediction
				connection
					.prepare(
						`
				INSERT INTO project_flagged_predictions 
				(project_id, prediction_class_id, coordinates, flag_type, timestamp, image_id)
				VALUES (?, ?, ?, ?, ?, ?)
			    `
					)
					.run(projectId, predictionId, zoomCoordinates, flagType, new Date().toISOString(), imageId)

				return { status: 'ok' }
			} catch (error: any) {
				console.error('Error inserting flagged prediction:', error)
				return {
					status: 'error',
					error: error?.message || 'Failed to insert flagged prediction'
				}
			}
		} else
			try {
				connection
					.prepare(
						`
                    DELETE FROM project_flagged_annotations
                    WHERE project_id = ?
                      AND coordinates = ?
                      AND image_id = (
                        SELECT id FROM project_images
                        WHERE project_id = ?
                          AND image_path = ?
                      )
                `
					)
					.run(query.projectId, zoomCoordinates, query.projectId, query.wsimage)

				connection
					.prepare(
						`
                    DELETE FROM project_annotations
                    WHERE project_id = ?
                      AND coordinates = ?
                      AND image_id = (
                        SELECT id FROM project_images
                        WHERE project_id = ?
                          AND image_path = ?
                      )
                `
					)
					.run(query.projectId, zoomCoordinates, query.projectId, query.wsimage)

				return { status: 'ok' }
			} catch (error: any) {
				console.error('Error deleting annotation:', error)
				return {
					status: 'error',
					error: error?.message || 'Failed to delete annotation'
				}
			}
	}
}
