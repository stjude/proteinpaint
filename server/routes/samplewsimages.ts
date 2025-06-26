import type { SampleWSImagesRequest, SampleWSImagesResponse, WSImage, RouteApi, Mds3 } from '#types'
import { sampleWSImagesPayload } from '#types/checkers'
import path from 'path'
import fs from 'fs'
import serverconfig from '#src/serverconfig.js'
/*
given a sample, return all whole slide images for specified dataset
*/

export const api: RouteApi = {
	endpoint: 'samplewsimages',
	methods: {
		get: {
			...sampleWSImagesPayload,
			init
		},
		post: {
			...sampleWSImagesPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: SampleWSImagesRequest = req.query
			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			const sampleId = query.sample_id
			const wsimages: WSImage[] = await ds.queries.WSImages.getWSImages(sampleId)

			if (ds.queries.WSImages.getWSIAnnotations) {
				for (const wsimage of wsimages) {
					if (ds.queries.WSImages.makeGeoJson) {
						await ds.queries.WSImages.makeGeoJson(sampleId, wsimage)
					}

					const annotations = await ds.queries.WSImages.getWSIAnnotations(sampleId, wsimage.filename)

					if (annotations && annotations.length > 0) {
						//Replace with annotations data??
						wsimage.overlays = annotations

						const annotationFilePath = path.join(
							serverconfig.tpmasterdir,
							ds.queries.WSImages.imageBySampleFolder,
							sampleId,
							annotations[0]
						)
						const annotationData = JSON.parse(fs.readFileSync(annotationFilePath, 'utf8'))
						//This assumes that classes are always present in the dataset.
						if (!annotationData.features && !ds.queries.WSImages?.classes?.length) {
							throw new Error(`No classes found for WSImage annotations in dataset ${ds.label}`)
						}

						wsimage.annotationsData = annotationData.features.map((d: any) => {
							const featClass =
								ds.queries.WSImages?.classes?.find(f => f.id == d.properties.class)?.label || d.properties.class
							return {
								zoomCoordinates: d.properties.zoomCoordinates,
								type: d.properties.type,
								uncertainty: d.properties.uncertainty,
								class: featClass
							}
						})

						wsimage.classes = ds.queries?.WSImages?.classes
						wsimage.uncertainty = ds.queries?.WSImages?.uncertainty
					}

					if (ds.queries.WSImages.getZoomInPoints) {
						const zoomInPoints: Array<[number, number]> = await ds.queries.WSImages.getZoomInPoints(
							sampleId,
							wsimage.filename,
							query.index
						)
						if (zoomInPoints) {
							wsimage.zoomInPoints = zoomInPoints
						}
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

			res.send({ sampleWSImages: wsimages } satisfies SampleWSImagesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample images not found')
		}
	}
}

export async function validate_query_getSampleWSImages(ds: Mds3) {
	if (!ds.queries?.WSImages) return
	validateQuery(ds)
}

function validateQuery(ds: any) {
	if (typeof ds.queries.WSImages.getWSImages == 'function') {
		// ds supplied getter
		return
	}
	// add getter with builtin logic
	ds.queries.WSImages.getWSImages = async (sampleName: string) => {
		// TODO move sql out so not to build it on every query
		const sql = `SELECT wsimages.filename as filename, wsimages.metadata as metadata
					 FROM wsimages
							  INNER JOIN sampleidmap
										 ON wsimages.sample = sampleidmap.id
					 WHERE sampleidmap.name = ?`

		const rows = ds.cohort.db.connection.prepare(sql).all(sampleName)
		const images: WSImage[] = []

		for (const row of rows) {
			images.push({
				filename: row.filename,
				metadata: row.metadata
			})
		}

		return images
	}
}
