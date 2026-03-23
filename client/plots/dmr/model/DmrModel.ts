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

	async fetchDmr(chr: string, start: number, stop: number, signal?: AbortSignal): Promise<TermdbDmrResponse> {
		const { group1, group2, settings } = this.config
		const { genome, dslabel } = this.vocab
		return dofetch3('termdb/dmr', {
			signal,
			body: {
				genome,
				dslabel,
				chr,
				start,
				stop,
				group1,
				group2,
				lambda: settings.dmr.lambda,
				C: settings.dmr.C,
				fdr_cutoff: settings.dmr.fdr_cutoff,
				group1Name: this.config.group1Name,
				group2Name: this.config.group2Name,
				blockWidth: settings.dmr.blockWidth,
				devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
				maxLoessRegion: settings.dmr.maxLoessRegion,
				colors: settings.dmr.colors,
				backend: settings.dmr.backend
			}
		}) as Promise<TermdbDmrResponse>
	}
}
