import { Menu, table2col } from '#dom'
import { axisstyle, newpane } from '#src/client'
import { dofetch3 } from '#common/dofetch'
import type { DapConcordance } from '#types'
import {
	loadBrainAssets,
	renderBrainSvg,
	makeDiseaseTabs,
	makeBrainFcScale,
	brainFillByRegion,
	brainTooltipByRegion,
	BRAIN_P_THRESHOLD,
	type BrainAssets
} from './brainRegions.svg'
import { axisBottom, axisLeft, scaleLinear, scaleBand, scalePoint, scaleSqrt, line as d3line, select } from 'd3'
import { NumericModes } from '#shared/terms.js'
import { roundValue } from '#shared/roundValue.js'

/*********************************************************************
 * proteinView study tiles
 *
 * Each tile answers one question about the searched protein and renders
 * only when the underlying study data supports it (tile-per-plot design).
 * Nothing about the dataset is hardcoded here: the tile list (titles,
 * order, which cohorts feed which tile) and the vocabulary (diseases,
 * models, cell types) come from queries.proteome.proteinView in the
 * dataset file; cohort metadata (disease/model/cellType/ageGroup/
 * brainRegion) from the per-cohort `catalog` blocks that termdb.config
 * ships to the client. This file only holds the renderers.
 *
 * Tiles are gene-level: when a cohort measured several isoforms
 * (accessions), the most significant one represents the cohort, matching
 * how the source papers report proteins (protein-group level, by gene
 * symbol). The full per-isoform detail stays in the overview volcano and
 * the PTM track.
 *********************************************************************/

/************ dataset config accessors ************/

type CohortMatch = {
	organism?: string
	assay?: string
	catalog?: { [k: string]: string }
	with?: string[]
	without?: string[]
}
type PairSide = CohortMatch & { label: string; ageVaries?: boolean }
export type TileCfg = {
	key: string
	title: string
	subtitle: string
	cohortMatch?: CohortMatch
	xLabel?: string
	yLabel?: string
	pairs?: { key: string; label: string; x: PairSide; y: PairSide }[]
	/** key of another tile whose entries are the reference side of a paired tile
	 *  (e.g. the whole-proteome tile for the insoluble dumbbell), matched by cohort name */
	referenceTile?: string
	defaultAge?: string
	note?: string
}

export function getProteinViewConfig(self: any): any {
	return self?.app?.vocabApi?.termdbConfig?.queries?.proteome?.proteinView || {}
}
export function getTileConfigs(self: any): TileCfg[] {
	return getProteinViewConfig(self).tiles || []
}
export function getTileConfig(self: any, key: string): TileCfg | undefined {
	return getTileConfigs(self).find(t => t.key === key)
}
// disease code → {name,label?,specificityControl?}; key order = axis order
function diseaseCfg(self: any): { [code: string]: { name: string; label?: string; specificityControl?: boolean } } {
	return getProteinViewConfig(self).diseases || {}
}
const diseaseOrder = (self: any) => Object.keys(diseaseCfg(self))
const diseaseLabel = (self: any, d: string) => diseaseCfg(self)[d]?.label || d
const isSpecificityControl = (self: any, d: string) => !!diseaseCfg(self)[d]?.specificityControl
const modelOrder = (self: any): string[] => Object.keys(getProteinViewConfig(self).models || {})
const modelColor = (self: any, m: string) => getProteinViewConfig(self).models?.[m]?.color || SINGLE_MODEL_COLOR
const cellTypeCfg = (self: any): { [ct: string]: { note?: string } } => getProteinViewConfig(self).cellTypes || {}
const proteomeLabel = (self: any, organism: string, assay: string) =>
	self?.app?.vocabApi?.termdbConfig?.queries?.proteome?.organisms?.[organism]?.assays?.[assay]?.proteomeLabel || assay

// sort keys by their position in a configured order; unknown keys keep
// their relative order after the known ones
export function orderBy(keys: string[], order: string[]) {
	const rank = (k: string) => (order.indexOf(k) === -1 ? order.length : order.indexOf(k))
	return [...keys].sort((a, b) => rank(a) - rank(b))
}

// does a cohort (by organism/assay + catalog) satisfy a cohortMatch rule
export function cohortMatches(m: CohortMatch | undefined, organism: string, assay: string, catalog: any): boolean {
	if (!m) return false
	if (m.organism && m.organism !== organism) return false
	if (m.assay && m.assay !== assay) return false
	const c = catalog || {}
	for (const k in m.catalog || {}) if (c[k] !== m.catalog![k]) return false
	for (const k of m.with || []) if (!c[k]) return false
	for (const k of m.without || []) if (c[k]) return false
	return true
}

const SIG_P = 0.05

// leading integer of an age-group label ("6 months" → 6); null when absent
export function parseAge(ageGroup: string | undefined): number | null {
	const n = parseInt(ageGroup || '')
	return Number.isFinite(n) ? n : null
}
const byAge = (a: string, b: string) => (parseAge(a) ?? 0) - (parseAge(b) ?? 0)

// memoized fetch shared by the tile faces and their expanded panes: one
// in-flight promise per key; a rejection is not cached so a retry refetches
const fetchCache = new Map<string, Promise<any>>()
function cachedFetch<T>(key: string, load: () => Promise<T>): Promise<T> {
	if (!fetchCache.has(key)) {
		const p = load()
		p.catch(() => fetchCache.delete(key))
		fetchCache.set(key, p)
	}
	return fetchCache.get(key)!
}
const vocabKey = (self: any) => `${self.app.opts.state.vocab.genome}|${self.app.opts.state.vocab.dslabel}`

// geometry scaling: tile faces render compact, the expanded pane large.
// scaleX compresses widths further than heights so charts fit narrow cards;
// it defaults to scale when unset.
export type TileRenderOpts = { scale?: number; scaleX?: number; expanded?: boolean }
const TILE_FACE_SCALE = 0.67
const TILE_FACE_SCALE_X = 0.45
const EXPANDED_SCALE = 1.7
// uniform card footprint so the grid reads as even rows
const CARD_W = 230
const CARD_MIN_H = 235

const SINGLE_MODEL_COLOR = '#6b7280'
const ND_COLOR = '#4263eb'
const PSY_COLOR = '#9ca3af'
const WHOLE_COLOR = '#2166ac'
const INSOLUBLE_COLOR = '#b2182b'
const REFERENCE_COLOR = '#111827'
// diverging fold-change colors, same semantics as cellTypeBubbleHeatmap
const FC_NEG_COLOR = '#762a83'
const FC_ZERO_COLOR = '#f7f7f7'
const FC_POS_COLOR = '#2166ac'

export function getLog2Ratio(foldChange: number) {
	if (!Number.isFinite(foldChange) || foldChange <= 0) return null
	return Math.log2(foldChange)
}

export function launchViolinPlot(
	self: any,
	organismName: string,
	assayName: string,
	cohortName: string,
	isoform: string
) {
	const selectedProtein = self.state.config?.tw?.term
	if (!selectedProtein) throw new Error('proteinView: selected protein term is missing')

	const action: any = {
		type: 'plot_create',
		config: {
			chartType: 'summary'
		}
	}
	action.config.assayCohortTitle = `${organismName} ${assayName}: ${cohortName}`
	action.config.proteomeDetails = { organism: organismName, assay: assayName, cohort: cohortName }

	const termdbConfig = self.app.vocabApi.termdbConfig
	const proteomeOverlayTerm = termdbConfig?.queries?.proteome?.organisms?.[organismName]?.overlayTerm
	const t = structuredClone(selectedProtein)
	t.name = `${t.name}: ${isoform}`
	t.dataTypeDetails = { organism: organismName, assay: assayName, cohort: cohortName }
	action.config.term = { term: t, q: { mode: NumericModes.continuous } }

	if (proteomeOverlayTerm) {
		action.config.term2 = { term: structuredClone(proteomeOverlayTerm), q: {} }
	}

	self.app.dispatch(action)
}

export type TileEntry = {
	organism: string
	assayName: string
	cohortName: string
	disease?: string
	uniqueIdentifier: string
	proteinAccession: string
	log2fc: number | null
	/** FDR (BH-adjusted p) from the cohort's DAP file */
	fdr: number | null
	testedN: number
	controlN: number
	isoformCount: number // how many accessions this cohort measured; entry is the most significant
	catalog: any
	// set only for PTM-site entries (the PTM summary card face)
	ptmType?: string
	modSites?: string
}

export type TileData = {
	/** tile key → its cohort entries, routed by each tile's cohortMatch */
	byTile: { [tileKey: string]: TileEntry[] }
	isoformCount: number
	ptmSiteCount: number
	cohortCount: number
}

const entries = (td: TileData, key: string): TileEntry[] => td.byTile[key] || []

// per-cohort catalog metadata (disease/model/cellType/ageGroup/…) that
// termdb.config ships to the client for the studyCatalog plot
export function catalogForEntry(self: any, e: any) {
	return self.app.vocabApi.termdbConfig?.queries?.proteome?.organisms?.[e.organism]?.assays?.[e.assayName]?.cohorts?.[
		e.cohortName
	]?.catalog
}

// One representative (most significant, valid fold change) entry per
// cohort; the source papers report at protein-group level, so tiles do too.
export function prepareTileData(data: any, self: any): TileData {
	const catalogFor = (e: any) => catalogForEntry(self, e)

	const accessions = new Set<string>()
	let ptmSiteCount = 0

	// collapse to one representative entry per (organism, assay, cohort)
	const byCohort = new Map<string, { best: any; count: number }>()
	for (const e of data?.cohorts || []) {
		if (e.PTMType) {
			ptmSiteCount++
			continue
		}
		accessions.add(e.proteinAccession)
		const log2fc = getLog2Ratio(e.foldChange)
		if (log2fc === null) continue
		const key = `${e.organism}|${e.assayName}|${e.cohortName}`
		const p = Number(e.fdr)
		const pRank = Number.isFinite(p) && p > 0 ? p : Infinity
		const cur = byCohort.get(key)
		if (!cur) byCohort.set(key, { best: { e, pRank }, count: 1 })
		else {
			cur.count++
			if (pRank < cur.best.pRank) cur.best = { e, pRank }
		}
	}

	const tiles = getTileConfigs(self)
	const td: TileData = {
		byTile: Object.fromEntries(tiles.map(t => [t.key, []])),
		isoformCount: accessions.size,
		ptmSiteCount,
		cohortCount: byCohort.size
	}

	for (const { best, count } of byCohort.values()) {
		const e = best.e
		const catalog = catalogFor(e)
		if (!catalog) continue // cohort not in the study catalog; volcano still shows it
		const p = Number(e.fdr)
		const entry: TileEntry = {
			organism: e.organism,
			assayName: e.assayName,
			cohortName: e.cohortName,
			disease: catalog.disease || e.disease,
			uniqueIdentifier: e.uniqueIdentifier,
			proteinAccession: e.proteinAccession,
			log2fc: getLog2Ratio(e.foldChange),
			fdr: Number.isFinite(p) && p > 0 ? p : null,
			testedN: Number(e.testedN) || 0,
			controlN: Number(e.controlN) || 0,
			isoformCount: count,
			catalog
		}
		// first tile (in dataset order) whose rule the cohort satisfies
		const tile = tiles.find(t => cohortMatches(t.cohortMatch, e.organism, e.assayName, catalog))
		if (tile) td.byTile[tile.key].push(entry)
	}

	return td
}

