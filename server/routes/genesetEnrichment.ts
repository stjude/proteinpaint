import type { GenesetEnrichmentRequest, GenesetEnrichmentResponse, RouteApi } from '#types'
import { genesetEnrichmentPayload } from '#types/checkers'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import serverconfig from '#src/serverconfig.js'

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
				// req.query.geneset_name contains the geneset name which is defined only when a request for plotting the details of a particular geneset_name is made. During the initial computation this is not defined as this will be selected by the user from the client side. When this is not defined, it will send the table output. The python code saves the table in serverconfig.cachedir in a pickle file (gsea_result_{random_number}.pkl) which will later be retrieved by a subsequent server request asking to plot the details of that geneset.
				if (typeof results != 'string') res.send(results satisfies GenesetEnrichmentResponse)
				else throw `invalid results type when !req.query.geneset_name`
			} else if (typeof results == 'string') {
				// req.query.geneset_name is present, this will cause the geneset image to be generated. The python code will retrieve gsea_result_{random_number}.pkl from serverconfig.cachedir to generate the image (gsea_plot_{random_num}.png). This prevents having to rerun the entire gsea computation again.
				res.sendFile(results, (err: any) => {
					fs.unlink(results, del_err => {
						if (del_err) {
							console.error('Error deleting file ' + results + ':', del_err)
						}
						//else {
						//	console.log('File ' + results + ' deleted successfully')
						//}
					})
					if (err) {
						res.status(404).send('Image not found')
					}
				})
			}
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
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
		cachedir: serverconfig.cachedir,
		geneset_name: q.geneset_name,
		pickle_file: q.pickle_file,
		genedb: path.join(serverconfig.tpmasterdir, genomes[q.genome].genedb.dbfile),
		filter_non_coding_genes: q.filter_non_coding_genes
	}

	//console.log('genesetenrichment_input:', genesetenrichment_input)
	//console.log('__dirname:',__dirname)
	//fs.writeFile('test.txt', '/' + JSON.stringify(genesetenrichment_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const gsea_output: any = await run_gsea(
		`${serverconfig.binpath}/utils/gsea.py`,
		'/' + JSON.stringify(genesetenrichment_input) // "/" is needed for python to accept the bracket "{" as a bracket
	)

	let result
	let data_found = false
	let image_found = false
	//
	for (const line of gsea_output.split('\n')) {
		// Parsing table output
		if (line.startsWith('result: ')) {
			result = JSON.parse(line.replace('result: ', ''))
			data_found = true
			// should break here ???
		} else if (line.startsWith('image: ')) {
			// Getting image to be sent to client
			result = JSON.parse(line.replace('image: ', ''))
			image_found = true
			// should break here ???
		} else {
			console.log(line)
		}
	}

	//
	if (data_found) {
		return result as GenesetEnrichmentResponse
	} else if (image_found) {
		const imagePath: string = path.join(serverconfig.cachedir, result.image_file)
		return imagePath
	} else {
		throw ``
	}
}

async function run_gsea(path, data) {
	try {
		await fs.promises.stat(path)
	} catch (_) {
		throw `${path} does not exist`
	}
	return new Promise((resolve, reject) => {
		const _stdout: any[] = []
		const _stderr: any[] = []
		// spawn python process
		const sp = spawn(serverconfig.python, [path])
		//console.log("data:",data)
		if (data) {
			// stream input data into python
			try {
				const input = data.endsWith('\n') ? data : data + '\n' // python expects a final end-of-line marker
				Readable.from(input).pipe(sp.stdin)
			} catch (e) {
				sp.kill()
				let errmsg = e
				const stderr = _stderr.join('').trim()
				if (stderr) errmsg += `\npython stderr: ${stderr}`
				reject(errmsg)
			}
		}
		// store stdout and stderr from python
		sp.stdout.on('data', data => _stdout.push(data))
		sp.stderr.on('data', data => _stderr.push(data))
		sp.on('error', err => reject(err))
		// return stdout and stderr when python process closes
		sp.on('close', code => {
			const stdout = _stdout.join('').trim()
			const stderr = _stderr.join('').trim()
			if (code !== 0) {
				// handle non-zero exit status
				let errmsg = `python process exited with non-zero status code=${code}`
				if (stdout) errmsg += `\npython stdout: ${stdout}`
				if (stderr) errmsg += `\npython stderr: ${stderr}`
				reject(errmsg)
			}
			if (stderr) {
				// handle python stderr
				const errmsg = `python process emitted standard error\npython stderr: ${stderr}`
				reject(errmsg)
			}
			// return standard out from python
			resolve(stdout)
		})
	})
}
