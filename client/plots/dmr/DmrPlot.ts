import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { sayerror } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { first_genetrack_tolist } from '#common/1stGenetk'
import type { TermdbDmrResponse } from '#types'
import type { DmrConfig, DmrDom, BedItem } from './DmrTypes.ts'
import { getDefaultDMRSettings } from './settings/defaults.ts'

class DmrPlot extends PlotBase implements RxComponent {
	static type = 'dmr'
	type = DmrPlot.type
	declare dom: DmrDom
	blockInstance: InstanceType<any> | null = null

	constructor(opts: any, api: any) {
		super(opts, api)
		this.dom = {
			header: opts?.header,
			holder: opts.holder.append('div'),
			error: opts.holder.append('div'),
			loading: opts.holder.append('div').text('Running DMR analysis…')
		}
	}

	getState(appState: { plots: DmrConfig[] }): { config: DmrConfig } {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config }
	}

	async init() {}

	async main() {
		const config = this.state.config as DmrConfig
		if (this.dom.header) this.dom.header.text(config.headerText || 'DMR Analysis')

		validateConfig(config)

		this.dom.holder.selectAll('*').remove()
		this.dom.error.selectAll('*').remove()
		this.dom.loading.style('display', 'block')

		try {
			const { geneName, group1, group2, settings } = config
			const { genome, dslabel } = this.app.vocabApi.vocab

			// Resolve gene name to genomic coordinates
			const geneResult = await dofetch3('genelookup', {
				body: { deep: 1, input: geneName, genome }
			})
			if (geneResult.error || !geneResult.gmlst?.length) {
				throw new Error(`Could not find coordinates for gene "${geneName}"`)
			}
			const gm = geneResult.gmlst[0]
			const chr = gm.chr
			const start = Math.max(0, gm.start - settings.dmr.pad)
			const stop = gm.stop + settings.dmr.pad

			const dmrResult: TermdbDmrResponse = await dofetch3('termdb/dmr', {
				body: { genome, dslabel, chr, start, stop, group1, group2 }
			})
			if ('error' in dmrResult) {
				sayerror(this.dom.error, dmrResult.error)
				throw new Error(dmrResult.error)
			}

			const genomeObj = this.app.opts.genome
			const tklst: { type: string; name: string; bedItems?: BedItem[]; __isgene?: boolean }[] = []
			first_genetrack_tolist(genomeObj, tklst)

			tklst.push({
				type: 'bedj',
				name: 'DMRs',
				bedItems: dmrResult.dmrs.map(dmr => {
					const alpha = Math.round(Math.min(255, (0.5 + dmr.probability * 0.5) * 255))
					const hex = alpha.toString(16).padStart(2, '0')
					const base = dmr.direction === 'hyper' ? '#e66101' : '#5e81f4'
					return { chr: dmr.chr, start: dmr.start, stop: dmr.stop, color: base + hex }
				})
			})

			const { Block } = await import('#src/block')
			this.blockInstance = new Block({
				holder: this.dom.holder,
				genome: genomeObj,
				chr,
				start,
				stop,
				tklst,
				nobox: true,
				width: settings.dmr.blockWidth,
				hidegenelegend: true
			})
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e)
			sayerror(this.dom.error, msg)
		}
		this.dom.loading.style('display', 'none')
	}
}

export const componentInit = getCompInit(DmrPlot)

export function getPlotConfig(opts: Partial<DmrConfig>): DmrConfig {
	validateConfig(opts)

	const config = {
		settings: {
			dmr: getDefaultDMRSettings(opts)
		}
	}
	return copyMerge(config, opts)
}

/** Runs in both getPlotConfig and main() because will only run in main()
 * when plot is loaded from a saved state (e.g. mass session file).*/
function validateConfig(opts) {
	if (!opts.geneName) throw new Error('geneName is required for DMR plot')
	if (!opts.group1) throw new Error('group1 is required for DMR plot')
	if (!opts.group2) throw new Error('group2 is required for DMR plot')
}