/************ card + interaction scaffolding ************/

export function makeTileGrid(holder: any) {
	// default align-items (stretch) equalizes card heights within each row.
	// white-space is reset because the mass plot holder sets nowrap (for
	// horizontally-scrolling plots), which would keep card text from wrapping.
	return holder
		.append('div')
		.style('display', 'flex')
		.style('flex-wrap', 'wrap')
		.style('gap', '14px')
		.style('margin-top', '10px')
		.style('white-space', 'normal')
}

export function makeTileCard(
	grid: any,
	opts: {
		title: string
		subtitle?: string
		fullWidth?: boolean
		// fixed footprint (CARD_W × ≥CARD_MIN_H) so tile cards line up evenly
		uniform?: boolean
		// greyed placeholder card (tile exists in the atlas but has no data here)
		disabled?: boolean
		// when set, an expand button in the card header opens the larger view
		onExpand?: () => void
	}
) {
	const card = grid
		.append('div')
		.style('border', opts.disabled ? '1px dashed #e5e7eb' : '1px solid #e5e7eb')
		.style('border-radius', '8px')
		.style('padding', '10px 12px')
		.style('background', opts.disabled ? '#f9fafb' : '#fff')
	if (opts.fullWidth) card.style('flex', '1 1 100%')
	if (opts.uniform) {
		card
			.style('width', `${CARD_W}px`)
			.style('min-height', `${CARD_MIN_H}px`)
			.style('display', 'flex')
			.style('flex-direction', 'column')
	}

	const header = card
		.append('div')
		.style('display', 'flex')
		.style('align-items', 'baseline')
		.style('gap', '8px')
		.style('flex-wrap', 'wrap')
	header
		.append('span')
		.style('font-weight', '600')
		.style('font-size', '.9em')
		.style('min-width', '0') // let long titles wrap instead of overflowing the card
		.style('color', opts.disabled ? '#9ca3af' : '#111827')
		.text(opts.title)
	if (opts.onExpand) {
		header
			.append('span')
			.attr('title', 'Expand')
			.attr('role', 'button')
			.attr('tabindex', '0')
			.attr('aria-label', `Expand ${opts.title}`)
			.style('margin-left', 'auto')
			.style('cursor', 'pointer')
			.style('color', '#9ca3af')
			.style('font-size', '1em')
			.style('line-height', '1')
			.text('⤢')
			.on('mouseover', function (this: any) {
				select(this).style('color', '#374151')
			})
			.on('mouseout', function (this: any) {
				select(this).style('color', '#9ca3af')
			})
			.on('click', opts.onExpand)
			.on('keydown', (event: KeyboardEvent) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault()
					opts.onExpand?.()
				}
			})
	}
	if (opts.subtitle) {
		card
			.append('div')
			.style('font-size', '.75em')
			.style('color', '#6b7280')
			.style('margin', '2px 0 4px 0')
			.text(opts.subtitle)
	}
	return card.append('div')
}

const tileClickMenu = new Menu({ padding: '0px' })

// Expanded-tile panes need an explicit z-index: app chrome such as the
// sandbox header carries z-index 99, which would paint over a z-auto pane's
// top edge. Shared menus go one higher so tooltips stay above panes. When
// the embedder configures base_zindex, newpane/Menu already set their own
// inline z-index and these defaults stay out of the way.
export const TILE_PANE_ZINDEX = 100

// Re-append the shared menus so tooltips stay above an expanded-tile pane in
// DOM order too (also after the pane is dragged, which re-appends the pane),
// and give them a z-index above the pane's.
export function raiseSharedMenus(self: any) {
	for (const m of [self?.dom?.tip, tileClickMenu]) {
		const n = m?.d?.node?.()
		if (!n) continue
		if (!n.style.zIndex) n.style.zIndex = String(TILE_PANE_ZINDEX + 1)
		if (n.parentNode === document.body && n !== document.body.lastChild) document.body.appendChild(n)
	}
}

function entryTipTable(entry: TileEntry, holder: any) {
	const tbl = table2col({ holder: holder.append('table') })
	tbl.addRow('Sample set', entry.cohortName)
	const c = entry.catalog || {}
	if (entry.disease) tbl.addRow('Disease', entry.disease)
	if (c.model) tbl.addRow('Model', c.model)
	if (c.cellType) tbl.addRow('Cell type', c.cellType)
	if (c.ageGroup) tbl.addRow('Age group', c.ageGroup)
	if (c.brainRegion) tbl.addRow('Brain region', c.brainRegion)
	if (entry.ptmType) tbl.addRow('PTM type', entry.ptmType)
	if (entry.modSites) tbl.addRow('Modified site', entry.modSites)
	tbl.addRow('Assay', entry.assayName)
	tbl.addRow('log2 fold change', entry.log2fc === null ? 'NA' : roundValue(entry.log2fc, 3))
	tbl.addRow('FDR', entry.fdr === null ? 'NA' : entry.fdr.toExponential(2))
	tbl.addRow('Case samples', entry.testedN)
	tbl.addRow('Control samples', entry.controlN)
	tbl.addRow('Protein accession', entry.proteinAccession)
	if (entry.isoformCount > 1) tbl.addRow('Note', `most significant of ${entry.isoformCount} isoforms`)
}

// hover tooltip + click menu (violin launch) for a tile data point
function attachEntryBehavior(shape: any, entry: TileEntry, self: any) {
	shape
		.style('cursor', 'pointer')
		.on('mouseover', (event: MouseEvent) => {
			raiseSharedMenus(self)
			self.dom.tip.clear()
			entryTipTable(entry, self.dom.tip.d)
			self.dom.tip.show(event.clientX, event.clientY)
		})
		.on('mouseout', () => self.dom.tip.hide())
		.on('click', (event: MouseEvent) => {
			raiseSharedMenus(self)
			self.dom.tip.hide()
			tileClickMenu.clear()
			const div = tileClickMenu.d.append('div')
			entryTipTable(entry, div.append('div').style('padding', '5px'))
			div
				.append('div')
				.attr('class', 'sja_menuoption sja_sharp_border')
				.text('Violin plot')
				.on('click', () => {
					tileClickMenu.hide()
					launchViolinPlot(self, entry.organism, entry.assayName, entry.cohortName, entry.uniqueIdentifier)
				})
			tileClickMenu.show(event.clientX, event.clientY)
		})
}

const isSig = (e: TileEntry) => e.fdr !== null && e.fdr < SIG_P

function drawMarker(g: any, x: number, y: number, color: string, sig: boolean, r = 4.5) {
	return g
		.append('circle')
		.attr('cx', x)
		.attr('cy', y)
		.attr('r', r)
		.attr('fill', sig ? color : '#fff')
		.attr('fill-opacity', sig ? 0.9 : 1)
		.attr('stroke', color)
		.attr('stroke-width', 1.5)
}

// y (or x) domain for log2FC values: always includes 0, padded
function fcDomain(values: number[]): [number, number] {
	let min = Math.min(0, ...values)
	let max = Math.max(0, ...values)
	const span = Math.max(0.4, max - min)
	const pad = span * 0.15
	if (min < 0) min -= pad
	max += pad
	if (min === 0) min = -span * 0.05 // keep the zero line off the plot edge
	return [min, max]
}

function addSigFootnote(body: any) {
	body
		.append('div')
		.style('font-size', '.7em')
		.style('color', '#9ca3af')
		.style('margin-top', '2px')
		.text(`filled: FDR < ${SIG_P}; hollow: not significant`)
}

function drawZeroLine(g: any, x1: number, y1: number, x2: number, y2: number) {
	g.append('line')
		.attr('x1', x1)
		.attr('y1', y1)
		.attr('x2', x2)
		.attr('y2', y2)
		.attr('stroke', 'black')
		.attr('stroke-dasharray', '4 3')
		.attr('stroke-opacity', 0.35)
}

function styledAxis(g: any, axis: any, tickFontSize?: string | null) {
	const a = g.call(axis)
	axisstyle({ axis: a, color: 'black', showline: true })
	// compact tile faces shrink tick labels so categorical axes don't collide
	if (tickFontSize) a.selectAll('text').style('font-size', tickFontSize)
	return a
}

// slant categorical x-tick labels on very narrow charts so they don't collide
function rotateXTicks(axisG: any) {
	axisG
		.selectAll('text')
		.attr('transform', 'rotate(-38)')
		.attr('text-anchor', 'end')
		.attr('dx', '-2px')
		.attr('dy', '5px')
}

function yAxisTitle(svg: any, innerH: number, marginTop: number, text: string) {
	svg
		.append('text')
		.attr('transform', `translate(11,${marginTop + innerH / 2}) rotate(-90)`)
		.attr('text-anchor', 'middle')
		.style('font-size', '11px')
		.style('fill', '#374151')
		.text(text)
}

/************ tile renderers ************/

