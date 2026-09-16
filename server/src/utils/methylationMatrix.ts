import { resolveElementQuery } from '../../routes/termdb.diffMeth.ts'
import { DMR_SCAN_ELEMENT_TYPE } from '#types'
import { buildGroupValues } from '#src/utils/sampleGroups.ts'
import serverconfig from '#src/serverconfig.js'

/* Which methylation matrix a region (DMR) request runs on, and which samples are eligible for it.
Shared by the single-region and batch routes so the two cannot drift: if they disagreed about the
matrix or the sample set, the same contrast would give different answers depending on whether the
user clicked one hit or drilled the whole list, and nothing would surface the difference. */

export type ResolvedMatrix = {
	/** absolute path to the h5 the analysis reads */
	matrixFile: string
	/** the matrix stores M-values rather than betas */
	mvalues: boolean
	/** resolved to an element matrix rather than a CpG one */
	useElement: boolean
	/** sample names eligible for the contrast, with the dataset's exclusions already applied */
	eligible: Set<string>
}

/* Three backings, finest first:

  .cpgByChr   per-chromosome CpG matrices, the resolution region calling actually wants
  .file       one genome-wide CpG matrix
  elements    the element matrix behind the element type the volcano was showing, where one row
              is a cCRE rather than a CpG

The element fallback is what makes the drill-down reachable at all from a hit of ANY cCRE class on
a cohort with no CpG matrix, but it is a fallback: cCREs are median 316bp/4 CpGs against DMRs of
median 737bp/12 CpGs, so element averaging cannot resolve sub-element structure.

The element path is deliberately NOT restricted to that element type's element_class the way the
volcano is: the classes are sparse genome-wide (PLS promoters run ~1 per Mb), so a class-restricted
window would hold two or three elements -- nothing to smooth or segment. Every element in the
matrix is tested instead, which does mean the per-element FDRs come from a larger universe than the
volcano's class-restricted DM and will not match it.

The choice is per CHROMOSOME, not per dataset: a cohort part-way through building its shards
serves CpG resolution where a shard exists and elements everywhere else, rather than failing on the
chromosomes it has not built yet. */
/* The element matrix entry a request implies, or undefined when the dataset has none.

An explicit element_type that names nothing is a caller bug and resolveElementQuery says so
precisely. Its ABSENCE is not: the DMR chart can be launched straight from the group menu with only
a region, and the scan pseudo-class names no matrix at all. So fall back to the dataset's own
default class when one resolves -- not to 'promoter', which a dataset may not declare or may not
mean -- and to nothing when none does. The entry is wanted for its eligible-sample set, and is only
load-bearing when the element matrix is also the analysis matrix. */
function resolveElementEntry(ds: any, elementType: string | undefined): any {
	const dm = ds.queries?.dnaMethylation
	const et = elementType == DMR_SCAN_ELEMENT_TYPE ? undefined : elementType
	if (et) return resolveElementQuery(ds, et).q
	const hasElements = !!(dm.promoter || Object.keys(dm.elements ?? {}).length)
	if (!hasElements) return undefined
	const dEl = dm.defaultElementType
	if (dEl && dEl != DMR_SCAN_ELEMENT_TYPE) {
		try {
			return resolveElementQuery(ds, dEl).q
		} catch {
			// a stale default is no worse than none: fall through to the configured order
		}
	}
	/* No usable default: the order mds3.init.js resolveElementEntryForTerms uses, so a region request
	and a term query nominate the same matrix -- first configured non-promoter entry, then promoter.
	Resolving 'promoter' alone rejected every dataset that declares only other classes, while
	termdb.config advertised element-level region analysis for it. */
	const nonPromoter = Object.entries<any>(dm.elements ?? {}).find(([k, e]) => k != 'promoter' && e?.file)
	if (nonPromoter) return nonPromoter[1]
	return dm.elements?.promoter?.file ? dm.elements.promoter : dm.promoter?.file ? dm.promoter : undefined
}

