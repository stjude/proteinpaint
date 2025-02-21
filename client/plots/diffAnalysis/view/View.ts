import type { MassAppApi } from '#mass/types/mass'
import { axisstyle } from '#src/client'
import { axisBottom, axisLeft } from 'd3-axis'
import { table2col, renderTable } from '#dom'
import { select } from 'd3-selection'
import type {
	DiffAnalysisDom,
	DiffAnalysisPlotDim,
	DiffAnalysisSettings,
	DiffAnalysisViewData,
	DataPointEntry
} from '../DiffAnalysisTypes'
import type { DiffAnalysisInteractions } from '../interactions/DiffAnalysisInteractions'
import { DataPointToolTip } from './DataPointToolTip'
import { gseaMenu } from './GSEAMenu'

/** TODO: finish typing this file */
export class View {
	dom: DiffAnalysisDom
	interactions: DiffAnalysisInteractions
	viewData: DiffAnalysisViewData
	constructor(
		app: MassAppApi,
		dom: DiffAnalysisDom,
		interactions: DiffAnalysisInteractions,
		settings: DiffAnalysisSettings,
		viewData: DiffAnalysisViewData
	) {
		this.dom = dom
		this.interactions = interactions
		this.viewData = viewData

		this.interactions.clearDom()

		const plotDim = this.viewData.plotDim
		this.renderUserActions(app, settings)
		this.renderDom(plotDim)
		renderDataPoints(this)
		this.renderFoldChangeLine(plotDim)
		this.renderStatsTable()
		if (settings.showPValueTable) this.renderPValueTable()
	}

	renderUserActions(app, settings) {
		this.dom.actions.style('margin-left', '20px').style('padding', '5px')
		if (app.opts.genome.termdbs) {
			this.addActionButton('Launch gene set enrichment analysis', () =>
				gseaMenu(this.dom.tip, this.interactions, settings, this.viewData.pointData)
			)
		}
		this.addActionButton('Confounding factors', () => this.interactions.confoundersMenu())
		this.addActionButton('Genes', () => this.interactions.launchGeneSetEdit())
	}

	addActionButton(text: string, callback: any) {
		const button = this.dom.actions
			.append('button')
			.attr('class', 'sja_menuoption')
			.style('margin', '3px')
			.style('padding', '3px')
			.text(text)
			.on('click', () => {
				this.dom.tip.clear().showunder(button.node())
				callback()
			})
	}

	renderDom(plotDim: DiffAnalysisPlotDim) {
		this.dom.svg.attr('width', plotDim.svg.width).attr('height', plotDim.svg.height)

		this.dom.yAxisLabel
			.attr('transform', `translate(${plotDim.yAxisLabel.x}, ${plotDim.yAxisLabel.y}) rotate(-90)`)
			.text(plotDim.yAxisLabel.text)

		this.dom.xAxisLabel
			.attr('transform', `translate(${plotDim.xAxisLabel.x}, ${plotDim.xAxisLabel.y})`)
			.text('log2(fold change)')

		this.renderScale(plotDim.xScale)
		this.renderScale(plotDim.yScale, true)

		this.dom.plot
			.append('rect')
			.attr('width', plotDim.plot.width)
			.attr('height', plotDim.plot.height)
			.attr('stroke', '#ededed')
			.attr('fill', 'transparent')
			.attr('shape-rendering', 'crispEdges')
			.attr('transform', `translate(${plotDim.plot.x}, ${plotDim.plot.y})`)
	}

	renderScale(scale: any, isLeft = false) {
		const scaleG = this.dom[isLeft ? 'yAxis' : 'xAxis']
			.append('g')
			.attr('transform', `translate(${scale.x}, ${scale.y})`)
			.call(isLeft ? axisLeft(scale.scale) : axisBottom(scale.scale))

		axisstyle({
			axis: scaleG,
			color: 'black',
			showline: true
		})
	}

	renderFoldChangeLine(plotDim: DiffAnalysisPlotDim) {
		//logFoldChangeLine
		this.dom.plot
			.append('line')
			.attr('stroke', '#ccc')
			.attr('shape-rendering', 'crispEdges')
			.attr('x1', plotDim.logFoldChangeLine.x)
			.attr('x2', plotDim.logFoldChangeLine.x)
			.attr('y1', plotDim.logFoldChangeLine.y1)
			.attr('y2', plotDim.logFoldChangeLine.y2)
	}

	renderStatsTable() {
		const statsData = this.viewData.statsData
		const holder = this.dom.div
			.append('div')
			.style('display', 'inline-block')
			.style('vertical-align', 'top')
			.style('margin-top', '50px')
		const table = table2col({ holder })
		for (const d of statsData) {
			const [td1, td2] = table.addRow()
			td1.text(d.label)
			td2.style('text-align', 'end').text(d.value)
		}
	}

	renderPValueTable() {
		const tableDiv = this.dom.div.append('div')
		renderTable({
			columns: this.viewData.pValueTableData.columns,
			rows: this.viewData.pValueTableData.rows,
			div: tableDiv.append('div'),
			showLines: true,
			maxHeight: '150vh',
			resize: true
		})
	}
}

function renderDataPoints(self) {
	self.dom.plot
		.selectAll('circle')
		.data(self.viewData.pointData)
		.enter()
		.append('circle')
		.attr('stroke', (d: DataPointEntry) => d.color)
		.attr('stroke-opacity', 0.2)
		.attr('stroke-width', 1)
		// orange-yellow fill shown on hover
		.attr('fill', (d: DataPointEntry) => (d.highlighted ? d.color : '#ffa200'))
		.attr('fill-opacity', (d: DataPointEntry) => (d.highlighted ? 0.9 : 0))
		.attr('cx', (d: DataPointEntry) => d.x)
		.attr('cy', (d: DataPointEntry) => d.y)
		.attr('r', (d: DataPointEntry) => d.radius)
		.each(function (this, d: DataPointEntry) {
			const circle = select(this)
			new DataPointToolTip(d, circle, self.dom.tip, self.interactions)
		})
}