// Tile — cross-disease profile: lollipop of log2FC per disease;
// the blue side answers "this protein changes in which diseases?"
// BD and SCZ are psychiatric disorders, while the others are neurodegenerative diseases.
// the grey side (diseases flagged specificityControl in the dataset config,
// e.g. psychiatric controls) answers "is the change neurodegeneration-specific or a generic brain-disease signal?"
function renderCrossDiseaseTile(body: any, td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const k = opts.scale || 1
	const kx = opts.scaleX ?? k
	const mr = 4.5 * Math.sqrt(k)
	const tickFont = k < 1 ? '8.5px' : null
	const byDisease = new Map<string, TileEntry>()
	// several cohorts may share a disease: show the most significant one and say so
	const multiCohort = new Set<string>()
	for (const e of entries(td, cfg.key)) {
		const d = e.disease || e.cohortName
		const cur = byDisease.get(d)
		if (cur) multiCohort.add(d)
		if (!cur || (e.fdr ?? Infinity) < (cur.fdr ?? Infinity)) byDisease.set(d, e)
	}
	const diseases = orderBy([...byDisease.keys()], diseaseOrder(self))
	const isControl = (d: string) => isSpecificityControl(self, d)

	const margin = { top: 12, right: 10, bottom: 34, left: 46 }
	const innerW = Math.max(200, diseases.length * 38) * kx
	const innerH = 150 * k
	const svg = body
		.append('svg')
		.attr('width', innerW + margin.left + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

	const x = scaleBand().domain(diseases).range([0, innerW]).padding(0.4)
	const y = scaleLinear()
		.domain(fcDomain(diseases.map(d => byDisease.get(d)!.log2fc as number)))
		.range([innerH, 0])

	const xAxisG = styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x), tickFont)
	if (kx < 0.6) rotateXTicks(xAxisG)
	styledAxis(g.append('g'), axisLeft(y).ticks(4), tickFont)
	drawZeroLine(g, 0, y(0), innerW, y(0))
	yAxisTitle(svg, innerH, margin.top, 'log2FC vs control')

	// separator before the psychiatric controls
	const firstPsy = diseases.findIndex(isControl)
	if (firstPsy > 0) {
		const xSep = (x(diseases[firstPsy - 1])! + x.bandwidth() + x(diseases[firstPsy])!) / 2
		g.append('line')
			.attr('x1', xSep)
			.attr('x2', xSep)
			.attr('y1', 0)
			.attr('y2', innerH)
			.attr('stroke', '#d1d5db')
			.attr('stroke-dasharray', '2 3')
		// the label needs more room than a narrow face has; the muted grey
		// dots still mark the group, and the expanded view spells it out
		if (kx >= 0.6) {
			g.append('text')
				.attr('x', (xSep + innerW) / 2)
				.attr('y', 9)
				.attr('text-anchor', 'middle')
				.style('font-size', '9px')
				.style('fill', '#9ca3af')
				.text(getProteinViewConfig(self).specificityControlLabel || 'controls')
		}
	}

	for (const d of diseases) {
		const e = byDisease.get(d)!
		const cx = x(d)! + x.bandwidth() / 2
		const color = isControl(d) ? PSY_COLOR : ND_COLOR
		g.append('line')
			.attr('x1', cx)
			.attr('x2', cx)
			.attr('y1', y(0))
			.attr('y2', y(e.log2fc as number))
			.attr('stroke', color)
			.attr('stroke-width', 1.5)
		attachEntryBehavior(drawMarker(g, cx, y(e.log2fc as number), color, isSig(e), mr), e, self)
	}

	// relabel ticks that have a nicer display name
	g.selectAll('text').each(function (this: any) {
		const t = (this as SVGTextElement).textContent || ''
		const l = diseaseLabel(self, t)
		if (l !== t) (this as SVGTextElement).textContent = l
	})

	addSigFootnote(body)
	if (multiCohort.size) {
		body
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#9ca3af')
			.text(`${[...multiCohort].map(d => diseaseLabel(self, d)).join(', ')}: several cohorts, most significant shown`)
	}
	if (opts.expanded) {
		body
			.append('div')
			.style('font-size', '.75em')
			.style('color', '#6b7280')
			.style('margin-top', '4px')
			.style('max-width', `${innerW + margin.left + margin.right}px`)
			.text(diseases.map(d => `${diseaseLabel(self, d)} = ${diseaseCfg(self)[d]?.name || d}`).join(' · '))
	}
}

// Tile 2 — whole vs insoluble dumbbell:
// answers: "Does this protein accumulate in the insoluble/aggregated fraction beyond any change in its total abundance (is it aggregating)?"
// Red far to the right of blue → the protein piles up in the insoluble fraction much more than its total level rises: the aggregation signature.
function renderInsolubleTile(body: any, td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const k = opts.scale || 1
	const kx = opts.scaleX ?? k
	const mr = 4.5 * Math.sqrt(k)
	const tickFont = k < 1 ? '8.5px' : null
	const wholeByCohort = new Map<string, TileEntry>()
	// the reference (whole proteome) side comes from the tile named by cfg.referenceTile
	if (cfg.referenceTile) for (const e of entries(td, cfg.referenceTile)) wholeByCohort.set(e.cohortName, e)
	const insol = entries(td, cfg.key)
	const rows = orderBy([...new Set(insol.map(e => e.cohortName))], diseaseOrder(self))

	const pairs = rows.map(c => ({
		cohortName: c,
		whole: wholeByCohort.get(c) || null,
		insoluble: insol.find(e => e.cohortName === c) || null
	}))
	// legend labels from the assays' proteomeLabel in the dataset config
	const wholeEntry = pairs.find(p => p.whole)?.whole
	const labelOf = (e: TileEntry | null | undefined, fallback: string) =>
		e ? proteomeLabel(self, e.organism, e.assayName) : fallback

	const margin = { top: 24, right: 12, bottom: 34, left: 46 }
	const innerW = 240 * kx
	const innerH = Math.max(90, rows.length * 30 * k)
	const svg = body
		.append('svg')
		.attr('width', innerW + margin.left + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

	const values: number[] = []
	for (const p of pairs) {
		if (p.whole) values.push(p.whole.log2fc as number)
		if (p.insoluble) values.push(p.insoluble.log2fc as number)
	}
	const x = scaleLinear().domain(fcDomain(values)).range([0, innerW])
	const y = scaleBand().domain(rows).range([0, innerH]).padding(0.4)

	styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x).ticks(4), tickFont)
	styledAxis(g.append('g'), axisLeft(y), tickFont)
	drawZeroLine(g, x(0), 0, x(0), innerH)
	svg
		.append('text')
		.attr('x', margin.left + innerW / 2)
		.attr('y', margin.top + innerH + 30)
		.attr('text-anchor', 'middle')
		.style('font-size', '11px')
		.style('fill', '#374151')
		.text('log2FC vs control')

	// inline legend
	const legend = g.append('g').attr('transform', `translate(0,-12)`)
	for (const [i, item] of [
		{
			label: labelOf(wholeEntry, getTileConfig(self, cfg.referenceTile || '')?.title || 'reference'),
			color: WHOLE_COLOR
		},
		{ label: labelOf(insol[0], cfg.cohortMatch?.assay || cfg.title), color: INSOLUBLE_COLOR }
	].entries()) {
		const lx = i * (kx < 0.6 ? 58 : 80)
		legend.append('circle').attr('cx', lx).attr('cy', 0).attr('r', 4).attr('fill', item.color).attr('fill-opacity', 0.9)
		legend
			.append('text')
			.attr('x', lx + 8)
			.attr('y', 3)
			.style('font-size', '10px')
			.style('fill', '#374151')
			.text(item.label)
	}

	for (const p of pairs) {
		const cy = y(p.cohortName)! + y.bandwidth() / 2
		if (p.whole && p.insoluble) {
			g.append('line')
				.attr('x1', x(p.whole.log2fc as number))
				.attr('x2', x(p.insoluble.log2fc as number))
				.attr('y1', cy)
				.attr('y2', cy)
				.attr('stroke', '#9ca3af')
				.attr('stroke-width', 1.5)
		}
		if (p.whole)
			attachEntryBehavior(
				drawMarker(g, x(p.whole.log2fc as number), cy, WHOLE_COLOR, isSig(p.whole), mr),
				p.whole,
				self
			)
		if (p.insoluble)
			attachEntryBehavior(
				drawMarker(g, x(p.insoluble.log2fc as number), cy, INSOLUBLE_COLOR, isSig(p.insoluble), mr),
				p.insoluble,
				self
			)
	}

	addSigFootnote(body)
}

// Tile — brain regional proteome: 9 regions coloured by log2FC where significant
// answers: Where in the brain does this protein change?
// thresholding/coloring rules are shared with the standalone brainRegions plot (brainRegions.svg.ts)
let brainGradientSeq = 0

// per-gene fetch of the brainRegions route data; the parsed svg assets are
// gene-independent and cached once per svgUrl
function getBrainRegionsData(self: any): Promise<{ data: any; assets: BrainAssets | null }> {
	const gene = self.state?.config?.tw?.term?.name
	const [genome, dslabel] = vocabKey(self).split('|')
	return cachedFetch(`brainRegions|${vocabKey(self)}|${gene}`, async () => {
		const data = await dofetch3('termdb/brainRegions', { body: { genome, dslabel, gene } })
		if (data.error) throw data.error
		const assets = Object.keys(data.isoforms || {}).length
			? await cachedFetch(`brainAssets|${data.svgUrl}`, () => loadBrainAssets(data.svgUrl, Object.keys(data.regions)))
			: null
		return { data, assets }
	})
}

// fold-change color scale for one isoform, scoped to the selected disease
const brainFcScale = (isoformData: any, disease: string) => makeBrainFcScale(isoformData.data[disease] || {})

// one brain for one disease; same coloring rules as the standalone
// brainRegions plot (significant fold changes only)
function drawBrainForDisease(
	holder: any,
	data: any,
	assets: BrainAssets,
	isoform: string,
	disease: string,
	self: any,
	brainW: number,
	colorScale: any
) {
	const regionData = data.isoforms[isoform]?.data?.[disease] || {}
	renderBrainSvg({
		holder: holder.append('div'),
		width: brainW,
		templateUrl: data.templateUrl,
		assets,
		regions: data.regions,
		tip: self.dom.tip,
		fillByRegion: brainFillByRegion(regionData, colorScale),
		tooltipByRegion: brainTooltipByRegion(regionData)
	})
}

