import { genesetEnrichmentRequest, genesetEnrichmentResponse } from '../shared/types/routes/genesetEnrichment.ts'
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import serverconfig from '../src/serverconfig.js'

export const api = {
	endpoint: 'genesetEnrichment',
	methods: {
		all: {
			init,
			request: {
				typeId: 'genesetEnrichmentRequest'
			},
			response: {
				typeId: 'genesetEnrichmentResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const results = await run_genesetEnrichment_analysis(req.query as genesetEnrichmentRequest, genomes)
			if (!req.query.geneset_name) {
				res.send(results as genesetEnrichmentResponse)
			} else {
				res.sendFile(results, (err: any) => {
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

async function run_genesetEnrichment_analysis(q: genesetEnrichmentRequest, genomes: any) {
	if (!genomes[q.genome].termdbs) throw 'termdb database is not available for ' + q.genome

	const genesetenrichment_input = {
		genes: q.genes,
		fold_change: q.fold_change,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name, // For now msigdb has been added, but later databases other than msigdb may be used
		geneset_group: q.geneSetGroup,
		cachedir: serverconfig.cachedir,
		geneset_name: q.geneset_name
	}

	//console.log('__dirname:',__dirname)
	//console.log('genesetenrichment_input:', JSON.stringify(genesetenrichment_input))
	//
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
			console.log(line)
		}
	}

	if (data_found) {
		return result as genesetEnrichmentResponse
	} else if (image_found) {
		const imagePath = path.join(serverconfig.cachedir, result.image_file)
		return imagePath as genesetEnrichmentResponse // This is not correct type assignment, need to fix it later
	}
}

async function run_gsea(path, data) {
	try {
		await fs.promises.stat(path)
	} catch (e) {
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
