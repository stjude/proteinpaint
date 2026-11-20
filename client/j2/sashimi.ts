import { dofetch3 } from '#common/dofetch'
import { getParameter } from './tk'

/* The junction track as a sashimi plot of two sample groups: each junction an arc between its ends, the first group
above the line and the second below. Shown in place of the junction lollipops when tk.sashimi.groupTw holds two groups
(from the genome browser's config.junction, by default the groups of its methylation track).

An arc's width is the junction's USAGE in the group: its share of the reads at the busier of its two splice sites, from
the reads pooled over the group's samples (the lower of its PSI5 and PSI3, see setUsage). Usage, not presence: a gene expressed far more in one group has every junction
in nearly all of that group's samples, so the share of samples with reads saturates, while usage still shows which
first exon, exon or splice site the group prefers. The share of samples with reads is kept for the filter (minShare)
and the tooltip. One termdb/junctions request per group, each filtered to that group alone. */

const ABOVE = 70,
	BELOW = 70,
	PAD = 16

export type SashimiConfig = {
	/** a samplelst term wrapper with two groups, as the methylation track's groupTw */
	groupTw: any
	/** junctions seen in a smaller share of both groups are left out; default 0.1 */
	minShare?: number
}

type Arc = {
	start: number
	stop: number
	strand: string
	/** per group: share of its samples with reads of the junction, those samples, the reads, and the usage */
	shares: number[]
	counts: number[]
	reads: number[]
	usage: number[]
	/** no other junction at either of its splice sites: its usage is 1 by construction, so it is drawn thin and not
	 * labeled */
	alone?: boolean
}

/** A filter to one group: a samplelst term holding only that group's list (a term listing every group would match the
 * samples of all of them, see the server's get_samplelst). Joined with the track's own sample filter, if any. */
export function groupFilter(groupTw: any, name: string, trackFilter?: any) {
	const values = groupTw.term.values
	const tvs = {
		type: 'tvs',
		tvs: { term: { name, type: 'samplelst', values: { [name]: values[name] } }, values: [{ key: name }] }
	}
	const lst: any[] = [tvs]
	if (trackFilter?.lst?.length) lst.push(trackFilter)
	return { type: 'tvslst', in: true, join: lst.length > 1 ? 'and' : '', lst }
}

/** Junctions of the groups, keyed by coordinates, with each group's share of samples and usage (see the top); those
 * under minShare in every group dropped. Usage is computed over every junction, before the drop. */
export function mergeGroups(results: { junctions: any[]; sampleTotal?: number }[], minShare: number): Arc[] {
	const arcs = new Map<string, Arc>()
	results.forEach((r, gi) => {
		const total = r.sampleTotal || 0
		for (const j of r.junctions || []) {
			const k = `${j.start}-${j.stop}-${j.strand}`
			let a = arcs.get(k)
			if (!a) {
				a = {
					start: j.start,
					stop: j.stop,
					strand: j.strand,
					shares: results.map(() => 0),
					counts: results.map(() => 0),
					reads: results.map(() => 0),
					usage: results.map(() => 0)
				}
				arcs.set(k, a)
			}
			a.counts[gi] = j.sampleCount || 0
			a.shares[gi] = total ? (j.sampleCount || 0) / total : 0
			a.reads[gi] = j.totalReadCount || 0
		}
	})
	const all = [...arcs.values()]
	setUsage(all, results.length)
	return all.filter(a => a.shares.some(s => s >= minShare))
}

/** Each junction's usage per group: its reads over the reads at the busier of its two splice sites (the junctions that
 * start or end where it does, on its strand), i.e. the lower of its PSI5 and PSI3. A constitutive junction is near 1; an
 * alternative first exon into a shared acceptor, or a skip from a shared donor, is its share at that site. Per site, not
 * over clusters joined through shared sites as LeafCutter's are: in a gene of many transcripts those chain into one
 * cluster of all its junctions, and every usage shrinks to a share of the gene. A junction that shares neither site is
 * alone: 1 by construction. */
export function setUsage(arcs: Arc[], groups: number) {
	const site = new Map<string, { n: number; reads: number[] }>()
	const at = (k: string) => site.get(k) || site.set(k, { n: 0, reads: Array(groups).fill(0) }).get(k)!
	const ends = (a: Arc) => [`${a.strand}:${a.start}`, `${a.strand}:${a.stop}`]
	for (const a of arcs)
		for (const k of ends(a)) {
			const s = at(k)
			s.n++
			a.reads.forEach((r, gi) => (s.reads[gi] += r))
		}
	for (const a of arcs) {
		const [s1, s2] = ends(a).map(k => site.get(k)!)
		a.alone = s1.n == 1 && s2.n == 1
		a.usage = a.reads.map((r, gi) => {
			const busier = Math.max(s1.reads[gi], s2.reads[gi])
			return busier ? r / busier : 0
		})
	}
}

