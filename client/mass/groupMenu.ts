import { filterJoin } from '#filter'
import { TermTypes } from '#types'
import type { DataAvailabilityGroup, DataAvailabilityType, Filter } from '#types'
import { dtsnvindel, dtcnv, dtfusionrna, dtsv } from '#shared/common.js'
import { isNumericTerm } from '#shared/terms.js'
import { getActiveCohortStr } from './charts'
import {
	renderDataAvailability,
	type AvailabilityRow,
	type AvailabilitySection,
	type RowAction,
	type SectionAction
} from './groupDataAvailability.ts'
import {
	addDiffAnalysisNote,
	addDiffAnalysisPlotMenuItem,
	addPlotMenuItem,
	canCompareMutations,
	closeGroupMenus,
	compareMutations,
	getAvailabilityGroups,
	getDiffAnalyses,
	launchPlot,
	mayAddBrainImagingOption,
	mayAddGenomebrowserOption,
	mayAddHierClusterPlotMenuItem,
	mayAddMatrixMenuItems,
	mayAddSamplescatterOption,
	plotConfig,
	showBrainImagingMenu,
	showHierClusterMenu,
	showTree,
	summaryConfig
} from './groups.js'

/*
The menu of sample groups, shared by the menu of a custom variable (groups.js) and the selected wedges of the
sunburst (plots/sunburst/SunburstChart.ts): the analyses of the groups, then how many samples of each group
have each kind of data of the dataset (termdb/dataAvailability), whose rows open a plot of that data.

The mode is chosen once, here, and each mode has its own options and row actions:
- explore: one group, given as its filter, which a plot of the group has as its own filter
- compare: two or more groups, given as a samplelst tw, which a plot divides by or compares
An option whose data the groups lack is removed once the counts arrive, and a row opens a plot only where
the mode has one for its data.
*/

/** where the menu is drawn: the app, the menus of its pickers, and how a plot is created. The functions of
 *  groups.js that draw the options of compare take it as their `self` */
export type GroupMenuHost = {
	app: any
	state: {
		/** {filter, filter0} of the app */
		termfilter: any
		currentCohortChartTypes: string[]
		matrixplots?: any
	}
	/** the menu that the menu of groups is in, if it is in one; hidden when a plot is created */
	tip?: any
	/** the submenu of a picker of an option or a row */
	tip2: any
	/** the gene search tooltip */
	tip3: any
	newId?: any
	/** creates a plot, e.g. after showing the plots tab; the plot is created in the app when absent */
	launch?: (config: any) => Promise<any> | void
	/** a picker drawn in tip2, destroyed when the menus close */
	picker?: { destroy: () => void }
}

export type GroupMenuArg = {
	holder: any
	host: GroupMenuHost
	/** the plot that a new plot is inserted before, if any */
	insertBefore?: string
	/** labels of the groups' count columns, by group name (compare) */
	labels?: { [name: string]: string }
} & (
	| {
			mode: 'explore'
			/** the filter of the group, without the global filter, which a plot joins to it */
			filter: Filter
	  }
	| {
			mode: 'compare'
			/** the groups, each with the global filter */
			samplelstTW: any
	  }
)

/** what an option or a row action reads; optionsDiv holds the options above the counts */
type Ctx = GroupMenuArg & { chartTypes: string[]; queries: any; optionsDiv: any }

/** what differs between the two modes */
type Route = {
	/** kinds of data that are not listed */
	exclude: DataAvailabilityType[]
	availabilityGroups: (ctx: Ctx) => DataAvailabilityGroup[]
	colors?: (ctx: Ctx) => { [name: string]: string | undefined }
	addOptions: (div: any, ctx: Ctx) => void
	rowAction: (row: AvailabilityRow, ctx: Ctx) => RowAction | undefined
	sectionActions?: (section: AvailabilitySection, ctx: Ctx) => SectionAction[]
}

/** draw the menu of the groups in arg.holder; resolves when the counts are drawn */
export function renderGroupMenu(arg: GroupMenuArg): Promise<void> {
	const route = arg.mode == 'explore' ? exploreRoute : compareRoute
	const options = arg.holder.append('div').attr('data-testid', 'sjpp-group-menu-options')
	const ctx = getContext(arg, options)
	route.addOptions(options, ctx)
	const termfilter = arg.host.state.termfilter || {}
	return renderDataAvailability({
		holder: arg.holder.append('div'),
		menuDiv: options,
		vocabApi: arg.host.app.vocabApi,
		groups: route.availabilityGroups(ctx),
		colors: route.colors?.(ctx),
		labels: arg.labels,
		exclude: route.exclude,
		filter0: termfilter.filter0,
		cohort: getActiveCohortStr(arg.host.app.getState()),
		rowAction: row => route.rowAction(row, ctx),
		sectionActions: route.sectionActions ? section => route.sectionActions!(section, ctx) : undefined
	})
}

