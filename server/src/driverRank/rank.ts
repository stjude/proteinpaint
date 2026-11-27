import {
	dtsnvindel,
	dtcnv,
	dtfusionrna,
	dtsv,
	dtitd,
	mclasscnvloss,
	mclasscnvgain,
	mclasscnvAmp,
	mclasscnvHomozygousDel,
	isGermlineOrigin,
	getVafCounts
} from '#shared'
import type { DriverTag, DriverRankInfo } from '#types'
import type { DriverKb, EnhancerRule, Region, SvRule } from './kb.ts'
import type { KbRow, KbKind, KbChange } from './kbFormat.ts'

/*
Tags the driver events of a sample by the rules of a driver knowledge base (kb.ts). An event goes to the matcher
of its dt, which returns the rules that it matches; the best of them (lowest tier, then the most specific kind of
rule, then the earliest source of index.json) makes the tag. An event of another dt, or that matches no rule,
gets no tag.

	rankEvents()          the tag of each event, for any caller (the singleSampleMutation route, GRIN2)
	rankMutationResult()  tags and sorts the events of a singleSampleMutation response

A sample's tags depend only on its events, the kb and the dataset, so a sample has the same driver events in
every view.
*/

export type RankContext = {
	/** how the dataset quantifies cnv values, ds.queries.cnv.type; the valueType of an event takes precedence */
	cnvType: string
	/** the number of snvindel events of the sample, when the events hold only some of them (dt2total) */
	snvindelTotal?: number
}

export type RankResult = {
	tags: (DriverTag | null)[]
	hypermutated?: { snvindelCount: number; threshold: number }
}

/** a rule that an event matches, with the tier for this event, which may be below the rule tier */
type Match = { rule: KbRow; tier: 1 | 2; genes: string[] }

type Matcher = (m: any, kb: DriverKb, ctx: RankContext) => Match[]

/** the matcher of each dt; an event of another dt is not ranked */
const matchers: { [dt: number]: Matcher } = {
	[dtsnvindel]: matchSnvindel,
	[dtfusionrna]: matchFusion,
	[dtsv]: matchSv,
	[dtitd]: matchItd,
	[dtcnv]: matchCnv
}

/** most specific first: a hotspot match outranks a gene-level match of the same tier */
const KIND_ORDER: KbKind[] = [
	'snv',
	'fs',
	'inframe',
	'exon',
	'itd',
	'fusion',
	'sv',
	'amp',
	'enhancer',
	'deepDel',
	'del',
	'gene'
]

/** the snvindel classes that change the protein; the others, e.g. silent and intronic, are not ranked */
const PROTEIN_CLASSES = new Set(['M', 'N', 'F', 'D', 'I', 'P', 'L', 'ProteinAltering', 'StartLost', 'StopLost'])

/** the snvindel classes of each kind of change of an exon or gene rule; null for any protein change */
const CHANGE_CLASSES: { [change in KbChange]: Set<string> | null } = {
	any: null,
	missense: new Set(['M']),
	trunc: new Set(['N', 'F', 'L']),
	fs: new Set(['F']),
	inframe: new Set(['D', 'I', 'ProteinAltering']),
	del: new Set(['D']),
	ins: new Set(['I']),
	dup: new Set(['I']),
	splice: new Set(['L', 'P']),
	// of enhancer rules only, which no snvindel matches
	gain: new Set()
}

/** bp around the exons of an exon rule of splicing, e.g. MET exon 14 skipping, for the variants of the splice sites */
const SPLICE_PAD = 50

