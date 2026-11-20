import type {
	VolcanoPlotDimensions,
	VolcanoPlotConfig,
	VolcanoPValueTableData,
	VolcanoViewData,
	DataPointEntry
} from '../VolcanoTypes'
import type { ValidatedVolcanoSettings } from '../settings/Settings'
import type { DEFullResponse, DmrScanSummary } from '#types'
import { bplen } from '#shared/common.js'
import { scaleLinear } from 'd3-scale'
import { roundValueAuto } from '#shared/roundValue.js'
import { getGroupColors } from '../colors'
import { enabledTermTypes } from '../../diffAnalysis/enabledTermTypes'
import {
	getPlottedEffect,
	getVolcanoHandler,
	SCAN_Y_AXIS_OPTIONS,
	type VolcanoAction,
	type VolcanoColumn,
	type VolcanoHandler
} from '../handlers'

/* Group names are user-supplied and can be arbitrarily long, so they are shortened before going
into any label. Shared by the two group labels above the plot and by the delta-beta axis label,
so the two shorten identically rather than drifting apart. */
function shortenGroupName(name: string) {
	if (name.length >= 25) return name.substring(0, 20) + '...'
	return name
}

/** Group read depths further apart than this get a warning in a scan's Statistics */
const DEPTH_RATIO_WARN = 1.5

export class VolcanoViewModel {
	config: any
	/** the code that differs by config.termType */
	handler: VolcanoHandler
	/** the columns of the p-value table, each with its cell */
	tableColumns: VolcanoColumn[]
	dataType: string
	response: DEFullResponse
	pValueTable: VolcanoPValueTableData
	settings: any
	termType: string
	viewData: VolcanoViewData
	numSignificant = 0
	numNonSignificant = 0
	/** The significant count split by direction, from the server so it reflects every
	 * significant row rather than the maxInteractiveDots-capped `dots`. */
	numSignificantUp = 0
	numSignificantDown = 0
	/** Present only when the "element class" was the de novo DMR scan. */
	scan?: DmrScanSummary
	/** One p per row (DAP's FDR, a scan's smoothed FDR or background FDR) rather than original +
	 * adjusted. Decides the column set, the tooltip rows and the axis name. */
	singlePValue: boolean
	pValueLabel: string
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

		/* Assigned before setPValueLabel(), which reads it: DAP is labelled off the term type, and
		with the assignment further down every DAP label read "adjusted p-value" for data that is an
		FDR. */
		this.termType = config.termType
		this.handler = getVolcanoHandler(config.termType)
		this.scan = (response as any).scan
		this.singlePValue = !!this.handler.fdrOnly || !!this.scan
		this.pValueLabel = this.setPValueLabel(settings)

		this.settings = settings
		const { columns, effectIndex } = this.getTableColumns()
		this.tableColumns = columns
		this.pValueTable = {
			// the effect-size column is drawn as a bar
			columns: columns.map((c, i) =>
				i == effectIndex ? { label: c.label, barplot, sortable: true } : { label: c.label, sortable: true }
			),
			/** Filled in setPointData(), one row per threshold-passing dot. Populated even when the
			 * table is hidden — the download reads it. */
			rows: [],
			rowKeys: new Map(),
			height: settings.height + this.topPad
		}
		this.dataType = this.setDataType()

		this.setMinMaxValues()

		const plotDim = this.setPlotDimensions()
		const pointData = this.setPointData(plotDim, controlColor, caseColor)

		// sort by effect size, for the rendered table and the downloaded one alike; it is the one
		// column drawn as a bar
		const foldChangeIdx = this.pValueTable.columns.findIndex(c => c.barplot)
		this.pValueTable.rows.sort((a: any, b: any) => b[foldChangeIdx].value - a[foldChangeIdx].value)

