import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { PlotBase } from './PlotBase'
import { Menu, addGeneSearchbox } from '#dom'
import { dofetch3 } from '#common/dofetch'
import { scaleLinear } from 'd3'
import { loadBrainAssets, renderBrainSvg, type BrainAssets } from './brainRegions.svg'

const defaultConfig = {
	chartType: 'brainRegions'
}

const P_VALUE_THRESHOLD = 0.05
const NONSIG_COLOR = '#ccc'

const BRAIN_RENDER_W = 520

// Monotonic counter for unique <linearGradient> ids (Date.now() can collide when
// two legends render within the same millisecond).
let gradientSeq = 0

class BrainRegions extends PlotBase implements RxComponent {
	static type = 'brainRegions'
	type: string
	dom!: {
		holder: any
		body: any
		tip: Menu
		header?: any
	}

	constructor(opts: any, api) {
		super(opts, api)
		this.type = BrainRegions.type
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Brain Regional Proteome')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const gene = this.state.config?.gene
		if (!gene) throw new Error('brainRegions: gene is missing')

		if (this.dom.header) this.dom.header.text(`Brain Regional Proteome: ${gene}`)

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			gene
		}

		const data = await dofetch3('termdb/brainRegions', { body })
		if (data.error) throw data.error

		this.dom.body.selectAll('*').remove()

		// Intro paragraph (config-driven), styled like the gene-ranking description note.
		const description = this.app.vocabApi.termdbConfig?.queries?.proteome?.brainRegions?.description
		if (description) {
			this.dom.body
				.append('div')
				.style('font-size', '0.85em')
				.style('color', '#555')
				.style('margin-bottom', '10px')
				.style('line-height', '1.4')
				.style('max-width', '600px')
				.style('white-space', 'normal')
				.style('overflow-wrap', 'break-word')
				.text(description)
		}

