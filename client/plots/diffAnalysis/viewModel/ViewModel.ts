import type {
	DiffAnalysisDom,
	DiffAnalysisViewData,
	DiffAnalysisPlotConfig,
	DiffAnalysisSettings
} from '../DiffAnalysisTypes'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'

//TODO: Add types
export class ViewModel {
	viewData: DiffAnalysisViewData
	response: any
	pValueCutoff: number
	pValueTable: any
	settings: DiffAnalysisSettings
	type: string
	numSignificant = 0
	numNonSignificant = 0
	minLogFoldChange = 0
	maxLogFoldChange = 0
	minLogPValue = 0
	maxLogPValue = 0
	readonly plotHeight = 400 //TODO: May change this to a settings control
	readonly plotWidth = 400 //TODO: May change this to a settings control
	readonly bottomPad = 60
	readonly horizPad = 70
	readonly topPad = 40
	constructor(config: DiffAnalysisPlotConfig, dom: DiffAnalysisDom, response: any, settings: DiffAnalysisSettings) {
		this.response = response
		this.pValueCutoff = -Math.log10(settings.pValue)
		this.pValueTable = {
			columns: [
				{ label: 'log2 Fold change' },
				{ label: 'Original p-value (linear scale)' },
				{ label: 'Adjusted p-value (linear scale)' }
			],
			rows: []
		}
		this.settings = settings
		this.type = 'genes' //Eventually this will be other types (e.g. 'mutations', 'proteins', etc.)

		this.setMinMaxValues()

		this.viewData = {
			legendData: this.setLegendData(config)
		}
	}

	setMinMaxValues() {
		for (const d of this.response.data) {
			this.minLogFoldChange = Math.min(this.minLogFoldChange, d.fold_change)
			this.maxLogFoldChange = Math.max(this.maxLogFoldChange, d.fold_change)
			if (d.adjusted_p_value != 0) {
				this.minLogPValue = Math.min(this.minLogPValue, d.adjusted_p_value)
				this.maxLogPValue = Math.max(this.maxLogPValue, d.adjusted_p_value)
			}
		}
	}

	setPlotDimensions() {
		const xScale = scaleLinear().domain([this.minLogFoldChange, this.maxLogFoldChange]).range([0, this.plotWidth])
		const yScale = scaleLinear().domain([this.minLogPValue, this.maxLogPValue]).range([this.plotHeight, 0])
		return {
			svg: {
				height: this.plotHeight + this.topPad + this.bottomPad,
				width: this.plotWidth + this.horizPad * 2
			},
			xScale: {
				scale: xScale
				// x: ,
				// y
			},
			xAxisLabel: {
				// x: ,
				// y
			},
			yScale: {
				scale: yScale
				// x: ,
				// y
			},
			yAxisLabel: {
				text: `-log10(${this.settings.pValueType} P value)`
				// x: ,
				// y
			},
			logFoldChangeLine: {
				x1: xScale(0),
				x2: xScale(0),
				y: this.plotHeight
			}
		}
	}

	setPointData() {
		//radius
		//x
		//y
		//tooltip data
		for (const d of this.response.data) {
			const significant = this.isSignificant(d)
			if (significant) {
				d.color = 'red'
				this.numSignificant++
				const row = [
					{ value: roundValueAuto(d.fold_change) },
					{ value: roundValueAuto(Math.pow(10, -d.original_p_value)) },
					{ value: roundValueAuto(Math.pow(10, -d.adjusted_p_value)) }
				]
				if (this.type == 'genes') {
					row.splice(1, 0, { value: d.gene_name }, { value: d.gene_symbol })
				}
				this.pValueTable.rows.push(row)
			} else {
				d.color = 'black'
				this.numNonSignificant++
			}
		}
	}

	isSignificant(d: any) {
		return (
			d[`${this.settings.pValueType}_p_value`] > this.pValueCutoff &&
			Math.abs(d.fold_change) > this.settings.foldChangeCutoff
		)
	}

	setLegendData(config: any) {
		const tableRows = [
			{
				label: `Percentage of significant ${this.type}`,
				value: roundValueAuto((this.numSignificant * 100) / (this.numSignificant + this.numNonSignificant))
			},
			{
				label: `Number of significant ${this.type}`,
				value: this.numSignificant
			},
			{
				label: `Number of total ${this.type}`,
				value: this.numSignificant + this.numNonSignificant
			},
			{
				label: config.samplelst.groups[0].name + ' sample size (control group)',
				value: this.response.sample_size1
			},
			{
				label: config.samplelst.groups[1].name + ' sample size (case group)',
				value: this.response.sample_size2
			}
		]

		if (this.type == 'genes') {
			tableRows.push({
				label: 'Number of variable genes used in parametric differential analysis',
				value: this.settings.varGenesCutoff
			})
		}

		return tableRows
	}

	setPTableData() {
		if (this.type == 'genes') {
			this.pValueTable.columns.splice(1, 0, { label: 'Gene Name' }, { label: 'Gene Symbol' })
		}

		const foldChangeIdx = this.pValueTable.columns.findIndex(c => c.label.includes('Fold change'))
		this.pValueTable.rows.sort((a, b) => a[foldChangeIdx].value - b[foldChangeIdx].value).reverse()
	}
}