function getContext(arg: GroupMenuArg, optionsDiv: any): Ctx {
	return {
		...arg,
		optionsDiv,
		chartTypes: arg.host.state.currentCohortChartTypes || [],
		queries: arg.host.app.vocabApi.termdbConfig?.queries || {}
	}
}

/************ explore: one group ************/

const exploreRoute: Route = {
	/* the counts that only a differential analysis uses, which compares two groups: of gene and isoform expression,
	and of splicing. DNA methylation is not excluded, as its row opens the methylation terms of the group */
	exclude: ['rnaseqGeneCount', 'isoformExpressionCount', 'junction'],
	availabilityGroups: ctx => [{ name: 'group', filter: withGlobalFilter(ctx) }],
	addOptions: (div, ctx) => addSummarizeOption(div, ctx),
	rowAction: exploreRowAction,
	sectionActions: (section, ctx) => {
		if (section.key != 'mutations' || !canRunGrin2(section, ctx)) return []
		return [{ testid: 'sjpp-grin2-option', label: 'Run GRIN2', run: () => launch(ctx, exploreConfig(ctx, 'grin2')) }]
	}
}

/** the plot of the group for a row of its data; none for a row without a plot of its own */
function exploreRowAction(row: AvailabilityRow, ctx: Ctx): RowAction | undefined {
	if (ctx.mode != 'explore') return
	const q = ctx.queries
	const open = (config: any) => ({ run: () => launch(ctx, config) })
	if (row.kind == 'survival') return open(exploreConfig(ctx, 'survival', { term: { id: row.key } }))
	// the mutations of the group, in the genome browser after a gene is entered
	if (row.kind == 'assay')
		return q.snvindel || q.svfusion || q.cnv
			? open(
					exploreConfig(ctx, 'genomeBrowser', {
						/* the mutation track shown, which the genome browser hides by default when the dataset also has
						trackLst. The query is copied as the browser's config replaces it, not merged */
						...(q.snvindel ? { snvindel: { ...structuredClone(q.snvindel), shown: true } } : {})
					})
			  )
			: undefined
	// the gene selection form, which creates only the chosen plot
	if (row.key == 'geneExpression' && ctx.chartTypes.includes('geneExpression'))
		return { run: anchor => showGeneExpression(ctx, anchor) }
	// the term search, whose DNA methylation tab lists methylation terms; a term opens its summary with the filter
	if (row.key == 'dnaMethylation') return open({ chartType: 'dictionary', spawnConfig: { filter: ctx.filter } })
	// the table of the imaging samples that pass the filter, to render on a brain template
	if (row.key == 'NIdata') return open(exploreConfig(ctx, 'brainImaging'))
	// the lanes of the patients of the group
	if (row.key == 'longitudinal' && ctx.chartTypes.includes('swimmer')) return open(exploreConfig(ctx, 'swimmer'))
}

/** GRIN2 is enabled for the cohort, and the group has a kind of mutation data that it analyzes */
function canRunGrin2(section: AvailabilitySection, ctx: Ctx): boolean {
	if (!ctx.chartTypes.includes('grin2')) return false
	const q = ctx.queries
	return section.rows.some(row => {
		const dt = Number(row.key.split('.')[0])
		if (dt == dtsnvindel) return !!q.snvindel
		if (dt == dtcnv) return !!(q.cnv || q.singleSampleMutation?.cnvTypes?.length)
		return (dt == dtfusionrna || dt == dtsv) && !!q.svfusion?.dtLst?.includes(dt)
	})
}

function exploreConfig(ctx: Ctx, chartType: string, more: any = {}) {
	if (ctx.mode != 'explore') throw new Error('not one group')
	return { chartType, filter: ctx.filter, ...more }
}

/** the group's filter with the global filter, as the server resolves the group */
function withGlobalFilter(ctx: Ctx): Filter {
	if (ctx.mode != 'explore') throw new Error('not one group')
	const filters = [ctx.filter, ctx.host.state.termfilter?.filter]
	return filterJoin(filters.filter(f => f?.lst?.length)) as Filter
}