/** returns the tag of each event of mlst, null for an event that is not a driver */
export function rankEvents(mlst: any[], kb: DriverKb, ctx: RankContext): RankResult {
	const snvindelCount = ctx.snvindelTotal ?? mlst.reduce((n, m) => (m?.dt == dtsnvindel ? n + 1 : n), 0)
	const threshold = kb.match.hypermutated.minSnvindel
	const hypermutated = snvindelCount > threshold
	const sourceOrder = new Map(kb.sources.map((s, i) => [s.id, i]))
	const tags = mlst.map(m => {
		const matcher = m && typeof m == 'object' ? matchers[m.dt] : undefined
		if (!matcher) return null
		let matches = matcher(m, kb, ctx)
		// in a hypermutated sample, passenger mutations often hit the genes of tier 2 rules
		if (hypermutated && m.dt == dtsnvindel) matches = matches.filter(x => x.tier == 1)
		return matches.length ? toTag(matches, sourceOrder) : null
	})
	return hypermutated ? { tags, hypermutated: { snvindelCount, threshold } } : { tags }
}

/** returns a singleSampleMutation response with .driver on the driver events, which are first in mlst[], and with
.driverRank; with driversOnly, mlst[] has only the driver events. The result of the getter is not changed, as a
getter may return an object that it caches: a tagged event is a copy */
export function rankMutationResult(result: any, kb: DriverKb, ctx: RankContext, driversOnly: boolean): any {
	const snvindelTotal = result.dt2total?.find((d: any) => d.dt == dtsnvindel)?.total
	const { tags, hypermutated } = rankEvents(result.mlst, kb, { ...ctx, snvindelTotal })
	const ranked = orderByDriver(result.mlst, tags)
	const out = { ...result, mlst: driversOnly ? ranked.filter(m => m.driver) : ranked }
	const shown = [out.mlst]
	if (driversOnly) {
		delete out.alternativeDataByDt
	} else if (result.alternativeDataByDt) {
		// the alternative data of a dt, e.g. another cnv file of a gdc case, is tagged as is, without sorting
		out.alternativeDataByDt = {}
		for (const [dt, sets] of Object.entries<any>(result.alternativeDataByDt)) {
			out.alternativeDataByDt[dt] = sets.map((set: any) => {
				if (!Array.isArray(set?.mlst)) return set
				const setTags = rankEvents(set.mlst, kb, ctx).tags
				const mlst = set.mlst.map((m: any, i: number) => (setTags[i] ? { ...m, driver: setTags[i] } : m))
				shown.push(mlst)
				return { ...set, mlst }
			})
		}
	}
	const used = new Set(shown.flat().flatMap((m: any) => m.driver?.sources || []))
	const info: DriverRankInfo = { kbVersion: kb.version, sources: kb.sources.filter(s => used.has(s.id)) }
	if (hypermutated) info.hypermutated = hypermutated
	out.driverRank = info
	return out
}

/** the amino acid change of an snvindel, from its mname, e.g. R175H, W288Cfs*12, E746_A750del, X119_splice */
export type AaChange = { ref: string; pos: number; end: number; kind: 'sub' | 'splice' | 'fs' | 'inframe'; alt: string }

export function parseAaChange(mname: unknown, mclass: string): AaChange | null {
	if (typeof mname != 'string') return null
	const s = mname.startsWith('p.') ? mname.slice(2) : mname
	let m: RegExpExecArray | null
	if (mclass == 'F' || s.includes('fs')) {
		m = /^([A-Z*])(\d+)/.exec(s)
		return m ? { ref: m[1], pos: +m[2], end: +m[2], kind: 'fs', alt: '' } : null
	}
	if ((m = /^([A-Z*])(\d+)_splice$/.exec(s))) return { ref: m[1], pos: +m[2], end: +m[2], kind: 'splice', alt: 'sp' }
	if ((m = /^([A-Z])(\d+)(?:_([A-Z])(\d+))?(?:delins|del|ins|dup)/.exec(s))) {
		return { ref: m[1], pos: +m[2], end: m[4] ? +m[4] : +m[2], kind: 'inframe', alt: '' }
	}
	if ((m = /^([A-Z*])(\d+)([A-Z*])$/.exec(s))) {
		// an older name writes a stop as X
		const alt = m[3] == 'X' && mclass == 'N' ? '*' : m[3]
		return { ref: m[1], pos: +m[2], end: +m[2], kind: 'sub', alt }
	}
	return null
}

