import type {
	VolcanoPlotDimensions,
	VolcanoPlotConfig,
	VolcanoPValueTableData,
	VolcanoViewData,
	DataPointEntry
} from '../VolcanoTypes'
import type { ValidatedVolcanoSettings } from '../settings/Settings'
import type { DEFullResponse } from '#types'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'
import { getSampleNum } from '../settings/defaults'
import { getGroupColors } from '../colors'
import { DNA_METHYLATION, GENE_EXPRESSION, SINGLECELL_CELLTYPE } from '#shared/terms.js'

export class VolcanoViewModel {
	config: any
	dataType: string
	response: DEFullResponse
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
	//Unpadded extents — used for the visible axis labels/ticks (only span real data)
	minLogFoldChangeAxis = 0
	maxLogFoldChangeAxis = 0
	minLogPValueAxis = 0
	maxLogPValueAxis = 0
	//Dot radius in pixels (from server) — overlay rings size to match the PNG
	dotRadiusPx = 2
	//Used in place of 0 p values that cannot be log transformed
	minNonZeroPValue = 10e-10
	//The x coord flush with the left side of the plot
	plotX: number
	readonly offset = 10
	readonly bottomPad = 60
	readonly horizPad = 70
	readonly topPad = 40
	/** Interactive rows returned by the server: threshold-passing dots, sorted by
	 * significance. The full scatter lives in `response.volcanoPng`. */
	dataRows: DataPointEntry[]

