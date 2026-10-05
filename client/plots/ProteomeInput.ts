import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { NumericModes } from '#shared/terms.js'
import { sayerror, Menu } from '#dom'
import { TermTypeGroups } from '#shared/common.js'
import { getDefaultVolcanoSettings } from './volcano/settings/defaults.ts'
import { getDefaultGseaSettings } from './gsea/settings/defaults.ts'
import { dofetch3 } from '#common/dofetch'
import { PROTEOME_DAP, type ProteomeDetails, type DataQualityFigure } from '#types'
import { importPlot } from '#plots/importPlot.js'
import { axisBottom, axisLeft, scaleLinear } from 'd3'
import {
	makeTileGrid,
	makeTileCard,
	tileExpandState,
	renderTileError,
	renderPlaceholderTiles
} from './proteinView.tiles'

/*
ProteomeInput — the analysis tools for ONE sample set, laid out as
tile cards like the Protein View and the multi-sample-set comparison. Each card's face previews
the tool; clicking a card expands it in place to the full tool (the rest of the grid shifts
around it). The expanded volcano tile hosts the full differential analysis (volcano, GSEA) as a
child plot (parentId = this plot), so it lives inside the tile instead of its own sandbox. The
protein tools' plots open as new charts below, so this tool grid stays available.
*/

type InputTool = {
	key: string
	title: string
	subtitle: string
	isVisible: () => boolean
	/** when set and false, the tool is shown as a greyed placeholder card with this note */
	hasData?: () => boolean
	noDataNote?: string
	/** card face (compact preview / quick entry) */
	face: (holder: any) => void | Promise<void>
	/** the full tool shown when the card is expanded */
	expanded: (holder: any) => void | Promise<void>
}

// volcano tile face: PNG size and axis margins; w + left + right margins fit the 230px card content
const VOLCANO_FACE = { w: 174, h: 150 }
const VOLCANO_MARGIN = { top: 8, right: 12, bottom: 34, left: 44 }
// data quality: figure width in the expanded tile, and the thumbnail grid on the face
const QC_FIGURE_W = 460
const QC_THUMBS = 4
const QC_THUMB_W = 100
const UP_COLOR = '#b2182b'
const DOWN_COLOR = '#2166ac'

export class ProteomeInput extends PlotBase implements RxComponent {
	static type = 'ProteomeInput'

