import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { BrainSample, CategoricalTW, GetBrainImagingSamplesRequest, GetBrainImagingSamplesResponse } from '#types'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: any = {
	endpoint: 'brainImagingSamples',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GetBrainImagingSamplesRequest'
			},
			response: {
				typeId: 'GetBrainImagingSamplesResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query = req.query as GetBrainImagingSamplesRequest

			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'

			const samples = await getBrainImageSamples(query, genomes)
			console.log(samples)
			res.send({ samples })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample brain image not found')
		}
	}
}

async function getBrainImageSamples(query: GetBrainImagingSamplesRequest, genomes: any): Promise<BrainSample[]> {
	const ds = genomes[query.genome].datasets[query.dslabel]
	const q = ds.queries.NIdata
	const key = query.refKey
	if (q[key].referenceFile && q[key].samples) {
		const refFile = path.join(serverconfig.tpmasterdir, q[key].referenceFile)
		const dirPath = path.join(serverconfig.tpmasterdir, q[key].samples)
		const files = fs
			.readdirSync(dirPath)
			.filter(file => file.endsWith('.nii') && fs.statSync(path.join(dirPath, file)).isFile())
		//const filePaths = files.map(file => path.join(dirPath, file))

		const sampleNames = files.map(name => name.split('.nii')[0])
		if (q[key].sampleColumns) {
			const samples = {}
			for (const s of sampleNames) {
				const annoForOneS = { sample: s }
				const sid = ds.cohort.termdb.q.sampleName2id(s)
				for (const term of q[key].sampleColumns) {
					const v = ds.cohort.termdb.q.getSample2value(term.termid, sid)
					if (v[0]) {
						annoForOneS[term.termid] = v[0].value
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
