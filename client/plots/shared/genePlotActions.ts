import { sayerror } from '#dom'
import { get$id } from '#termsetting'

/**
 * Dispatches a plot_create action that opens a Lollipop / genome-browser view
 * for a single gene. Used from gene-results tables (manhattan, grin2, volcano)
 * when the user picks one gene to drill into.
 */
export function createLollipopFromGene(geneSymbol: string, app: any) {
	const cfg: any = {
		type: 'plot_create',
		config: {
			chartType: 'genomeBrowser',
			snvindel: { shown: true }, // always set snvindel.shown=true so the mds3 tk is always shown; since grin2 works for this ds, it doesn't matter whether snvindel/cnv/svfusion any is present; all will be shown in mds3 tk
			geneSearchResult: { geneSymbol }
		}
	}
	if (app.vocabApi.termdbConfig.queries.trackLst?.activeTracks) {
		cfg.config.trackLst = structuredClone(app.vocabApi.termdbConfig.queries.trackLst)
		cfg.config.trackLst.activeTracks = [] // clear all active tracks as they are not related to grin2 analysis
		// cannot do cfg.config.trackLst={activeTracks:[]}; breaks
	}
	app.dispatch(cfg)
}

/**
 * Dispatches a plot_create action that opens a Matrix view for a set of genes.
 * Capped at 100 genes — the table caller is expected to have already filtered
 * to the user's selection.
 */
export async function createMatrixFromGenes(geneSymbols: string[], app: any): Promise<void> {
	// TODO: Improve this by maybe adding sayInfo that has a little div that shows a message letting the user know the matrix is being created with only the first N genes if they selected too many
	const MAX_GENES = 100
	const genesToUse = geneSymbols.slice(0, MAX_GENES)

	try {
		const termwrappers = await Promise.all(
			genesToUse.map(async (gene: string) => {
				const term = {
					type: 'geneVariant',
					gene: gene,
					name: gene
				}
				const minTwCopy = app.vocabApi.getTwMinCopy({ term, q: {} })
				return {
					$id: await get$id(minTwCopy),
					term,
					q: {}
				}
			})
		)

		app.dispatch({
			type: 'plot_create',
			config: {
				chartType: 'matrix',
				dataType: 'geneVariant',
				termgroups: [
					{
						name: 'Genomic Alterations',
						lst: termwrappers
					}
				]
			}
		})
	} catch (error) {
		sayerror(app.dom.div, `Error creating matrix: ${error instanceof Error ? error.message : error}`)
	}
}
