import type { Mds3, TileSelection, SaveWSIAnnotationRequest, AIProjectAuthInfo } from '#types'
import { FlagStatus, SelectionPrefixes, checkSelectionType } from '#types'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import type Database from 'better-sqlite3'
export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: SaveWSIAnnotationRequest = req.query
			if (!query.genome) throw new Error('.genome is required for deleteWSIAnnotation request.')
			if (!query.dslabel) throw new Error('.dslabel is required for deleteWSIAnnotation request.')

			const g = genomes[query.genome]
			if (!g) throw new Error('invalid genome name')

			const ds = g.datasets[query.dslabel]
			if (!ds) throw new Error('invalid dataset name')

			if (typeof ds.queries?.WSImages?.saveWSIAnnotation === 'function') {
				const result = await ds.queries.WSImages.saveWSIAnnotation(query, req)
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
	if (!ds.queries?.WSImages?.db) return
	const connection = getDbConnection(ds)
	if (!connection) {
		// DB file missing
		return
	}
	validateQuery(ds, connection)
}

function validateQuery(ds: any, connection: Database.Database) {
	ds.queries.WSImages.saveWSIAnnotation = async (annotation: SaveWSIAnnotationRequest, req: any) => {
		try {
			const { email = '' } = req.query.__protected__.clientAuthResult ?? ({} as AIProjectAuthInfo)
			const tileSelection: TileSelection = annotation.tileSelection
			const timestamp = new Date().toISOString()
			const projectId = annotation.projectId
			const wsimageFilename = annotation.wsimage // expected to exactly match project_images.image_path
			const coords = JSON.stringify(tileSelection.zoomCoordinates ?? [])
			const flag = tileSelection.flag
			const classId = annotation.classId
			const isAnnotation = checkSelectionType(tileSelection, SelectionPrefixes.Annotation)
			const isPrediction = checkSelectionType(tileSelection, SelectionPrefixes.Prediction)
			const currentUser = connection.prepare('SELECT current_user FROM project WHERE id = ?').get(projectId) as {
				current_user: string | null
			}
			if (!(await ds.queries?.AIHalAuth?.checkAuthorization(req, 'annotate', currentUser?.current_user ?? null))) {
				return {
					status: 'error',
					error: 'logout'
				}
			}
			if (!isAnnotation && !isPrediction) {
				return {
					status: 'error',
					error: `Invalid tileSelection id "${tileSelection.id}". Must start with "${SelectionPrefixes.Annotation}" or "${SelectionPrefixes.Prediction}".`
				}
			}
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
			const imageRow = connection.prepare(getImageIdSql).get(projectId, wsimageFilename) as { id: number } | undefined

			if (!imageRow?.id) {
				return {
					status: 'error',
					error: `Image not found for project_id=${projectId} and image_path="${wsimageFilename}".`
				}
			}

			const imageId = imageRow.id
			// Predictions and Annotations are housed in three databases, project_flagged_annotations, project_flagged_predictions, and project_annotations
			// project_flagged_annotations and project_flagged_predictions are for both annotations and predictions that are flagged
			// Non-flagged predictions are saved as csvs elsewhere, all three should be scrubbed for duplicates when saving
			connection
				.prepare(
					`DELETE FROM project_flagged_annotations
					 WHERE project_id = ?
					   AND image_id = ?
					   AND coordinates = ?`
				)
				.run(projectId, imageId, coords)

			connection
				.prepare(
					`DELETE FROM project_flagged_predictions
					 WHERE project_id = ?
					   AND image_id = ?
					   AND coordinates = ?`
				)
				.run(projectId, imageId, coords)
			connection
				.prepare(
					`DELETE FROM project_annotations
					 WHERE project_id = ?
					   AND image_id = ?
					   AND coordinates = ?`
				)
				.run(projectId, imageId, coords)

			if (isAnnotation) {
				// Right now user_id can be null, do we want to be able to work on this without auth?

				if (tileSelection.flag === FlagStatus.Normal) {
					connection
						.prepare(
							`
						INSERT INTO project_annotations (
							project_id, user_id, coordinates, timestamp,class_id, image_id
						) VALUES (?, ?, ?, ?, ?, ?)
					`
						)
						.run(projectId, email, coords, timestamp, classId, imageId)
				} else {
					connection
						.prepare(
							`
				INSERT INTO project_flagged_annotations (
					project_id, user_id, coordinates, timestamp, flagged,class_id, image_id
				) VALUES (?, ?, ?, ?, ?, ?, ?)
				`
						)
						.run(projectId, email, coords, timestamp, flag, classId, imageId)
				}
			} else if (isPrediction) {
				// Not inserting if flag is normal
				// Do we want to label flagged predictions with user_id
				if (tileSelection.flag !== FlagStatus.Normal) {
					const insertSql = `
                    INSERT INTO project_flagged_predictions (project_id, user_email, prediction_class_id, coordinates, flag_type,image_id,timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `
					const insertStmt = connection.prepare(insertSql)
					insertStmt.run(
						annotation.projectId,
						email,
						annotation.classId,
						JSON.stringify(tileSelection.zoomCoordinates),
						tileSelection.flag,
						imageId,
						timestamp
					)
				}
			}
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
