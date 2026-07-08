import type { GSEA } from '../gsea'
import * as d3axis from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { renderTable, table2col, axisstyle, sayerror } from '#dom'
import { roundValueAuto } from '#shared/roundValue.js'

export class GSEAView {
	gsea: GSEA
	dom: any
	pathwayDropDown: any

	constructor(gsea: GSEA) {
		this.gsea = gsea
		this.dom = gsea.dom
	}

	initRender() {
		this.renderActions()
	}

	renderActions() {
		this.dom.actionsDiv
			.append('span')
			.attr('data-testid', 'sjpp-gsea-pathway')
			.style('margin-right', '10px')
			.style('display', 'inline-block')
			.text('Select a gene set group:')

		this.pathwayDropDown = this.dom.actionsDiv
			.append('select')
			.style('display', 'inline-block')
			.on('change', async () => {
				const value = this.pathwayDropDown.node().value
				const settings = structuredClone(this.gsea.state.config.settings.gsea)
				settings.pathway = value
				await this.gsea.app.dispatch({
					type: 'plot_edit',
					id: this.gsea.id,
					config: {
						//Need to clear the gsea_params completely
						gsea_params: {
							geneset_name: null,
							pathway: value
						},
						highlightGenes: [],
						settings: {
							gsea: settings
						}
					}
				})
			})
	}

	update() {
		const viewData = this.gsea.viewModel.viewData
		this.renderPathwayOptions(viewData.pathwayOpts)

		this.dom.detailsDiv.selectAll('*').remove()
		this.dom.holder.selectAll('*').remove()
		this.dom.tableDiv.selectAll('*').remove()

		if (viewData.error) {
			sayerror(this.dom.holder, viewData.error)
			return
		}

		if (!viewData.tableData) return

		this.renderStats(viewData.statsData)
		if (viewData.detailImage) this.renderImage(viewData.detailImage)
		if (viewData.cernoPlotData) this.renderCernoPlot(viewData.cernoPlotData)
		if (viewData.detailError) sayerror(this.dom.holder, viewData.detailError)
		if (viewData.showHighlightButton) this.renderHighlightButton()
		this.renderResultsTable(viewData)
	}

	renderPathwayOptions(pathwayOpts) {
		this.pathwayDropDown.selectAll('option').remove()
		this.pathwayDropDown
			.selectAll('option')
			.data(pathwayOpts)
			.enter()
			.append('option')
			.text(d => d.label)
			.property('value', d => d.value)
			.property('selected', d => d.selected)
	}

	renderStats(statsData) {
		const tableStats = table2col({ holder: this.dom.detailsDiv.attr('data-testid', 'sjpp-gsea-stats') })
		const [, countHeader] = tableStats.addRow()
		countHeader.style('text-align', 'center').style('font-size', '0.8em').style('opacity', '0.8').text('COUNT')

		for (const row of statsData) {
			const [labelCell, valueCell] = tableStats.addRow()
			labelCell.text(row.label)
			valueCell.style('text-align', 'end').text(row.value)
		}
	}

	renderImage(detailImage) {
		this.dom.holder.append('img').attr('width', detailImage.width).attr('height', detailImage.height).attr('src', detailImage.src)
	}

	renderHighlightButton() {
		this.dom.detailsDiv
			.append('button')
			.style('margin-left', '10px')
			.style('display', 'block')
			.attr('aria-label', 'Highlight genes in the volcano plot')
			.text('Highlight genes')
			.on('click', () => {
				this.gsea.app.dispatch({
					type: 'plot_edit',
					id: this.gsea.id,
					config: {
						childType: 'volcano',
						highlightedData: this.gsea.state.config.highlightGenes
					}
				})
			})
	}

	renderResultsTable(viewData) {
		const tableDiv = this.dom.tableDiv.append('div')
		renderTable({
			download: {
				fileName: this.gsea.state.config.downloadFilename || ''
			},
			columns: viewData.tableData.columns,
			rows: viewData.tableData.rows,
			div: tableDiv,
			showLines: true,
			maxHeight: '30vh',
			singleMode: true,
			resize: true,
			header: { allowSort: true },
			selectedRows: viewData.selectedRows,
			noButtonCallback: async index => {
				const rowItem = viewData.tableData.rowItems[index]
				const config: any = {
					gsea_params: {
						geneset_name: rowItem.genesetName
					}
				}
				if (this.gsea.state.config.chartType == 'differentialAnalysis' && rowItem.genes.length) {
					config.highlightGenes = rowItem.genes
				}
				await this.gsea.app.dispatch({
					type: 'plot_edit',
					id: this.gsea.id,
					config
				})
			}
		})
	}