	type: string
	dom!: { [index: string]: any }
	tools!: InputTool[]
	/** key of the in-place expanded tool tile */
	expandedTileKey: string | null = null
	/** memoized DAP volcano response for the tile face */
	volcanoFace: Promise<any> | null = null
	/** the full differential analysis child plot, mounted into this persistent holder; the
	 *  expanded volcano tile re-attaches the holder, so collapsing keeps the analysis and
	 *  its settings alive */
	volcanoHolder: any = null
	volcanoComponent: any = null

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = ProteomeInput.type
		this.components = {}
	}

	getState(appState: any) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig,
			// the full differential analysis child plot; in state so its creation triggers main()
			volcanoSubplotId: appState.plots.find(
				(p: any) => p.parentId === this.id && p.chartType === 'differentialAnalysis'
			)?.id
		}
	}

	async init(appState: any) {
		const state = this.getState(appState)
		const proteomeDetails: ProteomeDetails = state.config.proteomeDetails
		const { organism, assay, cohort } = proteomeDetails
		const organisms = state.termdbConfig?.queries?.proteome?.organisms || {}
		const cohortConfig = organisms[organism]?.assays?.[assay]?.cohorts?.[cohort]

		this.dom = this.initDom(proteomeDetails)

		const activeCohort = state.activeCohort
		// the tile shows only when the dataset enables data quality
		const dq = state.termdbConfig?.queries?.proteome?.dataQuality
		const qcFigures: DataQualityFigure[] = cohortConfig?.qcFigures || []
		this.tools = [
			{
				key: 'volcano',
				title: 'DAP volcano',
				subtitle: 'Differentially abundant proteins, case vs control',
				isVisible: () => !!cohortConfig?.DAPfile,
				face: holder => this.renderVolcanoFace(holder, proteomeDetails),
				expanded: holder => this.renderVolcanoExpanded(holder, proteomeDetails)
			},
			{
				key: 'single',
				title: 'Single protein',
				subtitle: 'Abundance of one protein across samples',
				isVisible: () => true,
				face: holder => this.renderSingleProteinFace(holder, proteomeDetails),
				expanded: holder => this.renderSingleProtein(holder, proteomeDetails, activeCohort)
			},
			{
				key: 'two',
				title: 'Two proteins',
				subtitle: 'Abundance of one protein vs another',
				isVisible: () => true,
				face: holder => toolGlyph(holder, 'scatter', 'Pick two proteins to compare their abundance per sample.'),
				expanded: holder => this.renderTwoProteinSelect(holder, proteomeDetails)
			},
			{
				key: 'cluster',
				title: 'Hierarchical clustering',
				subtitle: 'Protein × sample abundance heatmap',
				isVisible: () => true,
				face: holder => toolGlyph(holder, 'cluster', 'Pick three or more proteins to cluster samples by abundance.'),
				expanded: holder => this.renderMultiProteinSelect(holder, proteomeDetails, activeCohort)
			},
			{
				key: 'dataQuality',
				title: 'Data quality',
				subtitle: 'QC figures provided for this sample set',
				isVisible: () => !!dq,
				hasData: () => qcFigures.length > 0,
				noDataNote: 'No data quality figures have been provided for this sample set yet',
				face: holder => renderQcFace(holder, qcFigures),
				expanded: holder => {
					if (dq.description)
						holder
							.append('div')
							.style('max-width', '900px')
							.style('margin-bottom', '12px')
							.style('color', '#555')
							.text(dq.description)
					renderQcFigures(holder, qcFigures, QC_FIGURE_W)
				}
			}
		]

		// config.expandedTile opens one tool on arrival (e.g. from the Data quality card)
		if (state.config.expandedTile) this.expandedTileKey = state.config.expandedTile
		const grid = makeTileGrid(this.dom.tiles)
		const missing: InputTool[] = []
		for (const tool of this.tools) {
			if (!tool.isVisible()) continue
			if (tool.hasData && !tool.hasData()) {
				missing.push(tool)
				continue
			}
			const face = makeTileCard(grid, {
				title: tool.title,
				subtitle: tool.subtitle,
				uniform: true,
				expand: { render: tool.expanded, ...tileExpandState(this, tool.key) }
			})
			try {
				const p = tool.face(face)
				if (p instanceof Promise) p.catch(err => renderTileError(face, err, this))
			} catch (err: any) {
				renderTileError(face, err, this)
			}
		}
		// data-first ordering, as in the Protein View: no-data placeholders after the live cards
		renderPlaceholderTiles(
			grid,
			missing.map(t => ({ title: t.title, note: t.noDataNote }))
		)
	}

	initDom(proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		this.opts.header.append('span').style('padding-right', '5px').text(`${organism} ${assay}: ${cohort}`)
		this.opts.header.append('span').text('PROTEOME').style('font-size', '0.7em').style('opacity', '0.6')

		return {
			tiles: this.opts.holder
				.append('div')
				.style('margin', '10px')
				.attr('data-testid', 'sjpp-proteome-input-tiles-wrapper')
		}
	}

	private getUsecase(proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		return {
			target: 'proteomeAbundance',
			detail: 'term',
			proteomeDetails: { organism, assay, cohort },
			label: `Organism: ${organism}; Assay: ${assay}; Sample set: ${cohort}`
		}
	}

	/** face: a quick protein search that opens the single-protein plot directly */
	renderSingleProteinFace(holder: any, proteomeDetails: ProteomeDetails) {
		toolGlyph(holder, 'violin', 'Search a protein to plot its abundance:')
		const row = holder.append('div').style('margin-top', '6px')
		this.addProteinSearchbox(row, proteomeDetails, (term: any) => this.launchSingleProtein(term, proteomeDetails), {
			width: '150px'
		})
	}

	launchSingleProtein(term: any, proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		const t = structuredClone(term.term || term)
		t.dataTypeDetails = { organism, assay, cohort }
		const config: any = {
			chartType: 'summary',
			term: { term: t, q: { mode: NumericModes.continuous } },
			assayCohortTitle: `${organism} ${assay}: ${cohort}`,
			proteomeDetails: { organism, assay, cohort }
		}
		const overlayTerm = this.getState(this.app.getState()).termdbConfig?.queries?.proteome?.organisms?.[organism]
			?.overlayTerm
		if (overlayTerm) config.term2 = { term: structuredClone(overlayTerm), q: {} }
		this.launchPlot(config)
	}

	async renderSingleProtein(holder: any, proteomeDetails: ProteomeDetails, activeCohort: number) {
		const row = holder.style('padding', '10px')
		row.append('div').style('padding', '5px').style('margin-bottom', '5px').text('Select a protein:')

		const treeHolder = row.append('div')
		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: this.app.vocabApi,
			holder: treeHolder,
			state: {
				activeCohort,
				nav: { header_mode: 'search_only' },
				tree: { usecase: this.getUsecase(proteomeDetails) }
			},
			tree: {
				click_term: (term: any) => this.launchSingleProtein(term, proteomeDetails)
			}
		})
	}

	private addProteinSearchbox(
		row: any,
		proteomeDetails: ProteomeDetails,
		onSelect: (term: any) => void,
		opts: { width?: string } = {}
	) {
		const usecase = this.getUsecase(proteomeDetails)
		const tip = new Menu({ padding: '0px' })
		const searchbox = row
			.append('input')
			.attr('type', 'search')
			.attr('placeholder', 'Protein')
			.attr('class', 'sja_genesearchinput')
			.style('width', opts.width || '200px')
		const mark = row.append('span').style('margin-left', '5px')
		const word = row.append('span').style('margin-left', '5px').style('font-size', '.8em').style('opacity', 0.6)

		let debounceTimer: ReturnType<typeof setTimeout>
		const doSearch = async () => {
			const v = searchbox.property('value').trim()
			if (v.length < 2) {
				tip.hide()
				return
			}
			try {
				const data = await this.app.vocabApi.findTerm(v, '', usecase, TermTypeGroups.PROTEOME_ABUNDANCE)
				if (!data.lst?.length) {
					mark.style('color', 'red').html('&cross;')
					word.text('No match')
					tip.hide()
				} else {
					tip.clear().showunder(searchbox.node())
					for (const term of data.lst) {
						tip.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.style('border-radius', '0px')
							.text(term.name)
							.on('click', () => {
								tip.hide()
								searchbox.property('value', term.name)
								mark.style('color', 'green').html('&check;')
								word.text(term.name)
								onSelect(term)
							})
					}
				}
			} catch (e: any) {
				mark.style('color', 'red').html('&cross;')
				word.text(e.message || 'Error')
			}
		}

		searchbox.on('keyup', async (event: any) => {
			if (event.key === 'Escape') {
				tip.hide()
				return
			}
			clearTimeout(debounceTimer)
			mark.html('')
			word.text('')
			debounceTimer = setTimeout(doSearch, 300)
		})

		return { searchbox, mark, word }
	}

	async renderTwoProteinSelect(holder: any, proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		holder.style('padding', '10px')
		let selectedTerm1: any = null
		let selectedTerm2: any = null

		const gene1row = holder.append('div').style('padding', '5px')
		const gene2row = holder.append('div').style('padding', '5px').style('display', 'none')
		const submitBtn = holder.append('button').attr('type', 'button').attr('disabled', true)

		gene1row.append('span').text('Select the first protein:')
		this.addProteinSearchbox(gene1row, proteomeDetails, (term: any) => {
			selectedTerm1 = term
			gene2row.style('display', 'block')
		})

		gene2row.append('span').text('Select the second protein:')
		this.addProteinSearchbox(gene2row, proteomeDetails, (term: any) => {
			selectedTerm2 = term
			submitBtn.attr('disabled', null)
		})

		submitBtn
			.text('Submit')
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.style('margin-top', '10px')
			.on('click', async () => {
				if (!selectedTerm1 || !selectedTerm2) {
					sayerror(holder, 'Please select two proteins.')
					return
				}
				const t1 = structuredClone(selectedTerm1)
				const t2 = structuredClone(selectedTerm2)
				t1.dataTypeDetails = { organism, assay, cohort }
				t2.dataTypeDetails = { organism, assay, cohort }
				await this.launchPlot({
					chartType: 'summary',
					term: { term: t1, q: { mode: NumericModes.continuous } },
					term2: { term: t2, q: { mode: NumericModes.continuous } },
					assayCohortTitle: `${organism} ${assay}: ${cohort}`,
					proteomeDetails: { organism, assay, cohort }
				})
			})
	}

	async renderMultiProteinSelect(holder: any, proteomeDetails: ProteomeDetails, activeCohort: number) {
		const { organism, assay, cohort } = proteomeDetails
		holder.style('padding', '10px')

		const usecase = this.getUsecase(proteomeDetails)
		const termdb = await import('../termdb/app')

		const treeHolder = holder.append('div')

		termdb.appInit({
			vocabApi: this.app.vocabApi,
			holder: treeHolder,
			state: {
				activeCohort,
				nav: { header_mode: 'search_only' },
				tree: { usecase }
			},
			tree: {
				submit_lst: (termlst: any[]) => {
					const twlst = termlst.map((term: any) => {
						const t = structuredClone(term)
						t.dataTypeDetails = { organism, assay, cohort }
						return { term: t, q: { mode: NumericModes.continuous } }
					})

					if (twlst.length < 3) {
						alert('At least three proteins are required for hierarchical clustering. Please select more proteins.')
						return
					}

					this.launchPlot({
						chartType: 'hierCluster',
						dataType: 'proteomeAbundance',
						termgroups: [{ name: 'Protein Abundance Cluster', lst: twlst, type: 'hierCluster' }],
						assayCohortTitle: `${organism} ${assay}: ${cohort}`,
						proteomeDetails: { organism, assay, cohort }
					})
				}
			}
		})

		const enforceMinAndLayout = () => {
			const submitBtn = treeHolder.select('button').node() as HTMLButtonElement | null
			if (submitBtn) {
				const selectedCount = treeHolder.selectAll('.sja_menuoption[aria-label="Click to delete"]').size()
				submitBtn.disabled = selectedCount < 3
			}

			const node = treeHolder.node() as HTMLElement
			const divs = node.querySelectorAll('div')
			for (const div of divs) {
				if (div.style.flexWrap === 'wrap' && div.style.display === 'inline-block') {
					div.style.display = 'flex'
				}
			}
		}
		const observer = new MutationObserver(enforceMinAndLayout)
		observer.observe(treeHolder.node(), {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style']
		})
	}

	/** tile-face DAP volcano: the server-rendered PNG of every protein, no interactive dots */
	getVolcanoFace(proteomeDetails: ProteomeDetails) {
		if (!this.volcanoFace) {
			const { organism, assay, cohort } = proteomeDetails
			const s = this.volcanoSettings()
			this.volcanoFace = dofetch3('termdb/dapVolcano', {
				body: {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					organism,
					assay,
					cohort,
					volcanoRender: {
						significanceThresholds: {
							pValueCutoff: s.pValue,
							pValueType: s.pValueType,
							foldChangeCutoff: s.foldChangeCutoff
						},
						pixelWidth: VOLCANO_FACE.w,
						pixelHeight: VOLCANO_FACE.h,
						dotRadius: Math.max(VOLCANO_FACE.w, VOLCANO_FACE.h) / 160,
						colorSignificantUp: UP_COLOR,
						colorSignificantDown: DOWN_COLOR,
						colorNonsignificant: '#9ca3af',
						maxInteractiveDots: 0,
						devicePixelRatio: Math.max(1, Math.min(window.devicePixelRatio || 1, 3))
					}
				}
			}).then(res => {
				if (res.error) throw res.error
				if (!res.data?.volcanoPng) throw 'No volcano data for this sample set'
				return res
			})
			// a failed request must not stay cached
			this.volcanoFace.catch(() => (this.volcanoFace = null))
		}
		return this.volcanoFace
	}

	volcanoSettings() {
		return { ...getDefaultVolcanoSettings({}, { termType: PROTEOME_DAP }), pValueType: 'original' as const }
	}

	/** PNG + axes */
	drawVolcano(holder: any, res: any) {
		const ext = res.data.plotExtent
		const m = VOLCANO_MARGIN
		const svg = holder
			.append('svg')
			.attr('width', ext.pixelWidth + m.left + m.right)
			.attr('height', ext.pixelHeight + m.top + m.bottom)
		const g = svg.append('g').attr('transform', `translate(${m.left},${m.top})`)
		g.append('image')
			.attr('href', `data:image/png;base64,${res.data.volcanoPng}`)
			.attr('width', ext.pixelWidth)
			.attr('height', ext.pixelHeight)
			.attr('preserveAspectRatio', 'none')
		const x = scaleLinear().domain([ext.xMin, ext.xMax]).range([0, ext.pixelWidth])
		const y = scaleLinear().domain([ext.yMin, ext.yMax]).range([ext.pixelHeight, 0])
		const xAxis = scaleLinear()
			.domain([ext.xMinUnpadded, ext.xMaxUnpadded])
			.range([x(ext.xMinUnpadded), x(ext.xMaxUnpadded)])
		const yAxis = scaleLinear()
			.domain([ext.yMinUnpadded, ext.yMaxUnpadded])
			.range([y(ext.yMinUnpadded), y(ext.yMaxUnpadded)])
		g.append('g')
			.attr('transform', `translate(0,${ext.pixelHeight})`)
			.call(axisBottom(xAxis).ticks(4) as any)
			.selectAll('text')
			.style('font-size', '8.5px')
		g.append('g')
			.call(axisLeft(yAxis).ticks(4) as any)
			.selectAll('text')
			.style('font-size', '8.5px')
		svg
			.append('text')
			.attr('x', m.left + ext.pixelWidth / 2)
			.attr('y', m.top + ext.pixelHeight + 30)
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.text('log2FC')
		svg
			.append('text')
			.attr('transform', `translate(11,${m.top + ext.pixelHeight / 2}) rotate(-90)`)
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.text('\u2212log\u2081\u2080(FDR)')
	}

	volcanoCountsLine(holder: any, res: any) {
		const d = res.data
		const line = holder.append('div').style('font-size', '.75em').style('color', '#374151').style('margin-top', '2px')
		line.append('span').style('color', UP_COLOR).text(`${d.totalSignificantUp} up`)
		line.append('span').text(' · ')
		line.append('span').style('color', DOWN_COLOR).text(`${d.totalSignificantDown} down`)
		line.append('span').style('color', '#6b7280').text(` of ${d.totalRows.toLocaleString()} proteins`)
	}

	async renderVolcanoFace(holder: any, proteomeDetails: ProteomeDetails) {
		const wait = holder.append('div').style('font-size', '.75em').style('color', '#9ca3af').text('Loading…')
		try {
			const res = await this.getVolcanoFace(proteomeDetails)
			wait.remove()
			this.drawVolcano(holder, res)
			this.volcanoCountsLine(holder, res)
			holder
				.append('div')
				.style('font-size', '.7em')
				.style('color', '#9ca3af')
				.text(`${res.sample_size2} case · ${res.sample_size1} control samples`)
		} catch (e: any) {
			wait.remove()
			throw e
		}
	}

	/** expanded volcano tile: the full differential analysis plot. Created as a child plot on
	 *  first expand; later expands re-attach the same live component. */
	async renderVolcanoExpanded(holder: any, proteomeDetails: ProteomeDetails) {
		if (!this.volcanoHolder) this.volcanoHolder = holder.append('div')
		else holder.node().appendChild(this.volcanoHolder.node())
		if (this.volcanoComponent) return
		if (this.getVolcanoSubplot()) {
			await this.mayMountVolcano()
			return
		}
		const { organism, assay, cohort } = proteomeDetails
		// main() mounts it once the store has the config
		await this.app.dispatch({
			type: 'plot_create',
			parentId: this.id,
			config: {
				chartType: 'differentialAnalysis',
				childType: 'volcano',
				parentId: this.id,
				termType: PROTEOME_DAP,
				headerText: `${organism} ${assay}: ${cohort}`,
				proteomeDetails: { organism, assay, cohort },
				settings: {
					volcano: this.volcanoSettings(),
					gsea: getDefaultGseaSettings({})
				},
				highlightedData: [],
				hidePlotFilter: true
			}
		})
	}

	getVolcanoSubplot() {
		const id = this.getState(this.app.getState()).volcanoSubplotId
		return id ? this.app.getState().plots.find((p: any) => p.id === id) : undefined
	}

	/** mount the differential analysis child plot into the volcano holder, only while the
	 *  holder is on the page (the volcano measures its layout) */
	async mayMountVolcano() {
		if (this.volcanoComponent || !this.volcanoHolder?.node()?.isConnected) return
		const subplot = this.getVolcanoSubplot()
		if (!subplot) return
		const { componentInit } = await importPlot(subplot.chartType)
		this.volcanoComponent = await componentInit({
			app: this.app,
			holder: this.volcanoHolder,
			id: subplot.id,
			parentId: this.id
		})
		// as a sub-component it gets later state updates (filters, its own setting edits);
		// the first render is forced here since mounting can happen outside a dispatch
		this.components.volcano = this.volcanoComponent
		await this.volcanoComponent.update({ appState: this.app.getState() })
	}

	/** open a tool's plot as a new chart; this tool grid stays so other tools remain one click away */
	async launchPlot(config: any) {
		await this.app.dispatch({ type: 'plot_create', config })
	}

	async main() {
		await this.mayMountVolcano()
	}
}

