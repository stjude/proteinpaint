import type { DERequest, GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import { mayLog } from '#src/helpers.ts'
import { formatElapsedTime } from '#shared'
import { readCacheFileOrRecompute, readDaCache } from '#src/diffAnalysis.ts'
import { authApi } from '#src/auth.js'
import { get_ds_tdb } from '#src/termdb.js'

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

const cachedir_gsea = path.join(serverconfig.cachedir, 'gsea')

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
				// (gsea_result_{random_number}.pkl) which will later be retrieved by a subsequent
				// server request asking to plot the details of that geneset.
				if (typeof results != 'object') throw new Error('gsea result is not object')
				res.send(results satisfies GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated.
			// The python code will retrieve gsea_result_{random_number}.pkl from cachedir_gsea to
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

	let genes: string[]
	let fold_change: number[]
	if (q.cacheId) {
		// Cache-backed path. Apply the same auth-filter injection that the
		// volcano route's req.query.filter receives via the global auth
		// middleware (auth.js mayUpdate__protected__ → mayAdjustFilter).
		// That middleware only touches top-level req.query.filter;
		// daRequest.filter is nested and stays pre-mutation. Without this,
		// the client's snapshot hashes differently from what the volcano
		// wrote for any auth-gated dataset.
		if (q.daRequest && (q as any).__protected__) {
			try {
				;(q.daRequest as any).__protected__ = (q as any).__protected__
				const genome = genomes[q.daRequest.genome]
				if (genome && q.daRequest.dslabel && q.daRequest.dslabel !== 'msigdb') {
					const [ds] = get_ds_tdb(genome, q.daRequest as any)
					authApi.mayAdjustFilter(q.daRequest as any, ds)
				}
			} finally {
				delete (q.daRequest as any).__protected__
			}
		}

		if (q.daRequest) {
			// Unified helper handles read-or-recompute internally. Returns
			// the deterministic cacheId derived from daRequest.
			const result = await readCacheFileOrRecompute({ daRequest: q.daRequest as DERequest, genomes })
			// Tamper check: the client-supplied cacheId must match what the
			// server derived from daRequest. Anything else is either drift
			// or a crafted request.
			if (result.cacheId !== q.cacheId) throw new Error('cacheId does not match daRequest')
			genes = result.geneData.map(g => g.gene_name)
			fold_change = result.geneData.map(g => g.fold_change)
		} else {
			// Pre-change saved session (cacheId but no daRequest). Can only
			// try the client-supplied id; no way to regenerate on miss.
			const cached = await readDaCache(q.cacheId)
			if (!cached) throw new Error('daCacheMissing')
			genes = cached.map(g => g.gene_name)
			fold_change = cached.map(g => g.fold_change)
		}
	} else {
		// Inline path: no cache involvement. Callers must supply both arrays
		// (e.g. the GDC single-cell plot builds them from its own DE route).
		// Reject early so we don't pass undefined to Python/Rust downstream.
		if (!q.genes || !q.fold_change) throw new Error('requires genes and fold_change when cacheId is absent')
		genes = q.genes
		fold_change = q.fold_change
	}

	if (q.fetchDE) {
		// Client requested the ranked DE list only (used by the cerno detail plot).
		return { data: { genes, fold_change } } as unknown as GenesetEnrichmentResponse
	}

	const genesetenrichment_input: any = {
		genes,
		fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name, // For now msigdb has been added, but later databases other than msigdb may be used
		geneset_group: q.geneSetGroup,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: q.filter_non_coding_genes
	}

	let gsea_output: any
	if (q.method == 'blitzgsea') {
		genesetenrichment_input.cachedir = cachedir_gsea
		genesetenrichment_input.pickle_file = q.pickle_file
		genesetenrichment_input.geneset_name = q.geneset_name
		genesetenrichment_input.num_permutations = q.num_permutations
		const time1 = new Date().valueOf()
		gsea_output = await run_python('gsea.py', '/' + JSON.stringify(genesetenrichment_input))
		mayLog('Time taken to run blitzgsea:', formatElapsedTime(Date.now() - time1))
		let result
		let data_found = false
		let image_found = false
		//
		for (const line of gsea_output.split('\n')) {
			// Parsing table output
			if (line.startsWith('result: ')) {
				result = JSON.parse(line.replace('result: ', ''))
				data_found = true
			} else if (line.startsWith('image: ')) {
				// Getting image to be sent to client
				result = JSON.parse(line.replace('image: ', ''))
				image_found = true
			} else {
				// is a status line reporting time spent etc
				mayLog(line)
			}
		}

		if (data_found) return result as GenesetEnrichmentResponse
		const image_file_name: any = path.join(cachedir_gsea, result.image_file)
		if (image_found) return image_file_name as GenesetEnrichmentResponse
		throw new Error('data or image not found in gsea output; this should not happen')
	} else if (q.method == 'cerno') {
		const time1 = new Date().valueOf()
		gsea_output = JSON.parse(await run_rust('cerno', JSON.stringify(genesetenrichment_input)))
		mayLog('Time taken to run CERNO:', formatElapsedTime(Date.now() - time1))
		return gsea_output as GenesetEnrichmentResponse
	} else {
		throw new Error('Unknown method:' + q.method)
	}
	// script output is line-based, each line can be 1) gsea result for genesets 2) an gsea plot image for a geneset 3) status logs that's very helpful to log out, thus process as below
}
