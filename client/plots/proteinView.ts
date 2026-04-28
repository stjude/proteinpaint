import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent } from '#rx'
import { axisstyle, to_svg } from '#src/client'
import { Menu, table2col, LegendCircleReference, addGeneSearchbox } from '#dom'
import { PlotBase } from './PlotBase'
import { dofetch3 } from '#common/dofetch'
import { axisBottom, axisLeft } from 'd3-axis'
import { scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
import { shapeSelector, shapesArray } from '../dom/shapes.js'
import { NumericModes, TermTypes } from '#shared/terms.js'
import { aa2gmcoord } from '#src/coord'
import { mclass, getColors } from '#shared/common.js'
import { roundValue } from '#shared/roundValue.js'
import { select, creator } from 'd3-selection'
import { icons as controlIcons } from '../dom/control.icons'

const defaultConfig = {
	chartType: 'proteinView'
}

class ProteinView extends PlotBase implements RxComponent {
	static type = 'proteinView'
	type: string
	dom!: {
		holder: any
		body: any
		tip: Menu
		header?: any
	}
	components: any

	constructor(opts: any, api) {
		super(opts, api)
		this.type = ProteinView.type
		this.components = {}
	}

	async init() {
		const holder = this.opts.holder.append('div').style('padding', '10px')
		this.dom = {
			holder,
			body: holder.append('div'),
			tip: new Menu({ padding: '' }),
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Protein View')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	maySetSandboxHeader() {
		if (!this.dom.header) return
		const term = this.state.config?.tw?.term
		const header = `Protein View: ${term?.name}`
		this.dom.header.text(header)
	}

	async main() {
		const term = this.state.config?.tw?.term
		if (!term?.name) throw new Error('proteinView: selected protein term is missing')

		const body = {
			genome: this.app.opts.state.vocab.genome,
			dslabel: this.app.opts.state.vocab.dslabel,
			term: this.state.config.tw,
			filter: this.state.config.filter,
			filter0: this.state.config.filter0
		}

		this.maySetSandboxHeader()
		const data = await dofetch3('termdb/proteome', { body })
		if (data.error) throw data.error
		this.dom.body.selectAll('*').remove()
		renderCohortVolcano(this.dom.body, data, this)
		const ptmDataByIsoform = new Map<string, any[]>()
		for (const cohortData of data.cohorts || []) {
			if (!cohortData.PTMType) continue // filter out non-PTM cohorts
			const isoform = cohortData.isoform
			const existingCohorts = ptmDataByIsoform.get(isoform)
			if (!existingCohorts) {
				ptmDataByIsoform.set(isoform, [cohortData])
			} else {
				existingCohorts.push(cohortData)
			}
		}

		for (const [isoform, ptmCohorts] of ptmDataByIsoform) {
			await renderPTMLollipop(this.dom.body, ptmCohorts, this, isoform)
		}
	}
}

function renderCohortVolcano(holder: any, data: any, self: ProteinView) {
	const dots: any[] = []

	for (const cohortData of data?.cohorts || []) {
		const log2fc = getLog2Ratio(cohortData.foldChange)
		const pValue = Number(cohortData.pValue)
		const testedN = Number(cohortData.testedN)
		const controlN = Number(cohortData.controlN)
		if (log2fc === null || !Number.isFinite(pValue) || pValue <= 0) continue
		dots.push({
			assayName: cohortData.assayName,
			cohortName: cohortData.cohortName,
			PTMType: cohortData.PTMType,
			modSites: cohortData.modSites,
			proteinAccession: cohortData.proteinAccession,
			uniqueIdentifier: cohortData.uniqueIdentifier,
			log2fc,
			pValue,
			score: -Math.log10(Math.max(pValue, 1e-300)),
			testedN: Number.isFinite(testedN) ? testedN : 0,
			controlN: Number.isFinite(controlN) ? controlN : 0
		})
	}

	const panel = holder.append('div').style('margin-bottom', '14px')
	const header = panel
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'center')
		.style('gap', '6px')
		.style('margin-bottom', '6px')

	const downloadBtn = header.append('div').style('display', 'inline-block')

	header.append('div').style('font-weight', 600).text('Cohort Volcano')

	if (!dots.length) {
		downloadBtn.style('display', 'none')
		panel
			.append('div')
			.style('font-size', '.85em')
			.style('color', '#666')
			.text('No cohorts with valid fold-change and p-value to plot.')
		return
	}

	const width = 640
	const height = 660
	const margin = { top: 40, right: 70, bottom: 120, left: 70 }
	const innerW = width - margin.left - margin.right
	const innerH = height - margin.top - margin.bottom

	let minX = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = 0
	let maxTestedN = 0
	let minTestedN = Number.POSITIVE_INFINITY
	for (const p of dots) {
		minX = Math.min(minX, p.log2fc)
		maxX = Math.max(maxX, p.log2fc)
		maxY = Math.max(maxY, p.score)
		maxTestedN = Math.max(maxTestedN, p.testedN)
		if (p.testedN > 0) minTestedN = Math.min(minTestedN, p.testedN)
	}

	if (maxY < 1) maxY = 1
	if (!Number.isFinite(minTestedN)) minTestedN = 1

	const xSpan = Math.max(0.05, maxX - minX)
	const xPad = Math.max(0.01, xSpan * 0.1)
	const xMin = Math.min(0, minX - xPad)
	const xMax = Math.max(0, maxX + xPad)
	const yMax = maxY * 1.15

	const xScale = scaleLinear().domain([xMin, xMax]).range([0, innerW])
	const yScale = scaleLinear().domain([0, yMax]).range([innerH, 0])
	const radiusRange: [number, number] = [4, 12]
	const radiusScale = scaleLinear()
		.domain([minTestedN, Math.max(minTestedN + 1, maxTestedN)])
		.range(radiusRange)

	const assayNames = [...new Set(dots.map((d: any) => d.assayName))].sort() as string[]
	const cohortNames = [...new Set(dots.map((d: any) => d.cohortName))].sort() as string[]
	const proteinAccessions = [...new Set(dots.map((d: any) => d.proteinAccession))].sort() as string[]

	// Create color scales for each grouping category
	const assayColorScale = getColors(assayNames.length).domain(assayNames)
	const cohortColorScale = getColors(cohortNames.length).domain(cohortNames)
	const proteinColorScale = getColors(proteinAccessions.length).domain(proteinAccessions)

	// Store colors in maps
	const assayColors = new Map<string, string>(assayNames.map(name => [name, rgb(assayColorScale(name)).formatHex()]))
	const cohortColors = new Map<string, string>(cohortNames.map(name => [name, rgb(cohortColorScale(name)).formatHex()]))
	const proteinColors = new Map<string, string>(
		proteinAccessions.map(acc => [acc, rgb(proteinColorScale(acc)).formatHex()])
	)
	const makeShapeMap = (items: string[]) =>
		new Map<string, number>(items.map((item, i) => [item, i % shapesArray.length]))
	const assayShapes = makeShapeMap(assayNames)
	const cohortShapes = makeShapeMap(cohortNames)
	const proteinShapes = makeShapeMap(proteinAccessions)

	type ColorMode = 'none' | 'assayType' | 'cohort' | 'proteinAccession'
	type ShapeMode = 'none' | 'assayType' | 'cohort' | 'proteinAccession'

	let colorMode: 'none' | 'assayType' | 'cohort' | 'proteinAccession' = 'assayType'
	let shapeMode: 'none' | 'assayType' | 'cohort' | 'proteinAccession' = 'none'
	const defaultDotColor = '#9ca3af'
	const customGroupPrefix = '__custom_group__:'
	const makeCustomGroupKey = (name: string) => `${customGroupPrefix}${name}`
	const isCustomGroupKey = (value: string) => value.startsWith(customGroupPrefix)
	const getCustomGroupNameFromKey = (value: string) => value.slice(customGroupPrefix.length)
	const customShapeGroupPrefix = '__custom_shape_group__:'
	const makeCustomShapeGroupKey = (name: string) => `${customShapeGroupPrefix}${name}`
	const isCustomShapeGroupKey = (value: string) => value.startsWith(customShapeGroupPrefix)
	const getCustomShapeGroupNameFromKey = (value: string) => value.slice(customShapeGroupPrefix.length)
	const customColorDomain = Array.from({ length: 64 }, (_, i) => `custom-${i}`)
	const customColorScale = getColors(customColorDomain.length).domain(customColorDomain)
	const colorModesWithGroups: ColorMode[] = ['assayType', 'cohort', 'proteinAccession']
	const shapeModesWithGroups: ShapeMode[] = ['assayType', 'cohort', 'proteinAccession']
	const createModeMap = <T>(factory: () => T) => ({
		none: factory(),
		assayType: factory(),
		cohort: factory(),
		proteinAccession: factory()
	})
	const customGroupsByMode = createModeMap(() => new Map<string, Set<string>>())
	const customGroupColorsByMode = createModeMap(() => new Map<string, string>())
	const customShapeGroupsByMode = createModeMap(() => new Map<string, Set<string>>())
	const customShapeIndicesByMode = createModeMap(() => new Map<string, number>())
	const checkedItemsByMode = createModeMap(() => new Set<string>())
	const checkedShapeItemsByMode = createModeMap(() => new Set<string>())
	const groupingModeActive = new Set<ColorMode>()
	const shapeGroupingModeActive = new Set<ShapeMode>()
	let customColorSeed = 0

	const getBaseColorValue = (d: any, mode: ColorMode) => {
		switch (mode) {
			case 'assayType':
				return d.assayName
			case 'cohort':
				return d.cohortName
			case 'proteinAccession':
				return d.proteinAccession
			default:
				return ''
		}
	}
	const getCustomGroupOfValue = (mode: ColorMode, value: string) => {
		if (mode === 'none') return null
		for (const [group, members] of customGroupsByMode[mode]) {
			if (members.has(value)) return group
		}
		return null
	}
	const getCustomGroupOfDot = (d: any, mode: ColorMode) => {
		if (mode === 'none') return null
		return getCustomGroupOfValue(mode, getBaseColorValue(d, mode))
	}
	const getCustomShapeGroupOfValue = (mode: ShapeMode, value: string) => {
		if (mode === 'none') return null
		for (const [group, members] of customShapeGroupsByMode[mode]) {
			if (members.has(value)) return group
		}
		return null
	}
	const getCustomShapeGroupOfDot = (d: any, mode: ShapeMode) => {
		if (mode === 'none') return null
		return getCustomShapeGroupOfValue(mode, getBaseColorValue(d, mode))
	}
	const getNextCustomColor = () => {
		const color = rgb(customColorScale(customColorDomain[customColorSeed % customColorDomain.length])).formatHex()
		customColorSeed++
		return color
	}
	const addOrUpdateCustomGroup = (mode: ColorMode, name: string, baseValues: string[]) => {
		if (!name || !baseValues.length || mode === 'none') return
		for (const members of customGroupsByMode[mode].values()) {
			for (const val of baseValues) members.delete(val)
		}
		const existing = customGroupsByMode[mode].get(name) || new Set<string>()
		for (const val of baseValues) existing.add(val)
		customGroupsByMode[mode].set(name, existing)
		if (!customGroupColorsByMode[mode].has(name)) customGroupColorsByMode[mode].set(name, getNextCustomColor())
	}
	const removeCustomGroup = (mode: ColorMode, name: string) => {
		if (mode === 'none') return
		customGroupsByMode[mode].delete(name)
		customGroupColorsByMode[mode].delete(name)
		hiddenColor[mode].delete(makeCustomGroupKey(name))
	}
	const addOrUpdateCustomShapeGroup = (mode: ShapeMode, name: string, baseValues: string[]) => {
		if (!name || !baseValues.length || mode === 'none') return
		for (const members of customShapeGroupsByMode[mode].values()) {
			for (const val of baseValues) members.delete(val)
		}
		const existing = customShapeGroupsByMode[mode].get(name) || new Set<string>()
		for (const val of baseValues) existing.add(val)
		customShapeGroupsByMode[mode].set(name, existing)
		if (!customShapeIndicesByMode[mode].has(name)) {
			const idx = customShapeIndicesByMode[mode].size % shapesArray.length
			customShapeIndicesByMode[mode].set(name, idx)
		}
	}
	const removeCustomShapeGroup = (mode: ShapeMode, name: string) => {
		if (mode === 'none') return
		customShapeGroupsByMode[mode].delete(name)
		customShapeIndicesByMode[mode].delete(name)
		hiddenShape[mode].delete(makeCustomShapeGroupKey(name))
	}
	const getCustomGroupItems = (mode: ColorMode) => {
		if (mode === 'none') return [] as string[]
		return [...customGroupsByMode[mode].keys()].sort().map(name => makeCustomGroupKey(name))
	}
	const getCustomShapeGroupItems = (mode: ShapeMode) => {
		if (mode === 'none') return [] as string[]
		return [...customShapeGroupsByMode[mode].keys()].sort().map(name => makeCustomShapeGroupKey(name))
	}
	const getColor = (d: any) => {
		const customGroup = colorMode === 'none' ? undefined : getCustomGroupOfDot(d, colorMode)
		switch (colorMode) {
			case 'none':
				return defaultDotColor
			case 'assayType':
				if (customGroup) return customGroupColorsByMode[colorMode].get(customGroup) ?? '#888'
				return assayColors.get(d.assayName) ?? '#888'
			case 'cohort':
				if (customGroup) return customGroupColorsByMode[colorMode].get(customGroup) ?? '#888'
				return cohortColors.get(d.cohortName) ?? '#888'
			case 'proteinAccession':
				if (customGroup) return customGroupColorsByMode[colorMode].get(customGroup) ?? '#888'
				return proteinColors.get(d.proteinAccession) ?? '#888'
			default:
				return '#888'
		}
	}
	const getShapeIndex = (d: any) => {
		const customShapeGroup = getCustomShapeGroupOfDot(d, shapeMode)
		if (customShapeGroup && shapeMode !== 'none') {
			return customShapeIndicesByMode[shapeMode].get(customShapeGroup) ?? 0
		}
		switch (shapeMode) {
			case 'none':
				return 0
			case 'assayType':
				return assayShapes.get(d.assayName) ?? 0
			case 'cohort':
				return cohortShapes.get(d.cohortName) ?? 0
			case 'proteinAccession':
				return proteinShapes.get(d.proteinAccession) ?? 0
			default:
				return 0
		}
	}
	const getShapePath = (d: any) => {
		const index = getShapeIndex(d) % shapesArray.length
		return shapesArray[index]
	}
	const getShapeTransform = (d: any, sizeScale = 1) => {
		const r = radiusScale(Math.max(minTestedN, d.testedN || minTestedN)) * sizeScale
		const scale = r / 8
		const x = xScale(d.log2fc) - 8 * scale
		const y = yScale(d.score) - 8 * scale
		return `translate(${x},${y}) scale(${scale})`
	}
	const colorGroupingModes: Array<{ key: ColorMode; label: string }> = [
		{ key: 'none', label: 'Default' },
		{ key: 'assayType', label: 'Assay' },
		{ key: 'cohort', label: 'Cohort' },
		{ key: 'proteinAccession', label: 'Isoform' }
	]
	const shapeGroupingModes: Array<{ key: ShapeMode; label: string }> = [
		{ key: 'none', label: 'Default' },
		{ key: 'assayType', label: 'Assay' },
		{ key: 'cohort', label: 'Cohort' },
		{ key: 'proteinAccession', label: 'Isoform' }
	]
	const makeHiddenState = () => ({
		none: new Set<string>(),
		assayType: new Set<string>(),
		cohort: new Set<string>(),
		proteinAccession: new Set<string>()
	})
	const hiddenColor = makeHiddenState()
	const hiddenShape = makeHiddenState()
	const getColorValueByMode = (d: any, mode: ColorMode) => {
		switch (mode) {
			case 'none':
				return ''
			case 'assayType':
				return getCustomGroupOfDot(d, mode) ? makeCustomGroupKey(getCustomGroupOfDot(d, mode) as string) : d.assayName
			case 'cohort':
				return getCustomGroupOfDot(d, mode) ? makeCustomGroupKey(getCustomGroupOfDot(d, mode) as string) : d.cohortName
			case 'proteinAccession':
				return getCustomGroupOfDot(d, mode)
					? makeCustomGroupKey(getCustomGroupOfDot(d, mode) as string)
					: d.proteinAccession
			default:
				return ''
		}
	}
	const getShapeValueByMode = (d: any, mode: ShapeMode) => {
		switch (mode) {
			case 'none':
				return ''
			case 'assayType':
				return getCustomShapeGroupOfDot(d, mode)
					? makeCustomShapeGroupKey(getCustomShapeGroupOfDot(d, mode) as string)
					: d.assayName
			case 'cohort':
				return getCustomShapeGroupOfDot(d, mode)
					? makeCustomShapeGroupKey(getCustomShapeGroupOfDot(d, mode) as string)
					: d.cohortName
			case 'proteinAccession':
				return getCustomShapeGroupOfDot(d, mode)
					? makeCustomShapeGroupKey(getCustomShapeGroupOfDot(d, mode) as string)
					: d.proteinAccession
			default:
				return ''
		}
	}
	const isDotHidden = (d: any) => {
		const colorValue = getColorValueByMode(d, colorMode)
		const shapeValue = getShapeValueByMode(d, shapeMode)
		return hiddenColor[colorMode].has(colorValue) || hiddenShape[shapeMode].has(shapeValue)
	}
	const getDotDistancePx = (d1: any, d2: any) => {
		const x = xScale(d1.log2fc) - xScale(d2.log2fc)
		const y = yScale(d1.score) - yScale(d2.score)
		return Math.sqrt(x * x + y * y)
	}
	const getVisibleDots = () => dots.filter(d => !isDotHidden(d))
	const getVisibleTestedNStats = () => {
		const visibleDots = getVisibleDots()
		if (!visibleDots.length) {
			return { domainMin: 1, domainMax: 2, minLabel: 0, maxLabel: 0 }
		}

		let visibleMax = 0
		let visibleMin = Number.POSITIVE_INFINITY
		for (const d of visibleDots) {
			visibleMax = Math.max(visibleMax, d.testedN)
			if (d.testedN > 0) visibleMin = Math.min(visibleMin, d.testedN)
		}

		if (!Number.isFinite(visibleMin)) visibleMin = 1
		const domainMax = Math.max(visibleMin + 1, visibleMax)
		return { domainMin: visibleMin, domainMax, minLabel: visibleMin, maxLabel: visibleMax || visibleMin }
	}
	const updateRadiusScaleForVisibleDots = () => {
		const stats = getVisibleTestedNStats()
		radiusScale.domain([stats.domainMin, stats.domainMax]).range(radiusRange)
		return stats
	}
	const getClusterDots = (seed: any) => {
		const thresholdPx = 5
		return dots
			.filter(d => !isDotHidden(d) && getDotDistancePx(d, seed) < thresholdPx)
			.sort((a, b) => getDotDistancePx(a, seed) - getDotDistancePx(b, seed))
	}
	const renderClusterTooltip = (clusterDots: any[]) => {
		const tip = self.dom.tip.clear().d

		if (clusterDots.length > 1) {
			tip
				.append('div')
				.style('color', '#888')
				.style('font-weight', 'bold')
				.style('margin', '0 0 6px 0')
				.text(`${clusterDots.length} Cohorts`)
		}

		const list = tip.append('div')

		if (clusterDots.length > 1) {
			const grouped = new Map<string, any>()
			for (const d of clusterDots) {
				const key = [d.assayName, d.cohortName, d.modSites || ''].join('\t')
				if (!grouped.has(key)) grouped.set(key, d)
			}
			for (const d of grouped.values()) {
				const block = list.append('div').style('padding', '3px 0').style('border-bottom', '1px solid #f1f1f1')
				const table = table2col({ holder: block.append('table') })
				table.addRow('Assay', d.assayName)
				table.addRow('Cohort', d.cohortName)
				if (d.modSites) table.addRow('Modified Site', d.modSites)
			}
			return
		}

		for (const d of clusterDots) {
			const block = list.append('div').style('padding', '3px 0').style('border-bottom', '1px solid #f1f1f1')
			const table = table2col({ holder: block.append('table') })
			table.addRow('Assay', d.assayName)
			table.addRow('Cohort', d.cohortName)
			table.addRow('Protein Accession', d.proteinAccession)
			if (d.PTMType) {
				table.addRow('PTM Type', d.PTMType)
				table.addRow('Modified Site', d.modSites)
				table.addRow('PTM', d.uniqueIdentifier)
			} else {
				table.addRow('Isoform', d.uniqueIdentifier)
			}
			table.addRow('log2 fold change', roundValue(d.log2fc, 3))
			table.addRow('p value', d.pValue.toExponential(2))
			table.addRow('-log10(p)', roundValue(d.score, 3))
			table.addRow('Tested samples', d.testedN)
			table.addRow('Control samples', d.controlN)
		}
	}
	const updateDots = () => {
		cohortDots
			.attr('fill', (d: any) => getColor(d))
			.attr('stroke', (d: any) => getColor(d))
			.attr('stroke-width', 1)
			.attr('d', (d: any) => getShapePath(d))
			.attr('transform', (d: any) => getShapeTransform(d))
			.style('opacity', (d: any) => (isDotHidden(d) ? 0 : 1))
			.style('pointer-events', (d: any) => (isDotHidden(d) ? 'none' : 'auto'))
	}
	const getShapeMapInUse = () => {
		switch (shapeMode) {
			case 'none':
				return assayShapes
			case 'assayType':
				return assayShapes
			case 'cohort':
				return cohortShapes
			case 'proteinAccession':
				return proteinShapes
			default:
				return assayShapes
		}
	}

	const plotAndLegend = panel
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'flex-start')
		.style('gap', '14px')
		.style('flex-wrap', 'wrap')

	const svg = plotAndLegend
		.append('svg')
		.attr('width', width)
		.attr('height', height)
		.style('display', 'block')
		.style('max-width', '100%')
		.style('height', 'auto')
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

	const xAxis = g.append('g').attr('transform', `translate(0,${innerH})`).call(axisBottom(xScale))
	axisstyle({ axis: xAxis, color: 'black', showline: true })

	const yAxis = g.append('g').call(axisLeft(yScale))
	axisstyle({ axis: yAxis, color: 'black', showline: true })

	const x0 = xScale(0)
	const pThreshold = -Math.log10(0.05)
	const thresholdY = yScale(Math.min(yMax, pThreshold))

	// Guide lines
	g.append('line')
		.attr('x1', x0)
		.attr('x2', x0)
		.attr('y1', 0)
		.attr('y2', innerH)
		.attr('stroke', 'black')
		.attr('stroke-dasharray', '5 4')
		.attr('stroke-opacity', 0.4)

	g.append('line')
		.attr('x1', 0)
		.attr('x2', innerW)
		.attr('y1', thresholdY)
		.attr('y2', thresholdY)
		.attr('stroke', 'black')
		.attr('stroke-dasharray', '5 4')
		.attr('stroke-opacity', 0.4)

	// Axis labels
	g.append('text')
		.attr('x', innerW / 2)
		.attr('y', innerH + 44)
		.attr('text-anchor', 'middle')
		.style('font-weight', 600)
		.text('log2 fold change (disease / control)')

	g.append('text')
		.attr('transform', `translate(${-50},${innerH / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.style('font-weight', 600)
		.text('-log10(p-value)')

	// Points
	const cohortDots = g
		.selectAll('path.cohort-dot')
		.data(dots)
		.enter()
		.append('path')
		.attr('class', 'cohort-dot')
		.attr('transform', (d: any) => getShapeTransform(d, 0.9))
		.attr('d', (d: any) => getShapePath(d))
		.attr('fill', (d: any) => getColor(d))
		.attr('fill-opacity', 0.5)
		.attr('stroke', (d: any) => getColor(d))
		.attr('stroke-width', 1)
		.style('cursor', 'pointer')

	cohortDots
		.transition()
		.duration(350)
		.attr('d', (d: any) => getShapePath(d))
		.attr('transform', (d: any) => getShapeTransform(d, 1))

	updateDots()

	cohortDots
		.on('mouseover', function (this: any, _event: any, d: any) {
			const clusterDots = getClusterDots(d)
			renderClusterTooltip(clusterDots)
			self.dom.tip.showunder(this)
		})
		.on('mouseout', () => {
			self.dom.tip.hide()
		})
		.on('click', (_event: any, d: any) => {
			launchViolinPlot(self, d.assayName, d.cohortName, d.uniqueIdentifier)
		})

	const legend = plotAndLegend
		.append('div')
		.style('margin', '0')
		.style('min-width', '220px')
		.style('font-size', '.75em')
		.style('color', '#374151')
	function renderSizeLegend() {
		legendSvg.selectAll('*').remove()
		const stats = updateRadiusScaleForVisibleDots()

		new LegendCircleReference({
			g: legendSvg.append('g').attr('transform', 'translate(12, 8)'),
			inputMax: radiusRange[1],
			inputMin: radiusRange[0],
			maxLabel: stats.maxLabel,
			maxRadius: radiusScale(stats.domainMax),
			minLabel: stats.minLabel,
			minRadius: radiusScale(stats.domainMin),
			title: '',
			menu: {
				minMaxLabel: 'pixels',
				callback: async (obj: { min: number; max: number }) => {
					radiusRange[0] = obj.min
					radiusRange[1] = obj.max
					radiusScale.range([obj.min, obj.max])
					updateDots()
					renderSizeLegend()
				}
			}
		})
	}
	const refreshAfterVisibilityChange = () => {
		updateRadiusScaleForVisibleDots()
		updateDots()
		renderColorLegend()
		renderSizeLegend()
	}

	const termName = self.state.config?.tw?.term?.name || ''
	const svgName = `${termName}.cohort-volcano`
	const downloadVolcanoSvg = () => {
		const plotNode = svg.node()
		const legendNode = legend.node()
		if (!plotNode) return

		const plotWidth = width
		const plotHeight = height
		const legendRect = legendNode?.getBoundingClientRect()
		const legendWidth = Math.max(220, Math.ceil(legendRect?.width || 220))
		const legendHeight = Math.max(plotHeight, Math.ceil(legendRect?.height || 0))
		const gap = 14

		const combinedSvg = select(creator('svg').call(document.documentElement) as SVGSVGElement)
			.attr('width', plotWidth + gap + legendWidth)
			.attr('height', legendHeight)

		combinedSvg.append(() => plotNode.cloneNode(true) as SVGSVGElement)

		combinedSvg
			.append('foreignObject')
			.attr('x', plotWidth + gap)
			.attr('y', 0)
			.attr('width', legendWidth)
			.attr('height', legendHeight)
			.append(() => {
				const clone = legendNode!.cloneNode(true) as HTMLDivElement
				clone.style.margin = '0px'
				clone.style.minWidth = '0px'
				return clone
			})

		to_svg(combinedSvg.node()!, svgName, { apply_dom_styles: true })
	}
	controlIcons.download(downloadBtn, { handler: downloadVolcanoSvg, title: 'Download' })

	const colorLegendDiv = legend.append('div').style('margin-bottom', '12px')
	const shapeLegendDiv = legend.append('div').style('margin-bottom', '12px')
	const sizeLegendRow = legend
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'flex-start')
		.style('gap', '8px')
		.style('margin-top', '8px')

	sizeLegendRow.append('span').style('display', 'inline-block').style('margin-top', '42px').text('Tested sample size')

	const legendSvg = sizeLegendRow.append('svg').attr('width', 190).attr('height', 110).style('display', 'block')

	function renderColorLegend() {
		colorLegendDiv.selectAll('*').remove()
		shapeLegendDiv.selectAll('*').remove()

		const setCreateButtonState = (
			container: any,
			isActive: boolean,
			inputSelector: string,
			buttonSelector: string,
			hasCheckedItems: boolean
		) => {
			if (!isActive) return
			const inputNode = container.select(inputSelector).node() as HTMLInputElement | null
			const createBtn = container.select(buttonSelector)
			if (!inputNode || createBtn.empty()) return
			const shouldDisable = !inputNode.value.trim() || !hasCheckedItems
			createBtn
				.property('disabled', shouldDisable)
				.style('opacity', shouldDisable ? '0.5' : '1')
				.style('cursor', shouldDisable ? 'not-allowed' : 'pointer')
		}

		const updateColorCreateButtonState = () => {
			setCreateButtonState(
				colorLegendDiv,
				groupingModeActive.has(colorMode),
				'input[data-role="custom-group-name"]',
				'button[data-role="create-custom-group-submit"]',
				checkedItemsByMode[colorMode].size > 0
			)
		}

		const updateShapeCreateButtonState = () => {
			setCreateButtonState(
				shapeLegendDiv,
				shapeGroupingModeActive.has(shapeMode),
				'input[data-role="custom-shape-group-name"]',
				'button[data-role="create-custom-shape-group-submit"]',
				checkedShapeItemsByMode[shapeMode].size > 0
			)
		}

		const modeRow = colorLegendDiv
			.append('div')
			.style('display', 'flex')
			.style('gap', '10px')
			.style('margin-bottom', '6px')
			.style('flex-wrap', 'wrap')

		modeRow.append('span').text('Color by')

		for (const { key, label } of colorGroupingModes) {
			modeRow
				.append('span')
				.text(label)
				.style('cursor', 'pointer')
				.style('font-weight', key === colorMode ? '600' : '400')
				.style('text-decoration', key === colorMode ? 'underline' : 'none')
				.style('color', key === colorMode ? '#111' : '#6b7280')
				.on('click', () => {
					groupingModeActive.delete(colorMode)
					checkedItemsByMode[colorMode].clear()
					colorMode = key
					refreshAfterVisibilityChange()
				})
		}

		const makeLegendItems = (items: string[], colorMap: Map<string, string>) => {
			const openColorMenu = (event: any, name: string, swatch: any) => {
				const menu = new Menu({ padding: '0px' })
				const div = menu.d.append('div')
				const hidden = hiddenColor[colorMode].has(name)
				const hiddenCount = hiddenColor[colorMode].size

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(hidden ? 'Show' : 'Hide')
					.on('click', () => {
						if (hidden) hiddenColor[colorMode].delete(name)
						else hiddenColor[colorMode].add(name)
						refreshAfterVisibilityChange()
						menu.hide()
					})

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Show only')
					.on('click', () => {
						hiddenColor[colorMode].clear()
						for (const item of items) {
							if (item != name) hiddenColor[colorMode].add(item)
						}
						refreshAfterVisibilityChange()
						menu.hide()
					})

				if (hiddenCount > 1)
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Show all')
						.on('click', () => {
							hiddenColor[colorMode].clear()
							refreshAfterVisibilityChange()
							menu.hide()
						})

				const input: any = div
					.append('div')
					.attr('class', 'sja_sharp_border')
					.style('padding', '0px 10px')
					.text('Color:')
					.append('input')
					.attr('type', 'color')
					.attr('value', colorMap.get(name) ?? '#888')
					.on('change', () => {
						const newColor = input.node().value
						if (isCustomGroupKey(name) && colorMode != 'none') {
							customGroupColorsByMode[colorMode].set(getCustomGroupNameFromKey(name), newColor)
						} else if (!isCustomGroupKey(name)) {
							if (colorMode == 'assayType') assayColors.set(name, newColor)
							else if (colorMode == 'cohort') cohortColors.set(name, newColor)
							else if (colorMode == 'proteinAccession') proteinColors.set(name, newColor)
						}
						colorMap.set(name, newColor)
						swatch.style('background', newColor)
						updateDots()
						menu.hide()
					})

				if (isCustomGroupKey(name))
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Remove group')
						.on('click', () => {
							removeCustomGroup(colorMode, getCustomGroupNameFromKey(name))
							refreshAfterVisibilityChange()
							menu.hide()
						})
				menu.showunder(event.target)
			}

			for (const name of items) {
				const hidden = hiddenColor[colorMode].has(name)
				const isGroup = isCustomGroupKey(name)
				const displayName = isGroup ? getCustomGroupNameFromKey(name) : name
				const inGroup = !isGroup ? getCustomGroupOfValue(colorMode, name) : null
				const row = colorLegendDiv
					.append('div')
					.style('display', 'flex')
					.style('align-items', 'center')
					.style('gap', '6px')
					.style('margin-bottom', '3px')
				if (!isGroup && groupingModeActive.has(colorMode)) {
					const cb = row.append('input').attr('type', 'checkbox').style('cursor', 'pointer').style('flex-shrink', '0')
					const cbNode = cb.node() as HTMLInputElement
					cbNode.checked = checkedItemsByMode[colorMode].has(name)
					cb.on('change', () => {
						if (cbNode.checked) checkedItemsByMode[colorMode].add(name)
						else checkedItemsByMode[colorMode].delete(name)
						updateColorCreateButtonState()
					})
				}
				const swatch = row
					.append('span')
					.style('display', 'inline-block')
					.style('width', '10px')
					.style('height', '10px')
					.style('border-radius', '50%')
					.style('background', colorMap.get(name) ?? '#888')
					.style('opacity', hidden ? 0.35 : 0.8)
					.style('flex-shrink', '0')
					.style('cursor', 'pointer')
				swatch.on('click', (event: any) => openColorMenu(event, name, swatch))
				row
					.append('span')
					.text(displayName)
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.style('cursor', 'pointer')
					.on('click', (event: any) => openColorMenu(event, name, swatch))
				if (isGroup) {
					const count = customGroupsByMode[colorMode].get(getCustomGroupNameFromKey(name))?.size || 0
					row.append('span').style('color', '#6b7280').text(`(${count} items)`)
				} else if (inGroup) {
					row.append('span').style('color', '#6b7280').style('font-style', 'italic').text(`→ ${inGroup}`)
				}
			}
		}

		const buildModeLegendItems = (baseItems: string[], baseColorMap: Map<string, string>) => {
			if (colorMode === 'none') {
				return { items: baseItems, colorMap: baseColorMap }
			}
			// Hide base items that have been absorbed into a custom group
			const visibleBaseItems = baseItems.filter(name => !getCustomGroupOfValue(colorMode, name))
			const mergedColorMap = new Map<string, string>()
			for (const name of visibleBaseItems) mergedColorMap.set(name, baseColorMap.get(name) ?? '#888')
			for (const name of getCustomGroupItems(colorMode)) {
				const rawName = getCustomGroupNameFromKey(name)
				mergedColorMap.set(name, customGroupColorsByMode[colorMode].get(rawName) ?? '#888')
			}
			return { items: [...visibleBaseItems, ...getCustomGroupItems(colorMode)], colorMap: mergedColorMap }
		}

		const renderCustomGroupControls = () => {
			if (!colorModesWithGroups.includes(colorMode)) return

			if (!groupingModeActive.has(colorMode)) {
				const createBtn = colorLegendDiv
					.append('button')
					.attr('type', 'button')
					.style('font-size', '1em')
					.style('font-weight', '400')
					.style('margin-top', '6px')
					.style('padding', '0')
					.style('border', 'none')
					.style('border-radius', '0')
					.style('background', 'transparent')
					.style('color', '#6b7280')
					.style('box-shadow', 'none')
					.style('cursor', 'pointer')
					.style('transition', 'color 120ms ease')
					.text('+ Create custom group')
					.on('click', () => {
						groupingModeActive.add(colorMode)
						renderColorLegend()
					})
				createBtn
					.on('mouseover', function (this: any) {
						select(this).style('color', '#111827')
					})
					.on('mouseout', function (this: any) {
						select(this).style('color', '#6b7280')
					})
				return
			}

			colorLegendDiv
				.append('div')
				.style('font-size', '11px')
				.style('color', '#6b7280')
				.style('margin-bottom', '4px')
				.text('Check items to include in the new group:')

			const controls = colorLegendDiv
				.append('div')
				.style('display', 'flex')
				.style('gap', '6px')
				.style('align-items', 'center')
				.style('flex-wrap', 'wrap')
				.style('margin-top', '4px')

			const nameInput = controls
				.append('input')
				.attr('data-role', 'custom-group-name')
				.attr('type', 'text')
				.attr('placeholder', 'Group name')
				.style('font-size', '12px')
				.style('padding', '2px 4px')
				.style('min-width', '100px')
				.on('input', () => updateColorCreateButtonState())

			controls
				.append('button')
				.attr('data-role', 'create-custom-group-submit')
				.attr('type', 'button')
				.style('font-size', '12px')
				.style('padding', '2px 6px')
				.text('Create')
				.on('click', () => {
					const groupName = ((nameInput.node() as HTMLInputElement)?.value || '').trim()
					if (!groupName || checkedItemsByMode[colorMode].size < 1) return
					addOrUpdateCustomGroup(colorMode, groupName, [...checkedItemsByMode[colorMode]])
					checkedItemsByMode[colorMode].clear()
					groupingModeActive.delete(colorMode)
					refreshAfterVisibilityChange()
				})

			updateColorCreateButtonState()

			controls
				.append('button')
				.attr('type', 'button')
				.style('font-size', '12px')
				.style('padding', '2px 6px')
				.text('Cancel')
				.on('click', () => {
					checkedItemsByMode[colorMode].clear()
					groupingModeActive.delete(colorMode)
					renderColorLegend()
				})
		}

		if (colorMode === 'assayType') {
			const { items, colorMap } = buildModeLegendItems(assayNames, assayColors)
			makeLegendItems(items, colorMap)
			renderCustomGroupControls()
		} else if (colorMode === 'cohort') {
			const { items, colorMap } = buildModeLegendItems(cohortNames, cohortColors)
			makeLegendItems(items, colorMap)
			renderCustomGroupControls()
		} else if (colorMode === 'proteinAccession') {
			const { items, colorMap } = buildModeLegendItems(proteinAccessions, proteinColors)
			makeLegendItems(items, colorMap)
			renderCustomGroupControls()
		}

		shapeLegendDiv.append('div').style('border-top', '1px solid #e5e7eb').style('margin', '8px 0 8px 0')

		const shapeModeRow = shapeLegendDiv
			.append('div')
			.style('display', 'flex')
			.style('gap', '10px')
			.style('margin-bottom', '6px')
			.style('flex-wrap', 'wrap')

		shapeModeRow.append('span').text('Shape by')

		for (const { key, label } of shapeGroupingModes) {
			shapeModeRow
				.append('span')
				.text(label)
				.style('cursor', 'pointer')
				.style('font-weight', key === shapeMode ? '600' : '400')
				.style('text-decoration', key === shapeMode ? 'underline' : 'none')
				.style('color', key === shapeMode ? '#111' : '#6b7280')
				.on('click', () => {
					shapeGroupingModeActive.delete(shapeMode)
					checkedShapeItemsByMode[shapeMode].clear()
					shapeMode = key
					refreshAfterVisibilityChange()
				})
		}

		const buildShapeLegendItems = (baseItems: string[]) => {
			if (shapeMode === 'none') {
				return { items: baseItems }
			}
			const visibleBaseItems = baseItems.filter(name => !getCustomShapeGroupOfValue(shapeMode, name))
			return { items: [...visibleBaseItems, ...getCustomShapeGroupItems(shapeMode)] }
		}

		const drawShapeLegend = (items: string[], shapeMap: Map<string, number>) => {
			const openShapeMenu = (event: any, name: string) => {
				const menu = new Menu({ padding: '0px' })
				const activeShapeMap = isCustomShapeGroupKey(name) ? customShapeIndicesByMode[shapeMode] : getShapeMapInUse()
				const div = menu.d.append('div')
				const hidden = hiddenShape[shapeMode].has(name)
				const hiddenCount = hiddenShape[shapeMode].size

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text(hidden ? 'Show' : 'Hide')
					.on('click', () => {
						if (hidden) hiddenShape[shapeMode].delete(name)
						else hiddenShape[shapeMode].add(name)
						refreshAfterVisibilityChange()
						menu.hide()
					})

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Show only')
					.on('click', () => {
						hiddenShape[shapeMode].clear()
						for (const item of items) {
							if (item != name) hiddenShape[shapeMode].add(item)
						}
						refreshAfterVisibilityChange()
						menu.hide()
					})

				if (hiddenCount > 1)
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Show all')
						.on('click', () => {
							hiddenShape[shapeMode].clear()
							refreshAfterVisibilityChange()
							menu.hide()
						})

				div
					.append('div')
					.attr('class', 'sja_menuoption sja_sharp_border')
					.text('Change shape')
					.on('click', () => {
						div.selectAll('*').remove()
						shapeSelector(div, (index: number) => {
							const shapeKey = isCustomShapeGroupKey(name) ? getCustomShapeGroupNameFromKey(name) : name
							activeShapeMap.set(shapeKey, index)
							updateDots()
							renderColorLegend()
							menu.hide()
						})
					})

				if (isCustomShapeGroupKey(name))
					div
						.append('div')
						.attr('class', 'sja_menuoption sja_sharp_border')
						.text('Remove group')
						.on('click', () => {
							removeCustomShapeGroup(shapeMode, getCustomShapeGroupNameFromKey(name))
							refreshAfterVisibilityChange()
							menu.hide()
						})

				menu.showunder(event.target)
			}

			for (const name of items) {
				const hidden = hiddenShape[shapeMode].has(name)
				const isGroup = isCustomShapeGroupKey(name)
				const displayName = isGroup ? getCustomShapeGroupNameFromKey(name) : name
				const inGroup = !isGroup ? getCustomShapeGroupOfValue(shapeMode, name) : null
				const row = shapeLegendDiv
					.append('div')
					.style('display', 'flex')
					.style('align-items', 'center')
					.style('gap', '6px')
					.style('margin-bottom', '3px')
				if (!isGroup && shapeGroupingModeActive.has(shapeMode)) {
					const cb = row.append('input').attr('type', 'checkbox').style('cursor', 'pointer').style('flex-shrink', '0')
					const cbNode = cb.node() as HTMLInputElement
					cbNode.checked = checkedShapeItemsByMode[shapeMode].has(name)
					cb.on('change', () => {
						if (cbNode.checked) checkedShapeItemsByMode[shapeMode].add(name)
						else checkedShapeItemsByMode[shapeMode].delete(name)
						updateShapeCreateButtonState()
					})
				}
				const icon = row
					.append('svg')
					.attr('width', 16)
					.attr('height', 16)
					.style('display', 'inline-block')
					.style('cursor', 'pointer')
				icon
					.append('path')
					.attr('transform', 'scale(0.8)')
					.attr(
						'd',
						shapesArray[
							((isGroup
								? customShapeIndicesByMode[shapeMode].get(getCustomShapeGroupNameFromKey(name))
								: shapeMap.get(name)) || 0) % shapesArray.length
						]
					)
					.attr('fill', '#4b5563')
					.attr('fill-opacity', hidden ? 0.35 : 0.9)
				icon.on('click', (event: any) => openShapeMenu(event, name))
				row
					.append('span')
					.text(displayName)
					.style('text-decoration', hidden ? 'line-through' : 'none')
					.style('cursor', 'pointer')
					.on('click', (event: any) => openShapeMenu(event, name))
				if (isGroup) {
					const count = customShapeGroupsByMode[shapeMode].get(getCustomShapeGroupNameFromKey(name))?.size || 0
					row.append('span').style('color', '#6b7280').text(`(${count} items)`)
				} else if (inGroup) {
					row.append('span').style('color', '#6b7280').style('font-style', 'italic').text(`→ ${inGroup}`)
				}
			}
		}

		const renderShapeCustomGroupControls = () => {
			if (!shapeModesWithGroups.includes(shapeMode)) return

			if (!shapeGroupingModeActive.has(shapeMode)) {
				const createBtn = shapeLegendDiv
					.append('button')
					.attr('type', 'button')
					.style('font-size', '1em')
					.style('font-weight', '400')
					.style('margin-top', '6px')
					.style('padding', '0')
					.style('border', 'none')
					.style('border-radius', '0')
					.style('background', 'transparent')
					.style('color', '#6b7280')
					.style('box-shadow', 'none')
					.style('cursor', 'pointer')
					.style('transition', 'color 120ms ease')
					.text('+ Create custom group')
					.on('click', () => {
						shapeGroupingModeActive.add(shapeMode)
						renderColorLegend()
					})
				createBtn
					.on('mouseover', function (this: any) {
						select(this).style('color', '#111827')
					})
					.on('mouseout', function (this: any) {
						select(this).style('color', '#6b7280')
					})
				return
			}

			shapeLegendDiv
				.append('div')
				.style('font-size', '11px')
				.style('color', '#6b7280')
				.style('margin-bottom', '4px')
				.text('Check items to include in the new group:')

			const controls = shapeLegendDiv
				.append('div')
				.style('display', 'flex')
				.style('gap', '6px')
				.style('align-items', 'center')
				.style('flex-wrap', 'wrap')
				.style('margin-top', '4px')

			const nameInput = controls
				.append('input')
				.attr('data-role', 'custom-shape-group-name')
				.attr('type', 'text')
				.attr('placeholder', 'Group name')
				.style('font-size', '12px')
				.style('padding', '2px 4px')
				.style('min-width', '100px')
				.on('input', () => updateShapeCreateButtonState())

			controls
				.append('button')
				.attr('data-role', 'create-custom-shape-group-submit')
				.attr('type', 'button')
				.style('font-size', '12px')
				.style('padding', '2px 6px')
				.text('Create')
				.on('click', () => {
					const groupName = ((nameInput.node() as HTMLInputElement)?.value || '').trim()
					if (!groupName || checkedShapeItemsByMode[shapeMode].size < 1) return
					addOrUpdateCustomShapeGroup(shapeMode, groupName, [...checkedShapeItemsByMode[shapeMode]])
					checkedShapeItemsByMode[shapeMode].clear()
					shapeGroupingModeActive.delete(shapeMode)
					refreshAfterVisibilityChange()
				})

			updateShapeCreateButtonState()

			controls
				.append('button')
				.attr('type', 'button')
				.style('font-size', '12px')
				.style('padding', '2px 6px')
				.text('Cancel')
				.on('click', () => {
					checkedShapeItemsByMode[shapeMode].clear()
					shapeGroupingModeActive.delete(shapeMode)
					renderColorLegend()
				})
		}

		if (shapeMode === 'assayType') {
			const { items } = buildShapeLegendItems(assayNames)
			drawShapeLegend(items, assayShapes)
			renderShapeCustomGroupControls()
		} else if (shapeMode === 'cohort') {
			const { items } = buildShapeLegendItems(cohortNames)
			drawShapeLegend(items, cohortShapes)
			renderShapeCustomGroupControls()
		} else if (shapeMode === 'proteinAccession') {
			const { items } = buildShapeLegendItems(proteinAccessions)
			drawShapeLegend(items, proteinShapes)
			renderShapeCustomGroupControls()
		}
	}

	updateRadiusScaleForVisibleDots()
	renderColorLegend()
	renderSizeLegend()
}

/*
function renderFCSummary(holder: any, data: any, self: ProteinView) {
	holder.selectAll('*').remove()

	// data.nonPTMAssays store the fold change for each nonPTM assay type, data.PTMs store the PTM data (including fold change) for each PTM assay type
	const nonPTMAssays = data?.nonPTMAssays || []

	let maxAbs = 0
	for (const assay of nonPTMAssays) {
		for (const c of assay.nonPTMCohorts || []) {
			const log2ratio = getLog2Ratio(c.value)
			if (log2ratio !== null) maxAbs = Math.max(maxAbs, Math.abs(log2ratio))
		}
	}
	if (maxAbs < 0.05) maxAbs = 0.05 // set a minimum scale for better visualization of small fold changes

	for (const assay of nonPTMAssays) {
		const assayName = assay.assayName
		const section = holder.append('div').style('margin-bottom', '18px')
		section.append('div').style('font-weight', 600).style('margin-bottom', '8px').text(`${assayName}`)

		const header = section
			.append('div')
			.style('display', 'grid')
			.style('grid-template-columns', '220px 30% 100px')
			.style('align-items', 'center')
			.style('gap', '8px')
			.style('margin', '0 0 6px 0')
			.style('font-size', '.75em')
			.style('font-weight', 600)
			.style('color', '#495057')

		header.append('div').text('Cohort')
		const scaleHeader = header.append('div').style('position', 'relative').style('height', '14px')

		scaleHeader.append('div').style('position', 'absolute').style('left', 0).style('top', 0).text((-maxAbs).toFixed(2))

		scaleHeader
			.append('div')
			.style('position', 'absolute')
			.style('left', '50%')
			.style('top', 0)
			.style('transform', 'translateX(-50%)')
			.text('0')

		scaleHeader.append('div').style('position', 'absolute').style('right', 0).style('top', 0).text(maxAbs.toFixed(2))

		header.append('div').text('log2 fold change')

		for (const c of assay.nonPTMCohorts || []) {
			const cohortName = c.cohortName
			const log2ratio = getLog2Ratio(c.value)
			const row = section
				.append('div')
				.style('display', 'grid')
				.style('grid-template-columns', '220px 30% 100px')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('margin', '4px 0')

			row.append('div').style('font-size', '.9em').text(cohortName)

			const track = row
				.append('div')
				.style('height', '14px')
				.style('background', '#f1f3f4')
				.style('border-radius', '7px')
				.style('position', 'relative')
				.style('overflow', 'hidden')
				.style('cursor', 'pointer')
				.attr('title', 'Click to show violin plot')
				.on('click', () => launchViolinPlot(self, assayName, cohortName))

			track
				.append('div')
				.style('position', 'absolute')
				.style('left', '50%')
				.style('top', 0)
				.style('bottom', 0)
				.style('width', '1px')
				.style('transform', 'translateX(-0.5px)')
				.style('background', '#868e96')
				.style('opacity', 0.7)

			const value = Number.isFinite(log2ratio) ? log2ratio : 0
			const ratio = maxAbs > 0 ? Math.abs(value as number) / maxAbs : 0
			const widthPct = Math.max(0, Math.min(50, ratio * 50))
			if (log2ratio !== null && widthPct > 0) {
				track
					.append('div')
					.style('position', 'absolute')
					.style('left', log2ratio >= 0 ? '50%' : `${50 - widthPct}%`)
					.style('top', 0)
					.style('bottom', 0)
					.style('width', `${widthPct}%`)
					.style('background', log2ratio >= 0 ? '#2b8a3e' : '#c92a2a')
					.style('opacity', 1)
			}

			row
				.append('div')
				.style('font-family', 'monospace')
				.style('font-size', '.85em')
				.style('cursor', 'pointer')
				.attr('title', 'Click to show violin plot')
				.on('click', () => launchViolinPlot(self, assayName, cohortName))
				.text(log2ratio !== null ? log2ratio.toFixed(3) : 'NA')
		}
	}
}
*/

function launchViolinPlot(self: ProteinView, assayName: string, cohortName: string, isoform: string) {
	const selectedProtein = self.state.config?.tw?.term
	if (!selectedProtein) throw new Error('proteinView: selected protein term is missing')

	const action: any = {
		type: 'plot_create',
		config: {
			chartType: 'summary'
		}
	}

	action.config.assayCohortTitle = `${assayName}: ${cohortName}`
	action.config.proteomeDetails = { assay: assayName, cohort: cohortName }

	const termdbConfig = self.app.vocabApi.termdbConfig
	const proteomeOverlayTerm = termdbConfig?.queries?.proteome?.overlayTerm
	const t = structuredClone(selectedProtein)
	t.name = `${t.name}: ${isoform}`
	t.proteomeDetails = { assay: assayName, cohort: cohortName }
	action.config.term = { term: t, q: { mode: NumericModes.continuous } }

	if (proteomeOverlayTerm) {
		action.config.term2 = { term: structuredClone(proteomeOverlayTerm), q: {} }
	}

	self.app.dispatch(action)
}

async function renderPTMLollipop(holder: any, ptmCohorts: any, self: ProteinView, isoform: string) {
	if (!ptmCohorts?.length) return

	const custom_variants: any[] = []
	const mergedMclassOverride: any = {}
	const gm = await getGmForPTM(ptmCohorts[0].geneName, self.app.opts.genome.name, isoform)
	for (const ptm of ptmCohorts) {
		//use default gene model to get coordinates for all PTM sites, which is sufficient for most cases
		//and avoids the complexity of mapping between different isoforms. TODO:support isoform-specific mapping.
		if (!gm) continue
		const logValue = getLog2Ratio(ptm.foldChange)
		const pValue = Number(ptm.pValue)
		const testedN = Number(ptm.testedN)
		const controlN = Number(ptm.controlN)

		if (ptm.mclassOverride && typeof ptm.mclassOverride == 'object') {
			Object.assign(mergedMclassOverride, ptm.mclassOverride)
		}

		const site = parsePTMModSites(ptm.modSites)
		if (!site) continue
		const pos = aa2gmcoord(site, gm)
		if (!Number.isInteger(pos)) continue
		const ptmClass = Object.keys(ptm.mclassOverride || {})[0]
		custom_variants.push({
			chr: gm.chr,
			pos,
			mname: ptm.modSites,
			class: ptmClass,
			dt: 1,
			logValue,
			pValue,
			testedN: Number.isFinite(testedN) ? testedN : null,
			controlN: Number.isFinite(controlN) ? controlN : null,
			htmlSections: [
				{ key: 'Assay', html: ptm.assayName || 'NA' },
				{ key: 'Cohort', html: ptm.cohortName || 'NA' },
				{ key: 'Protein Accession', html: ptm.proteinAccession || 'NA' },
				{
					key: 'Action',
					label: 'Launch Violin Plot',
					callback: () => launchViolinPlot(self, ptm.assayName, ptm.cohortName, ptm.uniqueIdentifier)
				}
			]
		})
	}
	if (!custom_variants.length) return

	const mclassOverride = {
		className: 'PTM',
		classes: mergedMclassOverride
	}

	// apply mclass override to global mclass, which will be used by the mds3 track to display the PTM sites.
	// this is necessary because the lollipop plot relies on mclass for variant
	// TODO: find a better way (such as defining PTM-specific class keys) to pass mclass override to the track
	// without modifying global mclass, which can have unintended side effects on other plots.
	for (const key in mclassOverride.classes) {
		if (mclass[key]) Object.assign(mclass[key], mclassOverride.classes[key])
	}

	// create mds3 custom track using numeric mode with logValue on y-axis
	const tk = {
		type: 'mds3',
		name: 'PTMs',
		custom_variants: custom_variants,
		skewerModes: [
			{
				type: 'numeric',
				byAttribute: 'logValue',
				label: 'Log2FC Disease vs Control',
				tooltipPrintValue: m => {
					const p = Number(m.pValue)
					return [
						{ k: 'log2 fold change', v: Number.isFinite(m.logValue) ? roundValue(m.logValue, 3) : 'NA' },
						{ k: 'p value', v: Number.isFinite(p) && p > 0 ? p.toExponential(2) : 'NA' },
						{ k: 'Tested samples', v: Number.isFinite(m.testedN) ? m.testedN : 'NA' },
						{ k: 'Control samples', v: Number.isFinite(m.controlN) ? m.controlN : 'NA' }
					]
				},
				inuse: true,
				axisheight: 100
			}
		],
		mclassOverride
	}

	// launch block in protein mode with custom track
	const arg = {
		holder: holder.append('div'),
		genome: self.app.opts.genome,
		nobox: true,
		tklst: [tk],
		mclassOverride,
		debugmode: self.app.opts.debug,
		query: gm.isoform
	}

	const _ = await import('#src/block.init')
	await _.default(arg)
}

// return the first valid modification site parsed from the modSites string, which is expected to be in the format like "S10", or "S10,T11"
// for now return the first valid site for simplicity. TODO: parse and display multiple sites if available.
function parsePTMModSites(modSites: string) {
	if (!modSites) return null
	const regex = /([A-Za-z])(\d+)/g
	let m
	while ((m = regex.exec(modSites)) !== null) {
		const position = Number(m[2])
		if (!Number.isInteger(position) || position < 1) continue
		return position
	}
	return null
}

async function getGmForPTM(geneName: string, genomeName: string, isoform: string) {
	if (!geneName) return null
	const d = await dofetch3('genelookup', {
		body: {
			deep: 1,
			genome: genomeName,
			input: geneName
		}
	})

	if (d.error || !Array.isArray(d.gmlst) || !d.gmlst.length) return null

	const normalizedIsoform = isoform?.trim().toUpperCase()
	const gm =
		d.gmlst.find((i: any) => i.isoform && normalizedIsoform && i.isoform.toUpperCase() == normalizedIsoform) ||
		d.gmlst.find((i: any) => i.isdefault) ||
		d.gmlst[0]
	return gm
}

function getLog2Ratio(foldChange: number) {
	if (!Number.isFinite(foldChange) || foldChange <= 0) return null
	return Math.log2(foldChange)
}

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	if (!opts.tw) throw new Error('proteinView requires opts.tw')
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
					chartType: 'proteinView',
					tw: {
						term: {
							gene: geneSearch.geneSymbol,
							name: geneSearch.geneSymbol,
							type: TermTypes.PROTEOME_ABUNDANCE
						}
					}
				}
			})
		}
	})
}

export const proteinViewInit = getCompInit(ProteinView)
export const componentInit = proteinViewInit