/** the class of an snvindel; a splice event of some datasets has class false */
function normalizeClass(mclass: unknown, mname: unknown): string {
	if (typeof mclass == 'string' && mclass) return mclass
	return typeof mname == 'string' && mname.endsWith('_splice') ? 'L' : ''
}

function matchSnvindel(m: any, kb: DriverKb): Match[] {
	const gene = kbGene(m.gene, kb)
	if (!gene) return []
	const mclass = normalizeClass(m.class, m.mname)
	if (!PROTEIN_CLASSES.has(mclass)) return []
	const rules: KbRow[] = []
	const aa = parseAaChange(m.mname, mclass)
	if (aa?.kind == 'sub' || aa?.kind == 'splice') {
		// the reference amino acid guards against an event on an isoform that numbers residues differently
		for (const r of kb.snv.get(gene)?.get(aa.pos) || []) {
			if (r.ref == aa.ref && (!r.alts.length || r.alts.includes(aa.alt))) rules.push(r)
		}
	} else if (aa?.kind == 'fs') {
		for (const r of kb.fs.get(gene) || []) {
			const inRange = aa.pos >= r.start! && aa.pos <= (r.end ?? r.start!)
			if (inRange && (!r.ref || aa.pos != r.start || r.ref == aa.ref)) rules.push(r)
		}
	} else if (aa?.kind == 'inframe') {
		for (const r of kb.inframe.get(gene) || []) {
			if (aa.pos <= (r.end ?? r.start!) && aa.end >= r.start!) rules.push(r)
		}
	}
	if (Number.isFinite(m.pos)) {
		for (const r of kb.exon.get(gene) || []) {
			if ((m.chr && m.chr != r.chr) || !changeMatches(r.change, mclass)) continue
			const pad = r.change == 'splice' ? SPLICE_PAD : 1
			if (r.intervals.some(([s, e]) => m.pos >= s - pad && m.pos <= e + pad)) rules.push(r)
		}
	}
	for (const r of kb.gene.get(gene) || []) {
		if (changeMatches(r.change, mclass)) rules.push(r)
	}
	return rules.map(rule => ({ rule, tier: rule.tier, genes: [gene] }))
}

/** a fusion event names its genes; geneA is the 5' gene when kb.match.fusion.geneAIs5prime */
function matchFusion(m: any, kb: DriverKb): Match[] {
	const as = eventGenes(m.geneA, kb)
	const bs = eventGenes(m.geneB, kb)
	const out = matchFusionRules(as, bs, kb, kb.match.fusion.geneAIs5prime)
	for (const r of kb.sv) {
		if (svRuleMatchesNames(r, as, bs, kb)) out.push({ rule: r, tier: r.tier, genes: ruleGenes(r) })
	}
	return out
}

/** an sv event has the coordinates of its breakpoints, and may name the genes there; its orientation is unknown */
function matchSv(m: any, kb: DriverKb): Match[] {
	const hasA = typeof m.chrA == 'string' && Number.isFinite(m.posA)
	const hasB = typeof m.chrB == 'string' && Number.isFinite(m.posB)
	const as = m.geneA ? eventGenes(m.geneA, kb) : hasA ? genesAt(kb.fusionGenesByChr, m.chrA, m.posA) : []
	const bs = m.geneB ? eventGenes(m.geneB, kb) : hasB ? genesAt(kb.fusionGenesByChr, m.chrB, m.posB) : []
	const out = matchFusionRules(as, bs, kb, false)
	const named = !!(m.geneA || m.geneB)
	for (const r of kb.sv) {
		// the window is around a gene; a locus, e.g. IGH, is the span of its genes, which a window would widen to
		// other genes, e.g. BCR 260 kb from IGL
		const atGene = (chr: string, pos: number) => near(r.geneRegions, chr, pos, kb.loci.has(r.gene) ? 0 : r.window)
		const atPartner = (chr: string, pos: number) =>
			r.partner == '*' || near(r.partnerRegions, chr, pos, kb.loci.has(r.partner) ? 0 : r.window)
		const byCoord =
			hasA &&
			hasB &&
			((atGene(m.chrA, m.posA) && atPartner(m.chrB, m.posB)) || (atGene(m.chrB, m.posB) && atPartner(m.chrA, m.posA)))
		if (byCoord || (named && svRuleMatchesNames(r, as, bs, kb)))
			out.push({ rule: r, tier: r.tier, genes: ruleGenes(r) })
	}
	const dup = tandemDuplication(m, kb)
	if (dup) out.push(...matchEnhancers(m.chrA, dup[0], dup[1], kb))
	return out
}

