import type { Mds3, RouteApi } from '#types'
import { deleteWSIAnnotationPayload } from '#types/checkers'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import { runSQL } from '#src/runSQLHelpers.ts'
import type { DeleteWSIAnnotationRequest, DeleteWSIAnnotationResponse } from '#types'
import type Database from 'better-sqlite3'

export const api: RouteApi = {
	endpoint: `deleteWSIAnnotation`,
	methods: {
		delete: {
			...deleteWSIAnnotationPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query = req.query satisfies DeleteWSIAnnotationRequest

			if (!query.genome) throw new Error('.genome is required for deleteWSIAnnotation request.')
			if (!query.dslabel) throw new Error('.dslabel is required for deleteWSIAnnotation request.')
			if (!query.annotation) throw new Error('.annotation:{} is required for deleteWSIAnnotation request.')
			if (!query.projectId) throw new Error('.projectId is required for deleteWSIAnnotation request.')
			if (!query.wsimage) throw new Error('.wsimage is required for deleteWSIAnnotation request.')

			const ds = genomes.datasets[query.dslabel]

			if (typeof ds.queries?.WSImages?.deleteAnnotation === 'function') {
				const result = await ds.queries.WSImages.deleteAnnotation(query)
				if (result?.status === 'error') {
					return res.status(500).send(result)
				}
			}

			res.status(200).send({ status: `Annotation = ${query.annotation.zoomCoordinates} deleted.` })
		} catch (e: any) {
			console.warn(e)
			res.status(500).send({
				status: 'error',
				error: e?.message || String(e)
			} satisfies DeleteWSIAnnotationResponse)
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
	ds.queries.WSImages.deleteAnnotation = async (query: DeleteWSIAnnotationRequest) => {
		const sql = `
        DELETE FROM project_annotations
        WHERE project_id = ?
          AND coordinates = ?
          AND image_id = (
            SELECT id FROM project_images
            WHERE project_id = ?
              AND image_path = ?
        )
    `
		const params = [
			query.projectId,
			JSON.stringify(query.annotation.zoomCoordinates),
			query.projectId,
			query.wsimage // this is the image_path
		] as string[]

		return runSQL(connection, sql, params, 'delete annotation')
	}
}
