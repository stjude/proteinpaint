import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent, type AppApi, type ComponentApi } from '#rx'
import { PlotBase } from '../PlotBase'
import { fillTermWrapper } from '#termsetting'
import { Menu, sayerror } from '#dom'
import { controlsInit } from '../controls'
import { getDefaultVolcanoSettings, validateVolcanoSettings } from './settings/defaults'
import type { VolcanoOpts, VolcanoDom } from './VolcanoTypes'
import { VolcanoModel } from './model/VolcanoModel'
import { VolcanoViewModel } from './viewModel/VolcanoViewModel'
import { VolcanoInteractions } from './interactions/VolcanoInteractions'
import { VolcanoPlotView } from './view/VolcanoPlotView'
import { VolcanoControlInputs } from './VolcanoControlInputs'
import { getCombinedTermFilter } from '#filter'
import { GENE_EXPRESSION, SINGLECELL_CELLTYPE, DNA_METHYLATION } from '#types'
import { uiLabel } from '#shared'

/* Below this many samples in the smaller group, the wilcoxon p-values are worth a caveat.
rust/src/stats_functions.rs only runs the exact test when both groups are under 50 AND no value is
tied; rna-seq counts always tie on zero, so every run takes the normal approximation. Its tie
correction shrinks sigma as the tied block grows, and for a gene that is zero in nearly every sample
-- a Y gene in a 99% female cohort, say -- that inflates z far past what the group sizes can
actually support (observed: p = 1e-81 from 14 vs 1356, where the exact test floor is 1e-33).
20 is the conventional floor for the normal approximation; the tie inflation is worse.
ponytail: gated on group size alone, which catches the case that motivated it. Catching a
tie-dominated gene in an otherwise well-sized cohort needs per-gene tie counts back from rust. */
const MIN_WILCOXON_GROUP_SIZE = 20

export class Volcano extends PlotBase implements RxComponent {
	static type = 'volcano'
	type: string
	components: { controls: any }
	dom: VolcanoDom
	interactions?: VolcanoInteractions
	model!: VolcanoModel
	view!: VolcanoPlotView
	termType: string