export async function renderSashimi(tk: any, block: any) {
	const groupTw = tk.sashimi.groupTw
	const groups: string[] = Object.keys(groupTw.term.values).slice(0, 2)
	if (groups.length < 2) throw new Error('a sashimi plot needs two sample groups')
	const results = await Promise.all(
		groups.map(async name => {
			const [body, headers] = getParameter(tk, block)
			delete body.matrixTop
			/* every sample with a read of a junction counts toward its share: the lollipops' read count cutoff (5 by
			default) would drop a junction that is rare per sample but present in most samples */
			delete body.readcountCutoff
			body.filterObj = groupFilter(groupTw, name, tk.filterObj)
			const data = await dofetch3('termdb/junctions', { body, headers })
			if (data.error) throw new Error(data.error)
			return data
		})
	)
	const arcs = mergeGroups(results, tk.sashimi.minShare ?? 0.1)

	const g = tk.rows.jug.g
	g.selectAll('*').remove()
	tk.rows.jug.axis?.selectAll('*').remove()
	g.attr('transform', 'translate(0,0)')
	const base = PAD + ABOVE
	const xOf = (pos: number) => {
		// the main view only: a hit in rglst within the block's width
		const hit = block.seekcoord(block.rglst[block.startidx].chr, pos).find(h => h.ridx != undefined)
		return hit && hit.x >= 0 && hit.x <= block.width ? hit.x : undefined
	}
	g.append('line').attr('x1', 0).attr('x2', block.width).attr('y1', base).attr('y2', base).attr('stroke', '#bbb')
	const colors = groups.map(n => groupTw.term.values[n].color || '#555')
	// the arcs whose usage differs most between the groups, by 10 points or more, are labeled with both usages
	const labeled = new Set(
		arcs
			// wide enough on screen to carry a label
			.filter(
				a =>
					!a.alone &&
					Math.abs(a.usage[0] - a.usage[1]) >= 0.1 &&
					Math.abs((xOf(a.stop) ?? 0) - (xOf(a.start) ?? 0)) > 30
			)
			.sort((a, b) => Math.abs(b.usage[0] - b.usage[1]) - Math.abs(a.usage[0] - a.usage[1]))
			.slice(0, 4)
	)
	let drawn = 0
	for (const a of arcs) {
		let x0 = xOf(a.start),
			x1 = xOf(a.stop)
		if (x0 == undefined && x1 == undefined) continue
		// an end out of view is drawn to the edge
		x0 ??= a.start < a.stop ? 0 : block.width
		x1 ??= a.start < a.stop ? block.width : 0
		drawn++
		const len = Math.abs(x1 - x0)
		groups.forEach((name, gi) => {
			const usage = a.usage[gi]
			if (!usage) return
			const up = gi == 0 ? -1 : 1
			// taller for longer junctions, and never taller than a third of the span, so that a short junction is a low arch, not a loop
			const h = Math.min((gi == 0 ? ABOVE : BELOW) * (0.15 + 0.8 * Math.sqrt(len / block.width)), 3 + len / 3)
			const cy = base + up * h * 1.33
			g.append('path')
				.attr('d', `M${x0},${base} C${x0},${cy} ${x1},${cy} ${x1},${base}`)
				.attr('fill', 'none')
				.attr('stroke', colors[gi])
				.attr('stroke-opacity', 0.75)
				.attr('stroke-width', a.alone ? 0.75 : 0.5 + 6 * usage)
				.append('title')
				.text(
					`${a.start.toLocaleString()}-${a.stop.toLocaleString()} (${a.strand}), usage (share of the reads at its ` +
						'splice sites) and samples with reads: ' +
						groups
							.map((n, i) => `${n} ${Math.round(a.usage[i] * 100)}% (${a.counts[i]}/${results[i].sampleTotal} samples)`)
							.join(', ')
				)
			if (labeled.has(a))
				g.append('text')
					.attr('x', (x0! + x1!) / 2)
					.attr('y', base + up * (h + 4))
					.attr('dominant-baseline', up < 0 ? 'auto' : 'hanging')
					.attr('text-anchor', 'middle')
					.attr('font-size', 11)
					.attr('fill', colors[gi])
					.attr('stroke', 'white')
					.attr('stroke-width', 3)
					.attr('paint-order', 'stroke')
					.text(`${Math.round(usage * 100)}%`)
		})
	}
	// which group is where, at the left end
	groups.forEach((name, gi) =>
		g
			.append('text')
			.attr('x', 4)
			.attr('y', gi == 0 ? PAD - 4 : base + BELOW + 4)
			.attr('dominant-baseline', gi == 0 ? 'auto' : 'hanging')
			.attr('font-size', 11)
			.attr('fill', colors[gi])
			.text(
				`${name} (${results[gi].sampleTotal}) ${
					gi == 0 ? 'above' : 'below'
				}; width: usage, the share of the reads at its busier splice site`
			)
	)
	tk.rows.jug.height = base + BELOW + PAD + 14
	tk.leftlabels.doms.jug.text(
		`${drawn} junction${drawn == 1 ? '' : 's'} in ≥ ${Math.round((tk.sashimi.minShare ?? 0.1) * 100)}% of a group`
	)
	return drawn
}
