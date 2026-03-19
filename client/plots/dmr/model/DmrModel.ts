import { dofetch3 } from '#common/dofetch'
import type { TermdbDmrResponse } from '#types'
import type { DmrConfig } from '../DmrTypes.ts'

export class DmrModel {
	private config: DmrConfig
	private vocab: { genome: string; dslabel: string }

	constructor(config: DmrConfig, vocab: { genome: string; dslabel: string }) {
		this.config = config
		this.vocab = vocab
	}

	async fetchDmr(chr: string, start: number, stop: number): Promise<TermdbDmrResponse> {
		const { group1, group2, settings } = this.config
		const { genome, dslabel } = this.vocab
		return dofetch3('termdb/dmr', {
			body: {
				genome,
				dslabel,
				chr,
				start,
				stop,
				group1,
				group2,
				width: settings.dmr.blockWidth,
				trackHeight: settings.dmr.trackHeight,
				nan_threshold: settings.dmr.nanThreshold,
				shoreSize: settings.dmr.shoreSize,
				colors: settings.dmr.colors,
				trackDpi: settings.dmr.trackDpi,
				trackYPad: settings.dmr.trackYPad,
				group1Name: this.config.group1Name,
				group2Name: this.config.group2Name
			}
		}) as Promise<TermdbDmrResponse>
	}

	async lookupGene(geneName: string): Promise<{ chr: string; start: number; stop: number }> {
		const { genome } = this.vocab
		const geneResult = await dofetch3('genelookup', { body: { deep: 1, input: geneName, genome } })
		if (geneResult.error || !geneResult.gmlst?.length) {
			throw new Error(`Could not find coordinates for gene "${geneName}"`)
		}
		const gm = geneResult.gmlst[0]
		return {
			chr: gm.chr,
			start: Math.max(0, gm.start - this.config.settings.dmr.pad),
			stop: gm.stop + this.config.settings.dmr.pad
		}
	}
}