function drawBrainLegend(holder: any, colorScale: any, maxAbsFC: number, nSig: number, disease: string) {
	const legend = holder.append('div').style('margin-top', '6px')
	if (!nSig) {
		// nothing passes the threshold: the gradient would only show the ±1 fallback domain
		legend
			.append('div')
			.style('font-size', '.75em')
			.style('color', '#6b7280')
			.text(`No region reaches p < ${BRAIN_P_THRESHOLD} for this isoform in ${disease} (all regions grey).`)
		return
	}
	const w = 160
	const h = 10
	const svg = legend
		.append('svg')
		.attr('width', w)
		.attr('height', h + 16)
	const gradientId = `pv-brain-fc-gradient-${brainGradientSeq++}`
	const gradient = svg
		.append('defs')
		.append('linearGradient')
		.attr('id', gradientId)
		.attr('x1', '0')
		.attr('y1', '0')
		.attr('x2', '1')
		.attr('y2', '0')
	const steps = 10
	for (let i = 0; i <= steps; i++) {
		const t = i / steps
		gradient
			.append('stop')
			.attr('offset', `${t * 100}%`)
			.attr('stop-color', colorScale(-maxAbsFC + t * 2 * maxAbsFC))
	}
	svg.append('rect').attr('width', w).attr('height', h).attr('fill', `url(#${gradientId})`).attr('stroke', '#d1d5db')
	const labels: Array<[number, string, string]> = [
		[0, `-${maxAbsFC.toFixed(2)}`, 'start'],
		[w / 2, '0', 'middle'],
		[w, maxAbsFC.toFixed(2), 'end']
	]
	for (const [x, text, anchor] of labels) {
		svg
			.append('text')
			.attr('x', x)
			.attr('y', h + 12)
			.attr('text-anchor', anchor)
			.style('font-size', '9px')
			.style('fill', '#374151')
			.text(text)
	}
	legend
		.append('div')
		.style('font-size', '.7em')
		.style('color', '#9ca3af')
		.text(`log₂ fold change vs control · grey: not significant (p ≥ ${BRAIN_P_THRESHOLD})`)
}

// gating uses proteome cohorts; the drawing uses the brainRegions route
function renderBrainRegionTile(body: any, _td: TileData, self: any, _cfg: TileCfg, opts: TileRenderOpts = {}) {
	const expanded = !!opts.expanded
	const wait = body.append('div').style('font-size', '.75em').style('color', '#9ca3af').text('Loading…')
	getBrainRegionsData(self)
		.then(({ data, assets }) => {
			wait.remove()
			const isoformIds = Object.keys(data.isoforms || {})
			if (!isoformIds.length || !assets) {
				body
					.append('div')
					.style('font-size', '.75em')
					.style('color', '#9ca3af')
					.text('No brain-region data for this protein.')
				return
			}

			if (!expanded) {
				const iso = isoformIds[0]
				const tabsHolder = body.append('div')
				const brainHolder = body.append('div')
				const caption = body
					.append('div')
					.style('font-size', '.7em')
					.style('color', '#9ca3af')
					.style('margin-top', '2px')
				const redraw = (disease: string) => {
					brainHolder.selectAll('*').remove()
					const { colorScale, nSig } = brainFcScale(data.isoforms[iso], disease)
					drawBrainForDisease(brainHolder, data, assets, iso, disease, self, 185, colorScale)
					caption.text(
						nSig
							? `red: up · blue: down · grey: p ≥ ${BRAIN_P_THRESHOLD}`
							: `no region reaches p < ${BRAIN_P_THRESHOLD} in ${disease}`
					)
				}
				if (data.diseases.length > 1) makeDiseaseTabs(tabsHolder, data.diseases, data.diseases[0], redraw, '.75em')
				redraw(data.diseases[0])
				return
			}

			const description = self.app.vocabApi.termdbConfig?.queries?.proteome?.brainRegions?.description
			if (description) {
				body
					.append('div')
					.style('font-size', '.8em')
					.style('color', '#555')
					.style('max-width', '640px')
					.style('line-height', '1.4')
					.style('margin-bottom', '8px')
					.text(description)
			}

			let selectedIso = isoformIds[0]
			let selectedDisease = data.diseases[0]
			const controlRow = body.append('div').style('margin-bottom', '8px').style('font-size', '.85em')
			controlRow.append('span').style('font-weight', '600').text('Isoform: ')
			const tabsHolder = body.append('div')
			const brainHolder = body.append('div')
			const redraw = () => {
				brainHolder.selectAll('*').remove()
				const isoformData = data.isoforms[selectedIso]
				if (!isoformData) return
				const { colorScale, maxAbsFC, nSig } = brainFcScale(isoformData, selectedDisease)
				drawBrainForDisease(brainHolder, data, assets, selectedIso, selectedDisease, self, 460, colorScale)
				drawBrainLegend(brainHolder, colorScale, maxAbsFC, nSig, selectedDisease)
			}
			if (data.diseases.length > 1) {
				makeDiseaseTabs(
					tabsHolder,
					data.diseases,
					selectedDisease,
					(d: string) => {
						selectedDisease = d
						redraw()
					},
					'.9em'
				)
			}
			if (isoformIds.length > 1) {
				const sel = controlRow
					.append('select')
					.style('margin-left', '5px')
					.on('change', () => {
						selectedIso = sel.node().value
						redraw()
					})
				sel
					.selectAll('option')
					.data(isoformIds)
					.enter()
					.append('option')
					.attr('value', (d: string) => d)
					.text((d: string) => `${data.isoforms[d].gene_name} — ${d}`)
			} else {
				controlRow
					.append('span')
					.style('margin-left', '5px')
					.text(`${data.isoforms[selectedIso].gene_name} — ${selectedIso}`)
			}
			redraw()
		})
		.catch((err: any) => {
			wait.style('color', '#b91c1c').text(`Failed to load: ${err?.message || err}`)
			if (self.app?.opts?.debug) console.error(err)
		})
}

// Tile — models over age: log2FC vs control, one line per model with an
// ageGroup series; single-timepoint models sit in a separate strip so no
// age is implied.
// answers: "when does this protein start to change, in which models?""
function renderMouseModelsTile(body: any, td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const k = opts.scale || 1
	const kx = opts.scaleX ?? k
	const mr = 4 * Math.sqrt(k)
	const tickFont = k < 1 ? '8.5px' : null
	type AgedPoint = { age: number; e: TileEntry }
	const aged = new Map<string, AgedPoint[]>()
	const singles: TileEntry[] = []
	for (const e of entries(td, cfg.key)) {
		const age = e.catalog.ageGroup ? parseAge(e.catalog.ageGroup) : null
		if (age === null) {
			singles.push(e)
			continue
		}
		if (!aged.has(e.catalog.model)) aged.set(e.catalog.model, [])
		aged.get(e.catalog.model)!.push({ age, e })
	}
	for (const pts of aged.values()) pts.sort((a, b) => a.age - b.age)

	const ages = [...new Set([...aged.values()].flatMap(pts => pts.map(p => p.age)))].sort((a, b) => a - b)
	// no aged series (every model single-timepoint): only the strip is drawn
	const hasAged = ages.length > 0
	const margin = { top: 20, right: 12, bottom: 36, left: 46 }
	const mainW = hasAged ? 210 * kx : 0
	const stripGap = singles.length && hasAged ? 18 * kx : 0
	const stripW = singles.length * 34 * kx
	const innerH = 150 * k
	const svg = body
		.append('svg')
		.attr('width', margin.left + mainW + stripGap + stripW + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

	const values: number[] = []
	for (const pts of aged.values()) for (const p of pts) values.push(p.e.log2fc as number)
	for (const e of singles) values.push(e.log2fc as number)

	// a single age would give a degenerate domain; pad it by a month either side
	const x = scaleLinear()
		.domain(ages.length > 1 ? [ages[0], ages[ages.length - 1]] : [(ages[0] ?? 0) - 1, (ages[0] ?? 0) + 1])
		.range([0, mainW])
	const y = scaleLinear().domain(fcDomain(values)).range([innerH, 0])

	if (hasAged) {
		styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x).tickValues(ages), tickFont)
		svg
			.append('text')
			.attr('x', margin.left + mainW / 2)
			.attr('y', margin.top + innerH + 32)
			.attr('text-anchor', 'middle')
			.style('font-size', '11px')
			.style('fill', '#374151')
			.text(cfg.xLabel || 'age')
	}
	styledAxis(g.append('g'), axisLeft(y).ticks(4), tickFont)
	drawZeroLine(g, 0, y(0), mainW + stripGap + stripW, y(0))
	yAxisTitle(svg, innerH, margin.top, cfg.yLabel || 'log2FC vs control')

	let legendX = 0
	for (const model of orderBy([...aged.keys()], modelOrder(self))) {
		const pts = aged.get(model)!
		const color = modelColor(self, model)
		const path = d3line<AgedPoint>()
			.x(p => x(p.age))
			.y(p => y(p.e.log2fc as number))
		g.append('path')
			.attr('d', path(pts))
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 1.5)
			.attr('stroke-opacity', 0.75)
		for (const p of pts)
			attachEntryBehavior(drawMarker(g, x(p.age), y(p.e.log2fc as number), color, isSig(p.e), mr), p.e, self)
		g.append('text')
			.attr('x', legendX)
			.attr('y', -8)
			.style('font-size', '10px')
			.style('font-weight', '600')
			.style('fill', color)
			.text(model)
		legendX += 52
	}

	if (singles.length) {
		const stripX0 = mainW + stripGap
		g.append('line')
			.attr('x1', stripX0 - stripGap / 2)
			.attr('x2', stripX0 - stripGap / 2)
			.attr('y1', 0)
			.attr('y2', innerH)
			.attr('stroke', '#d1d5db')
			.attr('stroke-dasharray', '2 3')
		for (const [i, e] of singles.entries()) {
			const cx = stripX0 + i * 34 * kx + 17 * kx
			attachEntryBehavior(drawMarker(g, cx, y(e.log2fc as number), SINGLE_MODEL_COLOR, isSig(e), mr), e, self)
			const lbl = g
				.append('text')
				.attr('x', cx)
				.attr('y', innerH + 14)
				.attr('text-anchor', 'middle')
				.style('font-size', '9px')
				.style('fill', '#6b7280')
				.text(e.catalog.model)
			// narrow strips slant the model names so they don't collide
			if (kx < 0.6) lbl.attr('transform', `rotate(-38 ${cx} ${innerH + 14})`).attr('text-anchor', 'end')
		}
	}

	addSigFootnote(body)
}

