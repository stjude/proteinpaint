import { dofetch3 } from '#common/dofetch' // fetch wrapper for the termdb route
import type { WsiBySampleResponse } from '#types' // the route's response shape

/** Server data access for the w2 plot. Both calls hit termdb/wsiBySample,
 which lists straight from the ds.queries.w2 roots (folder/wsiFolder) on disk. */
export class Model {
	constructor(readonly genome: string, readonly dslabel: string) {} // both requests address the dataset

	/** Every sample in the dataset that has at least one image on disk (one
	 subfolder per sample under either w2 root), with image counts. */
	async getData(): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel } // no sample_id = list samples
		})
	}

	/** One sample's images (WsiImage | SpatialImage), enumerated from the
	 sample's subfolders in both w2 roots. */
	async getImages(sample_id: string): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel, sample_id } // sample_id = list its images
		})
	}
}
