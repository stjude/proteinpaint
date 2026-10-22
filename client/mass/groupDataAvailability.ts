import { dofetch3 } from '#common/dofetch'
import type { DataAvailabilityGroup, DataAvailabilityResponse, DataAvailabilityType } from '#types'

/*
The samples with data of sample groups, from termdb/dataAvailability, in sections (availabilitySections()):
the kinds of data, the assays of mutation data and the survival terms. For the menu of a custom variable
(groups.js): a table of how many samples of each group have each kind of data, whose rows may open a plot
of the groups, and the menu options of an analysis of that data removed where the groups lack it. The
sunburst lists the same sections for its one selected group.
*/

/** the menu options of an analysis of a kind of data, by data-testid: `every` for an analysis that compares
 *  the groups, which needs the data in each of them, `some` for one that shows them side by side */
const optionsByDataType: { [dataType in DataAvailabilityType]?: { testid: string; need: 'every' | 'some' }[] } = {
	geneExpression: [{ testid: 'sjpp-hiercluster-option', need: 'some' }],
	rnaseqGeneCount: [{ testid: 'sjpp-da-option', need: 'every' }],
	dnaMethylation: [{ testid: 'sjpp-dmr-option', need: 'every' }],
	junction: [{ testid: 'sjpp-da-splicing-option', need: 'every' }],
	NIdata: [{ testid: 'sjpp-brain-imaging-option', need: 'some' }]
}

/** a line of the available data: a kind of data and the count of each group */
export type AvailabilityRow = {
	/** what the row is of: a kind of data (DataAvailabilityType), an assay or a survival term */
	kind: 'data' | 'assay' | 'survival'
	/** the data type, the assay key or the survival term id */
	key: string
	label: string
	/** of the counts, when not the unit of the groups, e.g. "patients" */
	unit?: string
	/** in the order of the groups */
	counts: (number | undefined)[]
}

/** rows of a kind of data, under a title unless they are the kinds of data at the top */
type AvailabilitySection = { key: string; title?: string; rows: AvailabilityRow[] }

/** the rows of the counts, in sections: the kinds of data, the assays of mutation data, then the survival
 *  terms. A row is left out when no group has a sample with the data, and a section without rows */
export function availabilitySections(
	res: DataAvailabilityResponse,
	exclude: DataAvailabilityType[] = []
): AvailabilitySection[] {
	const first = res.groups[0]
	const data: AvailabilityRow[] = res.dataTypes
		.filter(d => !exclude.includes(d.type))
		.map(d => ({
			kind: 'data',
			key: d.type,
			label: d.label,
			...(d.unit ? { unit: d.unit } : {}),
			counts: res.groups.map(g => g.data[d.type])
		}))
	const assays: AvailabilityRow[] = (first?.assays || []).map(a => ({
		kind: 'assay',
		key: a.key,
		label: a.label,
		counts: res.groups.map(g => g.assays?.find(b => b.key == a.key)?.count)
	}))
	const survival: AvailabilityRow[] = (first?.survival || []).map(t => ({
		kind: 'survival',
		key: t.termid,
		label: t.name,
		counts: res.groups.map(g => g.survival?.find(u => u.termid == t.termid)?.count)
	}))
	const hasData = (r: AvailabilityRow) => r.counts.some(n => n && n > 0)
	const survivalUnit = first?.survival?.[0]?.unit
	const sections: AvailabilitySection[] = [
		{ key: 'data', rows: data.filter(hasData) },
		{ key: 'mutations', title: 'Mutations · samples assayed', rows: assays.filter(hasData) },
		{ key: 'survival', title: `Survival${survivalUnit ? ' · ' + survivalUnit : ''}`, rows: survival.filter(hasData) }
	]
	return sections.filter(s => s.rows.length)
}

/** what a row of the counts table does when clicked; the option that it stands in for is removed from the
 *  menu then */
type RowAction = { run: (anchor: HTMLElement) => void; replaces?: string }

type DataAvailabilityArg = {
	/** the table is drawn here, replacing its content */
	holder: any
	/** the menu with the options to remove where the groups lack their data */
	menuDiv: any
	vocabApi: any
	groups: DataAvailabilityGroup[]
	/** colors of the groups, by name, for the column headers */
	colors?: { [name: string]: string | undefined }
	filter0?: any
	/** the active cohort string, whose survival terms are counted */
	cohort?: string
	/** the action of a row, if any */
	rowAction?: (row: AvailabilityRow) => RowAction | undefined
}

/** draw the counts of the groups' samples with data, for the kinds of data that a group has, and remove the
 *  options that the groups lack data for; nothing is drawn when no group has data. Resolves when done */
