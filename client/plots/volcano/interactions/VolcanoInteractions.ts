import type { MassAppApi } from '#mass/types/mass'
import { downloadTable, GeneSetEditUI, MultiTermWrapperEditUI, newSandboxDiv } from '#dom'
import { to_svg } from '#src/client'
import type { VolcanoDom, VolcanoPlotConfig } from '../VolcanoTypes'
import { DNA_METHYLATION, GENE_EXPRESSION } from '#shared/terms.js'
import { GpdmPlot } from '../../gpdm/GpdmPlot'
import { dofetch3 } from '#common/dofetch'
import { select } from 'd3-selection'

export class VolcanoInteractions {
	app: MassAppApi
	dom: VolcanoDom
	id: string
	pValueTableData: any
	data: any
	constructor(app: MassAppApi, id: string, dom: VolcanoDom) {
		this.app = app
		this.dom = dom
		this.id = id
		this.pValueTableData = []
		this.data = []
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

	clearDom() {
		this.dom.holder.selectAll('div[id="sjpp-volcano-actions"]').remove()
		this.dom.holder.selectAll('svg[id="sjpp-volcano-svg"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-stats"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-pValueTable"]').remove()
		this.dom.holder.selectAll('div[id="sjpp-volcano-images"]').remove()
		this.dom.error.selectAll('*').remove()
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
				text: 'Download p value table',
				callback: () => {
					downloadTable(this.pValueTableData.rows, this.pValueTableData.columns)
				}
			}
		]
		for (const opt of opts) {
			this.dom.actionsTip.d.append('div').attr('class', 'sja_menuoption').text(opt.text).on('click', opt.callback)
		}
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
	async launchBoxPlot(value: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		if (config.termType != GENE_EXPRESSION) return
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

	/** When clicking on a DM data point, launches the GPDM probe-level
	 * analysis in a new sandbox. Looks up gene coordinates via genelookup,
	 * then calls termdb/gpdm for the region. */
	async launchGpdm(geneName: string, promoterId?: string) {
		const config = this.app.getState().plots.find((p: VolcanoPlotConfig) => p.id === this.id)
		if (config.termType !== TermTypes.DNA_METHYLATION) return

		const genome = this.app.vocabApi.vocab.genome

		// Look up gene coordinates
		const result = await dofetch3('genelookup', {
			body: { deep: 1, input: geneName, genome }
		})
		if (result.error || !result.gmlst || result.gmlst.length === 0) {
			window.alert(`Could not find coordinates for gene "${geneName}"`)
			return
		}

		const gm = result.gmlst[0]
		// Expand region by 2kb on each side to capture flanking probes
		const pad = 2000
		const chr = gm.chr
		const start = Math.max(0, gm.start - pad)
		const stop = gm.stop + pad

		// Build sample lists from the config's group data
		const group1 = config.samplelst.groups[0].values || []
		const group2 = config.samplelst.groups[1].values || []

		// Open a new sandbox (PP standard pattern)
		const sandboxParent = this.app.opts.plotDiv || select(this.dom.holder.node()!.parentNode as HTMLElement)
		const sandbox = newSandboxDiv(sandboxParent)
		const title = promoterId ? `GPDM: ${geneName} (${promoterId})` : `GPDM: ${geneName}`
		sandbox.header.text(title)

		new GpdmPlot({
			holder: sandbox.body as any,
			genome,
			dslabel: this.app.vocabApi.vocab.dslabel,
			chr,
			start,
			stop,
			geneName,
			promoterId,
			group1,
			group2,
			group1Name: config.samplelst.groups[0].name,
			group2Name: config.samplelst.groups[1].name
		})
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
			const unit = this.app.vocabApi.termdbConfig.queries.geneExpression?.unit || 'Gene Expression'
			const name = `${gene} ${unit}`
			const term = { gene, name, type: GENE_EXPRESSION }
			const tw = { term, q: {} }
			return tw
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
