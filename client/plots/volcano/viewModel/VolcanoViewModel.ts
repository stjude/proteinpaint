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
		this.pValueCutoff = settings.pValue

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
			images: response.images || [],
			info: this.setTermInfo(plotDim, caseColor, controlColor),
			plotDim,
			pointData,
			pValueTableData: this.pValueTable,
			statsData: this.setStatsData(),
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
				//20 is for the term info above the plot
				height: this.settings.height + this.topPad + this.bottomPad * 2 + this.offset * 3,
				width: this.settings.width + this.horizPad * 2
			},
			top: {
				x: this.horizPad - this.offset * 3 + 5,
				y: 1
			},
			xAxisLabel: {
				x: this.horizPad + this.settings.width / 2 + this.offset,
				y: this.topPad + this.settings.height + this.bottomPad + this.offset
			},
			xScale: {
				scale: xScale,
				x: this.horizPad + this.offset * 2,
				y: this.settings.height + this.topPad + this.offset * 2
			},
			yAxisLabel: {
				text: `-log10(${this.settings.pValueType} P value)`,
				x: this.horizPad / 3,
				y: this.topPad + this.settings.height / 2
			},
			yScale: {
				scale: yScale,
				x: this.horizPad,
				y: this.topPad
			},
			plot: {
				height: this.settings.height,
				width: this.settings.width,
				x: this.horizPad + this.offset * 2,
				y: this.topPad
			},
			logFoldChangeLine: {
				x: xScale(0) + this.horizPad + this.offset * 2,
				y1: this.topPad,
				y2: this.settings.height + this.offset * 2
			}
		}
	}

	setTermInfo(plotDim, caseColor, controlColor) {
		return [
			{
				color: controlColor || this.settings.defaultSignColor,
				label: this.config.samplelst.groups[0].name,
				x: plotDim.top.x,
				y: plotDim.top.y
			},
			{
				color: caseColor || this.settings.defaultSignColor,
				label: this.config.samplelst.groups[1].name,
				x: plotDim.top.x,
				y: plotDim.top.y + 18
			}
		]
	}

	setPointData(plotDim: VolcanoPlotDimensions, controlColor: string, caseColor: string) {
		const radius = Math.max(this.settings.width, this.settings.height) / 80
		const dataCopy: any = structuredClone(this.response.data)
		for (const d of dataCopy) {
			d.highlighted = this.config.highlightedData.includes(d.gene_name)
			d.significant = this.isSignificant(d)
			this.getGenesColor(d, d.significant, controlColor, caseColor)
			if (d.significant) {
				this.numSignificant++
				const row = [
					{ value: roundValueAuto(d.fold_change) },
					{ value: roundValueAuto(d.original_p_value) },
					{ value: roundValueAuto(d.adjusted_p_value) }
				]
				if (this.dataType == 'genes') {
					row.splice(0, 0, { value: d.gene_name })
				}
				this.pValueTable.rows.push(row)
			} else {
				this.numNonSignificant++
			}
			d.x = plotDim.xScale.scale(d.fold_change) + this.horizPad + this.offset * 2
			const y =
				d[`${this.settings.pValueType}_p_value`] == 0 ? this.minNonZeroPValue : d[`${this.settings.pValueType}_p_value`]
			d.y = plotDim.yScale.scale(-Math.log10(y)) + this.topPad
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
		if (!d.gene_name) throw `Missing gene_name in data: ${JSON.stringify(d)} [VolcanoViewModel getGenesColor()]`
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
			this.pValueTable.columns.splice(0, 0, { label: 'Gene Name', sortable: true })
		}
	}

	setUserActions() {
		const userActions = {
			noShow: new Set<string>()
		}
		if (this.termType == 'geneExpression') {
			if (this.settings.method == 'edgeR' && getSampleNum(this.config) > 100) {
				userActions.noShow.add('Confounding factors')
			}
			if (this.settings.method == 'wilcoxon') userActions.noShow.add('Confounding factors')
		}
		return userActions
	}
}
