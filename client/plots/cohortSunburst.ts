import type { MassState, BasePlotConfig } from '#mass/types/mass'
import { getCompInit, copyMerge, type RxComponent, type ComponentApi } from '#rx'
import { PlotBase } from './PlotBase'
import { select } from 'd3-selection'
import { deriveCatalogRows, catalogRowKey, cohortMatches, type CatalogRow } from './proteome.catalog'
import type { ProteomeCohortSunburstConfig, ProteomeSunburstStat } from '#types'
import {
	SunburstRenderer,
	card,
	badge,
	pill,
	icon,
	SIZE,
	WARN,
	TEXT_DARK,
	TEXT_MUTED,
	LINK,
	RULE,
	type Card,
	type HNode,
	type SunNode
} from './sunburst/SunburstRenderer'

/*
Zoomable cohort sunburst of a dataset's sample sets, for example: panNDA

Rings follow the dataset's `cohortSunburst.levels`, each wedge sized by the number of sample sets (cohorts) beneath it.
The chart itself is the shared SunburstRenderer; this plot builds the tree from the sample-set
catalog and owns the selection: clicking a sample-set wedge (outermost leaf) toggles it in the
selection, and "Select all" adds every sample set under the current centre. The selection panel
launches the same actions as the Studies catalog: one cohort → Analytics Tools, several → cohort
compare.
*/

const defaultConfig = { chartType: 'cohortSunburst' }