export const proteomeInputInit = getCompInit(ProteomeInput)
export const componentInit = proteomeInputInit

export function getPlotConfig(opts: any) {
	const config = {
		chartType: 'ProteomeInput',
		hidePlotFilter: true
	}
	return copyMerge(config, opts)
}

/** a small static glyph + hint for tool cards whose output needs a protein choice first */
function toolGlyph(holder: any, kind: 'violin' | 'scatter' | 'cluster', hint: string) {
	const W = 200,
		H = 110
	const svg = holder.append('svg').attr('width', W).attr('height', H).style('display', 'block')
	const g = svg.append('g')
	if (kind === 'violin') {
		for (const [cx, h, c] of [
			[60, 80, DOWN_COLOR],
			[140, 60, UP_COLOR]
		] as [number, number, string][]) {
			const top = (H - h) / 2
			g.append('path')
				.attr(
					'd',
					`M${cx},${top} C${cx + 28},${top + h * 0.35} ${cx + 22},${top + h * 0.8} ${cx},${top + h} ` +
						`C${cx - 22},${top + h * 0.8} ${cx - 28},${top + h * 0.35} ${cx},${top} Z`
				)
				.attr('fill', c)
				.attr('fill-opacity', 0.25)
				.attr('stroke', c)
			g.append('line')
				.attr('x1', cx - 10)
				.attr('x2', cx + 10)
				.attr('y1', top + h * 0.55)
				.attr('y2', top + h * 0.55)
				.attr('stroke', c)
				.attr('stroke-width', 2)
		}
	} else if (kind === 'scatter') {
		// deterministic pseudo-random cloud along a diagonal
		for (let i = 0; i < 40; i++) {
			const t = (i * 37) % 40
			const jitter = (((i * 53) % 17) - 8) * 2.2
			g.append('circle')
				.attr('cx', 20 + t * 4)
				.attr('cy', H - 12 - t * 2.1 + jitter)
				.attr('r', 2.6)
				.attr('fill', '#6b7280')
				.attr('fill-opacity', 0.55)
		}
		g.append('line')
			.attr('x1', 16)
			.attr('y1', H - 10)
			.attr('x2', 184)
			.attr('y2', 12)
			.attr('stroke', UP_COLOR)
	} else {
		// dendrogram over a mini heatmap
		const cols = 8,
			rows = 5,
			cw = 18,
			ch = 12,
			x0 = (W - cols * cw) / 2,
			y0 = 40
		const palette = [DOWN_COLOR, '#92c5de', '#f7f7f7', '#f4a582', UP_COLOR]
		for (let r = 0; r < rows; r++)
			for (let c = 0; c < cols; c++)
				g.append('rect')
					.attr('x', x0 + c * cw)
					.attr('y', y0 + r * ch)
					.attr('width', cw - 1)
					.attr('height', ch - 1)
					.attr('fill', palette[(r * 3 + c * 2 + (c > 3 ? 2 : 0)) % palette.length])
		const leaf = (c: number) => x0 + c * cw + cw / 2
		const link = (a: number, b: number, yTop: number, yA: number, yB: number) =>
			g.append('path').attr('d', `M${a},${yA} V${yTop} H${b} V${yB}`).attr('fill', 'none').attr('stroke', '#6b7280')
		for (let c = 0; c < cols; c += 2) link(leaf(c), leaf(c + 1), 30, y0, y0)
		link((leaf(0) + leaf(1)) / 2, (leaf(2) + leaf(3)) / 2, 20, 30, 30)
		link((leaf(4) + leaf(5)) / 2, (leaf(6) + leaf(7)) / 2, 20, 30, 30)
		link((leaf(0) + leaf(3)) / 2, (leaf(4) + leaf(7)) / 2, 8, 20, 20)
	}
	holder.append('div').style('font-size', '.75em').style('color', '#6b7280').style('margin-top', '4px').text(hint)
}