// Tile — cell type × age grid: bubble per model, color = log2FC, size = significance.
// answers: "Which cell type carries this protein's change, and when does it appear?""
function renderCellTypesTile(body: any, td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const k = opts.scale || 1
	const kx = opts.scaleX ?? k
	const all = entries(td, cfg.key)
	const models = orderBy([...new Set(all.map(e => e.catalog.model))], modelOrder(self))
	const cellTypes = orderBy([...new Set(all.map(e => e.catalog.cellType))], Object.keys(cellTypeCfg(self)))

	// per model, the ages actually present (sorted)
	const agesByModel = new Map<string, string[]>()
	for (const m of models) {
		const ages = [...new Set(all.filter(e => e.catalog.model === m).map(e => e.catalog.ageGroup))].sort(byAge)
		agesByModel.set(m, ages)
	}

	const CELL_W = 34 * kx
	const CELL_H = 28 * k
	const ROW_LABEL_W = 82
	const MODEL_GAP = 12 * kx
	const HEADER_H = 34

	const colX = new Map<string, number>() // `${model}|${age}` → x center
	let xCursor = 0
	const modelSpans: Array<{ model: string; x0: number; x1: number }> = []
	for (const m of models) {
		const x0 = xCursor
		for (const a of agesByModel.get(m)!) {
			colX.set(`${m}|${a}`, xCursor + CELL_W / 2)
			xCursor += CELL_W
		}
		modelSpans.push({ model: m, x0, x1: xCursor })
		xCursor += MODEL_GAP
	}
	const gridW = xCursor - MODEL_GAP
	const gridH = cellTypes.length * CELL_H

	const svg = body
		.append('svg')
		.attr('width', ROW_LABEL_W + gridW + 10)
		.attr('height', HEADER_H + gridH + 8)
	const g = svg.append('g').attr('transform', `translate(${ROW_LABEL_W},${HEADER_H})`)

	// column headers: model band + age labels
	for (const span of modelSpans) {
		svg
			.append('text')
			.attr('x', ROW_LABEL_W + (span.x0 + span.x1) / 2)
			.attr('y', 12)
			.attr('text-anchor', 'middle')
			.style('font-size', '10px')
			.style('font-weight', '600')
			.style('fill', modelColor(self, span.model))
			.text(span.model)
	}
	for (const [key, cx] of colX) {
		svg
			.append('text')
			.attr('x', ROW_LABEL_W + cx)
			.attr('y', 27)
			.attr('text-anchor', 'middle')
			.style('font-size', '9px')
			.style('fill', '#6b7280')
			.text(key.split('|')[1])
	}
	// row labels
	for (const [i, ct] of cellTypes.entries()) {
		svg
			.append('text')
			.attr('x', ROW_LABEL_W - 6)
			.attr('y', HEADER_H + i * CELL_H + CELL_H / 2 + 3)
			.attr('text-anchor', 'end')
			.style('font-size', '10px')
			.style('fill', '#374151')
			.text(ct)
	}

	const maxAbsFc = Math.max(1, ...all.map(e => Math.abs(e.log2fc as number)))
	const colorScale = scaleLinear<string>()
		.domain([-maxAbsFc, 0, maxAbsFc])
		.range([FC_NEG_COLOR, FC_ZERO_COLOR, FC_POS_COLOR])
	const NEG_LOG_P_CAP = 10
	// bubble radius capped so the largest dot stays inside a narrowed cell
	const rScale = scaleSqrt()
		.domain([0, NEG_LOG_P_CAP])
		.range([3 * k, Math.min(11 * k, CELL_W / 2 - 0.5)])

	for (const e of all) {
		const cx = colX.get(`${e.catalog.model}|${e.catalog.ageGroup}`)
		const row = cellTypes.indexOf(e.catalog.cellType)
		if (cx === undefined || row < 0) continue
		const negLogP = e.fdr === null ? 0 : Math.min(NEG_LOG_P_CAP, -Math.log10(Math.max(e.fdr, 1e-300)))
		const circle = g
			.append('circle')
			.attr('cx', cx)
			.attr('cy', row * CELL_H + CELL_H / 2)
			.attr('r', rScale(negLogP))
			.attr('fill', colorScale(e.log2fc as number))
			.attr('stroke', isSig(e) ? '#374151' : '#d1d5db')
			.attr('stroke-width', 1)
		attachEntryBehavior(circle, e, self)
	}

	const foot = body.append('div').style('font-size', '.7em').style('color', '#9ca3af').style('margin-top', '2px')
	foot.style('max-width', '100%')
	foot.append('span').text(`color: log2FC (purple down, blue up) · size: −log10(FDR) · outline: FDR < ${SIG_P}`)
	for (const ct of cellTypes) {
		const note = cellTypeCfg(self)[ct]?.note
		if (note) foot.append('div').text(note)
	}
}

// Tile — plaque microenvironment: plaque vs adjacent non-plaque log2FC over
// age (cohorts with model+ageGroup, one line per model); cohorts without an
// age series (e.g. human) render as single reference marks labeled by organism.
// answers: "Is this protein recruited to amyloid plaques — how strongly, how early,
// and does the same thing happen in human tissue?"
function renderPlaqueTile(body: any, td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const k = opts.scale || 1
	const kx = opts.scaleX ?? k
	const mr = 4 * Math.sqrt(k)
	const tickFont = k < 1 ? '8.5px' : null
	const all = entries(td, cfg.key)
	const series = all.filter(e => e.catalog.ageGroup && e.catalog.model)
	const reference = all.filter(e => !(e.catalog.ageGroup && e.catalog.model))
	const refLabel = (e: TileEntry) => e.organism.charAt(0).toUpperCase() + e.organism.slice(1)
	const ages = [...new Set(series.map(e => e.catalog.ageGroup))].sort(byAge)
	const refCategories = [...new Set(reference.map(refLabel))]
	const categories = [...ages, ...refCategories]

	const margin = { top: 20, right: 14, bottom: 36, left: 46 }
	const innerW = Math.max(180, categories.length * 52) * kx
	const innerH = 140 * k
	const svg = body
		.append('svg')
		.attr('width', innerW + margin.left + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

	const x = scalePoint().domain(categories).range([0, innerW]).padding(0.5)
	const y = scaleLinear()
		.domain(fcDomain(all.map(e => e.log2fc as number)))
		.range([innerH, 0])

	const xAxisG = styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x), tickFont)
	if (kx < 0.6) rotateXTicks(xAxisG)
	styledAxis(g.append('g'), axisLeft(y).ticks(4), tickFont)
	drawZeroLine(g, 0, y(0), innerW, y(0))
	yAxisTitle(svg, innerH, margin.top, cfg.yLabel || 'log2FC vs control')
	// the slanted tick labels of a narrow face would collide with this title;
	// the age ticks are self-explanatory there
	if (kx >= 0.6) {
		svg
			.append('text')
			.attr('x', margin.left + innerW / 2)
			.attr('y', margin.top + innerH + 32)
			.attr('text-anchor', 'middle')
			.style('font-size', '11px')
			.style('fill', '#374151')
			.text(cfg.xLabel || 'age')
	}

	if (refCategories.length && ages.length) {
		const xSep = (x(ages[ages.length - 1])! + x(refCategories[0])!) / 2
		g.append('line')
			.attr('x1', xSep)
			.attr('x2', xSep)
			.attr('y1', 0)
			.attr('y2', innerH)
			.attr('stroke', '#d1d5db')
			.attr('stroke-dasharray', '2 3')
	}

	const models = orderBy([...new Set(series.map(e => e.catalog.model))], modelOrder(self))
	let legendX = 0
	for (const model of models) {
		const color = modelColor(self, model)
		const pts = series
			.filter(e => e.catalog.model === model)
			.sort((a, b) => byAge(a.catalog.ageGroup, b.catalog.ageGroup))
		const path = d3line<TileEntry>()
			.x(e => x(e.catalog.ageGroup)!)
			.y(e => y(e.log2fc as number))
		g.append('path')
			.attr('d', path(pts))
			.attr('fill', 'none')
			.attr('stroke', color)
			.attr('stroke-width', 1.5)
			.attr('stroke-opacity', 0.75)
			// a gap in the age series (a model missing one age) still gets connected;
			// dash the line so the interpolation is visible as such
			.attr('stroke-dasharray', pts.length < ages.length ? '5 3' : null)
		for (const e of pts)
			attachEntryBehavior(drawMarker(g, x(e.catalog.ageGroup)!, y(e.log2fc as number), color, isSig(e), mr), e, self)
		g.append('text')
			.attr('x', legendX)
			.attr('y', -8)
			.style('font-size', '10px')
			.style('font-weight', '600')
			.style('fill', color)
			.text(model)
		legendX += 52
	}

	for (const e of reference) {
		const cx = x(refLabel(e))!
		const cy = y(e.log2fc as number)
		const r = 5.5 * Math.sqrt(k)
		const diamond = g
			.append('path')
			.attr('d', `M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`)
			.attr('fill', isSig(e) ? REFERENCE_COLOR : '#fff')
			.attr('stroke', REFERENCE_COLOR)
			.attr('stroke-width', 1.5)
		attachEntryBehavior(diamond, e, self)
	}

	addSigFootnote(body)
}

// Tile 7 — multiomic ranking: Integrative rank ("#n of N") of
// GWAS, transcriptome, proteomes, PTMs and interactome per disease. Face: integrative
// rank per disease + a mini strip of per-modality rank percentiles. Expanded:
// the description and a full per-modality table.
// Proteins are ranked by p/FDR value or its log2FC-z score (so rank 1 = the strongest disease-associated signal in that dataset).
// Answers: "How strong is the overall multi-omic evidence for this protein in AD / LBD / FTLD, and which modalities drive it?"
function getGeneRanks(self: any): Promise<any> {
	const gene = self.state?.config?.tw?.term?.name
	const [genome, dslabel] = vocabKey(self).split('|')
	return cachedFetch(`geneRanks|${vocabKey(self)}|${gene}`, async () => {
		const data = await dofetch3('termdb/geneRanking', { body: { genome, dslabel, gene } })
		if (data.error) throw data.error
		return data.geneRanks || {}
	})
}

// percentile (0 = best) → color, dark for top-ranked
const rankColor = scaleLinear<string>().domain([0, 0.1, 1]).range(['#1d4ed8', '#93c5fd', '#f3f4f6']).clamp(true)

