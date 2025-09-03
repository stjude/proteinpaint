import type { Genome, RouteApi } from '#types'
import { deleteWSIAnnotationPayload } from '#types/checkers'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import { runSQL } from '#src/runSQLHelpers.ts'
import type {
	DeleteWSIAnnotationRequest,
	DeleteWSIAnnotationResponse
} from '@sjcrh/proteinpaint-types/routes/deleteWSIAnnotation.js'
import type Database from 'better-sqlite3'

export const api: RouteApi = {
	endpoint: `deleteWSIAnnotation`,
	methods: {
		post: {
			...deleteWSIAnnotationPayload,
			init
		},
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
			const ds = validate_query(genomes, query)

			const connection = getDbConnection(ds) as Database.Database
			deleteAnnotation(connection, query)

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

function validate_query(genomes: Genome, query: DeleteWSIAnnotationRequest): any {
	if (!query.genome) throw new Error('.genome is required for deleteWSIAnnotation request.')
	if (!query.dslabel) throw new Error('.dslabel is required for deleteWSIAnnotation request.')
	if (!query.annotation) throw new Error('.annotation:{} is required for deleteWSIAnnotation request.')
	if (!query.projectId) throw new Error('.projectId is required for deleteWSIAnnotation request.')
	if (!query.wsimage) throw new Error('.wsimage is required for deleteWSIAnnotation request.')

	const g = genomes[query.genome]
	const ds = g.datasets[query.dslabel]

	if (!ds.queries?.WSImages?.db) throw new Error(`WSImages database not found for ${query.dslabel}.`)

	return ds
}

function deleteAnnotation(
	connection: Database.Database,
	query: DeleteWSIAnnotationRequest
): Database.RunResult | any[] {
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
