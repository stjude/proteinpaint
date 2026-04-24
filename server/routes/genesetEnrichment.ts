import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { computeGSEA, resolveGseaGenesAndFoldChange } from '#src/diffAnalysis.ts'

export const api: RouteApi = {
	endpoint: 'genesetEnrichment',
	methods: {
		get: {
			...genesetEnrichmentPayload,
			init
		},
		post: {
			...genesetEnrichmentPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const q: GenesetEnrichmentRequest = req.query
			// TODO: should separate the processing based on if q.geneset_name exists,
			// so that each of the separate function can have definite signature types
			// instead of trying to generalize the same function to do different things
			const results = await run_genesetEnrichment_analysis(q, genomes)
			if (!q.geneset_name) {
				// req.query.geneset_name contains the geneset name which is defined only
				// when a request for plotting the details of a particular geneset_name is made.
				// During the initial computation this is not defined as this will be selected
				// by the user from the client side. When this is not defined, it will send the
				// table output. The python code saves the table in cachedir_gsea in a pickle file
				// (gsea_<hash>.pkl) which will later be retrieved by a subsequent
				// server request asking to plot the details of that geneset.
				if (typeof results != 'object') throw new Error('gsea result is not object')
				res.send(results satisfies GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated.
			// The python code will retrieve gsea_<hash>.pkl from cachedir_gsea to
			// generate the image (gsea_plot_{random_num}.png). This prevents having to rerun the
			// entire gsea computation again.
			if (typeof results != 'string') throw new Error('gsea result is not string')
			res.sendFile(results, (err: any) => {
				fs.unlink(results, () => {})
				if (err) {
					res.status(404).send('Image not found')
				}
			})
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
			if (e.stack) console.log(e.stack)
		}
	}
}

async function run_genesetEnrichment_analysis(
	q: GenesetEnrichmentRequest,
	genomes: any
): Promise<GenesetEnrichmentResponse | string> {
	if (!genomes[q.genome].termdbs) throw new Error('termdb database is not available for ' + q.genome)

	if (q.fetchDE) {
		// Client requested the ranked DE list only (used by the cerno detail plot).
		const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
		return { data: { genes, fold_change } } as unknown as GenesetEnrichmentResponse
	}

	if (q.method == 'blitzgsea') {
		// computeGSEA owns the whole blitzgsea path: genes/fold_change
		// resolution, deterministic pickle filename, in-flight dedup, and
		// the run_python invocation.
		return await computeGSEA({ q, genomes })
	}

	if (q.method == 'cerno') {
		const { genes, fold_change } = await resolveGseaGenesAndFoldChange({ q, genomes })
		const genesetenrichment_input: any = {
			genes,
			fold_change,
			db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
			geneset_group: q.geneSetGroup,
			genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
			filter_non_coding_genes: q.filter_non_coding_genes
		}
		const time1 = new Date().valueOf()
		const gsea_output = JSON.parse(await run_rust('cerno', JSON.stringify(genesetenrichment_input)))
		mayLog('Time taken to run CERNO:', formatElapsedTime(Date.now() - time1))
		return gsea_output as GenesetEnrichmentResponse
	}

	throw new Error('Unknown method:' + q.method)
}
