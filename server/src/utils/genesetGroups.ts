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
 * geneSetGroup must be one of the genome's termdbs.msigdb.analysisGenesetGroups[].value, which are
 * the options that the client shows, or a blitzgsea library when allowBlitzgsea is true
 */
export function validGeneSetGroup(genome: any, geneSetGroup: any, allowBlitzgsea = false) {
	if (typeof geneSetGroup != 'string' || !geneSetGroup) throw new Error('geneSetGroup must be a non-empty string')
	if (allowBlitzgsea && BLITZGSEA_GENESET_GROUPS.includes(geneSetGroup)) return geneSetGroup
	const groups = genome?.termdbs?.msigdb?.analysisGenesetGroups
	if (!Array.isArray(groups) || !groups.some(g => g.value === geneSetGroup)) throw new Error('invalid geneSetGroup')
	return geneSetGroup
}

/**
 * A request may name the MSigDB release of its gene sets, which the client reads from termdbs.msigdb.release.
 * The server has only the current release, so another one (from a page loaded before an update) is refused
 * rather than run on gene sets it did not name.
 */
export function validMsigdbRelease(genome: any, release: any) {
	if (release === undefined) return
	const current = genome?.termdbs?.msigdb?.release
	if (release !== current) throw new Error(`the gene sets are now MSigDB ${current}, please reload the page`)
}

export function validNumPermutations(value: any) {
	// a GET request has a string value
	const n = typeof value == 'string' && value ? Number(value) : value
	if (!Number.isInteger(n) || n < 0 || n > MAX_PERMUTATIONS)
		throw new Error(`num_permutations must be an integer from 0 to ${MAX_PERMUTATIONS}`)
	return n as number
}
