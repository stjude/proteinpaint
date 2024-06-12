import { genesetEnrichmentRequest, genesetEnrichmentResponse } from '#shared/types/routes/genesetEnrichment.ts'
import fs from 'fs'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import path from 'path'
import serverconfig from '../src/serverconfig'

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
			console.log('req.query:', req.query)
			const results = await run_genesetEnrichment_analysis(req.query as genesetEnrichmentRequest, genomes)
			res.send(results as genesetEnrichmentResponse)
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
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
		gene_set_group: q.geneSetGroup
	}
	console.log('serverconfig.binpath:', serverconfig.binpath)
	console.log('genesetenrichment_input:', JSON.stringify(genesetenrichment_input))
	const gsea_output: unknown = run_gsea(
		path.join(serverconfig.binpath, 'python/src', 'gsea.py'),
		JSON.stringify(genesetenrichment_input)
	)
	return gsea_output as genesetEnrichmentResponse
}

async function run_gsea(path, data) {
	try {
		await fs.promises.stat(path)
	} catch (e) {
		throw `${path} does not exist`
	}
	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn python process
		const sp = spawn(serverconfig.py_path, path)
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
		//sp.stdout.on('data', data => _stdout.push(data))
		//sp.stderr.on('data', data => _stderr.push(data))
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
				// handle R stderr
				const errmsg = `python process emitted standard error\npython stderr: ${stderr}`
				reject(errmsg)
			}
			// return standard out from python
			resolve(stdout)
		})
	})
}
