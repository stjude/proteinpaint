import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu, isoformSelect } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { makeDNAMethRegionTerm } from '#tw/dnaMethylation'
import type { MethylationLocusBin, MethylationLocusIsoform, MethylationLocusResponse } from '#types'
import { drawLocus } from './view'

/* Per-sample CpG methylation along one gene, next to the gene's expression in the same samples.
Opened from a volcano dot; see server/src/routes/termdb.methylationLocus.ts for the data. */

class MethylationLocus extends PlotBase implements RxComponent {
	static type = 'methylationLocus'
	type = MethylationLocus.type
	tip = new Menu({ padding: '5px' })
	isoformMenu = new Menu({ padding: '0px' })

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.dom = {
			header: opts.header,
			error: opts.holder.append('div'),
			holder: opts.holder.append('div').attr('data-testid', 'sjpp-methylationLocus').style('padding', '10px')
		}
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config, termfilter: appState.termfilter }
	}

	async main() {
		const { config, termfilter } = this.state
		this.dom.header?.text(`${config.gene} methylation and expression`)
		this.dom.holder.selectAll('*').remove()
		const loading = this.dom.holder.append('div').text('Loading...')
		const { genome, dslabel } = this.app.vocabApi.vocab
		const data: MethylationLocusResponse = await dofetch3('termdb/methylationLocus', {
			signal: this.api?.getAbortSignal(),
			body: {
				genome,
				dslabel,
				gene: config.gene,
				isoform: config.isoform,
				filter: termfilter?.filter,
				filter0: termfilter?.filter0,
				groupTw: config.groupTw
			}
		})
		loading.remove()
		if ('error' in data) throw new Error(data.error)
		this.renderIsoformSelect(data.gene, data.isoforms)
		const values = config.groupTw?.term?.values || {}
		// the colors the groups were given in the group picker, else one per group so the profile lines differ
		const fallback = ['#1b9e77', '#d95f02', '#7570b3', '#e7298a']
		const groupColor = (g: string) => values[g]?.color || fallback[data.groups?.indexOf(g) ?? -1] || '#888'
		this.dom.svg = drawLocus(
			this.dom.holder,
			data,
			this.tip,
			groupColor,
			bin => this.launchViolin(data.region.chr, bin),
			config.settings?.methylationLocus?.colWidth
		)
	}

	/* the isoform that sets the locus, chosen in the genome browser's isoform list (isoformSelect), which
	sketches the exons of every isoform; expression stays gene-level */
	renderIsoformSelect(current: MethylationLocusIsoform, isoforms: MethylationLocusIsoform[]) {
		// default first, then RefSeq curated (NM_, NR_), then the rest
		const rank = (i: MethylationLocusIsoform) => (i.isdefault ? 0 : /^N[MR]_/.test(i.isoform) ? 1 : 2)
		const sorted = [...isoforms].sort((a, b) => rank(a) - rank(b) || a.isoform.localeCompare(b.isoform))
		const div = this.dom.holder.append('div').style('margin-bottom', '8px')
		div.append('span').text('Isoform ').style('font-size', '0.9em')
		div
			.append('button')
			.attr('data-testid', 'sjpp-methylationLocus-isoform')
			.text(`${current.isoform} ▾`)
			.on('click', (event: any) => {
				this.isoformMenu.clear()
				isoformSelect({
					holder: this.isoformMenu.d.append('div').style('padding', '10px'),
					allgm: sorted,
					usegm: current,
					maxHeight: 400,
					onSelect: gm => {
						this.isoformMenu.hide()
						if (gm.isoform != current.isoform)
							this.app.dispatch({ type: 'plot_edit', id: this.id, config: { isoform: gm.isoform } })
					}
				})
				this.isoformMenu.showunder(event.target)
			})
		div
			.append('span')
			.style('font-size', '0.8em')
			.style('opacity', 0.7)
			.style('margin-left', '8px')
			.text(`${isoforms.length} isoforms; expression is gene-level`)
	}

	/* the gene's expression split by this bin's methylation, in the summary violin */
	launchViolin(chr: string, bin: MethylationLocusBin) {
		const { config } = this.state
		const term2 = makeDNAMethRegionTerm({ chr, start: bin.start, stop: bin.stop }, this.app.vocabApi, {})
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'violin',
				term: {
					q: { mode: 'continuous' },
					term: {
						type: 'geneExpression',
						gene: config.gene,
						name: config.gene
					}
				},
				term2: { q: { mode: 'discrete' }, term: term2 }
			}
		})
	}

	getChartImages() {
		const svg = this.dom.svg
		return svg && !svg.empty() ? [{ name: `${this.state.config.gene} methylation and expression`, svg }] : []
	}
}

export const componentInit = getCompInit(MethylationLocus)

export function getPlotConfig(opts: any) {
	if (!opts.gene) throw new Error('gene is required for the methylation locus plot')
	return copyMerge({ settings: {} }, opts)
}