	constructor(config: VolcanoPlotConfig, response: DEFullResponse, settings: ValidatedVolcanoSettings) {
		this.config = config
		this.response = response
		this.plotX = this.horizPad + this.offset * 2

		this.dataRows = response.data.dots as DataPointEntry[]

		// Shared helper (colors.ts) so the SVG overlay and the server PNG paint
		// each side in the exact same hex.
		const { caseColor, controlColor } = getGroupColors(this.config)
		const barplot = { colorNegative: controlColor, colorPositive: caseColor }

		this.pValueTable = {
			columns: [
				{ label: 'log₂(fold-change)', barplot, sortable: true },
				{ label: 'Original p-value', sortable: true },
				{ label: 'Adjusted p-value', sortable: true }
			],
			/** Arr set in setPointData() if settings.showPValueTable is true to
			 * prevent unnecessary data processing when the table is not shown */
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

		if (this.settings.showPValueTable) {
			//Get all rows data for the pValueTable in setPointsData, then sort by fold change
			const foldChangeIdx = this.pValueTable.columns.findIndex(c => c.label.includes('log₂(fold-change)'))
			this.pValueTable.rows.sort((a: any, b: any) => b[foldChangeIdx].value - a[foldChangeIdx].value)
		}

		this.viewData = {
			images: response.images || [],
			termInfo: this.setTermInfo(plotDim),
			plotDim,
			pointData,
			pValueTableData: this.pValueTable,
			statsData: this.setStatsData(),
			userActions: this.setUserActions(),
			volcanoPng: response.data.volcanoPng,
			plotExtent: response.data.plotExtent
		}
	}

	setDataType() {
		if (this.termType == GENE_EXPRESSION) return 'genes'
		else if (this.termType == DNA_METHYLATION) return 'promoters'
		else if (this.termType == SINGLECELL_CELLTYPE) return 'genes' //'cells'??
		else throw new Error(`Unknown termType: ${this.termType}`)
	}

	setMinMaxValues() {
		// The server-drawn PNG owns the axes; we adopt its extents verbatim so
		// overlay circles land on their counterparts in the PNG. Also adopt the
		// server's minNonZeroPValue so p=0 rows are capped at the same y position
		// the PNG used.
		const ext = this.response.data.plotExtent
		// Padded extents — used for positioning overlay dots & PNG (so dots near
		// the real-data edge stay fully visible).
		this.minLogFoldChange = ext.xMin
		this.maxLogFoldChange = ext.xMax
		this.minLogPValue = ext.yMin
		this.maxLogPValue = ext.yMax
		// Unpadded extents — used only for the visible axis ticks/labels.
		this.minLogFoldChangeAxis = ext.xMinUnpadded
		this.maxLogFoldChangeAxis = ext.xMaxUnpadded
		this.minLogPValueAxis = ext.yMinUnpadded
		this.maxLogPValueAxis = ext.yMaxUnpadded
		this.dotRadiusPx = ext.dotRadiusPx
		if (ext.minNonZeroPValue > 0) this.minNonZeroPValue = ext.minNonZeroPValue
	}

	setPlotDimensions() {
		// Trust the server's authoritative PNG dimensions for the plot rect.
		// (Recomputing as `settings.width + 2*dotRadiusPx` is wrong when rust's
		// `pad_px = ceil(2*dot_radius)` rounds up for non-integer dot_radius —
		// the SVG plot rect would scale the PNG and break pixel_x/pixel_y
		// alignment with the rasterized dots.)
		const ext = this.response.data.plotExtent
		const plotW = ext.pixelWidth
		const plotH = ext.pixelHeight

		// Positioning scales — padded data range covers the full plot rect.
		// Used for overlay dot placement, the PNG image, and the fold-change line.
		const xPlotScale = scaleLinear().domain([this.minLogFoldChange, this.maxLogFoldChange]).range([0, plotW])
		const yPlotScale = scaleLinear().domain([this.minLogPValue, this.maxLogPValue]).range([plotH, 0])

		// Visible axis scales — unpadded domain mapped onto the matching pixel
		// subrange of the padded plot, so axis ticks land exactly at their data
		// values in the PNG (mirror of manhattan's yAxisScale).
		const xScale = scaleLinear()
			.domain([this.minLogFoldChangeAxis, this.maxLogFoldChangeAxis])
			.range([xPlotScale(this.minLogFoldChangeAxis), xPlotScale(this.maxLogFoldChangeAxis)])
		const yScale = scaleLinear()
			.domain([this.minLogPValueAxis, this.maxLogPValueAxis])
			.range([yPlotScale(this.minLogPValueAxis), yPlotScale(this.maxLogPValueAxis)])

		return {
			svg: {
				//20 is for the term info above the plot
				height: plotH + this.topPad + this.bottomPad * 2 + this.offset * 3,
				width: plotW + this.horizPad * 2
			},
			top: {
				x: this.plotX,
				y: 5
			},
			xAxisLabel: {
				x: this.horizPad + plotW / 2 + this.offset,
				y: this.topPad + plotH + this.bottomPad + this.offset
			},
			xScale: {
				scale: xScale,
				x: this.plotX,
				y: plotH + this.topPad + this.offset * 2
			},
			yAxisLabel: {
				text: `-log10(${this.settings.pValueType} P value)`,
				x: this.horizPad / 3,
				y: this.topPad + plotH / 2
			},
			yScale: {
				scale: yScale,
				x: this.horizPad,
				y: this.topPad
			},
			plot: {
				height: plotH,
				width: plotW,
				x: this.plotX,
				y: this.topPad
			},
			logFoldChangeLine: {
				x: xPlotScale(0) + this.plotX,
				y1: this.topPad,
				y2: plotH + this.offset * 4
			},
			xPlotScale,
			yPlotScale
		}
	}

	setTermInfo(
		plotDim: VolcanoPlotDimensions
		// caseColor: string,
		// controlColor: string
	) {
		if (this.termType != GENE_EXPRESSION && this.termType != DNA_METHYLATION) return
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

	setPointData(_plotDim: VolcanoPlotDimensions, controlColor: string, caseColor: string) {
		// Use the server-supplied radius so SVG overlay rings sit exactly on top
		// of the PNG rings. The view's renderDataPoints draws them at stroke-width
		// 1 to match the rust PNG's stroke geometry.
		const radius = this.dotRadiusPx
		const dataCopy: any = structuredClone(this.dataRows)
		for (const d of dataCopy) {
			const highlightKey = this.termType === DNA_METHYLATION ? d.promoter_id : d.gene_name
			d.highlighted = this.config?.highlightedData?.includes(highlightKey)
			// Every row in response.data passed the server's thresholds by definition.
			d.significant = true
			this.getGenesColor(d, d.significant, controlColor, caseColor)
			if (d.significant) {
				this.numSignificant++
				const row = [
					{ value: roundValueAuto(d.fold_change) },
					{ value: roundValueAuto(d.original_p_value) },
					{ value: roundValueAuto(d.adjusted_p_value) }
				]
				if (this.termType == DNA_METHYLATION) {
					row.splice(0, 0, { value: d.promoter_id || '' }, { value: d.gene_name || '' })
				} else {
					row.splice(0, 0, { value: d.gene_name || '' })
				}
				//Do not create p-value table data unless user opts to show the table
				if (this.settings.showPValueTable) this.pValueTable.rows.push(row)
			} else {
				this.numNonSignificant++
			}
			// Use the exact pixel coords plotters used to rasterize this dot in
			// the PNG (echoed back from rust per-point). Translating by plotX /
			// topPad shifts from inner-plot pixel space to SVG-absolute coords.
			// This is the manhattan trick — guarantees the SVG overlay ring lands
			// on the rasterized PNG dot regardless of float-vs-int conventions.
			d.x = d.pixel_x + this.plotX
			d.y = d.pixel_y + this.topPad
			d.radius = radius
		}
		// Use the server's pre-truncation count so stats are correct even when
		// dots was capped by maxInteractiveDots.
		this.numSignificant = this.response.data.totalSignificantRows
		this.numNonSignificant = Math.max(0, this.response.data.totalRows - this.numSignificant)
		//Sort so the highlighted points appear on top
		dataCopy.sort((a: any, b: any) => a.highlighted - b.highlighted)
		return dataCopy
	}

	getGenesColor(d: DataPointEntry, significant: boolean, controlColor: string, caseColor: string) {
		if (!d.gene_name && this.termType != DNA_METHYLATION)
			throw new Error(`Missing gene_name in data: ${JSON.stringify(d)}`)
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
			}
		]
		if (this.termType == GENE_EXPRESSION || this.termType == DNA_METHYLATION) {
			tableRows.push(
				{
					label: this.config.samplelst.groups[0].name + ' sample size (control group)',
					value: this.response.sample_size1
				},
				{
					label: this.config.samplelst.groups[1].name + ' sample size (case group)',
					value: this.response.sample_size2
				}
			)
		}

		if (this.response.bcv !== undefined && this.response.bcv !== null) {
			tableRows.push({
				label: 'Biological coefficient of variation',
				value: roundValueAuto(this.response.bcv)
			})
		}
		return tableRows
	}

	setPTableColumns() {
		if (this.termType == DNA_METHYLATION) {
			this.pValueTable.columns.splice(0, 0, { label: 'Promoter', sortable: true }, { label: 'Gene(s)', sortable: true })
		} else {
			this.pValueTable.columns.splice(0, 0, { label: 'Gene Name', sortable: true })
		}
	}

	setUserActions() {
		const userActions = {
			noShow: new Set<string>()
		}
		if (this.termType == GENE_EXPRESSION) {
			if (this.settings.method == 'edgeR' && getSampleNum(this.config) > 100) {
				userActions.noShow.add('Confounding factors')
			}
			if (this.settings.method == 'wilcoxon') userActions.noShow.add('Confounding factors')
		}
		return userActions
	}
}