async function showGeneExpression(ctx: Ctx, anchor: HTMLElement) {
	if (ctx.mode != 'explore') return
	const { host } = ctx
	const tip = openSubmenu(host, anchor)
	const wait = tip.d.append('div').style('padding', '5px').text('Loading ...')
	const holder = tip.d.append('div')
	/* another submenu, which clears tip2, may open while the picker loads; the picker is then of no submenu, and
	must not replace the picker of the one that is open */
	const replaced = () => !holder.node().isConnected
	try {
		const { geneExpInputInit } = await import('#plots/GeneExpInput.ts')
		if (replaced()) return
		const picker = await geneExpInputInit({
			app: host.app,
			holder,
			header: tip.d.insert('div', ':first-child'),
			config: { termType: TermTypes.GENE_EXPRESSION, spawnConfig: { filter: ctx.filter } },
			onSubmit: (config: any) => launch(ctx, config)
		})
		if (replaced()) {
			picker.destroy()
			return
		}
		host.picker = picker
		await picker.update({ appState: host.app.getState() })
		wait.remove()
	} catch (e: any) {
		wait.attr('class', 'sja_errorbar').text(e?.message || String(e))
	}
}

/************ compare: two or more groups ************/

const compareRoute: Route = {
	exclude: [],
	availabilityGroups: ctx =>
		ctx.mode == 'compare' ? getAvailabilityGroups(ctx.samplelstTW, ctx.host.state.termfilter) : [],
	colors: ctx =>
		ctx.mode == 'compare'
			? Object.fromEntries(Object.entries(ctx.samplelstTW.term.values).map(([k, v]: [string, any]) => [k, v.color]))
			: {},
	addOptions: addCompareOptions,
	rowAction: compareRowAction,
	// which group is the case of the differential analyses of the rows above
	sectionActions: (section, ctx) => {
		if (ctx.mode != 'compare') return []
		if (!section.rows.some(row => diffAnalysisOf(row, ctx) && compareRowAction(row, ctx)?.run)) return []
		// an analysis still offered above the counts, which has no row of its own, has the note there already
		if (!ctx.optionsDiv.select('[data-testid="sjpp-da-note"]').empty()) return []
		const { samplelstTW } = ctx
		return [
			{
				testid: 'sjpp-da-note',
				render: cell => addDiffAnalysisNote(cell.style('font-size', '0.85em').style('opacity', 0.8), samplelstTW)
			}
		]
	}
}

/** the analyses and plots of the groups; those whose data the counts show in a row are replaced by the row */
function addCompareOptions(div: any, ctx: Ctx) {
	if (ctx.mode != 'compare') return
	const { host, samplelstTW, insertBefore: id, chartTypes } = ctx
	addSummarizeOption(div, ctx)
	if (chartTypes.includes('DA') && samplelstTW.q.groups.length == 2) addDiffAnalysisPlotMenuItem(div, host, samplelstTW)
	if (chartTypes.includes('survival'))
		addPlotMenuItem('survival', div, 'Compare survival', host.tip2, samplelstTW, id, host, true)
	if (chartTypes.includes('cuminc'))
		addPlotMenuItem('cuminc', div, 'Compare cumulative incidence', host.tip2, samplelstTW, id, host, true)
	mayAddHierClusterPlotMenuItem('geneExpression', div, 'Gene expression', host.tip2, samplelstTW, id, host, true)
	mayAddMatrixMenuItems(div, 'Matrix', host.tip2, samplelstTW, id, host, host.state, true, newIdOf(host))
	mayAddSamplescatterOption(div, host, samplelstTW)
	mayAddGenomebrowserOption(div, host, samplelstTW)
	mayAddBrainImagingOption(div, host, samplelstTW)
}

/** a plot of the groups compares two or more of them; with the data in one group only, there is nothing to compare
 *  it with, so the row is not clickable, and the option that it stands in for is removed too */
function compareRowAction(row: AvailabilityRow, ctx: Ctx): RowAction | undefined {
	const action = compareRowPlot(row, ctx)
	if (!action) return
	if (row.counts.filter(n => n && n > 0).length < 2)
		return { replaces: action.replaces, title: 'Only one group has this data, so there is nothing to compare it with' }
	return action
}

