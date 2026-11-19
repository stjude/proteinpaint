import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { Menu, addGeneSearchbox } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { launchMethylationBrowser } from '../../dnameth/launch'
import { withOthersGroup } from '#mass/groups'
import { getCombinedTermFilter } from '#filter'
import { getDefaultVolcanoSettings } from '../volcano/settings/defaults'
import type { MethylationStarburstResponse } from '#types'
import { stripAccessionVersion } from '#shared'
import { getIsoformTerm, sampleLevelGroups } from '../volcano/handlers/isoformExpression'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { drawStarburst, type Cutoffs, type StarburstData } from './view'

const defaultSettings: Cutoffs = { minDeltaBeta: 0.05, maxQ: 0.05 }

/* Methylation change against expression change per transcript, its own core promoter and body side by side, for the
two groups of a volcano. Only for a dataset with transcript counts (queries.isoformExpressionCount): there is no
gene-level version. A click on a point opens the methylation track of its gene, or the transcript's expression, with
the same groups. See server/src/routes/termdb.methylationStarburst.ts for the data.

Two ways in: its own plot, opened from a differential methylation volcano, or embedded in the volcano of a DMR scan
(opts.embedded), where it shares the volcano's plot config. Embedded, the cutoffs and pinned genes live under
settings.methylationStarburst, which the volcano's state leaves out, so changing them never re-runs the volcano; the
sex chromosomes follow the volcano's own setting. */

/** embedded, `open` is toggled by the volcano's button */
type StarburstSettings = Cutoffs & { highlightGenes?: string[]; open?: boolean }