class CohortSunburst extends PlotBase implements RxComponent {
	static type = 'cohortSunburst'
	type: string
	dom!: {
		holder: any
		body: any
		/** the selected sample sets, with the analyze/compare action */
		sel: Card
		/** "select all" control beside reset, for the sample sets under the centre */
		selectAll: any
		header?: any
	}
	ui?: SunburstUiConfig
	renderer?: SunburstRenderer
	/** selected cohorts by key, in selection order */
	selected: Map<string, CatalogRow> = new Map()
	/** leaf node of each cohort by key, for its hue and ring label */
	leafNode: Map<string, HNode> = new Map()

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = CohortSunburst.type
	}

	async init() {
		// the plot holder inherits nowrap from the sandbox; the cards need their text to wrap
		const holder = this.opts.holder.append('div').style('padding', '10px').style('white-space', 'normal')
		const body = holder.append('div')
		this.dom = {
			holder,
			body,
			sel: undefined as any,
			selectAll: undefined,
			header: this.opts.header
		}
		if (this.dom.header) this.dom.header.html('Explore cohorts')
	}

	getState(appState: MassState) {
		const config: any = appState.plots.find((p: BasePlotConfig) => p.id === this.id)
		if (!config) throw `No plot with id='${this.id}' found`
		return { config }
	}

	async main() {
		const proteome = this.app.vocabApi.termdbConfig?.queries?.proteome
		const ui: SunburstUiConfig | undefined = proteome?.cohortSunburst
		this.dom.body.selectAll('*').remove()
		this.renderer?.destroy()
		if (!ui?.levels?.length || !proteome?.organisms) {
			this.dom.body
				.append('div')
				.style('padding', '20px')
				.style('color', '#666')
				.text('No cohort sunburst is configured.')
			return
		}
		this.ui = ui
		const tree = buildTree(deriveCatalogRows(proteome.organisms), ui)
		this.renderer = new SunburstRenderer({
			holder: this.dom.body,
			unit: { one: 'sample set', many: 'sample sets' },
			rootName: 'All sample sets',
			rootPathTitle: `${ui.levels[0]?.name || ''} selection`.trim(),
			colors: ui.colors,
			statLabels: (ui.stats || []).map(s => s.label),
			hooks: {
				onClick: (d: HNode) => this.onWedgeClick(d),
				isSelected: (d: HNode) => this.isSelected(d),
				isDimmed: (d: HNode) =>
					this.selectedKind() !== undefined && !leavesOf(d.data).some(l => this.compatible(l.cohort!)),
				cursor: (d: HNode) => (d.dim && this.terminalLeaf(d) ? 'not-allowed' : 'pointer'),
				tooltip: (d: HNode, box: any) => this.tooltip(d, box),
				onFocus: () => {
					this.renderStats()
					this.renderToolbar()
					this.renderSidebar()
				}
			}
		})
		this.dom.selectAll = this.renderer.addControl().on('click', () => this.toggleSelectAll())
		this.dom.sel = card(this.renderer.dom.right, 'Selected sample sets')
		this.renderer.setTree(tree)
		this.leafNode = new Map(this.renderer.root.leaves().map((l: HNode) => [cohortKey(l.data.cohort), l]))
		// the sidebar's badges need leafNode, which exists only once the tree is laid out
		this.renderSidebar()
	}

	/** selection strokes on the wedges plus the selection panel; no geometry changes */
	refreshSelection() {
		this.renderer!.refresh()
		this.renderToolbar()
		this.renderSidebar()
	}

	/************ selection kind ************/

	kindKeys(): string[] {
		return this.ui?.selectionKind?.keys || []
	}

	/** the kind of the current selection; undefined when nothing is selected */
	selectedKind(): string | undefined {
		const first = this.selected.values().next()
		return first.done ? undefined : kindOf(first.value, this.kindKeys())
	}

	/** whether a cohort could be added to the current selection */
	compatible(r: CatalogRow): boolean {
		const kind = this.selectedKind()
		return kind === undefined || kindOf(r, this.kindKeys()) === kind
	}

	/** stat boxes for the sample sets under the centre */
	renderStats() {
		const leaves = leavesOf(this.renderer!.focus.data)
		const values = new Map<string, number | null>()
		for (const def of this.ui!.stats || []) values.set(def.label, computeStat(leaves, def))
		const keyOf = new Map((this.ui!.stats || []).map(def => [def.label, def.key || '']))
		this.renderer!.setStats(values, label => `No ${keyOf.get(label)} counts in the dataset yet`)
	}

	/** the sample sets Select all would take under the centre: those of the selected kind,
	 *  or, with nothing selected, of the largest kind there; and whether all are selected */
	underFocus(): { under: SunNode[]; allIn: boolean; kind: string } {
		const leaves = leavesOf(this.renderer!.focus.data)
		const keys = this.kindKeys()
		const kind = this.selectedKind() ?? largestKind(leaves, keys)
		const under = leaves.filter(l => kindOf(l.cohort!, keys) === kind)
		const allIn = under.length > 0 && under.every(l => this.selected.has(cohortKey(l.cohort!)))
		return { under, allIn, kind }
	}

	toggleSelectAll() {
		const { under, allIn } = this.underFocus()
		if (!under.length) return
		for (const l of under) {
			if (allIn) this.selected.delete(cohortKey(l.cohort!))
			else this.selected.set(cohortKey(l.cohort!), l.cohort!)
		}
		this.refreshSelection()
	}

	/** select all follows the centre and flips to deselect once everything under it is selected */
	renderToolbar() {
		const { under, allIn, kind } = this.underFocus()
		const what = kind ? `${kind} sample sets` : 'sample sets'
		const none = !under.length
		this.dom.selectAll
			.style('opacity', none ? 0.35 : 1)
			.style('cursor', none ? 'default' : 'pointer')
			.attr(
				'title',
				none
					? `No ${what} under the centre; clear the selection to pick other kinds`
					: allIn
					? `Deselect every ${what.replace(/s$/, '')} under the centre`
					: `Select every ${what.replace(/s$/, '')} under the centre`
			)
			.html(
				allIn
					? `${icon('<circle cx="12" cy="12" r="9"/><path d="M8 12h8"/>')}DESELECT ALL`
					: `${icon('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>')}SELECT ALL ${under.length}${
							kind ? ` · ${kind.toUpperCase()}` : ''
					  }`
			)
	}

	/** the selected-sample-sets card: count in the head, one line per set with its hue
	 *  badge, and the analyze/compare action as the footer */
	renderSidebar() {
		const { title, headRight, body } = this.dom.sel
		headRight.selectAll('*').remove()
		body.selectAll('*').remove()
		headRight.style('margin-bottom', '8px')
		const n = this.selected.size
		title.text(n ? 'Selected sample sets' : 'No sample sets selected')
		if (n) {
			pill(headRight).text(n)
			headRight
				.append('span')
				.style('font-size', '11px')
				.style('color', LINK)
				.style('cursor', 'pointer')
				.text('Clear')
				.on('click', () => {
					this.selected.clear()
					this.refreshSelection()
				})
		}

		const kind = this.selectedKind()
		if (kind) {
			body
				.append('div')
				.style('font-size', '0.75em')
				.style('color', TEXT_MUTED)
				.style('margin-bottom', '4px')
				.text(`${kind} only · clear the selection to pick another kind`)
		}
		const list = body
			.append('div')
			.style('max-height', `${SIZE - 200}px`)
			.style('overflow-y', 'auto')
		if (!n) {
			list
				.append('div')
				.style('font-size', '0.85em')
				.style('color', TEXT_MUTED)
				.style('padding', '4px 0')
				.text('Click a sample-set wedge, or Select all above the chart.')
		}
		for (const [k, r] of this.selected) {
			const leaf = this.leafNode.get(k)
			const line = list
				.append('div')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '8px')
				.style('padding', '3px 6px')
				.style('margin', '2px 0')
				.style('border-radius', '6px')
				.on('mouseenter', (event: any) => {
					select(event.currentTarget).style('background', '#f3f4f6').select('.sjpp-sunburst-remove').style('opacity', 1)
				})
				.on('mouseleave', (event: any) => {
					select(event.currentTarget)
						.style('background', 'transparent')
						.select('.sjpp-sunburst-remove')
						.style('opacity', 0)
				})
			badge(line, leaf?.data.name || r.cohort, leaf ? this.renderer!.hue(leaf) : '#9ca3af', 24)
			const text = line.append('div').style('flex', '1 1 auto').style('min-width', '0').style('line-height', '1.2')
			text
				.append('div')
				.style('font-size', '0.9em')
				.style('color', TEXT_DARK)
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.style('white-space', 'nowrap')
				.text(this.selectionLabel(r))
			text
				.append('div')
				.style('font-size', '0.7em')
				.style('color', '#6b7280')
				.text(r.proteome + (r.placeholder ? ' · placeholder data' : ''))
			line
				.append('span')
				.attr('class', 'sjpp-sunburst-remove')
				.style('opacity', 0)
				.style('cursor', 'pointer')
				.style('color', '#9ca3af')
				.style('font-size', '0.85em')
				.attr('title', 'Remove')
				.text('✕')
				.on('click', () => {
					this.selected.delete(k)
					this.refreshSelection()
				})
		}

		// PTM (site-level) and protein-level z are not comparable
		const types = new Set([...this.selected.values()].map(r => r.dataType))
		if (types.size > 1) {
			body
				.append('div')
				.style('font-size', '0.8em')
				.style('color', WARN)
				.style('margin-top', '6px')
				.text('Selection mixes PTM (site-level) and protein-level assays; their log2FC-z are not directly comparable.')
		}

		const footer = body
			.append('div')
			.style('margin-top', '10px')
			.style('padding-top', '10px')
			.style('border-top', `1px solid ${RULE}`)
		pill(footer, { button: true })
			.property('disabled', n === 0)
			.style('opacity', n ? 1 : 0.3)
			.style('cursor', n ? 'pointer' : 'default')
			.text(n >= 2 ? `Compare ${n} cohorts` : 'Analyze cohort')
			.on('click', () => this.onAction())
	}

	/************ interaction ************/

	/** the single sample set a wedge stands for: the leaf itself, or the only leaf beneath an
	 *  inner wedge (e.g. a human assay wedge with one cohort), so it can be selected without
	 *  zooming down to a lone full-circle wedge */
	terminalLeaf(d: HNode): CatalogRow | undefined {
		if (d.data.cohort) return d.data.cohort
		if (d.value !== 1) return undefined
		return leavesOf(d.data)[0].cohort
	}

	isSelected(d: HNode): boolean {
		const r = this.terminalLeaf(d)
		return !!r && this.selected.has(cohortKey(r))
	}

	onWedgeClick(d: HNode) {
		const r = this.terminalLeaf(d)
		if (r) {
			if (!this.compatible(r)) return // the tooltip says why
			const k = cohortKey(r)
			if (this.selected.has(k)) this.selected.delete(k)
			else this.selected.set(k, r)
			this.refreshSelection()
		} else this.renderer!.zoomTo(d)
	}

	tooltip(d: HNode, box: any) {
		const r = this.terminalLeaf(d)
		const stat = (label: string, value: string | number) => {
			const line = box.append('div').style('color', '#374151')
			line.append('span').text(`${label}: `)
			line.append('b').text(String(value))
		}
		const note = (text: string, color: string) =>
			box.append('div').style('margin-top', '4px').style('color', color).text(text)
		const kind = this.selectedKind()
		if (r) {
			box.append('div').style('color', '#6b7280').text(`${r.species} · ${r.proteome} · ${r.cohort}`)
			if (r.placeholder) box.append('div').style('color', WARN).text('placeholder data')
			if (!this.compatible(r))
				note(`Clear the ${kind} selection to select a ${kindOf(r, this.kindKeys())} sample set`, WARN)
			else note(this.selected.has(cohortKey(r)) ? 'click to deselect' : 'click to select', LINK)
		} else {
			box.append('div').style('color', '#6b7280').text(d.data.level)
			stat('Sample sets', d.value)
			if (d.dim) note(`No ${kind} sample sets here; clear the selection to pick from these`, WARN)
			note('click to zoom in', LINK)
		}
	}

	/** label for the selection list / compare plot; adds the assay when several are selected */
	selectionLabel(r: CatalogRow): string {
		const species = r.species
		const leaf = this.leafNode.get(cohortKey(r))
		const base = `${species} ${leaf?.data.name || r.cohort}`
		const assays = new Set([...this.selected.values()].map(x => x.proteome))
		return assays.size > 1 ? `${base} (${r.proteome})` : base
	}

	onAction() {
		const sel = [...this.selected.values()]
		if (sel.length === 1) {
			const c = sel[0]
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'ProteomeInput',
					proteomeDetails: { organism: c.organism, assay: c.assay, cohort: c.cohort },
					hidePlotFilter: true
				}
			})
		} else if (sel.length >= 2) {
			this.app.dispatch({
				type: 'plot_create',
				config: {
					chartType: 'proteomeCohortCompare',
					cohorts: sel.map(c => ({
						organism: c.organism,
						assay: c.assay,
						cohort: c.cohort,
						label: this.selectionLabel(c)
					}))
				}
			})
		}
	}

	destroy() {
		this.renderer?.destroy()
	}
}

