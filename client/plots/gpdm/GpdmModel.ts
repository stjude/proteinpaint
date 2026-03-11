import { dofetch3 } from '#common/dofetch'
import type { GpdmOpts, GpdmResponseData } from './GpdmTypes'

export class GpdmModel {
	opts: GpdmOpts

	constructor(opts: GpdmOpts) {
		this.opts = opts
	}

	async getData(): Promise<GpdmResponseData> {
		const body = {
			genome: this.opts.genome,
			dslabel: this.opts.dslabel,
			chr: this.opts.chr,
			start: this.opts.start,
			stop: this.opts.stop,
			group1: this.opts.group1,
			group2: this.opts.group2,
			annotations: this.opts.annotations || []
		}
		const result = await dofetch3('termdb/gpdm', { body })
		if (result.error) throw new Error(result.error)
		return result as GpdmResponseData
	}
}