/** data quality face: up to QC_THUMBS figure thumbnails in a 2-column grid + the figure count */
function renderQcFace(holder: any, figures: DataQualityFigure[]) {
	const grid = holder
		.append('div')
		.style('display', 'grid')
		.style('grid-template-columns', `repeat(2, ${QC_THUMB_W}px)`)
		.style('gap', '6px')
		.style('margin-top', '4px')
	for (const fig of figures.slice(0, QC_THUMBS)) {
		const cell = grid
			.append('div')
			.attr('title', fig.title)
			.style('height', '78px')
			.style('overflow', 'hidden')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'center')
			.style('border', '1px solid #f3f4f6')
		loadQcFigure(cell, fig, '100%')
	}
	holder
		.append('div')
		.style('font-size', '.75em')
		.style('color', '#6b7280')
		.style('margin-top', '6px')
		.text(`${figures.length} QC figure${figures.length === 1 ? '' : 's'}`)
}

/** the figures of one sample set as a wrapping grid of captioned images, each `width` px wide */
function renderQcFigures(holder: any, figures: DataQualityFigure[], width: number) {
	const grid = holder.append('div').style('display', 'flex').style('flex-wrap', 'wrap').style('gap', '16px')
	for (const fig of figures) {
		const cell = grid.append('div').style('width', `${width}px`)
		cell.append('div').style('font-size', '0.9em').style('margin-bottom', '4px').text(fig.title)
		loadQcFigure(cell.append('div'), fig)
	}
}

/** load one figure into holder through the img route; each figure loads on its own, so one
 *  missing file only blanks its own cell */
function loadQcFigure(holder: any, fig: DataQualityFigure, maxHeight?: string) {
	holder.style('color', '#888').style('font-size', '0.85em').text('Loading…')
	dofetch3(`img?file=${encodeURIComponent(fig.file)}`)
		.then((img: any) => {
			if (!img || img.error) throw img?.error || 'no image'
			holder
				.text('')
				.append('img')
				.attr('src', img.src)
				.attr('alt', fig.title)
				.style('max-width', '100%')
				.style('max-height', maxHeight || null)
		})
		.catch((e: any) => {
			// the img route's error names the server file path; log it, don't show it
			console.error('dataQuality figure', fig.file, e)
			holder.text('Figure not available')
		})
}