/** the duplicated segment of an sv of svtype DUP, which may duplicate an enhancer; null for another sv, as the
breakpoints of a deletion, an inversion and a duplication look alike without the svtype */
function tandemDuplication(m: any, kb: DriverKb): [number, number] | null {
	if (typeof m.svtype != 'string' || m.svtype.toUpperCase() != 'DUP') return null
	if (m.chrA != m.chrB || !Number.isFinite(m.posA) || !Number.isFinite(m.posB)) return null
	const start = Math.min(m.posA, m.posB)
	const stop = Math.max(m.posA, m.posB)
	return stop - start <= kb.match.cnv.focalMaxLength ? [start, stop] : null
}

/** the enhancer rules whose locus a gained segment overlaps; the segment need not reach the gene */
function matchEnhancers(chr: string, start: number, stop: number, kb: DriverKb): Match[] {
	return (kb.enhancerByChr.get(chr) || [])
		.filter((r: EnhancerRule) => start <= r.region.stop && stop >= r.region.start)
		.map(rule => ({ rule, tier: rule.tier, genes: [rule.gene] }))
}

/** an itd event has the coordinates of the duplicated segment, and names no gene */
function matchItd(m: any, kb: DriverKb): Match[] {
	if (typeof m.chr != 'string' || !Number.isFinite(m.start)) return []
	const stop = Number.isFinite(m.stop) ? m.stop : m.start
	return (kb.itdByChr.get(m.chr) || [])
		.filter(r => r.intervals.some(([s, e]) => m.start <= e && stop >= s))
		.map(rule => ({ rule, tier: rule.tier, genes: [rule.gene] }))
}

/** a cnv event is a segment; a rule matches a focal segment of its call over its gene, which an amplification must
contain whole; an enhancer rule matches a focal gain or amplification over its locus */
function matchCnv(m: any, kb: DriverKb, ctx: RankContext): Match[] {
	if (typeof m.chr != 'string' || !Number.isFinite(m.start) || !Number.isFinite(m.stop)) return []
	if (m.stop - m.start > kb.match.cnv.focalMaxLength) return []
	const call = cnvCall(m, kb, ctx)
	if (!call) return []
	const out: Match[] = []
	for (const r of kb.cnvByChr.get(m.chr) || []) {
		const overlaps = m.start <= r.loc.stop && m.stop >= r.loc.start
		const ok =
			r.kind == 'amp'
				? call == 'amp' && m.start <= r.loc.start && m.stop >= r.loc.stop
				: r.kind == 'deepDel'
				? call == 'deepDel' && overlaps
				: (call == 'del' || call == 'deepDel') && overlaps
		if (ok) out.push({ rule: r, tier: r.tier, genes: [r.gene] })
	}
	if (call == 'amp' || call == 'gain') out.push(...matchEnhancers(m.chr, m.start, m.stop, kb))
	return out
}

export type CnvCall = 'amp' | 'gain' | 'del' | 'deepDel'

