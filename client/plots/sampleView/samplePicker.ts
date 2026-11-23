import { DEFAULT_SAMPLE_TYPE, ROOT_SAMPLE_TYPE } from '#shared/terms.js'
import type { Sample } from './sampleView.tiles.ts'

/*********************************************************************
 * samplePicker
 *
 * Choose a sample to open in the sample view: a search box over the root
 * samples (e.g. the patients) passing the filter, with the first matches
 * listed under it. Shown in the menu of the Sample View chart button, in
 * the plot to change its sample, and in a plot without a sample.
 *
 * Also has searchSampleInput(), the datalist-based search box of the
 * scatter plot.
 *********************************************************************/

export type SamplePickerOpts = {
	/** d3 selection to render in */
	holder: any
	vocabApi: any
	/** only the samples passing the filter are listed */
	filter?: any
	hasSampleAncestry?: boolean
	/** called with the chosen root sample */
	onSelect: (sample: Sample) => void
	/** most samples listed; default 10 */
	limit?: number
}

/** the samples of getSamplesByName: by sample name */
type SamplesByName = {
	[name: string]: { id: number; name?: string; ancestor_name?: string; sample_type?: number | null }
}

/** a listed sample, with its related samples as text */
type Match = { name: string; label: string }

const DEFAULT_LIMIT = 10

export async function showSamplePicker(opts: SamplePickerOpts) {
	const limit = opts.limit || DEFAULT_LIMIT
	const dom = renderSkeleton(opts.holder)
	let samplesData: SamplesByName
	try {
		samplesData = await opts.vocabApi.getSamplesByName({ filter: opts.filter })
		if ('error' in samplesData) throw samplesData.error
	} catch (e: any) {
		dom.status.style('color', '#b91c1c').text(`Cannot list the samples: ${e?.message || e}`)
		return
	}
	const names = getRootSampleNames(samplesData, opts.hasSampleAncestry)
	if (!names.length) {
		dom.status.text('No accessible samples')
		return
	}
	const { childrenByParent, rootFor } = buildHierarchy(samplesData)
	const matches: Match[] = names.map(name => ({ name, label: getSampleLabel(name, childrenByParent, rootFor) }))
	const select = (name: string) => opts.onSelect({ sampleId: samplesData[name].id, sampleName: name })

	dom.input.property('disabled', false).on('input', update)
	dom.input.on('keydown', (event: KeyboardEvent) => {
		if (event.key != 'Enter') return
		const first = findSamples(matches, dom.input.property('value'), 1)[0]
		if (first) select(first.name)
	})
	;(dom.input.node() as HTMLInputElement).focus()
	update()

	function update() {
		const str = dom.input.property('value')
		const found = findSamples(matches, str, limit + 1)
		const shown = found.slice(0, limit)
		dom.list.selectAll('*').remove()
		for (const m of shown) {
			const row = dom.list
				.append('div')
				.attr('class', 'sja_menuoption')
				.attr('tabindex', 0)
				.attr('data-testid', 'sjpp-samplepicker-option')
				.style('padding', '5px 10px')
				.on('click', () => select(m.name))
				.on('keydown', (event: KeyboardEvent) => {
					if (event.key == 'Enter') select(m.name)
				})
			row.append('span').text(m.name)
			if (m.label != m.name)
				row
					.append('span')
					.style('margin-left', '10px')
					.style('font-size', '.8em')
					.style('color', '#6b7280')
					.text(m.label)
		}
		dom.status.style('color', '#6b7280').text(getStatus(str, shown.length, found.length > limit, names.length))
	}
}

function renderSkeleton(holder: any) {
	const div = holder.append('div').attr('data-testid', 'sjpp-samplepicker').style('padding', '10px')
	const input = div
		.append('input')
		.attr('type', 'search')
		.attr('aria-label', 'Search samples')
		.attr('placeholder', 'Search samples')
		.attr('autocomplete', 'off')
		.property('disabled', true)
		.style('width', '250px')
	const list = div.append('div').style('margin-top', '5px').style('max-height', '300px').style('overflow-y', 'auto')
	const status = div.append('div').style('margin-top', '5px').style('font-size', '.8em').text('Loading samples …')
	return { input, list, status }
}

function getStatus(str: string, shown: number, more: boolean, total: number) {
	const n = total.toLocaleString()
	if (!str) return more ? `Showing ${shown} of ${n} samples, type to search` : `${n} samples`
	if (!shown) return 'No matching sample'
	return more ? `Showing the first ${shown} matches` : `${shown} match${shown > 1 ? 'es' : ''}`
}

/** up to limit samples whose name, or the name of a related sample, includes str: first the names that start with
 * str, then the other names that include it, then by a related sample. Case-insensitive */
export function findSamples(matches: Match[], str: string, limit: number): Match[] {
	const s = str.trim().toLowerCase()
	if (!s) return matches.slice(0, limit)
	const found: Match[] = []
	const tiers = [
		(m: Match) => m.name.toLowerCase().startsWith(s),
		(m: Match) => m.name.toLowerCase().includes(s),
		(m: Match) => m.label.toLowerCase().includes(s)
	]
	const listed = new Set<string>()
	for (const isMatch of tiers) {
		for (const m of matches) {
			if (found.length == limit) return found
			if (listed.has(m.name) || !isMatch(m)) continue
			listed.add(m.name)
			found.push(m)
		}
	}
	return found
}

