import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { GetBrainImagingRequest, GetBrainImagingResponse } from '#types'
import { spawn } from 'child_process'
import { getData } from '../src/termdb.matrix.js'

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
			let plane, index
			if (query.l) {
				plane = 'L'
				index = query.l
			} else if (query.f) {
				plane = 'F'
				index = query.f
			} //(query.t)
			else {
				plane = 'T'
				index = query.t
			}

			const brainImage = await getBrainImage(query, genomes, plane, index)
			res.send({ brainImage, plane })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample brain image not found')
		}
	}
}

async function getBrainImage(query: GetBrainImagingRequest, genomes: any, plane: string, index: number): Promise<any> {
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

		const terms = []
		const divideByTw = query.divideByTW
		const overlayTW = query.overlayTW

		if (divideByTw) terms.push(divideByTw)
		if (overlayTW) terms.push(overlayTW)

		const selectedSampleNames = query.selectedSampleFileNames.map(s => s.split('.nii')[0])

		const data = await getData({ terms }, ds, q.genome)

		if (divideByTw) {
			const divideByValues = {}
			for (const value in divideByTw.term.values) {
				divideByValues[value] = []
			}

			for (const sampleName of selectedSampleNames) {
				const sampleId = ds.sampleName2Id.get(sampleName)

				const sampleData = data.samples[sampleId]
				const category = sampleData[divideByTw.$id].value
				divideByValues[category].push(sampleName + '.nii')
			}

			const matrix = Object.values(divideByValues)
			const lengths = matrix.map(arr => arr.length)
			// Find the length of each array and determine the maximum length
			const maxLength = Math.max(...lengths)

			const brainImageArray = {}
			for (const [termV, samples] of Object.entries(divideByValues)) {
				if (samples.length < 1) continue

				const url = await generateBrainImage(samples, refFile, plane, index, maxLength, dirPath)
				brainImageArray[termV] = { url, catNum: samples.length }
			}
			return brainImageArray
		}

		const url = await generateBrainImage(
			query.selectedSampleFileNames,
			refFile,
			plane,
			index,
			query.selectedSampleFileNames?.length,
			dirPath
		)
		return { default: { url, catNum: query.selectedSampleFileNames.length } }
	} else {
		throw 'no reference or sample files'
	}
}

async function generateBrainImage(selectedSampleFileNames, refFile, plane, index, catNum, dirPath) {
	return new Promise((resolve, reject) => {
		const filePaths = selectedSampleFileNames!.map(file => path.join(dirPath, file))
		const color = 'none'
		const cmd = [
			`${serverconfig.binpath}/../python/src/plotBrainImaging.py`,
			refFile,
			plane,
			index,
			color,
			catNum,
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
}
