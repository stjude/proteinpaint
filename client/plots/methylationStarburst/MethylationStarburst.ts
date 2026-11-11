import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { launchMethylationBrowser } from '../../dnameth/launch'
import { withOthersGroup } from '#mass/groups'
import { getDefaultVolcanoSettings } from '../volcano/settings/defaults'
import type { MethylationStarburstResponse } from '#types'
import { drawStarburst, drawPathways, type Cutoffs, type StarburstData } from './view'

/* Methylation change against expression change per gene, core promoter and gene body side by side, for the two
groups of a volcano. Opened from the differential methylation volcano; a click on a gene opens the methylation track at it
with the same groups. With a gene set group chosen, gene sets tested on expression, on gene-body methylation and on
the two merged are drawn under it. See server/src/routes/termdb.methylationStarburst.ts for the data. */

class MethylationStarburst extends PlotBase implements RxComponent {
	static type = 'methylationStarburst'
	type = MethylationStarburst.type
	tip = new Menu({ padding: '5px' })
	data?: StarburstData
	dataKey?: string
	pathwaySvg?: any

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.dom = {
			header: opts.header,
			holder: opts.holder.append('div').attr('data-testid', 'sjpp-methylationStarburst').style('padding', '10px')
		}
	}

	getState(appState: any) {
		const config = appState.plots.find(p => p.id === this.id)
		if (!config) throw new Error(`No plot with id='${this.id}' found`)
		return { config, termfilter: appState.termfilter }
	}

	async main() {
		const { config, termfilter } = this.state
		// an in:false "others" placeholder becomes the group it stands for, as the volcano sends it
		const groups = withOthersGroup(config.tw.q.groups, termfilter)
		const names = groups.map(g => g.name) as [string, string]
		this.dom.header?.text(`Methylation and expression by gene: ${names[1]} vs ${names[0]}`)
		const de = getDefaultVolcanoSettings({}, { termType: 'geneExpression' }) as any
		const { genome, dslabel } = this.app.vocabApi.vocab
		const body = {
			genome,
			dslabel,
			samplelst: { groups },
			corrected: !!config.corrected,
			excludeSexChr: !!config.excludeSexChr,
			// the DE volcano's settings, so the two share one cached run
			method: de.method,
			min_count: de.minCount,
			min_total_count: de.minTotalCount,
			cpm_cutoff: de.cpmCutoff,
			filter: termfilter?.filter,
			filter0: termfilter?.filter0,
			geneSetGroup: config.geneSetGroup || undefined
		}
		// a cutoff change redraws without asking the server again
		const key = JSON.stringify(body)
		if (key != this.dataKey) {
			this.dom.holder.selectAll('*').remove()
			this.dom.holder
				.append('div')
				.style('color', '#777')
				.text(
					'Computing promoter and gene-body methylation and expression for every gene' +
						(body.geneSetGroup ? ', and gene-set enrichment' : '') +
						'. A first run takes a few minutes.'
				)
			const data: MethylationStarburstResponse = await dofetch3('termdb/methylationStarburst', {
				signal: this.api?.getAbortSignal(),
				body
			})
			if ('error' in data) throw new Error(data.error)
			this.data = data
			this.dataKey = key
		}
		this.dom.holder.selectAll('*').remove()
		const s: Cutoffs = config.settings.methylationStarburst
		this.renderControls(s)
		this.dom.svg = drawStarburst(
			this.dom.holder,
			this.data!,
			s,
			names,
			this.tip,
			gene => this.launchLocus(gene, groups),
			config.highlightGenes
		)
		this.dom.holder
			.append('div')
			.style('font-size', '0.8em')
			.style('opacity', 0.7)
			.text(
				`${this.data!.sampleSize1} vs ${this.data!.sampleSize2} samples with methylation and expression; ` +
					`DE by ${this.data!.deMethod || 'the volcano default'}. Click a gene for its methylation track.`
			)
		const pw = this.data!.pathways
		this.pathwaySvg = pw
			? drawPathways(this.dom.holder.append('div').style('margin-top', '20px'), pw, names, this.tip)
			: null
	}

	renderControls(s: Cutoffs) {
		const { config } = this.state
		const div = this.dom.holder.append('div').style('margin-bottom', '8px').style('font-size', '0.9em')
		const edit = (c: any) => this.app.dispatch({ type: 'plot_edit', id: this.id, config: c })
		const num = (label: string, key: keyof Cutoffs, step: number) => {
			const l = div
				.append('label')
				.style('margin-right', '15px')
				.text(label + ' ')
			l.append('input')
				.attr('type', 'number')
				.attr('data-testid', `sjpp-methylationStarburst-${key}`)
				.attr('step', step)
				.attr('min', 0)
				.style('width', '60px')
				.property('value', s[key])
				.on('change', (event: any) => {
					const v = Number(event.target.value)
					if (Number.isFinite(v) && v >= 0) edit({ settings: { methylationStarburst: { [key]: v } } })
				})
		}
		num('|Δβ| >', 'minDeltaBeta', 0.01)
		num('DE q <', 'maxQ', 0.01)
		const l = div.append('label')
		l.append('input')
			.attr('type', 'checkbox')
			.attr('data-testid', 'sjpp-methylationStarburst-corrected')
			.property('checked', !!config.corrected)
			.on('change', (event: any) => edit({ corrected: event.target.checked }))
		l.append('span').text(' Δβ beyond matched background')
		// gene sets: the genome's msigdb groups, as the GSEA plot lists them; '-' is its "none"
		const groups = this.app.opts.genome?.termdbs?.msigdb?.analysisGenesetGroups
		if (!groups?.length) return
		const sl = div.append('label').style('margin-left', '15px').text('Gene sets ')
		const select = sl
			.append('select')
			.attr('data-testid', 'sjpp-methylationStarburst-geneSetGroup')
			.on('change', (event: any) => edit({ geneSetGroup: event.target.value == '-' ? null : event.target.value }))
		for (const g of [{ label: 'None', value: '-' }, ...groups.filter(g => g.value != '-')])
			select
				.append('option')
				.attr('value', g.value)
				.property('selected', g.value == (config.geneSetGroup || '-'))
				.text(g.label)
	}

	/* the gene's per-patient methylation and expression, with this plot's groups as the strip */
	launchLocus(gene: string, groups: any[]) {
		const { config } = this.state
		return launchMethylationBrowser(
			this.app,
			{ gene },
			{ q: { groups, type: 'custom-samplelst' }, term: config.tw.term }
		)
	}

	getChartImages() {
		const out: { name: string; svg: any }[] = []
		if (this.dom.svg && !this.dom.svg.empty())
			out.push({ name: 'Methylation and expression by gene', svg: this.dom.svg })
		if (this.pathwaySvg && !this.pathwaySvg.empty()) out.push({ name: 'Gene sets', svg: this.pathwaySvg })
		return out
	}
}

export const componentInit = getCompInit(MethylationStarburst)

export function getPlotConfig(opts: any) {
	if (opts.tw?.q?.groups?.length != 2) throw new Error('two sample groups are required for the starburst plot')
	return copyMerge({ settings: { methylationStarburst: { minDeltaBeta: 0.05, maxQ: 0.05 } } }, opts)
}