/*********** tree building (DOM-free) ***********/

type SunburstUiConfig = ProteomeCohortSunburstConfig
type Level = SunburstUiConfig['levels'][number]

/** a SunNode whose leaves carry the cohort's catalog row and count 1 */
type TreeNode = SunNode & { children?: TreeNode[]; cohort?: CatalogRow }

/** the value of one ring for a cohort, '' if the ring does not apply to it */
function levelValue(row: CatalogRow, level: Level): string {
	for (const v of level.values) {
		if (v.when && !cohortMatches(v.when, row.organism, row.assay, row)) continue
		if (v.const) return v.const
		if (v.key && row[v.key]) return String(row[v.key])
	}
	return ''
}

function leafLabel(row: CatalogRow, cfg: SunburstUiConfig['leafLabel']): string {
	const pick = (keys: string[]) =>
		keys
			.map(k => row[k])
			.filter(Boolean)
			.map(String)
	const a = pick(cfg.keys)
	if (a.length) return a.join(' ')
	const b = pick(cfg.fallbackKeys || [])
	return b.length ? b.join(' ') : row.cohort
}

/** nest cohorts by their ring values, in first-seen order. A ring without a value for a
 *  cohort is skipped for that cohort, so branches may differ in depth. */
function buildTree(rows: CatalogRow[], ui: SunburstUiConfig, rootName = 'All sample sets'): TreeNode {
	const root: TreeNode = { name: rootName, children: [] }
	for (const r of rows) {
		let node = root
		for (const level of ui.levels) {
			const v = levelValue(r, level)
			if (!v) continue
			if (!node.children) node.children = []
			let child = node.children.find(c => c.name === v && c.level === level.name)
			if (!child) {
				child = { name: v, level: level.name, children: [] }
				node.children.push(child)
			}
			node = child
		}
		if (!node.children) node.children = []
		node.children.push({ name: leafLabel(r, ui.leafLabel), cohort: r, value: 1 })
	}
	disambiguateLeaves(root)
	return root
}