function renderMultiomicRankTile(body: any, _td: TileData, self: any, _cfg: TileCfg, opts: TileRenderOpts = {}) {
	const expanded = !!opts.expanded
	// column vocabulary of the ranking files and per-ranking display labels come from the dataset
	const rankCfg = self.app.vocabApi.termdbConfig?.queries?.geneRanking || {}
	const modalities: string[] = rankCfg.modalities || []
	const integrativeColumn: string | undefined = rankCfg.integrativeColumn
	const statColumns: string[] = rankCfg.statColumns || []
	const rankingLabel = (key: string) => rankCfg.labels?.[key] || key
	const wait = body.append('div').style('font-size', '.75em').style('color', '#9ca3af').text('Loading…')
	getGeneRanks(self)
		.then((geneRanks: any) => {
			wait.remove()
			const keys = Object.keys(geneRanks)
			const ranked = keys.filter(k => geneRanks[k].row)
			if (!ranked.length) {
				body
					.append('div')
					.style('font-size', '.75em')
					.style('color', '#9ca3af')
					.text('Not present in the multiomic rankings.')
				return
			}
			const fmt = (n: number) => n.toLocaleString()

			if (expanded) {
				const description = self.app.vocabApi.termdbConfig?.queries?.geneRanking?.description
				if (description) {
					body
						.append('div')
						.style('font-size', '.8em')
						.style('color', '#555')
						.style('max-width', '640px')
						.style('line-height', '1.4')
						.style('margin-bottom', '10px')
						.text(description)
				}
			}

			for (const key of keys) {
				const r = geneRanks[key]
				const colIdx = new Map<string, number>(r.columns.map((c: string, i: number) => [c, i]))
				const intIdx = integrativeColumn ? colIdx.get(integrativeColumn) : undefined
				const intRank = r.row && intIdx !== undefined ? r.row[intIdx] : null
				const section = body.append('div').style('margin-bottom', expanded ? '12px' : '6px')
				const head = section
					.append('div')
					.style('display', 'flex')
					.style('align-items', 'baseline')
					.style('gap', '6px')
					.style('font-size', expanded ? '.9em' : '.8em')
				head.append('span').style('font-weight', '600').style('color', '#374151').text(rankingLabel(key))
				if (!r.row) {
					head.append('span').style('color', '#9ca3af').text('not ranked')
					continue
				}
				head
					.append('span')
					.style('color', typeof intRank === 'number' ? '#111827' : '#9ca3af')
					.text(typeof intRank === 'number' ? `#${fmt(intRank)} of ${fmt(r.counts[intIdx!])}` : 'no integrative rank')

				// per-modality ranks: strip on the face, table when expanded
				const mods = modalities.filter(m => colIdx.has(m))
				if (!expanded) {
					const strip = section.append('div').style('display', 'flex').style('gap', '2px').style('margin-top', '2px')
					for (const m of mods) {
						const c = colIdx.get(m)!
						const v = r.row[c]
						const n = r.counts[c]
						const pct = typeof v === 'number' && n ? (v - 1) / Math.max(1, n - 1) : null
						strip
							.append('div')
							.attr('title', pct === null ? `${m}: not ranked` : `${m}: #${fmt(v as number)} of ${fmt(n)}`)
							.style('width', '20px')
							.style('height', '9px')
							.style('border-radius', '2px')
							.style('background', pct === null ? '#fff' : rankColor(pct))
							.style('border', pct === null ? '1px dashed #d1d5db' : '1px solid transparent')
							.style('box-sizing', 'border-box')
					}
					continue
				}
				const tbl = table2col({ holder: section.append('table') })
				for (const m of mods) {
					const c = colIdx.get(m)!
					const v = r.row[c]
					const n = r.counts[c]
					const pctTop = typeof v === 'number' ? (100 * v) / n : null
					const pctText = pctTop === null ? '' : ` (top ${pctTop < 0.1 ? pctTop.toFixed(2) : pctTop.toFixed(1)}%)`
					tbl.addRow(m, typeof v === 'number' ? `#${fmt(v)} of ${fmt(n)}${pctText}` : 'not ranked')
				}
				for (const extra of statColumns) {
					const c = colIdx.get(extra)
					if (c === undefined) continue
					const v = r.row[c]
					tbl.addRow(extra, typeof v === 'number' ? (v < 0.001 && v > 0 ? v.toExponential(2) : String(v)) : 'NA')
				}
			}

			if (!expanded) {
				const foot = body.append('div').style('font-size', '.7em').style('color', '#9ca3af').style('margin-top', '4px')
				foot.text('strip: one cell per modality, darker = ranked higher · hover for ranks')
			}
		})
		.catch((err: any) => {
			wait.style('color', '#b91c1c').text(`Failed to load: ${err?.message || err}`)
			if (self.app?.opts?.debug) console.error(err)
		})
}

// Tile — concordance: All-gene scatter of log2FC in one cohort vs another
// (human vs mouse model, or model vs model), this protein highlighted,
// human-vs-mouse panels ask "does this mouse model reproduce human AD?",
// the mouse-vs-mouse panel "do the two models agree with each other?".
// R: Pearson correlation between the two cohorts' log2FC values across all
// shared genes (not just the searched protein), i.e. how well the whole
// proteome's direction and magnitude of change in one dataset tracks the
// other. High R (> 0.5): largely the same changes; ~0.2–0.3: only a subset
// moves in concert; ≈ 0: no global relationship.
// Answers: "Does the mouse model reproduce the human change for this protein — and for the proteome as a whole?"
type CohortRef = { organism: string; assay: string; cohort: string; label: string }
type ConcordancePair = { key: string; label: string; x: CohortRef; y: CohortRef }
// server joins the two DAP files on upper-cased gene and runs R's cor.test (R/src/corr.R)
function getConcordance(self: any, x: CohortRef, y: CohortRef): Promise<DapConcordance> {
	const [genome, dslabel] = vocabKey(self).split('|')
	const refKey = (r: CohortRef) => `${r.organism}|${r.assay}|${r.cohort}`
	return cachedFetch(`dapConcordance|${vocabKey(self)}|${refKey(x)}|${refKey(y)}`, async () => {
		const data = await dofetch3('termdb/dapVolcano', {
			body: {
				genome,
				dslabel,
				organism: x.organism,
				assay: x.assay,
				cohort: x.cohort,
				concordanceWith: { organism: y.organism, assay: y.assay, cohort: y.cohort }
			}
		})
		if (data.error) throw data.error
		return data.concordance
	})
}

// first cohort (with a DAP file) satisfying a pair side's cohortMatch; an
// ageVaries side additionally requires catalog.ageGroup == age
function findPairCohort(self: any, side: PairSide, age: string): CohortRef | null {
	const organisms = self.app?.vocabApi?.termdbConfig?.queries?.proteome?.organisms || {}
	for (const organism in organisms) {
		const assays = organisms[organism]?.assays || {}
		for (const assay in assays) {
			for (const cohort in assays[assay].cohorts || {}) {
				const c = assays[assay].cohorts[cohort]
				if (!c.DAPfile || !c.catalog) continue
				if (!cohortMatches(side, organism, assay, c.catalog)) continue
				if (side.ageVaries && c.catalog.ageGroup !== age) continue
				const label = side.ageVaries ? `${side.label} ${age}` : side.label
				return { organism, assay, cohort, label }
			}
		}
	}
	return null
}

// ages at which at least one ageVaries side has a DAP cohort, sorted numerically
function concordanceAges(self: any, cfg: TileCfg): string[] {
	const organisms = self.app?.vocabApi?.termdbConfig?.queries?.proteome?.organisms || {}
	const sides = (cfg.pairs || []).flatMap(p => [p.x, p.y]).filter(sd => sd.ageVaries)
	const ages = new Set<string>()
	for (const organism in organisms) {
		const assays = organisms[organism]?.assays || {}
		for (const assay in assays) {
			for (const cohort in assays[assay].cohorts || {}) {
				const c = assays[assay].cohorts[cohort]
				if (!c.DAPfile || !c.catalog?.ageGroup) continue
				if (sides.some(sd => cohortMatches(sd, organism, assay, c.catalog))) ages.add(c.catalog.ageGroup)
			}
		}
	}
	return [...ages].sort(byAge)
}

// age used when none is selected: the configured defaultAge if cohorts exist at
// it, else the first age that has any; '' only when no side varies by age
function defaultConcordanceAge(self: any, cfg: TileCfg): string {
	const ages = concordanceAges(self, cfg)
	if (cfg.defaultAge && ages.includes(cfg.defaultAge)) return cfg.defaultAge
	return ages[0] || cfg.defaultAge || ''
}

function concordancePairs(self: any, cfg: TileCfg, age = defaultConcordanceAge(self, cfg)): ConcordancePair[] {
	const pairs: ConcordancePair[] = []
	for (const p of cfg.pairs || []) {
		const x = findPairCohort(self, p.x, age)
		const y = findPairCohort(self, p.y, age)
		if (x && y) pairs.push({ key: p.key, label: p.label, x, y })
	}
	return pairs
}

async function drawConcordance(holder: any, self: any, pair: ConcordancePair, gene: string, expanded: boolean) {
	const { points: pts, r: R, p: P } = await getConcordance(self, pair.x, pair.y)
	const target = gene.toUpperCase()
	const hit = pts.find(p => p.gene === target)

	const margin = expanded ? { top: 14, right: 16, bottom: 44, left: 52 } : { top: 8, right: 10, bottom: 32, left: 38 }
	const innerW = expanded ? 380 : 150
	const innerH = expanded ? 320 : 118
	const svg = holder
		.append('svg')
		.attr('width', innerW + margin.left + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
	const x = scaleLinear()
		.domain(fcDomain(pts.map(p => p.x)))
		.range([0, innerW])
	const y = scaleLinear()
		.domain(fcDomain(pts.map(p => p.y)))
		.range([innerH, 0])
	const tickFont = expanded ? null : '8.5px'
	styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x).ticks(expanded ? 6 : 4), tickFont)
	styledAxis(g.append('g'), axisLeft(y).ticks(expanded ? 6 : 4), tickFont)
	drawZeroLine(g, x(0), 0, x(0), innerH)
	drawZeroLine(g, 0, y(0), innerW, y(0))
	yAxisTitle(svg, innerH, margin.top, `${pair.y.label} log2FC`)
	svg
		.append('text')
		.attr('x', margin.left + innerW / 2)
		.attr('y', margin.top + innerH + (expanded ? 36 : 28))
		.attr('text-anchor', 'middle')
		.style('font-size', expanded ? '11px' : '10px')
		.style('fill', '#374151')
		.text(`${pair.x.label} log2FC`)
	for (const p of pts) {
		if (p === hit) continue
		g.append('circle')
			.attr('cx', x(p.x))
			.attr('cy', y(p.y))
			.attr('r', expanded ? 1.6 : 1.1)
			.attr('fill', '#9ca3af')
			.attr('fill-opacity', 0.45)
	}
	if (hit) {
		g.append('circle')
			.attr('cx', x(hit.x))
			.attr('cy', y(hit.y))
			.attr('r', expanded ? 6 : 4)
			.attr('fill', '#e75480')
			.attr('stroke', '#7f1d1d')
			.attr('stroke-width', 1.2)
		g.append('text')
			.attr('x', x(hit.x) + (expanded ? 9 : 6))
			.attr('y', y(hit.y) - (expanded ? 6 : 4))
			.style('font-size', expanded ? '12px' : '9px')
			.style('font-weight', '600')
			.style('fill', '#7f1d1d')
			.text(gene)
	}
	g.append('text')
		.attr('x', innerW)
		.attr('y', -2)
		.attr('text-anchor', 'end')
		.style('font-size', expanded ? '11px' : '9px')
		.style('fill', '#374151')
		.attr('title', P === null ? null : `Pearson cor.test p = ${P < 1e-4 ? P.toExponential(1) : P.toFixed(4)}`)
		.text(`R = ${R === null ? 'NA' : R.toFixed(2)} · n = ${pts.length.toLocaleString()}`)
	if (!hit) {
		holder
			.append('div')
			.style('font-size', '.72em')
			.style('color', '#9ca3af')
			.text(`${gene} is not quantified in both datasets`)
	} else if (expanded) {
		holder
			.append('div')
			.style('font-size', '.8em')
			.style('color', '#374151')
			.style('margin-top', '4px')
			.text(`${gene}: ${pair.x.label} log2FC ${hit.x.toFixed(2)} · ${pair.y.label} log2FC ${hit.y.toFixed(2)}`)
	}
}

