import { resolveElementQuery } from '../../routes/termdb.diffMeth.ts'
import { buildGroupValues } from '#src/utils/sampleGroups.ts'

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
export function resolveMethylationMatrix(ds: any, chr: string, elementType: string | undefined): ResolvedMatrix {
	const dm = ds.queries?.dnaMethylation
	if (!dm) throw new Error('This dataset does not support DNA methylation region analysis.')

	/* An explicit element_type that names nothing is a caller bug and resolveElementQuery says so
	precisely. Its ABSENCE is not: the DMR chart can be launched straight from the group menu with
	only a region, never having been through the volcano. So fall back to the dataset's default
	class when one resolves, and to no entry at all when none does -- the entry is wanted for its
	eligible-sample set, and is only load-bearing when the element matrix is also the analysis
	matrix, which the branch below requires. */
	const hasElements = !!(dm.promoter || Object.keys(dm.elements ?? {}).length)
	let elementEntry: any
	if (elementType) {
		elementEntry = resolveElementQuery(ds, elementType).q
	} else if (hasElements) {
		try {
			elementEntry = resolveElementQuery(ds, undefined).q
		} catch {
			elementEntry = undefined // dataset declares classes but no default 'promoter' one
		}
	}

	let matrixFile: string
	let mvalues = false
	let useElement = false
	if (dm.cpgChroms?.has(chr)) {
		matrixFile = dm.cpgByChr.replace('{chr}', chr)
	} else if (dm.file) {
		matrixFile = dm.file
	} else if (elementEntry) {
		matrixFile = elementEntry.file
		// element matrices may hold either scale; the ds config entry declares which
		mvalues = /m-?value/i.test(elementEntry.unit || '')
		useElement = true
	} else {
		throw new Error('This dataset does not support DNA methylation region analysis.')
	}

	/* The eligible set is the element entry's when the dataset has one, because that set already
	has the dataset's excludeSampleNamesMatching applied: a specimen type the volcano withheld must
	not reappear here, or the region view would contrast a different set of samples than the hit
	being drilled into. */
	const eligible: Set<string> = elementEntry?.allSampleSet || dm.regionSampleSet
	return { matrixFile, mvalues, useElement, eligible }
}

/* The client sends group membership the way every two-group analysis does -- as termdb sample ids
-- while the matrices are keyed by sample NAME, so the ids are resolved through the same resolver
differential methylation uses. Reading a `sample` field off the request instead silently produced
empty groups for every caller whose group values carry ids alone, which is most of them. */
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