/** sibling leaves sharing a label (e.g. two studies of the same disease and region) get
 *  their cohort key appended, so each wedge names the sample set it selects */
function disambiguateLeaves(node: TreeNode) {
	const leaves = (node.children || []).filter(c => c.cohort)
	const seen = new Map<string, number>()
	for (const l of leaves) seen.set(l.name, (seen.get(l.name) || 0) + 1)
	for (const l of leaves) if (seen.get(l.name)! > 1) l.name = `${l.name} (${l.cohort!.cohort})`
	for (const c of node.children || []) if (!c.cohort) disambiguateLeaves(c)
}

/** every leaf under a node, in tree order */
function leavesOf(n: TreeNode): TreeNode[] {
	if (n.cohort) return [n]
	const out: TreeNode[] = []
	for (const c of n.children || []) out.push(...leavesOf(c))
	return out
}

const cohortKey = (r: CatalogRow) => catalogRowKey(r.organism, r.assay, r.cohort)

/*********** selection kind ***********/

/** the kind of a cohort: its values of the selectionKind keys joined, e.g. "Human Whole";
 *  '' when no keys are configured, so every cohort is of one kind */
function kindOf(r: CatalogRow, keys: string[] = []): string {
	return keys
		.map(k => r[k])
		.filter(Boolean)
		.map(String)
		.join(' ')
}