		const isoformIds = Object.keys(data.isoforms)
		if (isoformIds.length === 0) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text(`No brain-region data found for gene "${gene}".`)
			return
		}

		const brainAssets = await loadBrainAssets(data.svgUrl, Object.keys(data.regions))

		const controlRow = this.dom.body.append('div').style('margin-bottom', '15px')
		controlRow.append('span').style('font-weight', 'bold').text('Isoform: ')

		const selectedIsoform = isoformIds[0]
		if (isoformIds.length > 1) {
			const sel = controlRow
				.append('select')
				.style('margin-left', '5px')
				.style('padding', '3px 6px')
				.on('change', () => {
					this.renderBrains(data, sel.node().value, brainAssets)
				})

			sel
				.selectAll('option')
				.data(isoformIds)
				.enter()
				.append('option')
				.attr('value', (d: string) => d)
				.text((d: string) => `${data.isoforms[d].gene_name} — ${d}`)
		} else {
			controlRow
				.append('span')
				.style('margin-left', '5px')
				.text(`${data.isoforms[selectedIsoform].gene_name} — ${selectedIsoform}`)
		}

		this.renderBrains(data, selectedIsoform, brainAssets)
	}

	renderBrains(data: any, selectedIsoform: string, brainAssets: BrainAssets) {
		const existing = this.dom.body.select('.sjpp-brain-regions-container')
		if (!existing.empty()) existing.remove()

		const container = this.dom.body
			.append('div')
			.attr('class', 'sjpp-brain-regions-container')
			.style('display', 'flex')
			.style('gap', '40px')
			.style('flex-wrap', 'wrap')

		const isoformData = data.isoforms[selectedIsoform]
		if (!isoformData) return

		const allFCs: number[] = []
		for (const disease of data.diseases) {
			const regionData = isoformData.data[disease] || {}
			for (const entry of Object.values(regionData) as any[]) {
				if (entry.p_value < P_VALUE_THRESHOLD) {
					allFCs.push(entry.fold_change)
				}
			}
		}

		const maxAbsFC = allFCs.length > 0 ? Math.max(...allFCs.map(v => Math.abs(v))) : 1
		const colorScale = scaleLinear<string>()
			.domain([-maxAbsFC, 0, maxAbsFC])
			.range(['#2166ac', '#f7f7f7', '#b2182b'])
			.clamp(true)

		for (const disease of data.diseases) {
			const regionData = isoformData.data[disease] || {}
			renderBrainSvg({
				holder: container,
				width: BRAIN_RENDER_W,
				templateUrl: data.templateUrl,
				assets: brainAssets,
				regions: data.regions,
				title: disease,
				tip: this.dom.tip,
				fillByRegion: (code: string) => {
					const entry = regionData[code]
					if (entry && entry.p_value < P_VALUE_THRESHOLD) return colorScale(entry.fold_change) as string
					return NONSIG_COLOR
				},
				tooltipByRegion: (code: string, label: string) => {
					const entry = regionData[code]
					if (!entry) return `${label} (${code})\nNo data`
					const fc = entry.fold_change.toFixed(4)
					const p = entry.p_value >= 0.0001 ? entry.p_value.toFixed(4) : entry.p_value.toExponential(3)
					return `${label} (${code})\nlog₂ fold change: ${fc}\np-value: ${p}`
				}
			})
		}

		this.renderLegend(container, colorScale, maxAbsFC)
	}

	renderLegend(container: any, colorScale: any, maxAbsFC: number) {
		const legendDiv = container
			.append('div')
			.style('display', 'flex')
			.style('flex-direction', 'column')
			.style('justify-content', 'center')
			.style('padding', '10px')

		legendDiv
			.append('div')
			.style('font-weight', 'bold')
			.style('font-size', '13px')
			.style('margin-bottom', '8px')
			.text('Fold Change (log₂)')

		const legendWidth = 20
		const legendHeight = 200
		const svg = legendDiv
			.append('svg')
			.attr('width', legendWidth + 60)
			.attr('height', legendHeight + 30)

		const defs = svg.append('defs')
		const gradientId = `brain-fc-gradient-${gradientSeq++}`
		const gradient = defs
			.append('linearGradient')
			.attr('id', gradientId)
			.attr('x1', '0')
			.attr('y1', '0')
			.attr('x2', '0')
			.attr('y2', '1')

		const steps = 10
		for (let i = 0; i <= steps; i++) {
			const t = i / steps
			const val = maxAbsFC * (1 - 2 * t)
			gradient
				.append('stop')
				.attr('offset', `${t * 100}%`)
				.attr('stop-color', colorScale(val))
		}

		svg
			.append('rect')
			.attr('x', 0)
			.attr('y', 10)
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.style('fill', `url(#${gradientId})`)
			.attr('stroke', '#999')

		const legendScale = scaleLinear()
			.domain([maxAbsFC, -maxAbsFC])
			.range([10, legendHeight + 10])

		const ticks = [-maxAbsFC, -maxAbsFC / 2, 0, maxAbsFC / 2, maxAbsFC]
		for (const tick of ticks) {
			const y = legendScale(tick)
			svg
				.append('line')
				.attr('x1', legendWidth)
				.attr('y1', y)
				.attr('x2', legendWidth + 5)
				.attr('y2', y)
				.attr('stroke', '#666')
			svg
				.append('text')
				.attr('x', legendWidth + 8)
				.attr('y', y)
				.attr('dominant-baseline', 'central')
				.attr('font-size', '10px')
				.text(tick.toFixed(2))
		}

		legendDiv
			.append('div')
			.style('margin-top', '10px')
			.style('font-size', '12px')
			.style('color', '#666')
			.html(
				`<span style="display:inline-block;width:14px;height:14px;background:${NONSIG_COLOR};border:1px solid #999;vertical-align:middle;margin-right:4px"></span> Not significant (p ≥ 0.05)`
			)
	}
}

export const componentInit = getCompInit(BrainRegions)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	if (!opts.gene) throw new Error('brainRegions requires opts.gene')
	return copyMerge(config, opts)
}

export function makeChartBtnMenu(holder: any, chartsInstance: any) {
	const row = holder.append('div').style('padding', '5px')
	row.append('span').style('font-weight', 'bold').text('Enter a gene name:')

	const geneSearch = addGeneSearchbox({
		row,
		genome: chartsInstance.app.opts.genome,
		tip: new Menu({ padding: '0px' }),
		searchOnly: 'gene',
		callback: async () => {
			if (!geneSearch.geneSymbol) throw new Error('A valid gene selection is required')
			chartsInstance.dom.tip.hide()
			chartsInstance.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'brainRegions',
					gene: geneSearch.geneSymbol
				}
			})
		}
	})
}
