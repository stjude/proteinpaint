//import fs from 'fs'
import {
	genesetOverrepresentationRequest,
	genesetOverrepresentationResponse
} from '../shared/types/routes/genesetOverrepresentation.ts'
import { run_rust } from '@sjcrh/proteinpaint-rust'

export const api = {
	endpoint: 'genesetOverrepresentation',
	methods: {
		all: {
			init,
			request: {
				typeId: 'genesetOverrepresentationRequest'
			},
			response: {
				typeId: 'genesetOverrepresentationResponse'
				// will combine this with type checker
				//valid: (t) => {}
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			//console.log("req.query:",req.query)
			const results = await run_genesetOverrepresentation_analysis(
				req.query as genesetOverrepresentationRequest,
				genomes
			)
			res.send(results)
		} catch (e: any) {
			res.send({ status: 'error', error: e.message || e })
		}
	}
}

async function run_genesetOverrepresentation_analysis(q: genesetOverrepresentationRequest, genomes: any) {
	//console.log('genomes:', genomes[q.genome].termdbs.msigdb.cohort.db.connection.name)
	//console.log('q:', q.genome)
	if (!genomes[q.genome].termdbs) throw 'termdb database is not available for ' + q.genome
	const gene_overrepresentation_input = {
		sample_genes: q.sample_genes,
		background_genes: q.background_genes,
		db: genomes[q.genome].termdbs.msigdb.cohort.db.connection.name,
		gene_set_group: q.geneSetGroup
	}

	//fs.writeFile('test.txt', JSON.stringify(gene_overrepresentation_input), function (err) {
	//	// For catching input to rust pipeline, in case of an error
	//	if (err) return console.log(err)
	//})

	const time1 = new Date().valueOf()
	const rust_output = await run_rust('genesetORA', JSON.stringify(gene_overrepresentation_input))
	const time2 = new Date().valueOf()
	console.log('Time taken to run rust gene over representation pipeline:', time2 - time1, 'ms')
	let result
	for (const line of rust_output.split('\n')) {
		if (line.startsWith('pathway_p_values:')) {
			result = JSON.parse(line.replace('pathway_p_values:', ''))
		} else {
			//console.log(line)
		}
	}
	//console.log('result:', result)
	return result as genesetOverrepresentationResponse
}
