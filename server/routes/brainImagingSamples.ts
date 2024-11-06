import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type {
	BrainSample,
	CategoricalTW,
	BrainImagingSamplesRequest,
	BrainImagingSamplesResponse,
	RouteApi
} from '#types'
import { spawn } from 'child_process'

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

//function called on mds3 init when validate the query, it defines the get method used by the route
export async function validate_query_NIdata(ds, genome) {
	const q = ds.queries.NIdata
	if (!q || !serverconfig.features?.showBrainImaging) return
	for (const key in q) {
		if (q[key].referenceFile && q[key].samples) {
			q[key].get = async (sampleName, l, f, t) => {
				const refFile = path.join(serverconfig.tpmasterdir, q[key].referenceFile)
				const sampleFile = path.join(serverconfig.tpmasterdir, q[key].samples, sampleName)

				try {
					await fs.promises.stat(sampleFile)
				} catch (e: any) {
					if (e.code == 'EACCES') throw 'cannot read file, permission denied'
					if (e.code == 'ENOENT') throw 'no data for this sample'
					throw 'failed to load data'
				}

				return new Promise((resolve, reject) => {
					const ps = spawn(serverconfig.python, [
						`${serverconfig.binpath}/utils/plotBrainImaging.py`,
						refFile,
						sampleFile,
						l,
						f,
						t
					])
					const imgData: any[] = []
					ps.stdout.on('data', data => {
						imgData.push(data)
					})
					ps.stderr.on('data', data => {
						console.error(`stderr: ${data}`)
						reject(new Error(`Python script filed: ${data}`))
					})
					ps.on('close', code => {
						if (code === 0) {
							const imageBuffer = Buffer.concat(imgData)
							const base64Data = imageBuffer.toString('base64')
							const imgUrl = `data:image/png;base64,${base64Data}`
							resolve(imgUrl)
						} else {
							reject(new Error(`Python script exited with code ${code}`))
						}
					})
				})
			}
		} else {
			throw 'no reference or sample files'
		}
	}
}