		this.viewData = {
			images: response.images || [],
			termInfo: this.setTermInfo(plotDim),
			plotDim,
			pointData,
			pValueTableData: this.pValueTable,
			statsData: this.setStatsData(),
			scan: this.scan,
			pValueLabel: this.pValueLabel,
			singlePValue: this.singlePValue,
			numSignificantUp: this.numSignificantUp,
			numSignificantDown: this.numSignificantDown,
			xOffset: this.response.data.xOffset ?? 0,
			centered: !!this.response.data.centered,
			provenance: this.setProvenance(),
			userActions: this.setUserActions(),
			deltaBetaAxisLabel: this.setDeltaBetaAxisLabel(),
			deltaPsiAxisLabel: this.setDeltaPsiAxisLabel(),
			volcanoPng: response.data.volcanoPng,
			plotExtent: response.data.plotExtent
		}
	}

	/* The delta-beta axis used to read "Δβ (case − control)". Those are positional roles, not
	names, so the plot showed the size of an effect but not its direction -- you had to already
	know which group landed in which slot, or open a downloaded file and read the provenance line.
	Name the groups instead, in subtraction order (case first), so the axis states what it plots.

	Returns undefined when the group names are not available; the view falls back to the old
	wording rather than rendering a broken label. */
	setDeltaBetaAxisLabel(): string | undefined {
		const groups = this.config?.samplelst?.groups
		const control = groups?.[0]?.name
		const cases = groups?.[1]?.name
		if (!control || !cases) return undefined
		/* A centred axis must say so on the axis itself. The plot looks identical to an
		uncentred one apart from a small shift, so a reader who does not know the origin moved
		would take a dot at 0 to mean "no change" when it means "typical". */
		const centered = this.response.data.centered ? ' − median' : ''
		return `Δβ${centered} (${shortenGroupName(cases)} − ${shortenGroupName(control)})`
	}

	// same as setDeltaBetaAxisLabel, for ΔPSI
	setDeltaPsiAxisLabel(): string | undefined {
		const groups = this.config?.samplelst?.groups
		const control = groups?.[0]?.name
		const cases = groups?.[1]?.name
		if (!control || !cases) return undefined
		return `ΔPSI (${shortenGroupName(cases)} − ${shortenGroupName(control)})`
	}

	/** What the y axis and the p column are called. Named here once so the axis, the table header,
	 * the hover rows and the multi-hit table cannot disagree. */
	setPValueLabel(settings: ValidatedVolcanoSettings): string {
		if (this.handler.fdrOnly) return 'FDR'
		if (this.scan)
			// a scan from before the choice existed plotted the smoothed FDR
			return SCAN_Y_AXIS_OPTIONS.find(o => o.value == (this.scan!.yAxis ?? 'min_smoothed_fdr'))!.label
		return `${settings.pValueType} p-value`
	}

	/** what a dot is, plural: names the stats rows */
	setDataType() {
		return this.handler.getRowNoun(this.settings)
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
				text: `-log10(${this.pValueLabel})`,
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
		if (!enabledTermTypes.has(this.termType as any)) return

		// the data type may label its groups otherwise, such as a precomputed analysis with no groups of its own
		const [first, second] = this.handler.getGroupLabels?.(this.config, this.response) || [
			`${this.config.samplelst.groups[0].name} (${this.response.sample_size1})`,
			`${this.config.samplelst.groups[1].name} (${this.response.sample_size2})`
		]
		return {
			//Set slightly above the plot
			y: plotDim.top.y + 10,
			first: {
				// color: controlColor || this.settings.defaultSignColor,
				label: shortenGroupName(first),
				x: 0
				// rectX: this.settings.width/2 - 10,
			},
			second: {
				// color: caseColor || this.settings.defaultSignColor,
				label: shortenGroupName(second),
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
		// rebuilt from scratch on every call, like pointData below -- appending would double the rows
		// if this ever ran twice on one view model
		this.pValueTable.rows = []
		this.pValueTable.rowKeys.clear()
		const dataCopy: any = structuredClone(this.dataRows)
		for (const d of dataCopy) {
			const highlightKey = this.handler.getRowKey(d)
			d.highlighted = this.config?.highlightedData?.includes(highlightKey)
			// Every row in response.data passed the server's thresholds by definition.
			d.significant = true
			this.getGenesColor(d, d.significant, controlColor, caseColor)
			if (d.significant) {
				this.numSignificant++
				// header and cell come from one column, so a cell cannot land under another column's header
				const row = this.tableColumns.map(c => ({ value: c.value(d) }))
				/* Always collected, whether or not the table is displayed: "Download p-value table"
				reads these rows, and gating them on showPValueTable made that download emit a
				header with no rows. `row` above is built either way, so this only adds the push. */
				this.pValueTable.rows.push(row)
				/* Record the dot identity for this row. The methylation Promoter cell shows a
				formatted label (formatPromoterLabel), so row[0].value cannot be used to find the dot --
				hover/click highlighting must go through this map instead. Reuses the same highlightKey
				compared against config.highlightedData above, so the three stay in lock-step by
				construction. */
				this.pValueTable.rowKeys.set(row, highlightKey)
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
		this.numSignificantUp = this.response.data.totalSignificantUp ?? 0
		this.numSignificantDown = this.response.data.totalSignificantDown ?? 0
		//Sort so the highlighted points appear on top
		dataCopy.sort((a: any, b: any) => a.highlighted - b.highlighted)
		return dataCopy
	}

	getGenesColor(d: DataPointEntry, significant: boolean, controlColor: string, caseColor: string) {
		// the key of a row: gene_name, or the element of a methylation row, or the cluster of a splicing row
		if (!this.handler.getRowKey(d)) throw new Error(`Missing the row key in data: ${JSON.stringify(d)}`)
		if (significant) {
			/* The value the server classified and drew: delta-beta on the Δβ axis, less the median when
			centred. Colouring from raw fold_change painted a point between 0 and a positive median as
			"up" over a PNG dot the server had drawn as "down". */
			const { field } = getPlottedEffect(this.handler, this.settings)
			const x = field == 'delta_beta' ? (d as any).delta_beta - (this.response.data.xOffset ?? 0) : (d as any)[field]
			if (controlColor && caseColor) d.color = x > 0 ? caseColor : controlColor
			else d.color = this.settings.defaultSignColor
		} else d.color = this.settings.defaultNonSignColor
	}

	/** One line describing what produced this result: which groups, how many samples actually
	 * entered the model, and every setting that changes the numbers.
	 *
	 * This exists because an exported table is the artifact that outlives the session. Re-running
	 * a contrast months later and getting different counts is impossible to diagnose when the
	 * original run's group sizes and options were never written down anywhere -- the file, the
	 * screenshot and the memory of it all look identical regardless of how it was configured.
	 * Only settings that can change the result are listed; cosmetic ones are deliberately left
	 * out so the line stays readable and a difference in it always means a real difference. */
	setProvenance(): string {
		const s = this.settings
		const parts: string[] = []

		if (this.config.samplelst?.groups?.length == 2) {
			const [g1, g2] = this.config.samplelst.groups
			// The sizes reported by the server are post-filtering -- what the model actually used,
			// not what the group nominally contained.
			parts.push(`group1 (control) "${g1.name}" n=${this.response.sample_size1}`)
			parts.push(`group2 (case) "${g2.name}" n=${this.response.sample_size2}`)
		}

		const conf = this.config.confounderTws?.map((t: any) => t?.term?.name || t?.term?.id).filter(Boolean)
		parts.push(`confounders: ${conf?.length ? conf.join(' + ') : 'none'}`)

		// the settings of the data type, such as the method or the element class
		parts.push(...(this.handler.getProvenance?.(s, this.response, this.scan) || []))

		// Name the effect-size measure the cutoff was applied to, not just its number — the
		// threshold moves to deltaBetaCutoff when the axis does, and "0.1" alone is ambiguous.
		const axis = this.handler.getEffectAxis?.(s) || { cutoff: s.foldChangeCutoff }
		const effect = `|${getPlottedEffect(this.handler, s).provenance}| > ${axis.cutoff}`
		parts.push(`significance: ${s.pValueType} p < ${roundValueAuto(Math.pow(10, -s.pValue))}, ${effect}`)

		return parts.join('; ')
	}

	setStatsData() {
		const tableRows: { label: string; value: number | string }[] = [
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
		// a data type that compares groups names them; one that does not may label control and case
		const groups = this.config.samplelst?.groups
		const sizeLabels = this.handler.comparesGroups
			? [`${groups[0].name} sample size (control group)`, `${groups[1].name} sample size (case group)`]
			: this.handler.sampleSizeLabels
		if (sizeLabels)
			tableRows.push(
				{ label: sizeLabels[0], value: this.response.sample_size1 },
				{ label: sizeLabels[1], value: this.response.sample_size2 }
			)

		if (this.response.bcv !== undefined && this.response.bcv !== null) {
			tableRows.push({
				label: 'Biological coefficient of variation',
				value: roundValueAuto(this.response.bcv)
			})
		}
		if (this.scan) tableRows.push(...this.setScanStats(this.scan))
		return tableRows
	}

	/* The whole-scan facts, every one of them over the scan as returned -- before the volcano's
	thresholds -- and over the same set of DMRs (those meeting the CpG floor), so no two lines here
	have different denominators. The counts the thresholds select are the three rows above. */
	setScanStats(s: DmrScanSummary) {
		// what DMRcate ran over, of which the rows may show one chromosome
		const run = s.runChromosomes || s.chromosomes
		const rows: { label: string; value: number | string }[] = [
			{ label: 'Chromosomes scanned', value: run.length },
			// the counts below are over the chromosome shown, the run's genome-wide facts say so in their labels
			...(s.chromosomes.length < run.length ? [{ label: 'Chromosomes shown', value: s.chromosomes.join(', ') }] : []),
			{ label: 'CpGs analyzed', value: s.totalProbesAnalyzed },
			{ label: 'DMRs called', value: s.called },
			{ label: `DMRs with ${s.minCpgs}+ CpGs`, value: s.kept },
			// what the rows below, the Manhattan and the browser track count
			...(s.minDeltaBeta ? [{ label: `… and |Δβ| > ${s.minDeltaBeta}`, value: s.shown }] : []),
			{ label: 'Hypermethylated', value: s.hyper },
			{ label: 'Hypomethylated', value: s.hypo },
			// not on the volcano: no evidence to plot, rather than evidence of no change
			...(s.withoutStatistic
				? [{ label: `DMRs with no ${this.pValueLabel} (not plotted)`, value: s.withoutStatistic }]
				: []),
			...(s.withoutDeltaBeta ? [{ label: 'DMRs with no Δβ (not plotted or counted)', value: s.withoutDeltaBeta }] : [])
		]
		if (s.width)
			rows.push({
				label: 'DMR width, median (IQR)',
				value: `${bplen(s.width.median)} (${bplen(s.width.q1)} – ${bplen(s.width.q3)})`
			})
		/* Stated even when it dropped nothing, so "no artifact regions here" reads differently from
		"no mask was applied". These DMRs never reached the browser. */
		if (s.regionMask)
			rows.push({
				label: `DMRs removed by artifact mask (${s.regionMask.sources.join(', ')}; ≥${Math.round(
					s.regionMask.overlapFrac * 100
				)}% masked)`,
				value: s.regionMask.dmrsDropped
			})
		/* The backdrop every DMR is read against. Measured over every value the fits read, not over
		the DMRs, so it is independent of the result it qualifies: where the whole genome shifts,
		part of every region's difference is this number rather than anything local. */
		const gm = s.globalMethylation
		if (gm) {
			const [g1, g2] = this.config.samplelst?.groups?.map((g: any) => g.name) || ['group 1', 'group 2']
			/* Named for what DMRcate ran over, which these are measured on: the whole genome, even when
			the volcano shows one chromosome of it. */
			const one = run.length == 1 ? run[0] : null
			const meanLabel = (g: string) => (one ? `${g} mean β on ${one}` : `${g} genome-wide mean β`)
			rows.push(
				{ label: meanLabel(g1), value: gm.controlMeanBeta.toFixed(4) },
				{ label: meanLabel(g2), value: gm.caseMeanBeta.toFixed(4) },
				{
					label: one ? `β shift on ${one} (case − control)` : 'Genome-wide β shift (case − control)',
					value: `${gm.shift >= 0 ? '+' : ''}${gm.shift.toFixed(4)}`
				}
			)
			/* Read depth by group. DMRcate's sequencing model compares log-ratios with a pseudocount, which
			pulls shallow samples toward 0: where one group has more reads, it differs with no change in
			methylation, and DMRs with little beta change can be depth rather than biology. */
			const dc = gm.controlMeanDepth,
				dk = gm.caseMeanDepth
			if (dc != null && dk != null) {
				rows.push(
					{ label: `${g1} mean reads per CpG`, value: dc.toFixed(2) },
					{ label: `${g2} mean reads per CpG`, value: dk.toFixed(2) }
				)
				const ratio = Math.max(dc, dk) / Math.min(dc, dk)
				if (ratio > DEPTH_RATIO_WARN) {
					const deeper = dk > dc ? g2 : g1
					// a group with no reads has no ratio to state
					const differ = Number.isFinite(ratio)
						? `${deeper} has ${ratio.toFixed(1)}× the reads per CpG`
						: `Only ${deeper} has reads`
					// with no Min Δβ, every DMR is counted, so the remedy is to set one
					const floor = s.minDeltaBeta
						? `only those with |Δβ| > ${s.minDeltaBeta} are counted.`
						: 'set Min Δβ to count only DMRs whose beta moved.'
					rows.push({
						label: '⚠ Read depth differs between groups',
						value: `${differ}. DMRcate calls DMRs from read-count ratios that shift with depth, so DMRs with little beta change may reflect depth rather than methylation; ${floor}`
					})
				}
			}
		}
		/* How much of the measured methylome moved. Sits beside the DMR counts because the two say
		different things: a DMR count is a count of regions that passed a threshold, and on a cohort
		that drifted genome-wide that count is large whether or not much changed anywhere. The binned
		profile is the metric the methylome literature compares cohorts with. */
		const pf = s.profileSummary
		if (pf) {
			const pct = (v: number) => `${(100 * v).toFixed(1)}%`
			rows.push(
				{
					label: `Methylome profile: ${pf.bins.toLocaleString()} bins measured`,
					value: `${pct(pf.fractionHyper)} hyper`
				},
				{
					label: 'Methylome profile: per-bin Δβ, median (IQR)',
					value: `${pf.median >= 0 ? '+' : ''}${pf.median.toFixed(4)} (${pf.q1.toFixed(4)} – ${pf.q3.toFixed(4)})`
				},
				{ label: 'Methylome profile: bins moving |Δβ| > 0.05', value: pct(pf.fractionBeyond05) },
				{ label: 'Methylome profile: bins moving |Δβ| > 0.10', value: pct(pf.fractionBeyond10) }
			)
		}
		/* What the scan cost, measured on the run that produced this result (a cached answer keeps
		the original run's figures). One row each for the numbers a deployment is sized by: memory
		per worker, memory for the pool, cores, and how the time split between the workers and Node. */
		const r = s.resources
		if (r) {
			const top = r.perChromosome[0]
			rows.push(
				{
					label: 'Compute: workers × threads',
					value: `${r.workers} × ${r.threadsPerWorker} (${r.workers * r.threadsPerWorker} core${
						r.workers * r.threadsPerWorker == 1 ? '' : 's'
					})`
				},
				{ label: 'Compute: wall time', value: `${(r.wallMs / 1000).toFixed(1)} s` },
				{
					label: 'Compute: peak memory per worker',
					value: `${Math.round(r.peakWorkerMemoryMb).toLocaleString()} MB${
						top ? ` (${top.chr}, ${top.probes.toLocaleString()} CpGs)` : ''
					}`
				},
				{ label: 'Compute: peak memory, worker pool', value: `${Math.round(r.peakPoolMemoryMb).toLocaleString()} MB` },
				{ label: 'Compute: worker CPU time', value: `${r.workerCpuSeconds.toFixed(1)} s` },
				{
					label: 'Compute: server process',
					value: `+${Math.round(r.nodeRssDeltaMb).toLocaleString()} MB, ${r.nodeCpuSeconds.toFixed(1)} s CPU`
				}
			)
		}
		return rows
	}

	/** The p-value table's columns: the columns naming a row, the effect size, the columns of the data
	 * type, then the p-values. Each column holds its header and its cell, so the two cannot drift
	 * apart. effectIndex is the index of the effect-size column. */
	getTableColumns(): { columns: VolcanoColumn[]; effectIndex: number } {
		const run = { settings: this.settings, config: this.config, scan: this.scan }
		const effect = this.handler.getTableEffectColumn?.(run) || {
			label: 'log₂(fold-change)',
			value: d => roundValueAuto(d.fold_change)
		}
		// DAP files carry a single FDR and a scan a single p, both in original_p_value; other data types
		// report both a raw and an adjusted p-value
		const pValues: VolcanoColumn[] = this.singlePValue
			? [{ label: this.pValueLabel, value: d => roundValueAuto(d.original_p_value) }]
			: [
					{ label: 'Original p-value', value: d => roundValueAuto(d.original_p_value) },
					{
						label: 'Adjusted p-value',
						value: d => (d.adjusted_p_value != undefined ? roundValueAuto(d.adjusted_p_value) : '')
					}
			  ]
		const idColumns = this.handler.getIdColumns(this.settings)
		return {
			columns: [...idColumns, effect, ...(this.handler.getExtraColumns?.(run) || []), ...pValues],
			effectIndex: idColumns.length
		}
	}

	/** the actions of the data type that this run cannot offer */
	setUserActions() {
		const run = { settings: this.settings, config: this.config, scan: this.scan }
		return { noShow: new Set<VolcanoAction>(this.handler.getHiddenActions?.(run) || []) }
	}
}
