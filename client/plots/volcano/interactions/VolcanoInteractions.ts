import type { MassAppApi } from '#mass/types/mass'
import { groupColors } from '../groupColors'
import { downloadTable, fileDateStamp, GeneSetEditUI, MultiTermWrapperEditUI } from '#dom'
import { to_svg } from '#src/client'
import type { VolcanoDom, VolcanoPlotConfig } from '../VolcanoTypes'
import { PROTEOME_DAP, DNA_METHYLATION, GENE_EXPRESSION, DMR_SCAN_ELEMENT_TYPE } from '#types'
import type { DmrScanSummary } from '#types'
import { CCRE_TRACK_NAME } from '#plots/dmr/viewModel/DmrViewModel.ts'
import { getGEunit } from '#tw/geneExpression'
import { getDNAMethUnit, getDNAMethTermName } from '#tw/dnaMethylation'
import { elementNoun } from '../promoterLabel'
import { fillTermWrapper } from '#termsetting'
import { getCombinedTermFilter } from '#filter'
import { roundValueAuto } from '#shared/roundValue.js'
import { HYPER_COLOR, HYPO_COLOR } from '#shared/dmrColors.js'

export class VolcanoInteractions {
	app: MassAppApi
	dom: VolcanoDom
	id: string
	pValueTableData: any
	data: any
	/** Significant rows before maxInteractiveDots capped them. When this exceeds the rows on
	 * screen, the download re-fetches the uncapped set via fetchAllRows(). */
	totalSignificantRows: number
	/** Groups, sample sizes and result-affecting settings, written into downloads. */
	provenance: string
	/** Re-requests the current contrast with the maxInteractiveDots cap lifted and returns the
	 * full significance table, formatted by the same view model the on-screen table uses.
	 * Set by Volcano.main() after each fetch; absent until the first response arrives. */
	fetchAllRows?: () => Promise<{ rows: any[]; columns: any[] }>

	constructor(app: MassAppApi, id: string, dom: VolcanoDom) {
		this.app = app
		this.dom = dom
		this.id = id
		this.pValueTableData = []
		this.data = []
		this.totalSignificantRows = 0
		this.provenance = ''
	}

