import { dofetch3 } from '#common/dofetch' // fetch wrapper for the termdb route
import type { WsiBySampleResponse } from '#types' // the route's response shape

/** Server data access for the w2 plot. Both calls hit termdb/wsiBySample,
 which lists straight from the ds.queries.w2 roots (folder/wsiFolder) on disk. */
export class Model {
	constructor(readonly genome: string, readonly dslabel: string) {} // both requests address the dataset

	/** Every sample in the dataset that has at least one PLAIN slide on disk
	 (a wsiFolder subfolder with a slide), with plain-slide counts. Spatial-only
	 samples are not listed — spatial images are viewed through the sc app,
	 which fetches them per sample via getImages(). */
	async getData(): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel } // no sample_id = list samples
		})
	}

	/** One sample's images (WsiImage | SpatialImage). imageType restricts the
	 enumeration to that root ('wsi' = wsiFolder, 'spatial' = folder) so the
	 other tree is never read; omitted = both kinds. */
	async getImages(sample_id: string, imageType?: 'spatial' | 'wsi'): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel, sample_id, imageType } // sample_id = list its images
		})
	}
}
