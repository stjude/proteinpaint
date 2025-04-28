import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'

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
				// req.query.geneset_name contains the geneset name which is defined only when a request for plotting the details of a particular geneset_name is made. During the initial computation this is not defined as this will be selected by the user from the client side. When this is not defined, it will send the table output. The python code saves the table in serverconfig.cachedir_gsea in a pickle file (gsea_result_{random_number}.pkl) which will later be retrieved by a subsequent server request asking to plot the details of that geneset.
				if (typeof results != 'object') throw 'gsea result is not object'
				res.send(results satisfies GenesetEnrichmentResponse)
				return
			}
			// req.query.geneset_name is present, this will cause the geneset image to be generated. The python code will retrieve gsea_result_{random_number}.pkl from serverconfig.cachedir_gsea to generate the image (gsea_plot_{random_num}.png). This prevents having to rerun the entire gsea computation again.
			if (typeof results != 'string') throw 'gsea result is not string'
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
	if (!genomes[q.genome].termdbs) throw 'termdb database is not available for ' + q.genome

	const genesetenrichment_input = {
		genes: q.genes,
		fold_change: q.fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name, // For now msigdb has been added, but later databases other than msigdb may be used
		geneset_group: q.geneSetGroup,
		cachedir: serverconfig.cachedir_gsea,
		geneset_name: q.geneset_name,
		pickle_file: q.pickle_file,
		num_permutations: q.num_permutations,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: q.filter_non_coding_genes
	}

	//console.log('genesetenrichment_input:', genesetenrichment_input)
	//console.log('__dirname:',__dirname)
	//fs.writeFile('test.txt', '/' + JSON.stringify(genesetenrichment_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})
	const gsea_output: any = await run_python('gsea.py', '/' + JSON.stringify(genesetenrichment_input))

	// script output is line-based, each line can be 1) gsea result for genesets 2) an gsea plot image for a geneset 3) status logs that's very helpful to log out, thus process as below

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
	if (image_found) return path.join(serverconfig.cachedir_gsea, result.image_file)
	throw 'data or image not found in gsea output; this should not happen'
}