	/** Launches a multi-term select tree
	 * On submit, dispatches a plot_edit action with the new confounders */
	async confoundersMenu() {
		const state = this.app.getState()
		const config = state.plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		if (config.termType !== GENE_EXPRESSION && config.termType !== DNA_METHYLATION) return

		/** Find terms used to create the groups and disable in the
		 * termsetting UI. Prevents users from trying to control for
		 * variables used to create the groups.*/
		const allowedGroupNames = new Set([config.samplelst.groups[0].name, config.samplelst.groups[1].name])
		const grpTerms: Set<string> = new Set(
			(this.app?.vocabApi?.state.groups || [])
				.filter(g => allowedGroupNames.has(g.name))
				.flatMap(g =>
					g.filter.lst.flatMap(f => {
						if (f.tvs?.term) return f.tvs.term
						else return f.lst.map(l => l.tvs.term)
					})
				)
		)
		const disable_terms: any[] = grpTerms.size ? Array.from(grpTerms) : []
		const maxNum = config.settings.volcano.method == 'edgeR' ? 1 : 2

		const ui = new MultiTermWrapperEditUI({
			app: this.app,
			callback: async (tws: any) => {
				this.dom.actionsTip.hide()
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { confounderTws: tws }
				})
			},
			holder: this.dom.actionsTip.d as any,
			headerText: 'Select confounders',
			maxNum,
			state,
			twList: config.confounderTws,
			disable_terms
		})
		await ui.renderUI()
	}

	download(termType: string) {
		this.dom.actionsTip.clear().showunder(this.dom.controls.select('div').node())
		const opts = [
			{
				text: 'Download plot',
				callback: () => {
					const svg = this.dom.holder.select('svg').node() as Node
					to_svg(svg, `Differential ${termType} analysis volcano`, { apply_dom_styles: true })
				}
			},
			{
				// DAP volcanoes report a single FDR rather than a p-value.
				text: termType === PROTEOME_DAP ? 'Download FDR table' : 'Download p-value table',
				callback: (itemDiv: any) => this.downloadPvalueTable(termType, itemDiv)
			}
		]
		for (const opt of opts) {
			const itemDiv = this.dom.actionsTip.d.append('div').attr('class', 'sja_menuoption').text(opt.text)
			itemDiv.on('click', () => opt.callback(itemDiv))
		}
	}

	/* The interactive table only holds the most-significant maxInteractiveDots rows, because the
	dot overlay has to stay responsive. The download has no such constraint, so it should be the
	COMPLETE set of significant rows: when the two differ, re-request with the cap lifted and write
	those rows instead.

	That second request is cheap. volcanoRender is deliberately not part of the DA cache key (see
	dmKeyInputs in server/routes/termdb.diffMeth.ts), so lifting the cap re-uses the cached R result
	and pays only for a re-render.

	If the re-request fails the download still happens, with the capped rows and a note saying so --
	losing the file entirely would be a worse outcome than a disclosed subset. */
	async downloadPvalueTable(termType: string, itemDiv?: any) {
		// name the file after what is in it and when it was run -- these downloads pile up in
		// one folder across cohorts and reruns
		const date = fileDateStamp()
		const label = termType === PROTEOME_DAP ? 'fdr' : 'p-value'
		let { rows, columns } = this.pValueTableData
		let subsetNote: string | undefined

		/* Without a note, nothing in a capped file reveals that "how many were significant" is
		unanswerable from it. Only reachable now when the full fetch is unavailable or fails. */
		const cappedNote = (reason: string) =>
			`Top ${rows.length.toLocaleString()} of ${this.totalSignificantRows.toLocaleString()} significant results, ` +
			`selected by adjusted p-value and sorted by fold-change. This file is not the complete result set (${reason}).`

		if (this.totalSignificantRows > rows.length) {
			if (!this.fetchAllRows) subsetNote = cappedNote('complete set unavailable')
			else {
				// a full table can be tens of thousands of rows; say something before the wait
				const restore = itemDiv?.text()
				itemDiv?.text(`Preparing ${this.totalSignificantRows.toLocaleString()} rows...`)
				try {
					const full = await this.fetchAllRows()
					rows = full.rows
					columns = full.columns
				} catch (e: any) {
					subsetNote = cappedNote(`could not retrieve the complete set: ${e?.message || e}`)
				} finally {
					if (restore) itemDiv?.text(restore)
				}
			}
		}

		/* Provenance rides along with the rows. Comparing two exports months apart is
		otherwise guesswork: differing counts could be a code change, a settings change or a
		different group definition, and nothing in the file distinguishes them.
		Joined with ' | ' rather than a newline because downloadTable collapses newlines to
		keep the note on one '#' line -- writing '\n' here would look intentional and quietly
		become a space. */
		const note = [subsetNote, this.provenance && `Run: ${this.provenance}`].filter(Boolean).join(' | ')
		downloadTable(rows, columns, `${label}-table-${date}.tsv`, note || undefined)
	}

	async highlightDataPoint(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const highlightedData = config.highlightedData.includes(value)
			? config.highlightedData.filter(d => d !== value)
			: [...config.highlightedData, value]
		await this.app.dispatch({
			type: 'plot_edit',
			id: this.id,
			config: { highlightedData }
		})
	}

	/** When clicking on a data point, launches the box plot in a separate sandbox
	 * For geneExpression, value == gene symbol */
	launchBoxPlot(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const values = {}
		for (const group of config.samplelst.groups) {
			values[group.name] = {
				key: group.name,
				label: group.name,
				list: group.values
			}
		}
		/** Gene variant and expression terms do not have an id
		 * need to be handled separately.
		 * TODO: In the future with more use cases, simplify this logic. */
		const setTerm = () => {
			if (config.termType == GENE_EXPRESSION) {
				return {
					q: { mode: 'continuous' },
					term: {
						gene: value,
						name: value,
						type: config.termType
					}
				}
			} else return config.term
		}
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'boxplot',
				term: setTerm(),
				term2: {
					q: { groups: config.tw.q.groups, type: 'custom-samplelst' },
					term: config.tw.term
				}
			}
		})
	}

	/** Launch a violin plot for a gene expression data point. */
	launchViolinGeneExp(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'violin',
				term: {
					q: { mode: 'continuous' },
					term: {
						gene: value,
						name: value,
						type: config.termType
					}
				},
				term2: {
					q: { groups: config.tw.q.groups, type: 'custom-samplelst' },
					term: config.tw.term
				}
			}
		})
	}

	launchGeneSetEdit() {
		const plotConfig = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const holder = this.dom.actionsTip.d.append('div').style('padding', '5px') as any
		const limitedGenesList =
			plotConfig.termType === DNA_METHYLATION ? this.data.map(d => d.promoter_id) : this.data.map(d => d.gene_name)
		new GeneSetEditUI({
			holder,
			genome: this.app.opts.genome,
			vocabApi: this.app.vocabApi,
			limitedGenesList,
			geneList: plotConfig.highlightedData.map(d => {
				return { gene: d } //Formatted to Gene type in GeneSetEditUI
			}),
			customInputs: [
				{
					label: 'Cancel highlight',
					getDisplayStyle: () => (plotConfig.highlightedData.length > 0 ? '' : 'none'),
					showInput: async () => {
						await this.app.dispatch({
							type: 'plot_edit',
							id: this.id,
							config: { highlightedData: [] }
						})
						this.dom.actionsTip.hide()
					}
				}
			],
			callback: async result => {
				const highlightedData = result.geneList.map(d => d.gene)
				await this.app.dispatch({
					type: 'plot_edit',
					id: this.id,
					config: { highlightedData }
				})
				this.dom.actionsTip.hide()
			}
		})
	}

	/** When clicking on a DM data point, dispatches a DMR plot that runs DMRCate
	 * analysis and renders a genome browser Block with DMR regions on their own
	 * track. */
	async launchDmr(
		d: { chr: string; start: number; stop: number; promoterId?: string },
		/** DMR-plot settings to override, e.g. pad: 0 for a region that is already its own context */
		dmrSettings: Record<string, any> = {}
	) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)

		/* Shared with the batch drill-down's launcher so the two cannot drift. Absent colours are
		omitted rather than replaced: the DMR plot's own defaults are tuned, where the red/blue this
		used to substitute was neither chosen nor legible next to the hyper/hypo bars. */
		const colors = groupColors(config)

		const label = d.promoterId || `${d.chr}:${d.start}-${d.stop}`
		const dmrConfig: any = {
			chartType: 'dmr',
			headerText: `DMR: ${label}`,
			coordinateOverride: { chr: d.chr, start: d.start, stop: d.stop },
			group1: config.samplelst.groups[0].values || [],
			group2: config.samplelst.groups[1].values || [],
			group1Name: config.samplelst.groups[0].name,
			group2Name: config.samplelst.groups[1].name,
			/* Which element matrix to drill into, for a dataset whose methylation is element-level
			only. The server ignores it when the dataset has a CpG-level matrix, which is finer. The
			scan is not a matrix, so a region opened from a scan names none and the server picks. */
			elementType:
				config?.settings?.volcano?.elementType == DMR_SCAN_ELEMENT_TYPE
					? undefined
					: config?.settings?.volcano?.elementType,
			settings: { colors, ...dmrSettings }
		}

		this.app.dispatch({
			type: 'plot_create',
			config: dmrConfig
		})
	}

	/* Open a genome browser on a scan's DMR, with the scan's own DMRs as a track. The scan wrote
	every DMR it called to a bedj file in the server's cache (at the CpG floor the volcano counts
	at), so the track is an ordinary file tk: the browser reads whatever region is in view from it,
	including after the reader types another position into the search box. Opened on the DMR with
	room either side. */
	async launchScanGenomeBrowser(d: { chr: string; start: number; stop: number }, scan: DmrScanSummary) {
		const tracks: any[] = []
		// the regulatory context the region view also switches on, by the genome's own declaration
		const ccre = (this.app.opts.genome?.tracks || []).find((t: any) => t.name == CCRE_TRACK_NAME)
		if (ccre) tracks.push(structuredClone(ccre))
		if (scan.bedjFile) {
			tracks.push({
				type: 'bedj',
				name: 'Scan DMRs',
				// the file is under the server's bedj cache dir, not the tp dir
				isCache: true,
				file: scan.bedjFile,
				stackheight: 14,
				// drives both the fill and the block legend, which counts each class in view
				categories: {
					hyper: { label: 'Hypermethylated DMR', color: HYPER_COLOR },
					hypo: { label: 'Hypomethylated DMR', color: HYPO_COLOR }
				}
			})
		}
		const pad = Math.max(5000, d.stop - d.start)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'genomeBrowser',
				geneSearchResult: { chr: d.chr, start: Math.max(0, d.start - pad), stop: d.stop + pad },
				tracks
			}
		})
	}

	/** Launch a violin/box plot for a DNA methylation promoter.
	 * Creates a methylation term using the promoter's chr/start/stop coordinates.
	 * The tw handler fills in id and unit from termdbConfig. */
	/** The methylation term a volcano point stands for: its coordinates, named after the element
	 * class actually tested. Shared by every action that turns a point into a term -- the violin and
	 * the survival split -- so the two plots always label and value the same region the same way. */
	/** `d.noun` names the element when the caller knows better than the volcano's element class, as the
	 * promoter-silencing panel does: its rows are promoters whatever class the volcano shows. */
	dnaMethTermFor(d: {
		chr: string
		start: number
		stop: number
		gene_name?: string
		promoter_id?: string
		noun?: string
	}) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		const genomicFeatureType = d.promoter_id ? 'promoter' : 'gene'
		const featureName = genomicFeatureType === 'gene' ? d.gene_name?.split(',')[0]?.trim() || '' : ''
		const term: any = {
			genomicFeatureType,
			featureName,
			type: DNA_METHYLATION,
			chr: d.chr,
			start: d.start,
			stop: d.stop
		}
		/* Name the term after the element class actually tested. Every class carries its id in
		promoter_id, so genomicFeatureType is 'promoter' for a distal enhancer too and the sandbox
		header read "Promoter Average M-value (chr9:...)" for something that is not a promoter.
		Built here, where the selected class is known, rather than left to the tw fill step, which
		only sees the term. */
		if (genomicFeatureType === 'promoter') {
			const noun = d.noun || elementNoun(config?.settings?.volcano?.elementType).one
			const unit = getDNAMethUnit(genomicFeatureType, this.app.vocabApi)
			term.unit = unit
			term.name = getDNAMethTermName(term, unit, noun)
		}
		return { term, config }
	}

	launchDNAMethViolin(d: { chr: string; start: number; stop: number; gene_name?: string; promoter_id?: string }) {
		const { term, config } = this.dnaMethTermFor(d)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'violin',
				term: {
					q: { mode: 'continuous' },
					term
				},
				term2: {
					q: { groups: config.tw.q.groups, type: 'custom-samplelst' },
					term: config.tw.term
				}
			}
		})
	}

	/** Survival split by whether this promoter is methylated -- the silencing call of the promoter
	silencing screen (beta >= 0.5, i.e. M-value >= 0) -- over the whole cohort. Not divided by the
	volcano's groups: silencing is an event in a few patients, and splitting them further leaves arms of
	one or two. */
	async launchSilencingSurvival(d: {
		chr: string
		start: number
		stop: number
		gene_name?: string
		promoter_id?: string
		noun?: string
	}) {
		const survDefault = this.app.vocabApi.termdbConfig?.defaultTw4correlationPlot?.survival
		if (!survDefault)
			throw new Error('This dataset names no default survival term (defaultTw4correlationPlot.survival).')
		const { term } = this.dnaMethTermFor(d)
		const survTw: any = structuredClone(survDefault)
		await fillTermWrapper(survTw, this.app.vocabApi)
		/* The screen calls a promoter methylated at beta 0.5, which is 0 on an M-value axis. Which
		of the two the values arrive on is the dataset's choice (dnaMethylation.termValueUnit), so
		the cut is read off the unit rather than hardcoded -- a 0 cut on beta would put almost every
		patient in the methylated arm. */
		const cut = /beta/i.test(term.unit || '') ? 0.5 : 0
		const methTw: any = {
			term,
			q: {
				mode: 'discrete',
				type: 'custom-bin',
				lst: [
					{ startunbounded: true, stop: cut, stopinclusive: false, label: 'Unmethylated (beta < 0.5)' },
					{ start: cut, startinclusive: true, stopunbounded: true, label: 'Methylated (beta >= 0.5)' }
				]
			}
		}
		await fillTermWrapper(methTw, this.app.vocabApi)
		this.app.dispatch({ type: 'plot_create', config: { chartType: 'survival', term: survTw, term2: methTw } })
	}

	/** This region's methylation against its gene's expression, one dot per sample, one panel per
	volcano group, with a lowess line. The simplest question methylation answers: is the gene silenced
	in the patients where its promoter is methylated? Per group because the grouping moves both axes
	(t(4;14) shifts methylation genome-wide), so a pooled scatter would show the grouping as a
	correlation. Offered only for a region naming exactly one gene. */
	launchDNAMethExpressionScatter(d: {
		chr: string
		start: number
		stop: number
		gene_name?: string
		promoter_id?: string
		noun?: string
	}) {
		const genes = (d.gene_name || '')
			.split(',')
			.map(s => s.trim())
			.filter(Boolean)
		if (genes.length != 1) throw new Error('Methylation vs expression needs a region naming exactly one gene.')
		const { term, config } = this.dnaMethTermFor(d)
		this.app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'summary',
				childType: 'sampleScatter',
				term: { term, q: { mode: 'continuous' } },
				term2: { term: { type: GENE_EXPRESSION, gene: genes[0], name: genes[0] }, q: { mode: 'continuous' } },
				term0: { q: { groups: config.tw.q.groups, type: 'custom-samplelst' }, term: config.tw.term },
				settings: { sampleScatter: { regression: 'Lowess' } }
			}
		})
	}

	/** Survival split by this region's methylation, divided by the volcano's own two groups.

	Divided rather than pooled because the grouping is usually itself prognostic -- t(4;14) is a
	high-risk marker -- so a region correlated with the grouping would "predict" survival across the
	whole cohort by proxy, a guaranteed positive that says nothing about methylation. One panel per
	group asks the question that can come out either way: within patients who share the grouping,
	does the region's methylation still separate outcome?

	Each group gets its own plot, split at the median WITHIN that group. A single cohort-wide median
	cannot work here: the region was picked because the grouping shifts it, so the cohort median
	lands near one group's tail and re-encodes the grouping (on MMRF t(4;14) chr5 block BLK_3038 it
	left 42 vs 3 in the YES panel). The bins stay editable from each plot's term2 control. */
	async launchDNAMethSurvival(d: {
		chr: string
		start: number
		stop: number
		gene_name?: string
		promoter_id?: string
	}) {
		const survDefault = this.app.vocabApi.termdbConfig?.defaultTw4correlationPlot?.survival
		if (!survDefault)
			throw new Error('This dataset names no default survival term (defaultTw4correlationPlot.survival).')
		const { term, config } = this.dnaMethTermFor(d)
		const survTw: any = structuredClone(survDefault)
		await fillTermWrapper(survTw, this.app.vocabApi)
		for (const group of config.tw.q.groups) {
			const values = { [group.name]: { key: group.name, label: group.name, list: group.values } }
			const groupFilter = {
				type: 'tvslst',
				in: true,
				join: '',
				lst: [{ type: 'tvs', tvs: { term: { name: group.name, type: 'samplelst', values } } }]
			}
			const termfilter = getCombinedTermFilter(this.app.getState(), groupFilter)
			const median = (await this.app.vocabApi.getPercentile(term, [50], termfilter)).values?.[0]
			if (!Number.isFinite(median)) throw new Error(`No methylation values for this region in ${group.name}.`)
			const m = roundValueAuto(median)
			const methTw: any = {
				term,
				q: {
					mode: 'discrete',
					type: 'custom-bin',
					lst: [
						{ startunbounded: true, stop: m, stopinclusive: false, label: `<${m}` },
						{ start: m, startinclusive: true, stopunbounded: true, label: `≥${m}` }
					]
				}
			}
			await fillTermWrapper(methTw, this.app.vocabApi)
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'survival',
					term: survTw,
					term2: methTw,
					// one-group term0: restricts the plot to the group and titles its panel
					term0: {
						q: { groups: [group], type: 'custom-samplelst' },
						term: { name: config.tw.term.name, type: 'samplelst', values }
					}
				}
			})
		}
	}

	async launchDEGClustering() {
		//Sort the DEG rows by q-value in ascending order
		const geneIndex = this.pValueTableData.columns.findIndex(col => col.label === 'Gene Name')
		const adjustedPValIndex = this.pValueTableData.columns.findIndex(col => col.label === 'Adjusted p-value')
		const rowsSorted = [...this.pValueTableData.rows].sort((a, b) => {
			const aQVal = Number(a[adjustedPValIndex].value)
			const bQVal = Number(b[adjustedPValIndex].value)
			return aQVal - bQVal
		})

		// Launch hierCluster for up to 100 DEGs with the smallest q-values
		const geneList = rowsSorted.slice(0, 100).map(r => ({ gene: r[geneIndex].value }))

		const tws = geneList.map(d => {
			const gene = d.gene
			const unit = getGEunit(this.app.vocabApi)
			const name = `${gene} ${unit}`
			const term = { gene, name, type: GENE_EXPRESSION }
			return { term, q: {} }
		})

		const group = { lst: tws, type: 'hierCluster' }
		const customVariable = this.app.getState().plots.find((p: any) => p.id === this.id).tw
		const annotationGroup = { lst: [customVariable] }
		const config = {
			chartType: 'hierCluster',
			termgroups: [group, annotationGroup],
			dataType: GENE_EXPRESSION,
			filter: {
				in: true,
				join: '',
				type: 'tvslst',
				lst: [{ type: 'tvs', tvs: { term: customVariable.term } }]
			}
		}
		await this.app.dispatch({
			type: 'plot_create',
			config: structuredClone(config)
		})
	}
}
