import { canRunPython } from '@sjcrh/proteinpaint-python'
import { canRunRust } from '@sjcrh/proteinpaint-rust'

/* the geneset db analyses, by the name in termdbConfig.unavailable[], and whether this server can run each one.
A client hides an analysis that is listed, such as in an image that does not allow a child process and lacks its wasm
module. Only the run of the tool is checked, not its other dependencies, such as the python packages of a script. */
export const genesetAnalyses = {
	/** GSEA blitzgsea method, run by gsea.py */
	blitzgsea: () => canRunPython(),
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

/** computed once, on the first call, since the permission model and the wasm modules do not change while the server
runs; not when this module is imported, which is before app.ts sets the python binpath */
export function getUnavailableAnalysesOnce(): GenesetAnalysis[] {
	if (!unavailable) unavailable = getUnavailableAnalyses()
	return unavailable
}
