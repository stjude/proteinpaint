import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu, addGeneSearchbox } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { launchMethylationBrowser } from '../../dnameth/launch'
import { withOthersGroup } from '#mass/groups'
import { getCombinedTermFilter } from '#filter'
import { getDefaultVolcanoSettings } from '../volcano/settings/defaults'
import type { MethylationStarburstResponse } from '#types'
import { getIsoformTerm } from '../volcano/handlers/isoformExpression'
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
	destroyInteractions?: () => void

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
		// with the sample filter of the volcano it was opened from, when that has one
		return { config, termfilter: getCombinedTermFilter(appState, config.filter) }
	}

	async main() {
		const { config, termfilter } = this.state
		// an in:false "others" placeholder becomes the group it stands for, as the volcano sends it
		const groups = withOthersGroup(config.tw.q.groups, termfilter)
		const names = groups.map(g => g.name) as [string, string]
		// by isoform: each transcript's own promoter and body against its own expression change
		const byIsoform = !!config.byIsoform && !!this.app.vocabApi.termdbConfig?.queries?.isoformExpressionCount
		this.dom.header?.text(`Methylation and expression by ${byIsoform ? 'isoform' : 'gene'}: ${names[1]} vs ${names[0]}`)
		// the DE volcano's settings; by isoform, with the dataset's preferred method for transcripts, as the isoform
		// volcano takes it (volcano/handlers/isoformExpression.ts getPreferredMethod)
		const de = getDefaultVolcanoSettings({}, { termType: byIsoform ? 'isoformExpression' : 'geneExpression' }) as any
		const preferred = byIsoform && this.app.vocabApi.termdbConfig?.queries?.isoformExpressionCount?.defaultMethod
		if (preferred) de.method = preferred
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
			byIsoform: byIsoform || undefined,
			// gene sets are gene-level, so not with isoforms
			geneSetGroup: (!byIsoform && config.geneSetGroup) || undefined
		}
		// a cutoff change redraws without asking the server again
		const key = JSON.stringify(body)
		if (key != this.dataKey) {
			this.dom.holder.selectAll('*').remove()
			this.dom.holder
				.append('div')
				.style('color', '#777')
				.text(
					`Computing promoter and body methylation and expression for every ${byIsoform ? 'transcript' : 'gene'}` +
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
		// the click menus of the previous drawing live on <body>: dispose of them before drawing again
		this.destroyInteractions?.()
		const drawn = drawStarburst(
			this.dom.holder,
			this.data!,
			s,
			names,
			this.tip,
			i => this.getActions(i, groups),
			config.highlightGenes
		)
		this.dom.svg = drawn.svg
		this.destroyInteractions = drawn.destroy
		this.dom.holder
			.append('div')
			.style('font-size', '0.8em')
			.style('opacity', 0.7)
			.text(
				`${this.data!.sampleSize1} vs ${this.data!.sampleSize2} samples with methylation and expression; ` +
					`${byIsoform ? 'isoform ' : ''}DE by ${this.data!.deMethod || 'the volcano default'}. ` +
					(byIsoform
						? 'Each point is a transcript, its own core promoter and body against its own expression change. '
						: '') +
					'Click a point for its options.'
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
		// one point per transcript, where the dataset has transcript counts
		const isoformCounts = !!this.app.vocabApi.termdbConfig?.queries?.isoformExpressionCount
		if (isoformCounts) {
			const il = div.append('label').style('margin-right', '15px')
			il.append('input')
				.attr('type', 'checkbox')
				.attr('data-testid', 'sjpp-methylationStarburst-byIsoform')
				.property('checked', !!config.byIsoform)
				.on('change', (event: any) => edit({ byIsoform: event.target.checked }))
			il.append('span').text(' By isoform')
		}
		this.renderGeneFinder(div)
		// gene sets are tested by gene
		if (isoformCounts && config.byIsoform) return
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

	/* Genes to ring and name, found with the portal's gene search and kept in the plot state, each removable. By isoform
	a gene's transcripts are many points, which this is the way to find among tens of thousands. */
	renderGeneFinder(div: any) {
		const { config } = this.state
		const pinned: string[] = config.highlightGenes || []
		const edit = (highlightGenes: string[]) =>
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { highlightGenes } })
		const row = div.append('span').style('margin-right', '15px').style('display', 'inline-block')
		row.append('span').text(this.data?.isoforms ? 'Highlight gene or transcript ' : 'Highlight gene ')
		const searchRow = row.append('span').style('display', 'inline-block')
		const msg = row.append('span').style('margin-left', '6px').style('color', '#b00')
		const inPlot = new Set(this.data?.genes || [])
		const search = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: this.app.opts.genome,
			row: searchRow,
			searchOnly: 'gene',
			hideHelp: true,
			focusOff: true,
			testid: 'sjpp-methylationStarburst-findGene',
			callback: () => {
				const gene = search.geneSymbol
				if (!gene) return
				if (!inPlot.has(gene)) {
					msg.text(`${gene} is not in this plot`)
					return
				}
				msg.text('')
				if (!pinned.includes(gene)) edit([...pinned, gene])
			}
		})
		/* By isoform, a transcript id pins that one transcript. The gene search knows genes only and would answer "not
		found", so an id is taken on the way down to its input (capture on the row), before the search's own keyup. */
		const isoforms = new Set(this.data?.isoforms || [])
		if (isoforms.size)
			row.node().addEventListener(
				'keyup',
				(event: KeyboardEvent) => {
					if (event.key != 'Enter') return
					const v = String((event.target as HTMLInputElement).value || '')
						.trim()
						.toUpperCase()
						.replace(/\.\d+$/, '')
					if (!/^ENST\d+$/.test(v)) return
					event.stopPropagation()
					if (!isoforms.has(v)) return void msg.text(`${v} is not in this plot`)
					msg.text('')
					if (!pinned.includes(v)) edit([...pinned, v])
				},
				true
			)
		for (const gene of pinned)
			row
				.append('button')
				.attr('type', 'button')
				.attr('aria-label', `Remove ${gene}`)
				.style('margin-left', '4px')
				.style('font-size', '0.9em')
				.text(`${gene} ×`)
				.on('click', () => edit(pinned.filter(gn => gn != gene)))
	}

	/* What a click on a point offers, in a menu that stays until dismissed: the methylation track of its gene, and by
	isoform the transcript's own expression by the two groups, as the isoform volcano's rows offer */
	getActions(i: number, groups: any[]): { label: string; onClick: () => void }[] {
		const gene = this.data!.genes[i]
		const isoform = this.data!.isoforms?.[i]
		const actions = [{ label: `Methylation track of ${gene}`, onClick: () => void this.launchLocus(gene, groups) }]
		const termdbConfig = this.app.vocabApi.termdbConfig
		if (!isoform || !termdbConfig?.queries?.isoformExpression) return actions
		const { config } = this.state
		const summary = (childType: 'violin' | 'boxplot') =>
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'summary',
					childType,
					term: { q: { mode: 'continuous' }, term: getIsoformTerm({ gene_name: isoform, gene }, termdbConfig) },
					term2: {
						q: { groups: sampleLevelGroups(groups, termdbConfig), type: 'custom-samplelst' },
						term: config.tw.term
					}
				}
			})
		return [
			...actions,
			{ label: 'Isoform expression: violin', onClick: () => void summary('violin') },
			{ label: 'Isoform expression: box plot', onClick: () => void summary('boxplot') }
		]
	}

	/* the gene's per-patient methylation and expression, with this plot's groups as the strip */
	launchLocus(gene: string, groups: any[]) {
		const { config } = this.state
		return launchMethylationBrowser(
			this.app,
			{ gene },
			{ q: { groups, type: 'custom-samplelst' }, term: config.tw.term },
			undefined,
			config.filter
		)
	}

	/** remove the body-mounted menus: the click menus of the plot's points and the tooltip */
	destroy() {
		this.destroyInteractions?.()
		this.tip.destroy()
	}

	getChartImages() {
		const out: { name: string; svg: any }[] = []
		if (this.dom.svg && !this.dom.svg.empty())
			out.push({ name: 'Methylation and expression by gene', svg: this.dom.svg })
		if (this.pathwaySvg && !this.pathwaySvg.empty()) out.push({ name: 'Gene sets', svg: this.pathwaySvg })
		return out
	}
}

/* The groups for a plot of a sample-level value, such as isoform expression. A group defined by a filter (the Groups
tab) resolves to what its filter selects, which on a dataset with sample ancestry is the patients, whose samples carry the
expression: such a group then plotted no value ("no visible violin plot data"). The analyses map patients to their
samples on the server; a summary plot does that only for a group that asks for it, so each filter group asks. */
export function sampleLevelGroups(groups: any[], termdbConfig: any) {
	if (!termdbConfig?.hasSampleAncestry) return groups
	return groups.map(g => (g.filter && !Array.isArray(g.values) ? { ...g, mapParent2Children: true } : g))
}

export const componentInit = getCompInit(MethylationStarburst)

export function getPlotConfig(opts: any) {
	if (opts.tw?.q?.groups?.length != 2) throw new Error('two sample groups are required for the starburst plot')
	// no plot-local sample filter: the groups are sample lists that the methylation side does not filter further
	return copyMerge(
		{ hidePlotFilter: true, settings: { methylationStarburst: { minDeltaBeta: 0.05, maxQ: 0.05 } } },
		opts
	)
}
