import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { CategoricalTW, BrainImagingRequest, BrainImagingResponse, FilesByCategory, RouteApi } from '#types'
import { brainImagingPayload } from '#types'
import { spawn } from 'child_process'
import { getData } from '../src/termdb.matrix.js'
import { isNumericTerm } from '@sjcrh/proteinpaint-shared/terms.js'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/
export const api: RouteApi = {
	endpoint: 'brainImaging',
	methods: {
		get: {
			...brainImagingPayload,
			init
		},
		post: {
			...brainImagingPayload,
			init
		}
	}
}

function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: BrainImagingRequest = req.query

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

			const [brainImage, legend] = await getBrainImage(query, genomes, plane, index)
			res.send({ brainImage, plane, legend })
		} catch (e: any) {
			console.log(e)
			res.status(404).send('Sample brain image not found')
		}
	}
}

async function getBrainImage(query: BrainImagingRequest, genomes: any, plane: string, index: number): Promise<any> {
	const ds = genomes[query.genome].datasets[query.dslabel]
	const q = ds.queries.NIdata
	const key = query.refKey
	if (q[key].referenceFile && q[key].samples) {
		const refFile = path.join(serverconfig.tpmasterdir, q[key].referenceFile)
		const dirPath = path.join(serverconfig.tpmasterdir, q[key].samples)

		const terms: CategoricalTW[] = []
		const divideByTW: CategoricalTW | undefined = query.divideByTW
		const overlayTW: CategoricalTW | undefined = query.overlayTW

		if (divideByTW) terms.push(divideByTW)
		if (overlayTW) terms.push(overlayTW)

		const selectedSampleNames = query.selectedSampleFileNames.map(s => s.split('.nii')[0])

		const data = await getData({ terms }, ds, q.genome)

		const divideByCat: { [key: string]: FilesByCategory } = {}

		for (const sampleName of selectedSampleNames) {
			const sampleId = ds.sampleName2Id.get(sampleName)
			const sampleData = data.samples[sampleId]
			const samplePath = path.join(dirPath, sampleName) + '.nii'
			let divideCategory = 'default'
			let overlayCategory = 'default'
			if (divideByTW) {
				const value = sampleData[divideByTW.$id!]
				if (value) divideCategory = divideByTW.term.values?.[value.key]?.label || value.key // for numeric terms key has the bin label
			}
			if (overlayTW) {
				const value = sampleData[overlayTW.$id!]
				if (value) overlayCategory = overlayTW.term.values?.[value.key]?.label || value.key
			}
			if (!divideByCat[divideCategory]) divideByCat[divideCategory] = {}

			if (!query.legendFilter?.includes(overlayCategory)) {
				if (!divideByCat[divideCategory][overlayCategory]) {
					let color = overlayTW?.term?.values?.[overlayCategory]?.color || 'red'

					if (overlayTW && isNumericTerm(overlayTW.term)) {
						const bins = data.refs.byTermId[overlayTW.$id!].bins
						color = bins.find(b => b.label == overlayCategory).color
					}
					divideByCat[divideCategory][overlayCategory] = {
						samples: [],
						color
					}
				}
				divideByCat[divideCategory][overlayCategory].samples.push(samplePath)
			}
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
		const legend = {}
		for (const dcategory in divideByCat) {
			let catNum = 0
			const filesByCat = divideByCat[dcategory]
			for (const category in filesByCat) {
				if (filesByCat[category].samples.length < 1) continue
				catNum += filesByCat[category].samples.length
				if (!legend[category]) legend[category] = { color: filesByCat[category].color, maxLength }
			}
			const url = await generateBrainImage(refFile, plane, index, maxLength, JSON.stringify(filesByCat))
			brainImageDict[dcategory] = { url, catNum }
		}

		if (query.legendFilter) {
			for (const cat of query.legendFilter) {
				legend[cat] = {
					color: 'white',
					maxLength,
					crossedOut: true
				}
			}
		}
		return [brainImageDict, legend]
	} else {
		throw 'no reference or sample files'
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