export async function renderDataAvailability(arg: DataAvailabilityArg): Promise<void> {
	const { holder, menuDiv, vocabApi } = arg
	holder.selectAll('*').remove()
	if (!arg.groups.length) return
	holder.attr('data-testid', 'sjpp-group-data-availability').style('padding', '5px 8px')
	const wait = holder
		.append('div')
		.style('opacity', 0.6)
		.style('font-size', '.85em')
		.text('Loading samples with data ...')
	let res: DataAvailabilityResponse
	try {
		res = await fetchDataAvailability(vocabApi, arg.groups, arg.filter0, arg.cohort)
	} catch (e: any) {
		wait
			.attr('class', 'sja_errorbar')
			.style('opacity', 1)
			.text(e?.message || String(e))
		return
	}
	wait.remove()

	// an option of an analysis is removed when the groups lack its data
	for (const { type } of res.dataTypes) {
		const counts = res.groups.map(g => g.data[type])
		for (const o of optionsByDataType[type] || []) {
			const ok = o.need == 'every' ? counts.every(n => n && n > 0) : counts.some(n => n && n > 0)
			if (!ok) menuDiv.select(`[data-testid="${o.testid}"]`).remove()
		}
	}
	// the note of which group is the case of a differential analysis, once no such analysis is offered
	const analyses = ['sjpp-da-option', 'sjpp-da-dnaMeth-option', 'sjpp-da-splicing-option', 'sjpp-dmr-option']
	if (menuDiv.select(analyses.map(id => `[data-testid="${id}"]`).join(',')).empty())
		menuDiv.select('[data-testid="sjpp-da-note"]').remove()

	const sections = availabilitySections(res)
	if (!sections.length) return
	const table = holder.append('table').style('border-collapse', 'collapse').style('font-size', '.85em')
	const cell = (tr: any) => tr.append('td').style('padding', '2px 6px')
	if (res.groups.length > 1) {
		const tr = table.append('tr')
		cell(tr)
		for (const g of res.groups) {
			// a group name is supplied by the user, so it is set as text; a long one is cut, in full in the tooltip
			const td = cell(tr)
				.style('text-align', 'right')
				.style('max-width', '130px')
				.style('overflow', 'hidden')
				.style('text-overflow', 'ellipsis')
				.style('white-space', 'nowrap')
				.style('opacity', 0.8)
				.attr('title', g.name)
			const color = arg.colors?.[g.name]
			if (color)
				td.append('span')
					.style('display', 'inline-block')
					.style('width', '9px')
					.style('height', '9px')
					.style('margin-right', '4px')
					.style('background-color', color)
			td.append('span').text(g.name)
		}
	}
	for (const section of sections) {
		if (section.title) {
			const tr = table.append('tr').attr('data-testid', `sjpp-group-section-${section.key}`)
			cell(tr)
				.attr('colspan', res.groups.length + 1)
				.style('padding-top', '6px')
				.style('font-size', '.85em')
				.style('font-weight', 'bold')
				.style('letter-spacing', '.04em')
				.style('text-transform', 'uppercase')
				.style('opacity', 0.6)
				.text(section.title)
		}
		for (const row of section.rows) {
			const tr = table.append('tr').attr('data-testid', `sjpp-group-${row.kind}-${row.key}`)
			const label = cell(tr)
				.style('white-space', 'nowrap')
				.style('padding-left', section.title ? '16px' : '6px')
				.text(row.label + (row.unit ? ` (${row.unit})` : ''))
			for (const n of row.counts) {
				cell(tr)
					.style('text-align', 'right')
					.style('opacity', n ? 1 : 0.45)
					.text(n === undefined ? '' : n.toLocaleString())
			}
			const action = arg.rowAction?.(row)
			if (!action) continue
			if (action.replaces) menuDiv.select(`[data-testid="${action.replaces}"]`).remove()
			label.append('span').style('margin-left', '6px').text('›')
			tr.attr('class', 'sja_menuoption')
				.attr('title', `Open the ${row.label} of the groups`)
				.attr('role', 'button')
				.attr('tabindex', 0)
				.style('cursor', 'pointer')
				.on('click', (event: any) => action.run(event.currentTarget))
				.on('keydown', (event: KeyboardEvent) => {
					if (event.key == 'Enter' || event.key == ' ') {
						event.preventDefault()
						action.run(event.currentTarget as HTMLElement)
					}
				})
		}
	}
}

/** cohort: the active cohort string (getActiveCohortStr()), whose survival terms are counted */
export async function fetchDataAvailability(
	vocabApi: any,
	groups: DataAvailabilityGroup[],
	filter0?: any,
	cohort?: string
): Promise<DataAvailabilityResponse> {
	const body: any = { genome: vocabApi.vocab.genome, dslabel: vocabApi.vocab.dslabel, groups }
	if (filter0 !== undefined) body.filter0 = filter0
	if (cohort) body.cohort = cohort
	const res: any = await dofetch3('termdb/dataAvailability', { body })
	if (res?.error) throw res.error
	if (!Array.isArray(res?.groups)) throw 'invalid response from termdb/dataAvailability'
	return res
}
