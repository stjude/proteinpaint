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
import { getSampleNum } from '../Volcano'

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
	//Used for the y axis domain
	minLogPValue = 0
	maxLogPValue = 0
	//Used in place of 0 p values that cannot be log transformed
	minNonZeroPValue = 10e-10
	readonly offset = 10
	readonly bottomPad = 60
	readonly horizPad = 70
	readonly topPad = 40
	constructor(config: VolcanoPlotConfig, response: DEResponse, settings: VolcanoSettings) {
		this.config = config
		this.response = response
		this.pValueCutoff = -Math.log10(settings.pValue)

		const controlColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[0].name]?.color
		const caseColor = (this.config.tw?.term?.values as any)?.[this.config.samplelst.groups[1].name].color

		//Set colors equal to the groups colors if present
		const barplot = caseColor && controlColor ? { colorNegative: controlColor, colorPositive: caseColor } : {}

		this.pValueTable = {
			columns: [
				{ label: 'log2(Fold change)', barplot, sortable: true },
				{ label: 'Original p-value', sortable: true },
				{ label: 'Adjusted p-value', sortable: true }
			],
			rows: [],
			height: settings.height + this.topPad
		}
		this.settings = settings
		this.termType = config.termType
		this.dataType = this.setDataType()

		this.setMinMaxValues()

		const plotDim = this.setPlotDimensions()
		this.setPTableColumns()
		const pointData = this.setPointData(plotDim, controlColor, caseColor)
		//Get all rows data for the pValueTable in setPointsData, then sort by fold change
		const foldChangeIdx = this.pValueTable.columns.findIndex(c => c.label.includes('log2(Fold change)'))
		this.pValueTable.rows.sort((a: any, b: any) => b[foldChangeIdx].value - a[foldChangeIdx].value)

		this.viewData = {
			plotDim,
			pointData,
			statsData: this.setStatsData(),
			pValueTableData: this.pValueTable,
			images: response.images || [],
			userActions: this.setUserActions()
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
			if (d[`${this.settings.pValueType}_p_value`] != 0) {
				this.minLogPValue = Math.min(this.minLogPValue, -Math.log10(d[`${this.settings.pValueType}_p_value`]))
				this.maxLogPValue = Math.max(this.maxLogPValue, -Math.log10(d[`${this.settings.pValueType}_p_value`]))
				this.minNonZeroPValue = Math.min(this.minNonZeroPValue, d[`${this.settings.pValueType}_p_value`])
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

	setPointData(plotDim: VolcanoPlotDimensions, controlColor: string, caseColor: string) {
		const radius = Math.max(this.settings.width, this.settings.height) / 80
		const dataCopy: any = structuredClone(this.response.data)
		for (const d of dataCopy) {
			d.highlighted = this.config.highlightedData.includes(d.gene_symbol)
			const significant = this.isSignificant(d)
			this.getGenesColor(d, significant, controlColor, caseColor)
			if (significant) {
				this.numSignificant++
				const row = [
					{ value: roundValueAuto(d.fold_change) },
					{ value: roundValueAuto(d.original_p_value) },
					{ value: roundValueAuto(d.adjusted_p_value) }
				]
				if (this.dataType == 'genes') {
					row.splice(0, 0, { value: d.gene_symbol })
				}
				this.pValueTable.rows.push(row)
			} else {
				this.numNonSignificant++
			}
			d.x = plotDim.xScale.scale(d.fold_change) + this.horizPad + this.offset * 2
			const y =
				d[`${this.settings.pValueType}_p_value`] == 0 ? this.minNonZeroPValue : d[`${this.settings.pValueType}_p_value`]
			d.y = plotDim.yScale.scale(-Math.log10(y)) + this.topPad - this.offset
			d.radius = radius
		}
		//Sort so the highlighted points appear on top
		dataCopy.sort((a: any, b: any) => a.highlighted - b.highlighted)
		return dataCopy
	}

	isSignificant(d: DataPointEntry) {
		return (
			-Math.log10(d[`${this.settings.pValueType}_p_value`]) > this.pValueCutoff &&
			Math.abs(d.fold_change) > this.settings.foldChangeCutoff
		)
	}

	getGenesColor(d: DataPointEntry, significant: boolean, controlColor: string, caseColor: string) {
		if (this.termType != 'geneExpression') return
		if (!d.gene_symbol) throw `Missing gene_symbol in data: ${JSON.stringify(d)} [VolcanoViewModel getGenesColor()]`
		if (significant) {
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

	setPTableColumns() {
		if (this.termType == 'geneExpression') {
			this.pValueTable.columns.splice(0, 0, { label: 'Gene Symbol', sortable: true })
		}
	}

	setUserActions() {
		const userActions = {
			noShow: [] as string[]
		}
		if (this.termType == 'geneExpression') {
			if (this.settings.method == 'edgeR' && getSampleNum(this.config) > 100) {
				userActions.noShow.push('Confounding factors')
			}
		}
		return userActions
	}
}
