import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { CategoricalTW, BrainImagingRequest, BrainImagingResponse, FilesByCategory, RouteApi } from '#types'
import { brainImagingPayload } from '#types/checkers'
import { getData } from '../src/termdb.matrix.js'
import { isNumericTerm } from '@sjcrh/proteinpaint-shared/terms.js'
import { getColors } from '#shared/common.js'
import { run_python } from '@sjcrh/proteinpaint-python'

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
			res.send({ brainImage, plane, legend } satisfies BrainImagingResponse)
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

		const data = await getData({ terms }, ds)

		/*
		divideByCat's structure, When no divideByTW given, one fake divideByTwCat 'default' will be used.
		when no overlayTW given, one fake overlayTwCat 'default' will be used.
			{
				divideByTwCat_1: {
					overlayTwCat_1: {
						samples: [*.nii, *.nii, ...]
						color: str
					},

					overlayTwCat_2: {
						samples: [*.nii, *.nii, ...]
						color: str
					},
					...
				},

				divideByTwCat_2: {
					overlayTwCat_1: {
						samples: [*.nii, *.nii, ...]
						color: str
					},

					overlayTwCat_2: {
						samples: [*.nii, *.nii, ...]
						color: str
					},
					...
				}
			}
		*/
		const divideByCat: { [key: string]: FilesByCategory } = {}
		const uniqueOverlayTwCats = new Set()
		for (const sampleName of selectedSampleNames) {
			const sampleId = ds.sampleName2Id.get(sampleName)
			const sampleData = data.samples[sampleId]
			const samplePath = path.join(dirPath, sampleName) + '.nii'
			let divideCategory = 'default'
			let overlayCategory = 'default'
			if (divideByTW) {
				const value = sampleData[divideByTW.$id!]
				if (value) divideCategory = divideByTW.term.values?.[value.key]?.label || value.key // for numeric terms key has the bin label, for geneVariant terms, key is the group
			}
			if (overlayTW) {
				const value = sampleData[overlayTW.$id!]
				if (value) {
					overlayCategory = overlayTW.term.values?.[value.key]?.label || value.key
					uniqueOverlayTwCats.add(overlayCategory)
				}
			}
			if (!divideByCat[divideCategory]) divideByCat[divideCategory] = {}

			if (!query.legendFilter?.includes(overlayCategory)) {
				if (!divideByCat[divideCategory][overlayCategory]) {
					let color = overlayTW?.term?.values?.[overlayCategory]?.color
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

		const k2c = getColors(uniqueOverlayTwCats.size)
		const lengths: number[] = []
		for (const dcategory in divideByCat) {
			for (const category in divideByCat[dcategory]) {
				const overlayCat = divideByCat[dcategory][category]
				const samples = overlayCat.samples
				lengths.push(samples.length)
				if (!overlayCat.color) overlayCat.color = category == 'default' ? 'red' : k2c(category)
			}
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
			const arg = {
				refFile,
				plane,
				index,
				maxLength,
				filesByCat: JSON.stringify(filesByCat)
			}
			let url: string | undefined
			try {
				url = await run_python('plotBrainImaging.py', JSON.stringify(arg))
			} catch (error) {
				const errmsg = 'Error running Python script:' + error
				throw new Error(errmsg)
			}
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