/** the names of the samples to search: the root samples, or all samples of a dataset without sample ancestry */
export function getRootSampleNames(samplesData: SamplesByName, hasSampleAncestry?: boolean): string[] {
	const names: string[] = []
	for (const name in samplesData) {
		const sample_type = samplesData[name].sample_type
		if (
			sample_type == ROOT_SAMPLE_TYPE ||
			sample_type == null ||
			(!hasSampleAncestry && sample_type == DEFAULT_SAMPLE_TYPE)
		)
			names.push(name)
	}
	return names
}

export function searchSampleInput(
	holder: any,
	samplesData: any,
	hasSampleAncestry: any,
	callback: (name: string) => void,
	keyUpCallback?: (str: string) => void
) {
	const limit = 100
	const allSamples = getRootSampleNames(samplesData, hasSampleAncestry)
	const isBigDataset = allSamples.length > 10000

	if (allSamples.length == 0)
		//Happens if it requires sign in first
		return

	// === Precompute Hierarchy labels once ===
	const { childrenByParent, rootFor } = buildHierarchy(samplesData)
	const sampleName = allSamples[0]
	const input = holder
		.append('input')
		.attr('list', 'sampleDatalist')
		.property('autocomplete', 'off')
		.attr('placeholder', sampleName)
		.style('width', '250px')

	holder.style('opacity', '0.8')
	const datalist = holder.append('datalist').attr('id', 'sampleDatalist')
	addOptions(allSamples)
	input.on('keyup', () => {
		datalist.selectAll('*').remove()
		const str = input.node().value.toLowerCase()
		if (keyUpCallback) keyUpCallback(str)
		const options: string[] = []
		for (const sample of allSamples) {
			if (sample.toLowerCase().startsWith(str)) options.push(sample)
			if (options.length == limit && allSamples.length > 10000) break
		}
		for (const sample of allSamples) {
			if (sample.toLowerCase().includes(str) && !options.includes(sample)) options.push(sample)
			if (options.length == limit && allSamples.length > 10000) break
		}
		if (options.length > 1 || (options.length == 1 && input.node().value != options[0])) addOptions(options)
	})
	input.on('change', () => {
		const sampleName = input.node().value
		callback(sampleName)
	})
	function addOptions(options) {
		datalist
			.selectAll('option')
			.data(options.filter((s, i) => i < limit))
			.enter()
			.append('option')
			.attr('value', d => d)
			.attr(
				'label',
				(d, i) =>
					getSampleLabel(d, childrenByParent, rootFor) +
					(i + 1 == limit
						? isBigDataset
							? ` Showing first ${i + 1} hits`
							: ` Showing ${i + 1} of ${options.length} hits`
						: i + 1 === options.length && i > 0
						? `  (Found ${options.length} hits)`
						: '')
			)
	}
	return sampleName
}

/** the related samples of a sample as text, e.g. "SJ1-primary > SJ1-pdx, SJ1-csf"; the sample name if none */
function getSampleLabel(sampleName: string, childrenByParent: Map<string, string[]>, rootFor: Map<string, string>) {
	const rootName = rootFor.get(sampleName) || sampleName
	if (!childrenByParent.has(rootName)) return sampleName

	const rootChildren = childrenByParent.get(rootName) || []
	if (rootChildren.length === 0) return sampleName

	const parts: string[] = []
	for (const child of rootChildren) {
		const chain: string[] = [child]
		let cur = child
		let kids = childrenByParent.get(cur) || []
		while (kids.length > 0) {
			chain.push(kids[0])
			cur = kids[0]
			kids = childrenByParent.get(cur) || []
		}
		parts.push(chain.length > 1 ? chain.join(' > ') : child)
	}
	return parts.join(', ')
}

function buildHierarchy(samplesData: any) {
	const childrenByParent = new Map<string, string[]>()
	const rootFor = new Map<string, string>()

	// Build children map + find roots
	for (const s of Object.values(samplesData) as any[]) {
		const childName: string = s.name
		const parentName: string = s.ancestor_name
		if (parentName) {
			if (!childrenByParent.has(parentName)) {
				childrenByParent.set(parentName, [])
			}
			childrenByParent.get(parentName)!.push(childName)
		}

		// find root for this sample
		let root: string = childName
		let curr: any = s
		while (curr?.ancestor_name) {
			root = curr.ancestor_name
			curr = samplesData[root]
		}
		rootFor.set(childName, root)
	}

	// Sort every children list once
	for (const list of childrenByParent.values()) {
		list.sort((a, b) => {
			const na = Number(a)
			const nb = Number(b)
			return !isNaN(na) && !isNaN(nb) ? na - nb : a.localeCompare(b)
		})
	}
	return { childrenByParent, rootFor }
}