	constructor(opts: VolcanoOpts, api: ComponentApi) {
		super(opts, api)
		if (this.opts.parentId) this.parentId = this.opts.parentId
		this.type = Volcano.type
		this.components = {
			controls: {}
		}

		this.termType = opts.termType
		const holder = opts.holder
			.classed('sjpp-volcano-main', true)
			.attr('data-testid', `sjpp-volcano-main-${opts.termType}`)
		//Either allow a node to be passed or create a new div
		const controls = typeof opts.controls == 'object' ? opts.controls : holder || (holder as any).append('div')
		const error = opts.holder
			.append('div')
			.attr('id', 'sjpp-volcano-error')
			.attr('data-testid', `sjpp-volcano-error-${opts.termType}`)
			.style('opacity', 0.75) as any
		this.dom = {
			holder,
			controls,
			error,
			wait: holder
				.append('div')
				.attr('id', 'sjpp-volcano-wait')
				.attr('data-testid', `sjpp-volcano-wait-${opts.termType}`)
				.style('opacity', 0.75)
				.style('padding', '20px')
				.text('Loading...') as any,
			tip: new Menu({ padding: '' }),
			actionsTip: new Menu({ padding: '' })
		}
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) {
			throw new Error(
				`No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
			)
		}
		const parentConfig: any = this.parentId && appState.plots.find(p => p.id === this.parentId)
		const termfilter = getCombinedTermFilter(appState, config.filter || parentConfig?.filter)

		return {
			config: Object.assign({}, config, {
				settings: {
					volcano: config.settings.volcano
				}
			}),
			termfilter
		}
	}

	async setControls() {
		const plotConfig = this.app.getState().plots.find((p: any) => p.id === this.id)
		const controls = new VolcanoControlInputs(
			plotConfig,
			this.termType,
			this.app.vocabApi.termdbConfig?.queries?.dnaMethylation?.elementTypes
		)

		this.components.controls = await controlsInit({
			app: this.app,
			id: this.id,
			holder: this.dom.controls.style('display', 'inline-block'),
			inputs: controls.inputs
		})

		this.components.controls.on('downloadClick.volcano', () => this.interactions!.download(this.termType))
		if (plotConfig.chartType == 'differentialAnalysis')
			this.components.controls.on('helpClick.differentialAnalysis', () =>
				//Opens the page for the differential analysis wiki
				//Can't put in parent as DA does not have a controls component
				window.open('https://github.com/stjude/proteinpaint/wiki/Differential-analysis')
			)
	}

	async init() {
		this.interactions = new VolcanoInteractions(this.app, this.id, this.dom)
		this.model = new VolcanoModel(this, this.termType)
		this.view = new VolcanoPlotView(this.dom, this.interactions, this.termType)
		await this.setControls()
	}

	async main() {
		if (!this.interactions) throw new Error('Volcano Interactions not initialized')
		if (!this.model) throw new Error('Volcano Model not initialized')
		if (!this.view) throw new Error('Volcano View not initialized')

		const config = structuredClone(this.state.config)
		//TODO: Fix this to use parentId instead
		if (config.chartType != this.type && config.childType != this.type) return

		const settings = config.settings.volcano
		try {
			//Only show Loading for data requests that take longer than 500ms
			const showWait = setTimeout(() => {
				this.dom.wait.style('display', 'block')
			}, 500)

			/** Fetch data */
			const response = await this.model.getData(config, settings)
			this.dom.error.text('')
			if (!response || response.error || !response.data || !response.data.volcanoPng || !response.data.totalRows) {
				const msg = response?.error || 'No data returned from server'
				if (response?.code === 'CACHE_BUSY') {
					if (window.confirm(msg)) this.main()
				} else sayerror(this.dom.error, msg)
				clearTimeout(showWait)
				this.dom.wait.style('display', 'none')
				return
			}

			/** Format response into an object for rendering */
			const viewModel = new VolcanoViewModel(config, response, settings)
			//Pass table data for downloading
			this.interactions.pValueTableData = viewModel.viewData.pValueTableData
			this.interactions.data = response.data.dots
			//pre-cap count, so the download knows whether the on-screen rows are a subset
			this.interactions.totalSignificantRows = response.data.totalSignificantRows
			//groups, sample sizes and settings, so a downloaded table records how it was produced
			this.interactions.provenance = viewModel.viewData.provenance
			/* Lets the download write every significant row while the interactive table keeps only
			the most-significant maxInteractiveDots (the dot overlay does not scale past that).
			maxInteractiveDots null tells renderVolcano to keep them all; it is not part of the DA
			cache key, so this re-uses the cached analysis and only re-renders. Rebuilt on each
			response so it closes over the current config/settings rather than a stale pair. */
			this.interactions.fetchAllRows = async () => {
				const full = await this.model!.getData(config, { ...settings, maxInteractiveDots: null })
				if (!full || full.error || !full.data?.dots) throw new Error(full?.error || 'no rows returned')
				return new VolcanoViewModel(config, full, settings).viewData.pValueTableData
			}

			/** Render formatted data */
			this.view.render(settings, viewModel.viewData)

			/* Non-fatal notes on how to read the result. Both can apply at once, so they are collected
			and shown together rather than one overwriting the other. */
			const notes: string[] = []
			if (!response.data.dots.length) notes.push('No points passed the significance thresholds.')
			const smallestGroup = Math.min(response.sample_size1, response.sample_size2)
			if (settings.method == 'wilcoxon' && smallestGroup < MIN_WILCOXON_GROUP_SIZE) {
				// gdc users are the most likely readers of this sentence, and gdc calls them cases
				const samplesLabel = uiLabel(this.app.vocabApi.termdbConfig?.uiLabels, 'samples', 'samples')
				notes.push(
					`The smaller group has ${smallestGroup.toLocaleString()} ${samplesLabel}. Wilcoxon p-values are ` +
						`approximated here, and a gene that is zero in most ${samplesLabel} can be assigned a p-value far ` +
						`smaller than its group sizes can support. Rank these results by fold change rather than by ` +
						`p-value magnitude, and do not compare the p-values against another analysis.`
				)
			}
			if (notes.length) this.dom.error.text(notes.join(' ')).style('color', '#555')

			clearTimeout(showWait)
			this.dom.wait.style('display', 'none')
		} catch (e: any) {
			if (e instanceof Error) console.error(e.message || e)
			else if (e.stack) console.log(e.stack)
			throw e
		}
	}
}

export const volcanoInit = getCompInit(Volcano)
export const componentInit = volcanoInit

export async function getPlotConfig(opts: any, app: AppApi) {
	if (!opts.termType) throw new Error('.termType is required')

	const config = {
		settings: {
			// app is passed through so the defaults can read the dataset's preferred starting
			// element class from termdbConfig; opts alone does not carry it
			volcano: getDefaultVolcanoSettings(opts.overrides, { ...opts, app })
		},
		highlightedData: opts.highlightedData || [],
		termType: opts.termType
	}

	//Define Gene Expression and DNA Methylation config. Both run confounder-adjusted
	//two-group analyses off a samplelst, so both need their confounder tws filled here
	//-- otherwise a session rehydrated with confounders already set carries unfilled tws.
	if (opts.termType == GENE_EXPRESSION || opts.termType == DNA_METHYLATION) {
		if (opts.confounderTws) {
			try {
				for (const tw of opts.confounderTws) {
					await fillTermWrapper(tw, app.vocabApi)
				}
			} catch (e: any) {
				console.error(e.message || e)
				throw new Error(`Volcano getPlotConfig() failed to fill confounder term wrappers: ${e}`)
			}
		}
		Object.assign(config, {
			confounderTws: opts.confounderTws || [],
			samplelst: opts.samplelst
		})
	}

	//Define Single Cell Cell Type config
	if (opts.termType == SINGLECELL_CELLTYPE) {
		Object.assign(config, {
			//TODO: Fix this logic
			sample: opts.experimentID || opts.sample || opts.samples?.[0]?.experiments[0]?.experimentID,
			termId: app.vocabApi.termdbConfig.queries.singleCell.DEgenes.termId,
			//TODO: 'Cluster' is a fallback for development
			//Should require opts.categoryName in the future
			categoryName: opts.categoryName || 'Cluster'
		})
	}

	//Validate user submitted unavailable/inappropriate settings
	validateVolcanoSettings(config, opts)

	return copyMerge(config, opts)
}