/** the differential analysis of the data of a row, for two groups */
function diffAnalysisOf(row: AvailabilityRow, ctx: Ctx) {
	if (ctx.mode != 'compare' || row.kind != 'data') return
	if (ctx.samplelstTW.q.groups.length != 2 || !ctx.chartTypes.includes('DA')) return
	return getDiffAnalyses(ctx.host).find(a => a.dataType == row.key)
}

/** the plot of the groups for a row of their data, which replaces the menu option of that plot */
function compareRowPlot(row: AvailabilityRow, ctx: Ctx): RowAction | undefined {
	if (ctx.mode != 'compare') return
	const { host, samplelstTW, chartTypes } = ctx
	// the differential analysis of the data, e.g. of RNA-seq gene counts or DNA methylation
	const analysis = diffAnalysisOf(row, ctx)
	if (analysis) {
		const [control, test] = samplelstTW.q.groups.map(g => g.name)
		return {
			replaces: analysis.testid,
			title: `${analysis.label} of ${test} (case) vs ${control} (control)`,
			run: anchor => analysis.show(host, samplelstTW, anchor)
		}
	}
	if (row.kind == 'survival' && chartTypes.includes('survival'))
		return {
			replaces: 'sjpp-survival-option',
			run: () => launch(ctx, plotConfig('survival', { id: row.key }, samplelstTW, ctx.insertBefore, newIdOf(host)))
		}
	if (row.kind == 'assay' && canCompareMutations(host, samplelstTW))
		return { replaces: 'sjpp-genome-browser-option', run: () => compareMutations(host, samplelstTW) }
	if (row.kind != 'data') return
	// the expression of genes by the groups
	if (row.key == 'geneExpression' && chartTypes.includes('geneExpression'))
		return {
			replaces: 'sjpp-hiercluster-option',
			run: anchor => showHierClusterMenu(host, samplelstTW, anchor)
		}
	// the lanes of the groups' patients, in a section per group
	if (row.key == 'longitudinal' && chartTypes.includes('swimmer'))
		return { run: () => launch(ctx, { chartType: 'swimmer', term0: structuredClone(samplelstTW) }) }
	if (row.key == 'NIdata')
		return { replaces: 'sjpp-brain-imaging-option', run: anchor => showBrainImagingMenu(host, samplelstTW, anchor) }
}

/************ both modes ************/

/** a term picker beside the option; the term's summary of the group, or by the groups */
function addSummarizeOption(div: any, ctx: Ctx) {
	const d = div
		.append('div')
		.attr('class', 'sja_menuoption sja_sharp_border')
		.attr('data-testid', 'sjpp-summarize-option')
		.text('Summarize')
	d.insert('div').html('›').style('float', 'right')
	d.on('click', () => {
		const { host } = ctx
		host.picker?.destroy()
		host.picker = undefined
		if (ctx.mode == 'compare') {
			const { samplelstTW, insertBefore } = ctx
			showTree(
				d,
				term => {
					// a samplelst custom variable is given as its tw
					const tw = term.term ? term : { term }
					if (isNumericTerm(tw.term)) tw.q = { mode: 'continuous' }
					launch(ctx, summaryConfig(tw, samplelstTW, insertBefore, newIdOf(host)))
				},
				host.app,
				host.tip2
			)
			return
		}
		// the dictionary of the group's samples; a survival term opens its curve
		const state = host.app.getState()
		showTree(
			d,
			selected => {
				const term = selected.term ? selected : { term: selected }
				launch(ctx, exploreConfig(ctx, term.term.type == 'survival' ? 'survival' : 'summary', { term }))
			},
			host.app,
			host.tip2,
			// showTree() types its default tree state, whose usecase has a detail
			{
				vocab: state.vocab,
				termfilter: { ...state.termfilter, filter: withGlobalFilter(ctx) },
				customTerms: state.customTerms,
				tree: { usecase: { target: 'dictionary' } }
			} as any
		)
	})
}

/** as groups.js passes the id of a new plot, which the menu of a custom variable has; none otherwise */
function newIdOf(host: GroupMenuHost) {
	return host.newId ? () => host.newId : undefined
}

/** tip2, emptied, under the anchor */
function openSubmenu(host: GroupMenuHost, anchor: HTMLElement) {
	host.picker?.destroy()
	host.picker = undefined
	host.tip2.clear().showunderoffset(anchor)
	return host.tip2
}

function launch(ctx: Ctx, config: any) {
	closeGroupMenus(ctx.host)
	return launchPlot(ctx.host, config)
}
