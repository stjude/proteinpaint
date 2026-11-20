import { canRunRust } from '@sjcrh/proteinpaint-rust'

// whether this server process can run python; not a function of the python package, since an image may replace that
// package with one that only rejects its calls
const canRunPython = process.permission ? process.permission.has('child') : true

/* the geneset db analyses, by the name in termdbConfig.unavailable[], and whether this server can run each one.
A client hides an analysis that is listed, such as one whose tool is not in a server build. Only the run of the tool is
checked, not its other dependencies, such as the python packages of a script. */
export const genesetAnalyses = {
	/** GSEA blitzgsea method, run by gsea.py */
	blitzgsea: () => canRunPython,
	/** GSEA cerno method */
	cerno: () => canRunRust('cerno'),
	/** gene set over-representation analysis */
	ora: () => canRunRust('genesetORA')
}

export type GenesetAnalysis = keyof typeof genesetAnalyses

/** the geneset db analyses that this server cannot run */
export function getUnavailableAnalyses(analyses = genesetAnalyses): GenesetAnalysis[] {
	return (Object.keys(analyses) as GenesetAnalysis[]).filter(name => !analyses[name]())
}

let unavailable: GenesetAnalysis[] | undefined

/** computed once, on the first call, since what the server can run does not change while it runs */
export function getUnavailableAnalysesOnce(): GenesetAnalysis[] {
	if (!unavailable) unavailable = getUnavailableAnalyses()
	return unavailable
}
