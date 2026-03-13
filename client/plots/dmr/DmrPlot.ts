import { PlotBase } from '../PlotBase.ts'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { sayerror } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { first_genetrack_tolist } from '#common/1stGenetk'
import type { DmrConfig, DmrDom, DmrResult, BedItem } from './DmrTypes.ts'
import { getDefaultDMRSettings } from './settings/defaults.ts'

class DmrPlot extends PlotBase implements RxComponent {
	static type = 'dmr'
	type = DmrPlot.type
	declare dom: DmrDom
	blockInstance: InstanceType<any> | null = null

	constructor(opts: any, api: any) {
		super(opts, api)
		this.dom = {
			header: opts.header,
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

		this.dom.holder.selectAll('*').remove()
		this.dom.error.selectAll('*').remove()
		this.dom.loading.style('display', 'block')

		try {
			const { genome, dslabel, chr, start, stop, group1, group2, settings } = config
			const dmrResult: DmrResult = await dofetch3('termdb/dmr', {
				body: {
					genome,
					dslabel,
					chr,
					start: Math.max(0, start - settings.dmr.pad),
					stop,
					group1,
					group2
				}
			})
			if (!dmrResult || dmrResult.error) {
				sayerror(this.dom.error, dmrResult?.error || 'No result returned from server')
				throw new Error(dmrResult?.error || 'No result returned from server')
			}

			const genomeObj = this.app.opts.genome
			const tklst: { type: string; name: string; bedItems?: BedItem[]; __isgene?: boolean }[] = []
			first_genetrack_tolist(genomeObj, tklst)

			tklst.push({
				type: 'bedj',
				name: 'DMRs',
				bedItems: (dmrResult.dmrs ?? []).map(dmr => {
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
	const config = {
		settings: {
			dmr: getDefaultDMRSettings(opts)
		}
	}
	return copyMerge(config, opts)
}