/* Which samples can take part in a methylation contrast, for the whole analysis rather than for one
chromosome.

Every caller that only needs the sample set used to resolve a MATRIX for an arbitrary chromosome
(majorchrorder[0], or 'chr1') to get at this, which made the answer depend on whether that one
chromosome happened to have a shard -- so the expression follow-ups could be handed a different
cohort than the scan they claim to match. It also made a CpG-only dataset throw: the pre-analysis
sample count resolved 'promoter' on a dataset that declares no element matrix at all.

The element entry's set is preferred where there is one, because it already has the dataset's
excludeSampleNamesMatching applied -- a specimen type the volcano withheld must not reappear here.
It is then cut to the samples a CpG matrix actually holds when the dataset has one, since that is
what a region analysis on this dataset reads. */
export function eligibleMethylationSamples(ds: any, elementType: string | undefined): Set<string> {
	const dm = ds.queries?.dnaMethylation
	if (!dm) throw new Error('This dataset does not support DNA methylation region analysis.')
	const elementEntry = resolveElementEntry(ds, elementType)
	const eligible: Set<string> | undefined = elementEntry?.allSampleSet || dm.regionSampleSet
	if (!eligible) throw new Error('This dataset does not support DNA methylation region analysis.')
	const cpgBacked = !!(dm.cpgChroms?.size || dm.file)
	if (cpgBacked && elementEntry?.allSampleSet && dm.regionSampleSet)
		return new Set([...eligible].filter(n => dm.regionSampleSet.has(n)))
	return eligible
}

export function resolveMethylationMatrix(ds: any, chr: string, elementType: string | undefined): ResolvedMatrix {
	const dm = ds.queries?.dnaMethylation
	if (!dm) throw new Error('This dataset does not support DNA methylation region analysis.')
	const elementEntry = resolveElementEntry(ds, elementType)

	let matrixFile: string
	let mvalues = false
	let useElement = false
	if (dm.cpgChroms?.has(chr)) {
		matrixFile = dm.cpgByChr.replace('{chr}', chr)
	} else if (dm.file) {
		matrixFile = dm.file
	} else if (elementEntry) {
		matrixFile = elementEntry.file
		/* M-values unless the entry says beta: the term getter's contract (mds3.init.js storesBeta).
		Testing for "m-value" instead read a missing or differently worded unit as beta, and the
		binary would logit-transform an M-value matrix a second time. */
		mvalues = !/beta/i.test(elementEntry.unit || '')
		useElement = true
	} else {
		throw new Error('This dataset does not support DNA methylation region analysis.')
	}

	/* One definition of who is eligible, shared with every caller that needs it without a
	chromosome in hand. An element-matrix fit reads that matrix's own samples; anything CpG-backed
	is intersected, which is what eligibleMethylationSamples does. */
	const eligible = useElement ? elementEntry.allSampleSet : eligibleMethylationSamples(ds, elementType)
	return { matrixFile, mvalues, useElement, eligible }
}

/* Which of these chromosomes a genome-wide analysis may fan out over, on a dataset whose CpG matrix
is sharded per chromosome.

The per-chromosome fallback to the element matrix exists for the single-region view, where dropping
to element resolution on one chromosome is a visible, local trade. A genome-wide run is different:
falling back silently mixes CpG and element resolution across chromosomes of ONE result, and where
the fit cannot read the element matrix it fails deep in rust with an h5 error naming no cause. So a
missing shard is refused up front here, naming the chromosomes.

In debugmode the missing ones are skipped instead, so local dev holding one shard (say chr4) runs on
what it has. A dataset with a genome-wide CpG matrix, or none at all, is not shard-backed and is
returned unchanged. */
export function requireCpgShards(ds: any, chromosomes: string[], route: string): string[] {
	const dm = ds.queries?.dnaMethylation
	// .file is a genome-wide CpG matrix: every chromosome is in it, so nothing can be missing
	if (!dm?.cpgByChr || dm.file) return chromosomes
	const missing = chromosomes.filter(c => !dm.cpgChroms?.has(c))
	if (!missing.length) return chromosomes
	if (!serverconfig.debugmode)
		throw new Error(
			`No CpG matrix for ${missing.join(',')}. A genome-wide analysis needs one shard per chromosome ` +
				`(queries.dnaMethylation.cpgByChr); build the missing ones, or analyse a chromosome that has one.`
		)
	const kept = chromosomes.filter(c => dm.cpgChroms?.has(c))
	console.log(`${route} (debugmode): skipped chromosomes with no CpG h5 file: ${missing.join(',')}`)
	if (!kept.length) throw new Error(`No CpG h5 file for the requested chromosome(s): ${chromosomes.join(',')}`)
	return kept
}

