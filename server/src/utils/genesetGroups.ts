/*
Validates the request's geneSetGroup and num_permutations for the /genesetEnrichment and
/genesetOverrepresentation routes, which pass them to the gsea.py, cerno, and genesetORA tools.
*/

/** blitzgsea's own gene set libraries, which are not in the msigdb db, see python/src/gsea.py */
export const BLITZGSEA_GENESET_GROUPS = Object.freeze([
	'REACTOME--blitzgsea',
	'KEGG--blitzgsea',
	'WikiPathways--blitzgsea'
])

/** matches the max of the client's "Number of Permutations" input, see client/plots/gsea/view/GSEAControls.ts */
export const MAX_PERMUTATIONS = 40000

/**
 * The genome's gene set db for a request's MSigDB release: termdbs.msigdb when no release is given,
 * otherwise the termdb whose .release it is. An unknown release is refused rather than run on another one.
 */
export function msigdbTermdb(genome: any, release?: any) {
	if (release === undefined || release === null || release === '') {
		if (!genome?.termdbs?.msigdb) throw new Error('gene set db is not available for this genome')
		return genome.termdbs.msigdb
	}
	if (typeof release != 'string') throw new Error('msigdbRelease must be a string')
	const termdb = Object.values(genome?.termdbs || {}).find((t: any) => t.release === release)
	if (!termdb) throw new Error('unknown msigdbRelease')
	return termdb as any
}

/**
 * geneSetGroup must be one of the termdb's analysisGenesetGroups[].value, which are the options that
 * the client shows, or a blitzgsea library when allowBlitzgsea is true
 */
export function validGeneSetGroup(termdb: any, geneSetGroup: any, allowBlitzgsea = false) {
	if (typeof geneSetGroup != 'string' || !geneSetGroup) throw new Error('geneSetGroup must be a non-empty string')
	if (allowBlitzgsea && BLITZGSEA_GENESET_GROUPS.includes(geneSetGroup)) return geneSetGroup
	const groups = termdb?.analysisGenesetGroups
	if (!Array.isArray(groups) || !groups.some(g => g.value === geneSetGroup)) throw new Error('invalid geneSetGroup')
	return geneSetGroup
}

export function validNumPermutations(value: any) {
	// a GET request has a string value
	const n = typeof value == 'string' && value ? Number(value) : value
	if (!Number.isInteger(n) || n < 0 || n > MAX_PERMUTATIONS)
		throw new Error(`num_permutations must be an integer from 0 to ${MAX_PERMUTATIONS}`)
	return n as number
}
