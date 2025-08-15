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
			const projectId = query.projectId
			const wsimagesFilenames = query.wsimagesFilenames

			const wsimages: WSImage[] = []

			if (ds.queries.WSImages.getWSIAnnotations) {
				for (const wsimageFilename of wsimagesFilenames) {
					const wsimage: WSImage = {
						filename: wsimageFilename
					}

					const annotations = await ds.queries.WSImages.getWSIAnnotations(projectId, wsimageFilename)

					if (annotations && annotations.length > 0) {
						wsimage.annotationsData = annotations

						wsimage.classes = ds.queries?.WSImages?.getAnnotationClasses(projectId)
						wsimage.uncertainty = ds.queries?.WSImages?.uncertainty
						wsimage.activePatchColor = ds.queries?.WSImages?.activePatchColor
					}

					if (ds.queries.WSImages.getWSIPredictionPatches) {
						const predictionsFile = await ds.queries.WSImages.getWSIPredictionPatches(projectId, wsimageFilename)

						const predictionsFilePath = path.join(
							serverconfig.tpmasterdir,
							ds.queries.WSImages.aiToolImageFolder,
							predictionsFile[0]
						)

						const predictionsData = JSON.parse(fs.readFileSync(predictionsFilePath, 'utf8'))

						wsimage.predictions = predictionsData.features.map((d: any) => {
							const featClass =
								ds.queries.WSImages?.classes?.find(f => f.id == d.properties.class)?.label || d.properties.class
							return {
								zoomCoordinates: d.properties.zoomCoordinates,
								uncertainty: d.properties.uncertainty,
								class: featClass
							}
						})
					}

					if (ds.queries.WSImages.makeGeoJson) {
						await ds.queries.WSImages.makeGeoJson(projectId, wsimageFilename)
					}

					wsimages.push(wsimage)
				}
			}

			if (ds.queries.WSImages.getWSIPredictionOverlay) {
				for (const wsimage of wsimages) {
					const predictionOverlay = await ds.queries.WSImages.getWSIPredictionOverlay(wsimage.filename)

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

export async function validate_query_getWSIAnnotations(ds: Mds3) {
	if (!ds.queries?.WSImages?.db?.file) return
	if (typeof ds.queries.WSImages.getWSIAnnotations == 'function') {
		// ds supplied getter
		return
	}
	validateWSIAnnotationsQuery(ds)
}
export async function validate_query_getWSIClassesQuery(ds: Mds3) {
	if (!ds.queries?.WSImages?.db?.file) return
	if (typeof ds.queries.WSImages.getAnnotationClasses == 'function') {
		// ds supplied getter
		return
	}
	validateWSIClassesQuery(ds)
}

export function validateWSIAnnotationsQuery(ds: any) {
	// Only add if not already provided externally
	if (typeof ds?.queries?.WSImages?.getWSIAnnotations === 'function') return

	type AnnotationRow = {
		id: number
		project_id: number
		user_id: number
		coordinates: any // stored JSON string like "[x,y]" or JSON array
		timestamp: string
		status: number
		class_name: string | null
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
    INNER JOIN project_images pi
      ON pi.id = pa.image_id
    LEFT JOIN project_classes pc
      ON pc.id = pa.class_id
    WHERE pa.project_id = ?
      AND pi.image_path = ?
      AND pa.status = 1
    ORDER BY pa.timestamp DESC, pa.id DESC
  `

	ds.queries.WSImages.getWSIAnnotations = async (projectId: number, filename: string): Promise<Annotation[]> => {
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

			const stmt = connection.prepare<[number, string], AnnotationRow>(GET_ANNOTATIONS_SQL)
			const rows = stmt.all(projectId, filename)

			return rows.map(r => {
				let coords: [number, number] = [NaN, NaN]

				try {
					const parsed = typeof r.coordinates === 'string' ? JSON.parse(r.coordinates) : r.coordinates
					if (Array.isArray(parsed) && parsed.length >= 2) {
						const x = Number(parsed[0])
						const y = Number(parsed[1])
						if (!Number.isNaN(x) && !Number.isNaN(y)) coords = [x, y]
					}
				} catch {
					/* ignore parse errors, keep [NaN, NaN] */
				}

				return {
					zoomCoordinates: coords,
					class: r.class_name ?? ''
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

export function validateWSIClassesQuery(ds: any) {
	type ProjectClass = {
		id: number
		project_id: number
		name: string
		color: string
		key_shortcut: string
	}

	if (!ds?.queries?.WSImages) {
		ds.queries = { ...(ds.queries || {}), WSImages: {} }
	}

	const GET_CLASSES_SQL = `
		SELECT id, project_id, name, color, key_shortcut
		FROM project_classes
		WHERE project_id = ?
		ORDER BY id
	`

	ds.queries.WSImages.getProjectClasses = async (projectId: number): Promise<ProjectClass[]> => {
		let connection: Database.Database | undefined
		try {
			const dbRelativePath = ds?.queries?.WSImages?.db?.file
			if (!dbRelativePath) {
				throw new Error('SQLite database path not found in ds.queries.WSImages.db.file')
			}

			const dbPath = path.join(serverconfig.tpmasterdir, dbRelativePath)

			// TODO cache db connection
			connection = new Database(dbPath, { fileMustExist: true })
			connection.pragma('journal_mode = WAL')
			connection.pragma('foreign_keys = ON')

			const stmt = connection.prepare<[number], ProjectClass>(GET_CLASSES_SQL)
			return stmt.all(projectId)
		} catch (error) {
			console.error('Error loading project classes:', error)
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
