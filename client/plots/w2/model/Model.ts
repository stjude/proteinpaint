import { dofetch3 } from '#common/dofetch'
import type { WsiBySampleResponse } from '#types'

/** Server data access for the w2 plot. Both calls hit termdb/wsiBySample,
 which lists straight from the ds.queries.w2.folder directory on disk. */
export class Model {
	constructor(readonly genome: string, readonly dslabel: string) {}

	/** Every sample in the dataset that has at least one whole-slide image on
	 disk (one subfolder per sample under ds.queries.w2.folder), with counts. */
	async getData(): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel }
		})
	}

	/** One sample's whole-slide images ({ fileName, thumbnail }), read from the
	 sample's folder: ds.queries.w2.folder/<sample_id>/ */
	async getImages(sample_id: string): Promise<WsiBySampleResponse> {
		return await dofetch3('termdb/wsiBySample', {
			body: { genome: this.genome, dslabel: this.dslabel, sample_id }
		})
	}
}