/** the call of a cnv event by the thresholds of its value type (gain only where the type has a gain threshold),
or by the class of a qualitative event */
export function cnvCall(m: any, kb: DriverKb, ctx: RankContext): CnvCall | null {
	const type = m.valueType || ctx.cnvType
	if (type == 'category' || !Number.isFinite(m.value)) {
		if (m.class == mclasscnvAmp) return 'amp'
		if (m.class == mclasscnvgain) return 'gain'
		if (m.class == mclasscnvHomozygousDel) return 'deepDel'
		if (m.class == mclasscnvloss) return 'del'
		return null
	}
	const c = kb.match.cnv.calls[type]
	if (!c) return null
	if (m.value >= c.amp) return 'amp'
	if (c.gain !== undefined && m.value >= c.gain) return 'gain'
	if (m.value <= c.deepDel) return 'deepDel'
	if (m.value <= c.del) return 'del'
	return null
}

/** the fusion rules of a pair of gene lists, as and bs; an event out of the orientation of a wildcard rule, or of
unknown orientation, gets no higher than kb.match.sv.wildcardTier */
function matchFusionRules(as: string[], bs: string[], kb: DriverKb, oriented: boolean): Match[] {
	const out: Match[] = []
	const wildcard = (r: KbRow, inOrder: boolean): 1 | 2 =>
		inOrder && oriented ? r.tier : (Math.max(r.tier, kb.match.sv.wildcardTier) as 1 | 2)
	for (const a of as) {
		for (const b of bs) {
			for (const r of kb.fusionPair.get(`${a}::${b}`) || []) out.push({ rule: r, tier: r.tier, genes: [a, b] })
			// the reciprocal fusion of a known pair comes from the same rearrangement
			for (const r of kb.fusionPair.get(`${b}::${a}`) || []) out.push({ rule: r, tier: r.tier, genes: [b, a] })
		}
	}
	for (const [genes, is5, others] of [
		[as, true, bs],
		[bs, false, as]
	] as [string[], boolean, string[]][]) {
		for (const g of genes) {
			// both ends in the gene: a rearrangement within it, e.g. a deletion, not a fusion with another gene
			if (others.includes(g)) continue
			for (const r of kb.fusion5.get(g) || []) out.push({ rule: r, tier: wildcard(r, is5), genes: [g] })
			for (const r of kb.fusion3.get(g) || []) out.push({ rule: r, tier: wildcard(r, !is5), genes: [g] })
		}
	}
	return out
}

function svRuleMatchesNames(r: SvRule, as: string[], bs: string[], kb: DriverKb): boolean {
	const isGene = (n: string) => nameIs(r.gene, n, kb)
	if (r.partner == '*') return as.some(isGene) || bs.some(isGene)
	const isPartner = (n: string) => nameIs(r.partner, n, kb)
	return (as.some(isGene) && bs.some(isPartner)) || (bs.some(isGene) && as.some(isPartner))
}

/** whether an event gene name is the gene of a rule, or a gene of its locus, e.g. IGHM of IGH */
function nameIs(ruleName: string, name: string, kb: DriverKb): boolean {
	return name == ruleName || isOfLocus(name, ruleName, kb)
}

/** whether an event gene name is of a locus: a gene of the gene db that is a member of the locus, on its chr, so
not IGHEP2 of chr9 for IGH; or a name that the gene db lacks and that fits the pattern of the locus, e.g. IGH@ */
function isOfLocus(name: string, locusName: string, kb: DriverKb): boolean {
	if (name == locusName) return true
	const locus = kb.loci.get(locusName)
	if (!locus) return false
	return kb.isGeneName(name) ? locus.members.has(name.toUpperCase()) : locus.pattern.test(name)
}