function renderConcordanceTile(body: any, _td: TileData, self: any, cfg: TileCfg, opts: TileRenderOpts = {}) {
	const expanded = !!opts.expanded
	const gene = self.state?.config?.tw?.term?.name || ''
	let age = defaultConcordanceAge(self, cfg)
	let pairs = concordancePairs(self, cfg, age)
	if (!pairs.length) return
	let pair = pairs[0]
	const controls = body.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '12px')
	const tabsHolder = controls.append('div')
	const plotHolder = body.append('div')
	// a redraw issued while an earlier one is still fetching must win: each
	// draw gets a generation and only the latest one may touch plotHolder
	let generation = 0
	const redraw = () => {
		const gen = ++generation
		plotHolder.selectAll('*').remove()
		const wait = plotHolder.append('div').style('font-size', '.75em').style('color', '#9ca3af').text('Loading…')
		const target = plotHolder.append('div')
		drawConcordance(target, self, pair, gene, expanded)
			.then(() => {
				if (gen !== generation) target.remove()
				else wait.remove()
			})
			.catch((err: any) => {
				if (gen !== generation) return
				wait.style('color', '#b91c1c').text(`Failed to load: ${err?.message || err}`)
				if (self.app?.opts?.debug) console.error(err)
			})
	}
	const makeTabs = () => {
		tabsHolder.selectAll('*').remove()
		if (pairs.length < 2) return
		makeDiseaseTabs(
			tabsHolder,
			pairs.map(p => p.label),
			pair.label,
			(label: string) => {
				pair = pairs.find(p => p.label === label) || pairs[0]
				redraw()
			},
			'.9em'
		)
	}
	if (expanded) {
		makeTabs()
		// age selector; the same pair (by key) is kept across ages when it
		// exists at the new age, otherwise the first available pair is shown
		const ages = concordanceAges(self, cfg)
		if (ages.length > 1) {
			const ageDiv = controls.append('div').style('font-size', '.85em').style('color', '#374151')
			ageDiv.append('span').text('Age: ')
			const sel = ageDiv.append('select').style('font-size', 'inherit')
			for (const a of ages)
				sel
					.append('option')
					.attr('value', a)
					.property('selected', a === age)
					.text(a)
			sel.on('change', () => {
				age = sel.property('value')
				const next = concordancePairs(self, cfg, age)
				if (!next.length) {
					plotHolder.selectAll('*').remove()
					plotHolder.append('div').style('font-size', '.8em').style('color', '#9ca3af').text(`No cohorts at ${age}`)
					tabsHolder.selectAll('*').remove()
					return
				}
				pairs = next
				pair = pairs.find(p => p.key === pair.key) || pairs[0]
				makeTabs()
				redraw()
			})
		}
	}
	redraw()
	if (!expanded) {
		body
			.append('div')
			.style('font-size', '.7em')
			.style('color', '#9ca3af')
			.style('margin-top', '2px')
			.text(`${pair.label}${age ? ', ' + age : ''}, all genes · expand for other pairs and ages`)
	} else if (cfg.note) {
		body.append('div').style('font-size', '.75em').style('color', '#9ca3af').style('margin-top', '6px').text(cfg.note)
	}
}

/************ registry ************/

// renderer per tile key; the dataset config decides which tiles exist, their
// titles and order. `has` gates rendering on the data actually present.
type TileRenderer = {
	has: (td: TileData, self: any, cfg: TileCfg) => boolean
	render: (body: any, td: TileData, self: any, cfg: TileCfg, opts?: TileRenderOpts) => void
}
const TILE_RENDERERS: { [key: string]: TileRenderer } = {
	crossDisease: {
		has: (td, _s, cfg) => new Set(entries(td, cfg.key).map(e => e.disease || e.cohortName)).size >= 2,
		render: renderCrossDiseaseTile
	},
	insoluble: { has: (td, _s, cfg) => entries(td, cfg.key).length >= 1, render: renderInsolubleTile },
	brainRegions: { has: (td, _s, cfg) => entries(td, cfg.key).length >= 2, render: renderBrainRegionTile },
	mouseModels: { has: (td, _s, cfg) => entries(td, cfg.key).length >= 2, render: renderMouseModelsTile },
	cellTypes: { has: (td, _s, cfg) => entries(td, cfg.key).length >= 2, render: renderCellTypesTile },
	plaque: { has: (td, _s, cfg) => entries(td, cfg.key).length >= 1, render: renderPlaqueTile },
	multiomicRank: {
		// available whenever the dataset ships rankings; the gene may still be absent
		has: (_td, self) => !!self?.app?.vocabApi?.termdbConfig?.queries?.geneRanking?.rankings,
		render: renderMultiomicRankTile
	},
	concordance: { has: (_td, self, cfg) => concordancePairs(self, cfg).length > 0, render: renderConcordanceTile }
	// 'ptm' is rendered by renderPTMSummaryCard from site-level data, not here
}

export type TileDef = TileCfg & TileRenderer

// tiles the dataset configures that this file can draw, in dataset order
function configuredTiles(self: any): TileDef[] {
	const out: TileDef[] = []
	for (const cfg of getTileConfigs(self)) {
		const r = TILE_RENDERERS[cfg.key]
		if (!r) continue
		out.push({ ...cfg, ...r })
	}
	return out
}

// inline error box used by every tile face and pane
export function renderTileError(holder: any, err: any, self: any) {
	holder
		.append('div')
		.style('color', '#b91c1c')
		.style('font-size', '.8em')
		.text(`Failed to render: ${err?.message || err}`)
	if (self?.app?.opts?.debug) console.error(err)
}

// Open expanded-tile panes, keyed per plot instance + tile so the ⤢ button
// toggles (second click closes) instead of stacking duplicate panes.
const openTilePanes = new Map<string, any>()
const tilePaneKey = (self: any, key: string) => `${self?.id ?? ''}|${key}`

// close all panes belonging to this plot instance; called on re-render so
// panes never outlive the data they were drawn from
export function closeTilePanes(self: any) {
	const prefix = `${self?.id ?? ''}|`
	for (const [k, pane] of openTilePanes) {
		if (!k.startsWith(prefix)) continue
		pane.pane.remove()
		openTilePanes.delete(k)
	}
}

// close one tile's pane if open; returns whether one was closed
export function closeTilePane(self: any, key: string): boolean {
	const k = tilePaneKey(self, key)
	const existing = openTilePanes.get(k)
	if (!existing) return false
	existing.pane.remove()
	openTilePanes.delete(k)
	return true
}

// toggle a draggable pane (the app's standard floating panel) for one tile;
// make() fills the pane body. Returns the newly opened pane, or null when the
// call closed an existing one. onClose fires whenever the pane goes away
// (toggle, ✕ button, or closeTilePane[s]) so callers can drop their own refs.
export function toggleTilePane(
	self: any,
	key: string,
	title: string,
	make: (body: any) => void,
	onClose?: () => void
): any {
	const k = tilePaneKey(self, key)
	if (closeTilePane(self, key)) return null
	// newpane offsets by the page scroll itself, so y is viewport-relative
	const pane: any = newpane({
		x: Math.max(16, (window.innerWidth - 760) / 2),
		y: 60,
		close: () => {
			pane.pane.remove()
			openTilePanes.delete(k)
		}
	})
	if (onClose) {
		const remove = pane.pane.remove.bind(pane.pane)
		pane.pane.remove = () => {
			remove()
			onClose()
		}
	}
	openTilePanes.set(k, pane)
	// lift the pane above app chrome (sandbox header z-index 99) unless the
	// embedder's base_zindex already set one
	if (!pane.pane.node().style.zIndex) pane.pane.style('z-index', TILE_PANE_ZINDEX)
	pane.header.text(title)
	make(pane.body)
	// keep hover tooltips above this newly-appended pane
	raiseSharedMenus(self)
	return pane
}

// click-to-expand: the same renderer at a larger scale with extra detail
function openExpandedTile(tile: TileDef, td: TileData, self: any) {
	const protein = self.state?.config?.tw?.term?.name || ''
	toggleTilePane(self, tile.key, `${protein ? protein + ' — ' : ''}${tile.title}`, paneBody => {
		const body = paneBody.append('div').style('padding', '12px 16px')
		body
			.append('div')
			.style('font-size', '.8em')
			.style('color', '#6b7280')
			.style('margin-bottom', '6px')
			.text(tile.subtitle)
		try {
			tile.render(body.append('div'), td, self, tile, { scale: EXPANDED_SCALE, expanded: true })
		} catch (err: any) {
			renderTileError(body, err, self)
		}
	})
}

// renders a chart card for every tile whose data requirement is met (in
// canonical order) and returns the tiles that have no data, so the caller
// can append their greyed placeholders after the other live cards.
export function renderStudyTiles(grid: any, td: TileData, self: any): { missing: TileDef[] } {
	const missing: TileDef[] = []
	for (const tile of configuredTiles(self)) {
		if (!tile.has(td, self, tile)) {
			missing.push(tile)
			continue
		}
		const body = makeTileCard(grid, {
			title: tile.title,
			subtitle: tile.subtitle,
			uniform: true,
			onExpand: () => openExpandedTile(tile, td, self)
		})
		try {
			tile.render(body, td, self, tile, { scale: TILE_FACE_SCALE, scaleX: TILE_FACE_SCALE_X })
		} catch (err: any) {
			renderTileError(body, err, self)
		}
	}
	return { missing }
}

