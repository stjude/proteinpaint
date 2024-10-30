import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { GetBrainImagingRequest, GetBrainImagingResponse } from '#types'
import { spawn } from 'child_process'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: any = {
	endpoint: 'brainImaging',
	methods: {
		get: {
			init,
			request: {
				typeId: 'GetBrainImagingRequest'
			},
			response: {
				typeId: 'GetBrainImagingResponse'
			}
		}
	}
}

function init({ genomes }) {
	return async (req: any, res: any): Promise<void> => {
		try {
			const query = req.query as GetBrainImagingRequest

			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			console.log(query)
			const plane = query.l ? 'L' : query.f ? 'F' : query.t ? 'T' : ''

			const brainImage = await getBrainImage(query, genomes, plane)
			res.send({ brainImage, plane })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample brain image not found')
		}
	}
}

async function getBrainImage(query: GetBrainImagingRequest, genomes: any, plane) {
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

		if (query.samplesOnly) {
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
			return sampleNames
		}
		return new Promise((resolve, reject) => {
			const filePaths = query.selectedSampleFileNames!.map(file => path.join(dirPath, file))
			const cmd = [
				`${serverconfig.binpath}/../python/src/plotBrainImaging${plane}.py`,
				refFile,
				query.l || '',
				query.f || '',
				query.t || '',
				...filePaths
			]
			const ps = spawn(serverconfig.python, cmd)
			const imgData: Buffer[] = []
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
	} else {
		throw 'no reference or sample files'
	}
}
