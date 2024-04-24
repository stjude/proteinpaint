import {
	genesetOverrepresentationRequest,
	genesetOverrepresentationResponse
} from '#shared/types/routes/genesetOverrepresentation.ts'
import { run_rust } from '@sjcrh/proteinpaint-rust'
import path from 'path'
import got from 'got'
import serverconfig from '#src/serverconfig.js'

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
			console.log('Hello')
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

async function run_genesetOverrepresentation_analysis(q: genesetOverrepresentationRequest, genomes: Any) {
	console.log('genomes:', genomes[q.genome].termdbs)
	console.log('q:', q.genome)
}
