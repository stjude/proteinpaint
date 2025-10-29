import type {
	VolcanoPlotDimensions,
	VolcanoPlotConfig,
	VolcanoPValueTableData,
	VolcanoViewData,
	DataPointEntry
} from '../VolcanoTypes'
import type { ValidatedVolcanoSettings } from '../settings/Settings'
import type { DEResponse } from '#types'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSampleNum } from '../settings/defaults'
import { TermTypes } from '#shared/terms.js'

export class VolcanoViewModel {
	config: any
	dataType: string
	response: DEResponse
	pValueCutoff: number
	pValueTable: VolcanoPValueTableData
	settings: any
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
	//The x coord flush with the left side of the plot
	plotX: number
	readonly offset = 10
	readonly bottomPad = 60
	readonly horizPad = 70
	readonly topPad = 40
	constructor(config: VolcanoPlotConfig, response: DEResponse, settings: ValidatedVolcanoSettings) {
		this.config = config
		this.response = response
		this.pValueCutoff = settings.pValue
		this.plotX = this.horizPad + this.offset * 2

		const controlColor = this.config.tw?.term?.values?.[this.config.samplelst.groups[0].name]?.color || 'red'
		const caseColor = this.config.tw?.term?.values?.[this.config.samplelst.groups[1].name].color || 'blue'

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
			termInfo: this.setTermInfo(plotDim),
			plotDim,
			pointData,
			pValueTableData: this.pValueTable,
			statsData: this.setStatsData(),
			userActions: this.setUserActions()
		}
	}

	setDataType() {
		if (this.termType == TermTypes.GENE_EXPRESSION) return 'genes'
		else if (this.termType == TermTypes.SINGLECELL_CELLTYPE) return 'cells'
		else throw new Error(`Unknown termType: ${this.termType}`)
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
				x: this.plotX,
				y: 5
			},
			xAxisLabel: {
				x: this.horizPad + this.settings.width / 2 + this.offset,
				y: this.topPad + this.settings.height + this.bottomPad + this.offset
			},
			xScale: {
				scale: xScale,
				x: this.plotX,
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
				x: this.plotX,
				y: this.topPad
			},
			logFoldChangeLine: {
				x: xScale(0) + this.plotX,
				y1: this.topPad,
				y2: this.settings.height + this.offset * 4
			}
		}
	}

	setTermInfo(
		plotDim: VolcanoPlotDimensions
		// caseColor: string,
		// controlColor: string
	) {
		if (this.termType != TermTypes.GENE_EXPRESSION) return
		const getLabel = (name: string) => {
			if (name.length >= 25) return name.substring(0, 20) + '...'
			return name
		}

		return {
			//Set slightly above the plot
			y: plotDim.top.y + 10,
			first: {
				// color: controlColor || this.settings.defaultSignColor,
				label: getLabel(`${this.config.samplelst.groups[0].name} (${this.response.sample_size1})`),
				x: 0
				// rectX: this.settings.width/2 - 10,
			},
			second: {
				// color: caseColor || this.settings.defaultSignColor,
				label: getLabel(`${this.config.samplelst.groups[1].name} (${this.response.sample_size2})`),
				x: this.settings.width
				// rectX: this.settings.width/2 + 10,
			}
		}
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
			d.x = plotDim.xScale.scale(d.fold_change) + this.plotX
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
		if (this.termType != TermTypes.GENE_EXPRESSION) return
		if (!d.gene_name) throw new Error(`Missing gene_name in data: ${JSON.stringify(d)}`)
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

		if (this.response.bcv !== undefined && this.response.bcv !== null) {
			tableRows.push({
				label: 'Biological coefficient of variation',
				value: roundValueAuto(this.response.bcv)
			})
		}
		return tableRows
	}

	setPTableColumns() {
		if (this.termType == TermTypes.GENE_EXPRESSION) {
			this.pValueTable.columns.splice(0, 0, { label: 'Gene Name', sortable: true })
		}
	}

	setUserActions() {
		const userActions = {
			noShow: new Set<string>()
		}
		if (this.termType == TermTypes.GENE_EXPRESSION) {
			if (this.settings.method == 'edgeR' && getSampleNum(this.config) > 100) {
				userActions.noShow.add('Confounding factors')
			}
			if (this.settings.method == 'wilcoxon') userActions.noShow.add('Confounding factors')
		}
		return userActions
	}
}
