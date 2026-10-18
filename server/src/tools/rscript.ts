import serverconfig from '../serverconfig.js'
import type { ToolSpec } from './index.ts'

/*
Spec of the Rscript operations that are not an R script of the R package, which run_R() runs.
See index.ts for how a spec is checked and used.
*/

export const specs: Record<string, ToolSpec> = {
	'Rscript.loadRData': {
		bin: () => serverconfig.Rscript,
		fields: {
			// a dataset file; a dev environment may keep it outside tp, see validate_cumburden()
			file: { type: 'file', roots: ['tp'], debugmodeAnyRoot: true }
		},
		// the file is a trailing argument that R reads with commandArgs(), so that it is never part of the R code
		argv: ['--vanilla', '-e', 'load(commandArgs(trailingOnly = TRUE)[1])', '$file']
	}
}