	renderCernoPlot(cernoPlotData) {
		const holder = this.dom.holder
		const svgWidth = 400
		const svgHeight = 400
		const svg = holder.append('svg').attr('width', svgWidth).attr('height', svgHeight)
		const topPad = 20
		const rightPad = 5
		const xPad = 50
		const yPad = 100
		const yAxis = svg.append('g')
		const xAxis = svg.append('g')

		const xScale = scaleLinear().domain([0, cernoPlotData.rankedGenes.length]).range([xPad, svgWidth - rightPad])
		const yScale = scaleLinear().domain([100, 0]).range([topPad, svgHeight - yPad])

		yAxis.attr('transform', `translate(${xPad},0)`)
		xAxis.attr('transform', `translate(0,${svgHeight - yPad})`)

		svg
			.append('text')
			.text('Gene list')
			.attr('fill', 'black')
			.attr('text-anchor', 'start')
			.attr('transform', `translate(${xScale(cernoPlotData.rankedGenes.length / 3)},${svgHeight - yPad + 2 * topPad})`)

		svg
			.append('text')
			.text('Percentage of gene set')
			.attr('fill', 'black')
			.attr('text-anchor', 'middle')
			.attr('y', xPad / 2)
			.attr('x', -svgWidth / 2.5)
			.attr('transform', 'rotate(-90)')

		let fontSize = 30
		const title = svg
			.append('text')
			.text(cernoPlotData.genesetName)
			.attr('fill', 'black')
			.attr('text-anchor', 'start')
			.attr('font-size', `${fontSize}px`)
			.attr('transform', `translate(${xPad},${topPad / 2})`)

		let titleBox = title.node().getBBox()
		while (titleBox.width > svgWidth - xPad || titleBox.height > (topPad * 3.5) / 5) {
			fontSize -= 1
			title.node().setAttribute('font-size', `${fontSize}px`)
			titleBox = title.node().getBBox()
		}

		if (typeof cernoPlotData.auc === 'number') {
			const aucPos =
				cernoPlotData.auc >= 0.5
					? `${xScale((cernoPlotData.rankedGenes.length * 3) / 3.5)},${svgHeight - yPad * 1.5}`
					: `${xScale((cernoPlotData.rankedGenes.length * 0.8) / 4.5)},${svgHeight - yPad * 3}`
			svg
				.append('text')
				.text(`AUC=${roundValueAuto(cernoPlotData.auc)}`)
				.attr('fill', 'black')
				.attr('text-anchor', 'middle')
				.attr('transform', `translate(${aucPos})`)
		}

		axisstyle({
			axis: yAxis.call(d3axis.axisLeft(yScale)),
			color: 'black',
			showline: true,
			fontsize: '10'
		})
		axisstyle({
			axis: xAxis.call(d3axis.axisBottom(xScale)),
			color: 'black',
			showline: true,
			fontsize: '10'
		})

		const hitGenes = new Set(cernoPlotData.leadingEdgeGenes)
		const yIncrement = 100 / Math.max(hitGenes.size, 1)
		const lines = svg.append('g')
		let yIter = 100
		for (let index = 0; index < cernoPlotData.rankedGenes.length; index++) {
			const rankedGene = cernoPlotData.rankedGenes[index]
			const yOld = yIter
			if (hitGenes.has(rankedGene.gene)) {
				yIter -= yIncrement
				lines
					.append('line')
					.style('stroke', 'red')
					.attr('x1', xScale(index))
					.attr('y1', svgHeight)
					.attr('x2', xScale(index))
					.attr('y2', svgHeight - yPad + 2.5 * topPad)
			}
			lines
				.append('line')
				.style('stroke', 'red')
				.attr('x1', xScale(index))
				.attr('y1', yScale(100 - yOld))
				.attr('x2', xScale(index + 1))
				.attr('y2', yScale(100 - yIter))
		}
	}
}