// greyed placeholder cards for tiles without data, appended after the live
// cards so real data leads the grid
export function renderPlaceholderTiles(grid: any, tiles: { title: string; note?: string }[]) {
	for (const tile of tiles) {
		const body = makeTileCard(grid, { title: tile.title, disabled: true, uniform: true })
		body
			.style('flex', '1')
			.style('display', 'flex')
			.style('align-items', 'center')
			.style('justify-content', 'center')
			.append('div')
			.style('font-size', '.75em')
			.style('color', '#9ca3af')
			.style('max-width', '200px')
			.style('text-align', 'center')
			.text(tile.note || 'No data for this protein in this study')
	}
}

// fallback dot colors for the PTM summary card face when the dataset's
// mclassOverride doesn't provide one: assigned by order of first appearance
const PTM_FALLBACK_PALETTE = ['#d7301f', '#2166ac', '#1b9e77', '#7570b3', '#e6ab02']

// first residue position in a modSites string like "S10" or "S10,T11"
function firstModSitePos(modSites: string): number | null {
	const m = /[A-Za-z](\d+)/.exec(modSites || '')
	if (!m) return null
	const pos = Number(m[1])
	return Number.isInteger(pos) && pos >= 1 ? pos : null
}

// Compact overview volcano card: Every protein-level measurement across sample sets
// as one volcano.
// Answers: At a glance, how consistent and how significant are this protein's changes across all studies?
export function renderOverviewVolcanoCard(
	grid: any,
	data: any,
	self: any,
	opts: { onExpandRender: (holder: any) => void }
) {
	type Pt = { x: number; y: number; sig: boolean }
	const pts: Pt[] = []
	for (const e of data?.cohorts || []) {
		if (e.PTMType) continue
		const log2fc = getLog2Ratio(e.foldChange)
		const p = Number(e.fdr)
		if (log2fc === null || !Number.isFinite(p) || p <= 0) continue
		pts.push({ x: log2fc, y: -Math.log10(Math.max(p, 1e-300)), sig: p < SIG_P })
	}
	const protein = self.state?.config?.tw?.term?.name || ''
	const body = makeTileCard(grid, {
		title: 'All sample sets',
		subtitle: 'log2FC vs significance, every cohort',
		uniform: true,
		onExpand: () =>
			toggleTilePane(self, 'volcano', `${protein ? protein + ' — ' : ''}All sample sets`, (paneBody: any) => {
				opts.onExpandRender(paneBody.append('div').style('padding', '12px 16px'))
			})
	})
	if (!pts.length) {
		body.append('div').style('font-size', '.75em').style('color', '#9ca3af').text('No protein-level data.')
		return
	}

	const margin = { top: 8, right: 10, bottom: 32, left: 38 }
	const innerW = 156
	const innerH = 118
	const svg = body
		.append('svg')
		.attr('width', innerW + margin.left + margin.right)
		.attr('height', innerH + margin.top + margin.bottom)
	const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)
	const x = scaleLinear()
		.domain(fcDomain(pts.map(p => p.x)))
		.range([0, innerW])
	const y = scaleLinear()
		.domain([0, Math.max(2, ...pts.map(p => p.y)) * 1.05])
		.range([innerH, 0])
	styledAxis(g.append('g').attr('transform', `translate(0,${innerH})`), axisBottom(x).ticks(4), '8.5px')
	styledAxis(g.append('g'), axisLeft(y).ticks(4), '8.5px')
	drawZeroLine(g, x(0), 0, x(0), innerH)
	// significance threshold line
	g.append('line')
		.attr('x1', 0)
		.attr('x2', innerW)
		.attr('y1', y(-Math.log10(SIG_P)))
		.attr('y2', y(-Math.log10(SIG_P)))
		.attr('stroke', '#9ca3af')
		.attr('stroke-dasharray', '3 3')
		.attr('stroke-opacity', 0.5)
	yAxisTitle(svg, innerH, margin.top, '\u2212log\u2081\u2080(FDR)')
	svg
		.append('text')
		.attr('x', margin.left + innerW / 2)
		.attr('y', margin.top + innerH + 28)
		.attr('text-anchor', 'middle')
		.style('font-size', '10px')
		.style('fill', '#374151')
		.text('log2FC')
	for (const p of pts) {
		g.append('circle')
			.attr('cx', x(p.x))
			.attr('cy', y(p.y))
			.attr('r', 2)
			.attr('fill', p.sig ? '#e75480' : '#c7cbd1')
			.attr('fill-opacity', 0.6)
	}
	body
		.append('div')
		.style('font-size', '.7em')
		.style('color', '#9ca3af')
		.style('margin-top', '2px')
		.text(`${pts.length} dots (accession \u00d7 sample set) \u00b7 expand for the interactive view`)
}

// Modified sites along the protein, coloured by PTM type (phospho,
// ubiquitin), log2FC per site
export function renderPTMSummaryCard(
	grid: any,
	ptmEntries: any[],
	self: any,
	opts: { onExpandRender: (holder: any) => void | Promise<void> }
) {
	if (!ptmEntries?.length) return
	const protein = self.state?.config?.tw?.term?.name || ''
	const cfg = getTileConfig(self, 'ptm')
	const title = cfg?.title || 'PTM sites'
	const body = makeTileCard(grid, {
		title,
		subtitle: cfg?.subtitle || 'Site-level log2FC along the protein',
		uniform: true,
		onExpand: () =>
			toggleTilePane(self, 'ptm', `${protein ? protein + ' — ' : ''}${title}`, async (paneBody: any) => {
				const holder = paneBody.append('div').style('padding', '12px 16px')
				const wait = holder.append('div').style('color', '#6b7280').style('font-size', '.85em').text('Loading…')
				try {
					await opts.onExpandRender(holder)
				} catch (err: any) {
					renderTileError(holder, err, self)
				}
				wait.remove()
			})
	})

	type SitePoint = { pos: number; log2fc: number; color: string; entry: TileEntry }
	const byOrganism = new Map<string, SitePoint[]>()
	const typeCounts = new Map<string, { count: number; color: string }>()
	for (const e of ptmEntries) {
		const pos = firstModSitePos(e.modSites)
		const log2fc = getLog2Ratio(e.foldChange)
		const mclass: any = Object.values(e.mclassOverride || {})[0]
		const existing = typeCounts.get(e.PTMType)
		const color =
			existing?.color || mclass?.color || PTM_FALLBACK_PALETTE[typeCounts.size % PTM_FALLBACK_PALETTE.length]
		const tc = existing || { count: 0, color }
		tc.count++
		typeCounts.set(e.PTMType, tc)
		if (pos === null || log2fc === null) continue
		const p = Number(e.fdr)
		const entry: TileEntry = {
			organism: e.organism,
			assayName: e.assayName,
			cohortName: e.cohortName,
			disease: e.disease,
			uniqueIdentifier: e.uniqueIdentifier,
			proteinAccession: e.proteinAccession,
			log2fc,
			fdr: Number.isFinite(p) && p > 0 ? p : null,
			testedN: Number(e.testedN) || 0,
			controlN: Number(e.controlN) || 0,
			isoformCount: 1,
			catalog: catalogForEntry(self, e) || {},
			ptmType: e.PTMType,
			modSites: e.modSites
		}
		const arr = byOrganism.get(e.organism) || []
		arr.push({ pos, log2fc, color, entry })
		byOrganism.set(e.organism, arr)
	}

	// one mini strip per organism (site numbering is isoform-specific, so
	// organisms never share an x-axis)
	const stripW = 152
	const stripH = 46
	const labelW = 46
	for (const [organism, points] of byOrganism) {
		const maxPos = Math.max(...points.map(p => p.pos)) * 1.05
		const maxAbs = Math.max(0.2, ...points.map(p => Math.abs(p.log2fc)))
		const row = body.append('div').style('display', 'flex').style('align-items', 'center').style('gap', '4px')
		row
			.append('span')
			.style('flex', `0 0 ${labelW}px`)
			.style('font-size', '.7em')
			.style('color', '#6b7280')
			.text(organism)
		const svg = row.append('svg').attr('width', stripW).attr('height', stripH)
		const x = scaleLinear()
			.domain([0, maxPos])
			.range([4, stripW - 4])
		const y = scaleLinear()
			.domain([-maxAbs, maxAbs])
			.range([stripH - 4, 4])
		svg.append('line').attr('x1', 0).attr('x2', stripW).attr('y1', y(0)).attr('y2', y(0)).attr('stroke', '#e5e7eb')
		for (const p of points) {
			svg
				.append('line')
				.attr('x1', x(p.pos))
				.attr('x2', x(p.pos))
				.attr('y1', y(0))
				.attr('y2', y(p.log2fc))
				.attr('stroke', p.color)
				.attr('stroke-opacity', 0.4)
			attachEntryBehavior(
				svg
					.append('circle')
					.attr('cx', x(p.pos))
					.attr('cy', y(p.log2fc))
					.attr('r', 2.5)
					.attr('fill', p.color)
					.attr('fill-opacity', 0.8),
				p.entry,
				self
			)
		}
	}

	const foot = body
		.append('div')
		.style('display', 'flex')
		.style('gap', '10px')
		.style('flex-wrap', 'wrap')
		.style('font-size', '.7em')
		.style('color', '#6b7280')
		.style('margin-top', '4px')
	for (const [type, tc] of typeCounts) {
		const item = foot.append('span').style('display', 'inline-flex').style('align-items', 'center').style('gap', '4px')
		item
			.append('span')
			.style('display', 'inline-block')
			.style('width', '7px')
			.style('height', '7px')
			.style('border-radius', '50%')
			.style('background', tc.color)
		item.append('span').text(`${tc.count} ${type}`)
	}
}

// header coverage line: which studies detected this protein, sample-set and
// PTM counts, and the isoform-collapsing note
export function renderCoverageLine(holder: any, td: TileData) {
	const parts = [`${td.cohortCount} sample set${td.cohortCount === 1 ? '' : 's'}`]
	if (td.ptmSiteCount) parts.push(`${td.ptmSiteCount} PTM site measurement${td.ptmSiteCount === 1 ? '' : 's'}`)
	if (td.isoformCount > 1) parts.push(`${td.isoformCount} isoforms (tiles show the most significant per sample set)`)
	holder
		.append('div')
		.style('font-size', '.8em')
		.style('color', '#6b7280')
		.style('margin-bottom', '4px')
		.text(parts.join(' · '))
}
