import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { BrainSample, BrainImagingSamplesRequest, BrainImagingSamplesResponse, RouteApi } from '#types'
import { getData } from '#src/termdb.matrix.js'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'brainImagingSamples',
	methods: {
		get: {
			init,
			request: {
				typeId: 'BrainImagingSamplesRequest'
			},
			response: {
				typeId: 'BrainImagingSamplesResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query: BrainImagingSamplesRequest = req.query

			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'

			const samples = await getBrainImageSamples(query, genomes)
			res.send({ samples } satisfies BrainImagingSamplesResponse)
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample brain image not found')
		}
	}
}

async function getBrainImageSamples(query: BrainImagingSamplesRequest, genomes: any): Promise<BrainSample[]> {
	const ds = genomes[query.genome].datasets[query.dslabel]
	const q = ds.queries.NIdata
	const key = query.refKey
	if (q[key].referenceFile && q[key].samples) {
		const dirPath = path.join(serverconfig.tpmasterdir, q[key].samples)
		const files = fs
			.readdirSync(dirPath)
			.filter(file => file.endsWith('.nii') && fs.statSync(path.join(dirPath, file)).isFile())
		//const filePaths = files.map(file => path.join(dirPath, file))

		const sampleNames = files.map(name => name.split('.nii')[0])
		if (q[key].sampleColumns) {
			// Build term wrappers for getData
			const terms = q[key].sampleColumns.map(term => ({
				$id: term.termid,
				term: { id: term.termid },
				q: {}
			}))
			
			// Get data for all terms at once
			const data = await getData({ terms }, ds)
			if (data.error) throw data.error
			
			const samples = {}
			for (const s of sampleNames) {
				const annoForOneS = { sample: s }
				const sid = ds.cohort.termdb.q.sampleName2id(s)
				
				// Extract values from getData result
				const sampleData = data.samples?.[sid]
				if (sampleData) {
					for (const term of q[key].sampleColumns) {
						const value = sampleData[term.termid]
						if (value !== undefined) {
							annoForOneS[term.termid] = value.value
						}
					}
				}
				samples[s] = annoForOneS
			}
			return Object.values(samples)
		}
		return sampleNames.map(name => ({ sample: name }))
	} else {
		throw 'no reference or sample files'
	}
}