/** the gene names of an event, e.g. geneA of a fusion, as kb gene names where an alias maps to one, and as the
locus where a name fits one, e.g. IGH of IGHM or IGH@, so that it matches the fusion rules of the locus; without
the strand of the gene that some datasets add to the gene name of an sv breakpoint, e.g. ETV6(+) */
function eventGenes(v: unknown, kb: DriverKb): string[] {
	if (typeof v != 'string' || !v) return []
	return v
		.split(',')
		.map(s => s.replace(/\([+-]\)$/, '').trim())
		.filter(Boolean)
		.map(s => kbGene(s, kb) || locusOf(s, kb) || s)
}

/** the locus of index.json that an event gene name is, or is a gene of, or null */
function locusOf(name: string, kb: DriverKb): string | null {
	for (const locus of kb.loci.keys()) {
		if (isOfLocus(name, locus, kb)) return locus
	}
	return null
}

/** the kb gene name of an event gene, or null when no rule names the gene */
function kbGene(name: unknown, kb: DriverKb): string | null {
	if (typeof name != 'string' || !name) return null
	if (kb.genes.has(name)) return name
	// a gene of its own, e.g. FLG of filaggrin, is not the gene that it is an old alias of, FGFR1
	if (kb.isGeneName(name)) return null
	const official = kb.aliasToName(name)
	return official && kb.genes.has(official) ? official : null
}

function changeMatches(change: KbChange | '', mclass: string): boolean {
	const classes = CHANGE_CLASSES[change as KbChange]
	return classes === null ? true : !!classes?.has(mclass)
}

function genesAt(byChr: Map<string, Region[]>, chr: string, pos: number): string[] {
	return (byChr.get(chr) || []).filter(r => pos >= r.start && pos <= r.stop).map(r => r.name)
}

function near(regions: Region[], chr: string, pos: number, window: number): boolean {
	return regions.some(r => r.chr == chr && pos >= r.start - window && pos <= r.stop + window)
}

function ruleGenes(r: KbRow): string[] {
	return [r.gene, r.partner].filter(g => g && g != '*')
}

function toTag(matches: Match[], sourceOrder: Map<string, number>): DriverTag {
	matches.sort(
		(a, b) =>
			a.tier - b.tier ||
			KIND_ORDER.indexOf(a.rule.kind) - KIND_ORDER.indexOf(b.rule.kind) ||
			(sourceOrder.get(a.rule.source) ?? 99) - (sourceOrder.get(b.rule.source) ?? 99)
	)
	const best = matches[0]
	const tag: DriverTag = {
		tier: best.tier,
		reason: best.rule.kind,
		genes: unique(matches.filter(x => x.tier == best.tier).flatMap(x => x.genes)),
		ruleIds: unique(matches.map(x => x.rule.id)),
		sources: unique(matches.map(x => x.rule.source))
	}
	if (best.rule.kind == 'enhancer') tag.locus = best.rule.partner
	return tag
}

/** returns the events with the tagged ones first, as copies with .driver: by tier, somatic before germline, then by
the highest VAF; the others keep their order */
function orderByDriver(mlst: any[], tags: (DriverTag | null)[]): any[] {
	const keyed = mlst.map((m0, i) => {
		const tag = tags[i]
		const m = tag ? { ...m0, driver: tag } : m0
		return { m, i, tag, germline: tag && isGermline(m) ? 1 : 0, vaf: tag ? maxVaf(m) : -1 }
	})
	keyed.sort((a, b) => {
		const ta = a.tag?.tier ?? 9
		const tb = b.tag?.tier ?? 9
		return ta - tb || a.germline - b.germline || b.vaf - a.vaf || a.i - b.i
	})
	return keyed.map(k => k.m)
}

function isGermline(m: any): boolean {
	return isGermlineOrigin(m.origin ?? m.vorigin)
}

function maxVaf(m: any): number {
	let max = -1
	for (const v of Array.isArray(m.vafs) ? m.vafs : []) {
		const c = getVafCounts(v)
		if (c) max = Math.max(max, c.altCount / c.totalCount)
	}
	return max
}

function unique(list: string[]): string[] {
	return [...new Set(list)]
}