/* A caller-supplied chromosome list, bounded by the genome's own chromosome set and deduplicated,
returned in the genome's order.

Every route taking one of these fans out to one rust invocation per entry, each holding a
chromosome's matrix and saturating a core, and none of them caps the list: a request naming one
chromosome five thousand times was five thousand full fits, and because a cache key built from the
raw list is unique per multiset it was five thousand fits every time it was sent. Deduplicating
before anything is built from the list is what makes the cost proportional to the genome rather
than to the request.

Names are canonicalised through chrlookup and returned in the caller's order, first occurrence
winning; a caller wanting a stable cache key sorts the result. */
export function validateChromosomes(genome: any, chromosomes: string[] | undefined, allOnAbsent = false): string[] {
	/* The genome's chromosomes, most authoritative first. majorchrorder carries them in order;
	majorchr is the same set unordered; chrlookup is a last resort that also holds aliases, so it
	bounds the length without being a list to return. */
	const all: string[] = (genome.majorchrorder as string[]) || Object.keys(genome.majorchr || {})
	const known: string[] = all.length ? all : Object.keys(genome.chrlookup || {})
	if (!chromosomes?.length) {
		if (!allOnAbsent) return []
		if (!all.length) throw new Error('This genome declares no chromosomes.')
		return [...all]
	}
	if (chromosomes.length > known.length)
		throw new Error(`Too many chromosomes (${chromosomes.length}); the genome has ${known.length}.`)
	const seen = new Set<string>()
	const out: string[] = []
	for (const c of chromosomes) {
		const info = genome.chrlookup?.[String(c).toUpperCase()]
		if (!info) throw new Error(`Unknown chromosome '${c}' for genome ${genome.name || ''}.`.replace(' .', '.'))
		if (seen.has(info.name)) continue
		seen.add(info.name)
		out.push(info.name)
	}
	return out
}

/* The client sends group membership the way every two-group analysis does -- as termdb sample ids
-- while the matrices are keyed by sample NAME, so the ids are resolved through the same resolver
differential methylation uses. Reading a `sample` field off the request instead silently produced
empty groups for every caller whose group values carry ids alone, which is most of them. */
/* The two groups cut down to the samples that have methylation data, as termdb sample ids.

For any expression step that follows a methylation contrast -- the gene-body expression test, the
DE volcano launched from it -- the comparison is only clean if it is made on the SAME patients.
Otherwise the methylation side is the 365 with WGBS and the expression side the 918 with RNA, and a
difference between the two readings could be the extra 553 patients rather than anything about
methylation. Resolved through the same path the methylation analyses use, then mapped back to ids,
so ancestry mapping and the dataset's specimen exclusions apply identically. */
export async function matchedSamplelst(
	samplelst: { groups: { name: string; values: any[]; [k: string]: any }[] },
	eligible: Set<string>,
	ds: any
): Promise<{ groups: { name: string; values: { sampleId: number | string }[]; [k: string]: any }[] }> {
	const groups: { name: string; values: { sampleId: number | string }[] }[] = []
	for (const g of samplelst.groups) {
		const { names } = await buildGroupValues(g.values, eligible, ds, undefined, undefined, undefined, undefined)
		/* Everything but the values is kept as it came, `in: true` included: the volcano treats a
		group without `in` as the "all other samples" group and rebuilds its membership. */
		groups.push({ ...g, values: names.map(n => ({ sampleId: ds.cohort?.termdb?.q?.sampleName2id?.(n) ?? n })) })
	}
	return { groups }
}

export async function resolveGroupNames(
	group1: any[],
	group2: any[],
	eligible: Set<string>,
	ds: any
): Promise<{ group1: string[]; group2: string[] }> {
	const [g1, g2] = await Promise.all([
		buildGroupValues(group1, eligible, ds, undefined, undefined, undefined, undefined),
		buildGroupValues(group2, eligible, ds, undefined, undefined, undefined, undefined)
	])
	return { group1: g1.names, group2: g2.names }
}
