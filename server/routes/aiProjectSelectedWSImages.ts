import type { Annotation, Mds3, RouteApi, WSImage } from '#types'
import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
import Database from 'better-sqlite3'
import type {
	AiProjectSelectedWSImagesRequest,
	AiProjectSelectedWSImagesResponse
} from '@sjcrh/proteinpaint-types/routes/aiProjectSelectedWSImages.ts'

import { aiProjectSelectedWSImagesResponsePayload } from '@sjcrh/proteinpaint-types/routes/aiProjectSelectedWSImages.ts'

/*
given a sample, return all whole slide images for specified dataset
*/

export const api: RouteApi = {
	endpoint: 'aiProjectSelectedWSImages',
	methods: {
		get: {
			...aiProjectSelectedWSImagesResponsePayload,
			init
		},
		post: {
			...aiProjectSelectedWSImagesResponsePayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: AiProjectSelectedWSImagesRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			// TODO remove sampleId from query
			const sampleId = 'query.sample_id'
			const wsimages: WSImage[] = await ds.queries.WSImages.getWSImages()

			if (ds.queries.WSImages.getWSIAnnotations) {
				for (const wsimage of wsimages) {
					if (ds.queries.WSImages.makeGeoJson) {
						await ds.queries.WSImages.makeGeoJson(sampleId, wsimage)
					}

					const annotations = await ds.queries.WSImages.getWSIAnnotations(sampleId, wsimage.filename)

					if (annotations && annotations.length > 0) {
						wsimage.annotationsData = annotations

						wsimage.classes = ds.queries?.WSImages?.classes
						wsimage.uncertainty = ds.queries?.WSImages?.uncertainty
						wsimage.activePatchColor = ds.queries?.WSImages?.activePatchColor
					}

					if (ds.queries.WSImages.getWSIPredictionPatches) {
						const predictionsFile = await ds.queries.WSImages.getWSIPredictionPatches(sampleId, wsimage.filename)

						const predictionsFilePath = path.join(
							serverconfig.tpmasterdir,
							ds.queries.WSImages.imageBySampleFolder,
							sampleId,
							predictionsFile[0]
						)

						const predictionsData = JSON.parse(fs.readFileSync(predictionsFilePath, 'utf8'))

						wsimage.predictions = predictionsData.features
							.map((d: any) => {
								const featClass =
									ds.queries.WSImages?.classes?.find(f => f.id == d.properties.class)?.label || d.properties.class
								return {
									zoomCoordinates: d.properties.zoomCoordinates,
									uncertainty: d.properties.uncertainty,
									class: featClass
								}
							})
							.slice(0, 15)
					}
				}
			}

			if (ds.queries.WSImages.getWSIPredictionOverlay) {
				for (const wsimage of wsimages) {
					const predictionOverlay = await ds.queries.WSImages.getWSIPredictionOverlay(sampleId, wsimage.filename)

					if (predictionOverlay) {
						wsimage.predictionLayers = [predictionOverlay]
					}
				}
			}

			res.send({ wsimages: wsimages } satisfies AiProjectSelectedWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

export async function validate_query_getAISelectedWSImages(ds: Mds3) {
	if (!ds.queries?.WSImages) return
	validateQuery(ds)
}

function validateQuery(ds: any) {
	if (typeof ds.queries.WSImages.getWSImages == 'function') {
		// ds supplied getter
		return
	}

	// TODO WRITE QUERY TO GET WSIMAGES and CLASSES
	return []
}

// TODO migrate to a separate endpoint
export async function validate_query_getWSIAnnotations(ds: Mds3) {
	if (!ds.queries?.WSImages?.db?.file) return
	validateAnnotationQuery(ds)
}

export function validateAnnotationQuery(ds: any) {
	type AnnotationRow = {
		id: number
		project_id: number
		user_id: number
		coordinates: any
		timestamp: string
		status: number
		class_name: string // from project_classes.name
	}

	const GET_ANNOTATIONS_SQL = `
    SELECT 
      pa.id,
      pa.project_id,
      pa.user_id,
      pa.coordinates,
      pa.timestamp,
      pa.status,
      pc.name AS class_name
    FROM project_annotations pa
    LEFT JOIN project_classes pc
      ON pa.class_id = pc.id
    WHERE pa.status = 1
    ORDER BY pa.timestamp DESC
  `

	ds.queries.WSImages.getWSIAnnotations = async (): Promise<Annotation[]> => {
		let connection: Database.Database | undefined
		try {
			const dbRelativePath = ds?.queries?.WSImages?.db?.file
			if (!dbRelativePath) {
				throw new Error('SQLite database path not found in ds.queries.WSImages.db.file')
			}

			const dbPath = path.join(serverconfig.tpmasterdir, dbRelativePath)

			connection = new Database(dbPath, { fileMustExist: true })
			connection.pragma('journal_mode = WAL')
			connection.pragma('foreign_keys = ON')

			const stmt = connection.prepare<[], AnnotationRow>(GET_ANNOTATIONS_SQL)
			const rows = stmt.all()

			return rows.map(r => {
				let coords: [number, number] = [NaN, NaN]

				try {
					const parsed = typeof r.coordinates === 'string' ? JSON.parse(r.coordinates) : r.coordinates
					if (Array.isArray(parsed) && parsed.length >= 2) {
						const x = Number(parsed[0])
						const y = Number(parsed[1])
						if (!Number.isNaN(x) && !Number.isNaN(y)) {
							coords = [x, y]
						}
					}
				} catch {
					// ignore parse errors
				}

				return {
					zoomCoordinates: coords,
					class: r.class_name || '' // empty if no matching class
				}
			})
		} catch (error) {
			console.error('Error loading annotations:', error)
			return []
		} finally {
			try {
				connection?.close()
			} catch {
				/* ignore */
			}
		}
	}
}
