// Result kind: a typed genomic region ("chr7:100000-200000"). Not a list: the server resolves at most one
// coordinate. Opens the genome browser in genomic view. No protein view: a bare region is not tied to a gene.
import type { OmnisearchResult } from '#types'
import { addActionButton } from '../buttons.ts'
import { inactive, type Coord, type HandlerCtx, type HandlerDeps, type HandlerPlan } from './types.ts'
import type { OmnisearchHandler, SearchInput } from './types.ts'

export type RegionRow = { name: string; coord: Coord }

export function formatCoord(coord: Coord): string {
	return `${coord.chr}:${coord.start.toLocaleString()}-${coord.stop.toLocaleString()}`
}

/** Genomic coordinate shape-filter + "chr" prefix toggling. Matches a typed "chr:start-stop" range
 * (e.g. "chr7:100000-200000" or, with the prefix omitted, "7:100000-200000") and returns the candidate
 * coordinate strings to try server-side: both the typed spelling and the "chr"-toggled one, since only the
 * server's genome object knows which chromosome name it uses. Returns null when the prompt is not a
 * coordinate range (a bare chr, a gene name, or partial typing). Chromosome existence and position validity
 * are left to the server's string2pos(); this is only a cheap shape/spelling step. */
export function parseCoordCandidates(prompt: string): string[] | null {
	const m = /^\s*(\w+)\s*:\s*([\d,]+)\s*-\s*([\d,]+)\s*$/.exec(prompt)
	if (!m) return null
	const [, chrToken, start, stop] = m
	const chrCandidates = /^chr/i.test(chrToken)
		? [chrToken, chrToken.replace(/^chr/i, '')] // "chr7" -> try "chr7", then "7"
		: [chrToken, 'chr' + chrToken] // "7" -> try "7", then "chr7"
	return chrCandidates.map(chr => `${chr}:${start}-${stop}`)
}

export class GenomicRegionHandler implements OmnisearchHandler<RegionRow> {
	readonly id = 'coord'
	readonly key = 'coord' as const
	readonly heading = 'Genomic region'
	readonly noun = 'genomic region'
	readonly label = 'Genomic regions'
	readonly hint = 'chr:start-stop'
	enabled = false

	/** A region needs the genome browser's genomic view: some genomic-alteration data, and not a dataset
	 * restricted to the protein view. */
	init({ termdbConfig }: HandlerCtx) {
		const q = termdbConfig?.queries || {}
		this.enabled = Boolean(q.snvindel || q.cnv || q.svfusion) && q.gbRestrictMode != 'protein'
	}

	/** No length gate: the regex decides. */
	plan({ prompt }: SearchInput): HandlerPlan {
		const coordCandidates = this.enabled ? parseCoordCandidates(prompt) : null
		return coordCandidates ? { active: true, request: { coordCandidates } } : inactive()
	}

	buildRows(data: OmnisearchResult): RegionRow[] {
		const coord = data.coord
		return coord ? [{ name: formatCoord(coord), coord }] : []
	}

	renderRow(tr: any, row: RegionRow, deps: HandlerDeps) {
		tr.append('td').text(row.name).style('padding', '5px 10px')
		addActionButton(tr.append('td'), deps, {
			label: 'Genome Browser',
			testid: 'sjpp-mass-chat-coord-genomebrowser',
			onClick: () => deps.launcher.launchGenomeBrowserView('genomic', { coord: row.coord })
		})
	}
}
