import type {
	VolcanoPlotDimensions,
	VolcanoPlotConfig,
	VolcanoPValueTableData,
	VolcanoSettings,
	VolcanoViewData,
	DataPointEntry
} from '../VolcanoTypes'
import type { DEResponse } from '#types'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'

/** TODO: Images should be reusable. Remove hardcoding */
export class VolcanoViewModel {
	config: VolcanoPlotConfig
	dataType: string
	response: DEResponse
	pValueCutoff: number
	pValueTable: VolcanoPValueTableData
	settings: VolcanoSettings
	termType: string
	viewData: VolcanoViewData
	numSignificant = 0
	numNonSignificant = 0
	minLogFoldChange = 0
	maxLogFoldChange = 0
	minLogPValue = 0
	maxLogPValue = 0
	readonly offset = 10
	readonly bottomPad = 60
	readonly horizPad = 70
	readonly topPad = 40
	constructor(config: VolcanoPlotConfig, response: DEResponse, settings: VolcanoSettings) {
		this.config = config
		this.response = response
		this.pValueCutoff = -Math.log10(settings.pValue)
		this.pValueTable = {
			columns: [
				{ label: 'log2 Fold change', sortable: true },
				{ label: 'Original p-value (linear scale)', sortable: true },
				{ label: 'Adjusted p-value (linear scale)', sortable: true }
			],
			rows: []
		}
		this.settings = settings
		this.termType = config.termType
		this.dataType = this.setDataType()

		this.setMinMaxValues()

		const plotDim = this.setPlotDimensions()
		this.setPTableData()

		this.viewData = {
			plotDim,
			pointData: this.setPointData(plotDim),
			statsData: this.setStatsData(),
			pValueTableData: this.pValueTable,
			images: response.images || []
		}
	}

	setDataType() {
		if (this.termType == 'geneExpression') return 'genes'
		else throw `Unknown termType: ${this.termType} [VolcanoViewModel setDataType()]`
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
		const xScale = scaleLinear().domain([this.minLogFoldChange, this.maxLogFoldChange]).range([0, this.settings.width])
		const yScale = scaleLinear().domain([this.minLogPValue, this.maxLogPValue]).range([this.settings.height, 0])
		return {
			svg: {
				height: this.settings.height + this.topPad + this.bottomPad * 2,
				width: this.settings.width + this.horizPad * 2
			},
			xAxisLabel: {
				x: this.horizPad + this.settings.width / 2 + this.offset,
				y: this.topPad + this.settings.height + this.bottomPad
			},
			xScale: {
				scale: xScale,
				x: this.horizPad + this.offset * 2,
				y: this.settings.height + this.topPad + this.offset
			},
			yAxisLabel: {
				text: `-log10(${this.settings.pValueType} P value)`,
				x: this.horizPad / 3,
				y: this.topPad + this.settings.height / 2 + this.offset
			},
			yScale: {
				scale: yScale,
				x: this.horizPad,
				y: this.topPad - this.offset
			},
			plot: {
				height: this.settings.height,
				width: this.settings.width,
				x: this.horizPad + this.offset * 2,
				y: this.topPad - this.offset
			},
			logFoldChangeLine: {
				x: xScale(0) + this.horizPad + this.offset * 2,
				y1: this.topPad - this.offset,
				y2: this.settings.height + this.offset * 3
			}
		}
	}

	setPointData(plotDim: VolcanoPlotDimensions) {
		const radius = Math.max(this.settings.width, this.settings.height) / 80
		const dataCopy: any = structuredClone(this.response.data)
		for (const d of dataCopy) {
			d.highlighted = this.config.highlightedData.includes(d.gene_symbol)
			const significant = this.isSignificant(d)
			this.getGenesColor(d, significant)
			if (significant) {
				this.numSignificant++
				const row = [
					{ value: roundValueAuto(d.fold_change) },
					{ value: roundValueAuto(Math.pow(10, -d.original_p_value)) },
					{ value: roundValueAuto(Math.pow(10, -d.adjusted_p_value)) }
				]
				if (this.dataType == 'genes') {
					row.splice(0, 0, { value: d.gene_name }, { value: d.gene_symbol })
				}
				this.pValueTable.rows.push(row)
			} else {
				this.numNonSignificant++
			}
			d.x = plotDim.xScale.scale(d.fold_change) + this.horizPad + this.offset * 2
			d.y = plotDim.yScale.scale(d[`${this.settings.pValueType}_p_value`]) + this.topPad - this.offset
			d.radius = radius
		}
		//Sort so the highlighted points appear on top
		dataCopy.sort((a: any, b: any) => a.highlighted - b.highlighted)
		return dataCopy
	}

	isSignificant(d: DataPointEntry) {
		return (
			d[`${this.settings.pValueType}_p_value`] > this.pValueCutoff &&
			Math.abs(d.fold_change) > this.settings.foldChangeCutoff
		)
	}

	getGenesColor(d: DataPointEntry, significant: boolean) {
		if (this.termType != 'geneExpression') return
		if (!d.gene_symbol) throw `Missing gene_symbol in data: ${JSON.stringify(d)} [VolcanoViewModel getGenesColor()]`
		if (significant) {
			const controlColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[0].name]?.color
			const caseColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[1].name].color
			if (controlColor && caseColor) d.color = d.fold_change > 0 ? caseColor : controlColor
			else d.color = this.settings.defaultSignColor
		} else d.color = this.settings.defaultNonSignColor
	}

	setStatsData() {
		const tableRows = [
			{
				label: `Percentage of significant ${this.dataType}`,
				value: roundValueAuto((this.numSignificant * 100) / (this.numSignificant + this.numNonSignificant))
			},
			{
				label: `Number of significant ${this.dataType}`,
				value: this.numSignificant
			},
			{
				label: `Number of total ${this.dataType}`,
				value: this.numSignificant + this.numNonSignificant
			},
			{
				label: this.config.samplelst.groups[0].name + ' sample size (control group)',
				value: this.response.sample_size1
			},
			{
				label: this.config.samplelst.groups[1].name + ' sample size (case group)',
				value: this.response.sample_size2
			}
		]
		return tableRows
	}

	setPTableData() {
		if (this.termType == 'geneExpression') {
			this.pValueTable.columns.splice(
				0,
				0,
				{ label: 'Gene Name', sortable: true },
				{ label: 'Gene Symbol', sortable: true }
			)
		}
		const foldChangeIdx = this.pValueTable.columns.findIndex(c => c.label.includes('Fold change'))
		this.pValueTable.rows.sort((a: any, b: any) => a[foldChangeIdx].value - b[foldChangeIdx].value).reverse()
	}
}