class MethylationStarburst extends PlotBase implements RxComponent {
	static type = 'methylationStarburst'
	type = MethylationStarburst.type
	tip = new Menu({ padding: '5px' })
	/** the gene search's own menu, made once rather than on every render */
	searchTip = new Menu({ padding: '0px' })
	data?: StarburstData
	dataKey?: string
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
		const embedded = !!this.opts.embedded
		const volcano = config.settings?.volcano || {}
		return {
			embedded,
			// embedded, only beside the volcano of a DMR scan, once its button is clicked
			show:
				!embedded || (volcano.elementType == DMR_SCAN_ELEMENT_TYPE && !!config.settings?.methylationStarburst?.open),
			groups: config.tw.q.groups,
			term: config.tw.term,
			filter: config.filter,
			excludeSexChr: !!(embedded ? volcano.excludeSexChr : config.excludeSexChr),
			settings: { ...defaultSettings, ...config.settings?.methylationStarburst } as StarburstSettings,
			// with the sample filter of the volcano it was opened from, when that has one
			termfilter: getCombinedTermFilter(appState, config.filter)
		}
	}

	async main() {
		const state = this.state
		// embedded, the volcano's slot is hidden with it
		;(state.embedded ? this.opts.holder : this.dom.holder).property('hidden', !state.show)
		if (!state.show) {
			// the volcano drops back to where it was before the starburst lined it up
			this.opts.volcanoPlot?.()?.svg.style('margin-top', null)
			return
		}
		// an in:false "others" placeholder becomes the group it stands for, as the volcano sends it
		const groups = withOthersGroup(state.groups, state.termfilter)
		const names = groups.map(g => g.name) as [string, string]
		const title = `Methylation and expression by isoform: ${names[1]} vs ${names[0]}`
		if (this.dom.header) this.dom.header.text(title)
		// the isoform volcano's settings, with the dataset's preferred method for transcripts, as the isoform volcano
		// takes it (volcano/handlers/isoformExpression.ts getPreferredMethod)
		const de = getDefaultVolcanoSettings({}, { termType: 'isoformExpression' }) as any
		const preferred = this.app.vocabApi.termdbConfig?.queries?.isoformExpressionCount?.defaultMethod
		if (preferred) de.method = preferred
		const { genome, dslabel } = this.app.vocabApi.vocab
		const body = {
			genome,
			dslabel,
			samplelst: { groups },
			excludeSexChr: state.excludeSexChr,
			// the isoform volcano's settings, so the two share one cached run
			method: de.method,
			min_count: de.minCount,
			min_total_count: de.minTotalCount,
			cpm_cutoff: de.cpmCutoff,
			filter: state.termfilter?.filter,
			filter0: state.termfilter?.filter0
		}
		// a cutoff change redraws without asking the server again
		const key = JSON.stringify(body)
		if (key != this.dataKey) {
			this.dom.holder.selectAll('*').remove()
			if (!this.dom.header) this.dom.holder.append('div').style('font-weight', 'bold').text(title)
			this.dom.holder
				.append('div')
				.style('color', '#777')
				.text(
					'Computing promoter and body methylation and expression for every transcript. A first run takes a few minutes.'
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
		if (!this.dom.header) this.dom.holder.append('div').style('font-weight', 'bold').text(title)
		const s = state.settings
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
			s.highlightGenes,
			this.opts.volcanoPlot?.()?.plot.height
		)
		this.dom.svg = drawn.svg
		this.alignWithVolcano(drawn.svg, drawn.plotTop)
		this.destroyInteractions = drawn.destroy
		this.dom.holder
			.append('div')
			.style('font-size', '0.8em')
			.style('opacity', 0.7)
			.text(
				`${this.data!.sampleSize1} vs ${this.data!.sampleSize2} samples with methylation and expression; ` +
					`isoform DE by ${this.data!.deMethod || 'the volcano default'}. ` +
					'Each point is a transcript, its own core promoter and body against its own expression change. ' +
					'Click a point for its options.'
			)
	}

	/* Embedded, the starburst's plots and the volcano's start at the same height: whichever is higher on the page is
	pushed down by the difference. Measured, because the starburst's title and controls above its plots wrap with
	the width. */
	alignWithVolcano(svg: any, plotTop: number) {
		const v = this.opts.volcanoPlot?.()
		if (!v) return
		v.svg.style('margin-top', null)
		svg.style('margin-top', null)
		const volcanoTop = v.svg.node().getBoundingClientRect().top + v.plot.y
		const starburstTop = svg.node().getBoundingClientRect().top + plotTop
		const d = Math.round(starburstTop - volcanoTop)
		if (d > 0) v.svg.style('margin-top', `${d}px`)
		else if (d < 0) svg.style('margin-top', `${-d}px`)
	}

	/** this plot's settings, which embedded are the volcano's config too */
	editSettings(s: Partial<StarburstSettings>) {
		return this.app.dispatch({ type: 'plot_edit', id: this.id, config: { settings: { methylationStarburst: s } } })
	}

	renderControls(s: Cutoffs) {
		const div = this.dom.holder.append('div').style('margin-bottom', '8px').style('font-size', '0.9em')
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
					if (Number.isFinite(v) && v >= 0) this.editSettings({ [key]: v })
				})
		}
		num('|Δβ| >', 'minDeltaBeta', 0.01)
		num('DE q <', 'maxQ', 0.01)
		this.renderGeneFinder(div)
	}

	/* Genes to ring and name, found with the portal's gene search and kept in the plot settings, each removable. A
	gene's transcripts are many points, which this is the way to find among tens of thousands. */
	renderGeneFinder(div: any) {
		const pinned: string[] = this.state.settings.highlightGenes || []
		const edit = (highlightGenes: string[]) => this.editSettings({ highlightGenes })
		const row = div.append('span').style('margin-right', '15px').style('display', 'inline-block')
		row.append('span').text('Highlight gene or transcript ')
		const searchRow = row.append('span').style('display', 'inline-block')
		const msg = row.append('span').style('margin-left', '6px').style('color', '#b00')
		const inPlot = new Set(this.data?.genes || [])
		const search = addGeneSearchbox({
			tip: this.searchTip,
			genome: this.app.opts.genome,
			row: searchRow,
			searchOnly: 'gene',
			// a transcript id is taken too, see below
			placeholder: 'Gene or transcript',
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
		/* A transcript id pins that one transcript. The gene search knows genes only and would answer "not
		found", so an id of the plot is taken on the way down to its input (capture on the row), before the search's own
		keyup; any other text goes on to the search. Matched without version and case, pinned as the plot names it. */
		const isoformOf = new Map((this.data?.isoforms || []).map(id => [stripAccessionVersion(id).toUpperCase(), id]))
		row.node().addEventListener(
			'keyup',
			(event: KeyboardEvent) => {
				if (event.key != 'Enter' || event.isComposing) return
				const typed = String((event.target as HTMLInputElement).value || '').trim()
				const id = isoformOf.get(stripAccessionVersion(typed).toUpperCase())
				if (!id) return
				event.stopPropagation()
				// the gene search's pending lookup sees an empty input and does not reopen its menu
				;(event.target as HTMLInputElement).value = ''
				this.searchTip.hide()
				msg.text('')
				if (!pinned.includes(id)) edit([...pinned, id])
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

	/* What a click on a point offers, in a menu that stays until dismissed: the methylation track of its gene, and the
	transcript's own expression by the two groups, as the isoform volcano's rows offer */
	getActions(i: number, groups: any[]): { label: string; onClick: () => void }[] {
		const gene = this.data!.genes[i]
		const isoform = this.data!.isoforms[i]
		const actions = [{ label: `Methylation track of ${gene}`, onClick: () => void this.launchLocus(gene, groups) }]
		const termdbConfig = this.app.vocabApi.termdbConfig
		if (!termdbConfig?.queries?.isoformExpression) return actions
		const { filter, term } = this.state
		const summary = (childType: 'violin' | 'boxplot') =>
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'summary',
					childType,
					// the plot-local filter that the starburst's own DE and methylation runs apply
					filter,
					term: { q: { mode: 'continuous' }, term: getIsoformTerm({ gene_name: isoform, gene }, termdbConfig) },
					term2: {
						q: { groups: sampleLevelGroups(groups, termdbConfig), type: 'custom-samplelst' },
						term
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
		const { filter, term } = this.state
		return launchMethylationBrowser(
			this.app,
			{ gene },
			{ q: { groups, type: 'custom-samplelst' }, term },
			undefined,
			filter
		)
	}

	/** remove the body-mounted menus: the click menus of the plot's points and the tooltip */
	destroy() {
		this.destroyInteractions?.()
		this.tip.destroy()
		this.searchTip.destroy()
	}

	getChartImages() {
		const out: { name: string; svg: any }[] = []
		if (this.dom.svg && !this.dom.svg.empty())
			out.push({ name: 'Methylation and expression by isoform', svg: this.dom.svg })
		return out
	}
}

export const componentInit = getCompInit(MethylationStarburst)

export function getPlotConfig(opts: any) {
	if (opts.tw?.q?.groups?.length != 2) throw new Error('two sample groups are required for the starburst plot')
	// no plot-local sample filter: the groups are sample lists that the methylation side does not filter further
	return copyMerge({ hidePlotFilter: true, settings: { methylationStarburst: { ...defaultSettings } } }, opts)
}
