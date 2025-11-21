import type { Annotation, Mds3, RouteApi, WSImage } from '#types'
import type { AiProjectSelectedWSImagesRequest, AiProjectSelectedWSImagesResponse } from '#types'
import { aiProjectSelectedWSImagesResponsePayload } from '#types/checkers'
import { getDbConnection } from '#src/aiHistoDBConnection.ts'
import type Database from 'better-sqlite3'

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

			const wsimagesFilenamesArg = query.wsimagesFilenames as string[]
			let wsimagesFilenames: Array<string> = []

			const wsimages: WSImage[] = []

			// if client requested ["all"], attempt to get full WSI filename list from ds.queries helper
			if (
				Array.isArray(wsimagesFilenamesArg) &&
				wsimagesFilenamesArg.length === 1 &&
				wsimagesFilenamesArg[0] === 'all'
			) {
				// prefer using dataset-provided query helper if available
				if (ds.queries?.WSImages?.getAllWSImages) {
					try {
						wsimagesFilenames = await ds.queries.WSImages.getAllWSImages(projectId)
					} catch (e) {
						console.error('Failed to get WSI image list via helper, falling back to provided param', e)
					}
				}
			} else {
				wsimagesFilenames = wsimagesFilenamesArg
			}

			if (ds.queries.WSImages.getWSIAnnotations) {
				for (const wsimageFilename of wsimagesFilenames) {
					const wsimage: WSImage = {
						filename: wsimageFilename
					}

					wsimage.annotations = await ds.queries.WSImages.getWSIAnnotations(projectId, wsimageFilename)

					wsimage.classes = await ds.queries.WSImages.getAnnotationClasses(projectId)

					wsimage.uncertainty = ds.queries?.WSImages?.uncertainty
					wsimage.activePatchColor = ds.queries?.WSImages?.activePatchColor

					if (ds.queries.WSImages.getWSIPredictionPatches) {
						const predictions = await ds.queries.WSImages.getWSIPredictionPatches(projectId, wsimageFilename)

						const classMap = new Map<number, string>((wsimage.classes || []).map((c: any) => [c.id, c.label]))
						wsimage.predictions = (predictions || []).map((p: any) => {
							const label = classMap.get(p.class) ?? p.class
							return { ...p, class: label }
						})
					}

					wsimages.push(wsimage)
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
	if (!ds.queries?.WSImages?.db) return
	const connection = getDbConnection(ds)
	if (!connection) return
	validateWSIAnnotationsQuery(ds, connection)
}
export async function validate_query_getWSIClassesQuery(ds: Mds3) {
	if (!ds.queries?.WSImages?.db) return
	const connection = getDbConnection(ds)
	if (!connection) return

	validateWSIClassesQuery(ds, connection)
}

export function validateWSIAnnotationsQuery(ds: any, connection: Database.Database) {
	if (!ds.queries?.WSImages?.db) return

	type AnnotationRow = {
		id: number
		project_id: number
		user_id: number
		coordinates: any // stored JSON string like "[x,y]" or JSON array
		timestamp: string
		status: number
		label: string | null
	}

	const GET_ANNOTATIONS_SQL = `
        SELECT
            pa.id,
            pa.project_id,
            pa.user_id,
            pa.coordinates,
            pa.timestamp,
            pa.status,
            pc.label AS label
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

	// SQL to list all WSI filenames for a project (used when client asks for ["all"])
	const GET_PROJECT_IMAGES_SQL = `
        SELECT DISTINCT pi.image_path AS image_path
        FROM project_images pi
        WHERE pi.project_id = ?
        ORDER BY pi.id
    `

	if (!ds.queries) ds.queries = {}
	if (!ds.queries.WSImages) ds.queries.WSImages = {}

	ds.queries.WSImages.getWSIAnnotations = async (projectId: number, filename: string): Promise<Annotation[]> => {
		try {
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
					class: r.label ?? '',
					timestamp: r.timestamp
				}
			})
		} catch (error) {
			console.error('Error loading annotations:', error)
			return []
		}
	}

	// expose helper that returns all image filenames for a project
	ds.queries.WSImages.getAllWSImages = async (projectId: number): Promise<string[]> => {
		try {
			const stmt = connection.prepare<[number], { image_path: string }>(GET_PROJECT_IMAGES_SQL)
			const rows = stmt.all(projectId)
			return (rows || []).map(r => r.image_path)
		} catch (error) {
			console.error('Error loading project images list:', error)
			return []
		}
	}
}

export function validateWSIClassesQuery(ds: any, connection: Database.Database) {
	type ProjectClass = {
		id: number
		project_id: number
		label: string
		color: string
		key_shortcut: string
	}

	if (!ds.queries) ds.queries = {}
	if (!ds.queries.WSImages) ds.queries.WSImages = {}

	const GET_CLASSES_SQL = `
        SELECT id, project_id, label, color, key_shortcut
        FROM project_classes
        WHERE project_id = ?
        ORDER BY id
    `

	ds.queries.WSImages.getAnnotationClasses = async (projectId: number): Promise<ProjectClass[]> => {
		try {
			const stmt = connection.prepare<[number], ProjectClass>(GET_CLASSES_SQL)
			return stmt.all(projectId)
		} catch (error) {
			console.error('Error loading project classes:', error)
			return []
		}
	}
}
