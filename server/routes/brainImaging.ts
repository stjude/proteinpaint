import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { CategoricalTW, GetBrainImagingRequest, FilesByCategory, TermWrapper } from '#types'
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
		},
		post: {
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

		const terms: CategoricalTW[] = []
		const divideByTW: CategoricalTW | undefined = query.divideByTW
		const overlayTW = query.overlayTW

		if (divideByTW) terms.push(divideByTW)
		if (overlayTW) terms.push(overlayTW)

		const selectedSampleNames = query.selectedSampleFileNames.map(s => s.split('.nii')[0])

		const data = await getData({ terms }, ds, q.genome)

		const divideByCat: { [key: string]: FilesByCategory } = {}

		for (const sampleName of selectedSampleNames) {
			const sampleId = ds.sampleName2Id.get(sampleName)
			const sampleData = data.samples[sampleId]
			const samplePath = path.join(dirPath, sampleName) + '.nii'
			const divideCategory = divideByTW ? sampleData[divideByTW.$id!].value : 'default'
			const overlayCategory = overlayTW ? sampleData[overlayTW.$id!].value : 'default'
			if (!divideByCat[divideCategory]) divideByCat[divideCategory] = {}
			if (!divideByCat[divideCategory][overlayCategory])
				divideByCat[divideCategory][overlayCategory] = {
					samples: [],
					color: overlayTW?.term?.values?.[overlayCategory]?.color || 'red'
				}
			divideByCat[divideCategory][overlayCategory].samples.push(samplePath)
		}
		const lengths: number[] = []
		for (const dcategory in divideByCat)
			for (const category in divideByCat[dcategory]) {
				const samples = divideByCat[dcategory][category].samples
				lengths.push(samples.length)
			}

		// Find the length of each array and determine the maximum length
		const maxLength = Math.max(...lengths)

		const brainImageDict = {}
		for (const dcategory in divideByCat) {
			let catNum = 0
			const filesByCat = divideByCat[dcategory]
			for (const category in filesByCat) catNum += filesByCat[category].samples.length
			//if (samples.length < 1) continue
			const url = await generateBrainImage(refFile, plane, index, maxLength, JSON.stringify(filesByCat))
			brainImageDict[dcategory] = { url, catNum }
		}

		return brainImageDict
	} else {
		throw 'no reference or sample files'
	}

	function getFilesByCat(tw: CategoricalTW) {
		const filesByCat: FilesByCategory = {}
		for (const [key, value] of Object.entries(tw.term.values)) {
			// TODO: make sure each term has a default color. buildTermDb assigns default color when not available
			filesByCat[key] = { samples: [], color: value.color || 'red' }
		}
		return filesByCat
	}
}

async function generateBrainImage(refFile, plane, index, maxLength, filesJson) {
	return new Promise((resolve, reject) => {
		const cmd = [
			`${serverconfig.binpath}/../python/src/plotBrainImaging.py`,
			refFile,
			plane,
			index,
			maxLength,
			filesJson
		]
		//Use this log if you need to debug the python script, to run the python script manually
		//You will need to add simple quotes to filesJson
		//console.log(cmd.join(' '))

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