/** the kind with the most leaves; first-seen wins a tie; '' for no leaves */
function largestKind(leaves: TreeNode[], keys: string[] = []): string {
	const counts = new Map<string, number>()
	for (const l of leaves) {
		const k = kindOf(l.cohort!, keys)
		counts.set(k, (counts.get(k) || 0) + 1)
	}
	let best = ''
	let bestN = 0
	for (const [k, n] of counts) {
		if (n > bestN) {
			best = k
			bestN = n
		}
	}
	return best
}

/** value of a stat box over a set of leaves; null = not available (a sum with no data) */
function computeStat(leaves: TreeNode[], def: ProteomeSunburstStat): number | null {
	const rows = leaves.map(l => l.cohort!).filter(r => !def.where || cohortMatches(def.where, r.organism, r.assay, r))
	if (def.kind === 'count') return rows.length
	if (def.kind === 'distinct') {
		const vals = new Set(rows.map(r => r[def.key || '']).filter(v => v !== undefined && v !== null && v !== ''))
		return vals.size
	}
	// sum
	let total = 0
	let seen = false
	for (const r of rows) {
		const v = Number(r[def.key || ''])
		if (!Number.isFinite(v) || r[def.key || ''] === undefined || r[def.key || ''] === '') continue
		total += v
		seen = true
	}
	return seen ? total : null
}

export const componentInit = getCompInit(CohortSunburst)

export async function getPlotConfig(opts: any) {
	const config = structuredClone(defaultConfig)
	return copyMerge(config, opts)
}
