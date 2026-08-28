import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { QualTW, BrainImagingRequest, BrainImagingResponse, FilesByCategory } from '#types'
import { getData } from '../src/termdb.matrix.js'
import { filterSampleNamesByAccess } from '#src/termdb.sql.js'
import { isNumericTerm } from '#shared'
import { getColors } from '#shared'
import { run_python } from '@sjcrh/proteinpaint-python'

/*
given one or more samples, map the sample(s) to brain template and return the image
*/

export function init({ genomes }) {
	return async (req, res): Promise<void> => {
		try {
			const query: BrainImagingRequest = req.query

			const g = genomes[query.genome]
			if (!g) throw 'invalid genome name'
			const ds = g.datasets[query.dslabel]
			if (!ds) throw 'invalid dataset name'
			// must not test truthiness: slice index 0 (first slice) is valid
			let plane, index
			if (query.l != undefined) {
				plane = 'L'
				index = query.l
			} else if (query.f != undefined) {
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
			/* send the error as plain text, NOT a json object: dofetch3 caches json
			response bodies for the page lifetime, so a transient failure would be
			replayed forever for this request body; string responses are not kept
			in that cache, keeping errors retryable. clients treat a string
			response from this route as the error message */
			res.status(404).send(typeof e == 'string' ? e : 'Sample brain image not found')
		}
	}
}

async function getBrainImage(query: BrainImagingRequest, genomes: any, plane: string, index: number): Promise<any> {
	const ds = genomes[query.genome].datasets[query.dslabel]
	const q = ds.queries.NIdata
	// dataset-level access rule (e.g. sign-in required); throws for callers who may not use brain imaging
	ds.cohort?.termdb?.checkNIdataAccess?.(query)
	const key = query.refKey
	if (q[key].referenceFile && q[key].samples) {
		const refFile = path.join(serverconfig.tpmasterdir, q[key].referenceFile)
		const dirPath = path.join(serverconfig.tpmasterdir, q[key].samples)

		const terms: QualTW[] = []
		const divideByTW: QualTW | undefined = query.divideByTW
		const overlayTW: QualTW | undefined = query.overlayTW

		if (divideByTW) terms.push(divideByTW)
		if (overlayTW) terms.push(overlayTW)

		let selectedSampleNames = query.selectedSampleFileNames.map(s => s.split('.nii')[0])

		// sample view and matrix may request any sample, including ones without imaging data;
		// keep only samples that actually have an imaging file
		const existingFiles = new Set(await fs.promises.readdir(dirPath))
		selectedSampleNames = selectedSampleNames.filter(s => existingFiles.has(s + '.nii'))
		if (!selectedSampleNames.length) throw 'no brain imaging data for the requested sample(s)'

		// restrict rendered samples by the combined global+local filter and access control
		selectedSampleNames = await filterSampleNamesByAccess(query, ds, selectedSampleNames)
		// covers both a user filter excluding all selected samples and access control;
		// an explicit message beats rendering a bare template with no explanation
		if (!selectedSampleNames.length) throw 'no selected samples pass the current filter'

		const data = await getData({ terms, __protected__: query.__protected__ }, ds)
		if (data.error) throw data.error

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
		/* a sample with several values for one term (e.g. a membership multivalue
		term) comes back as {values:[{key,value},..]} instead of {key,value}; this
		lists the category label(s) of a term value */
		const getCategories = (tw: QualTW, value: any): string[] => {
			const keys = value.values ? value.values.map(v => v.key) : [value.key]
			// for numeric terms key has the bin label, for geneVariant terms, key is the group
			return keys.map(k => tw.term.values?.[k]?.label || k)
		}
		for (const sampleName of selectedSampleNames) {
			const sampleId = ds.sampleName2Id.get(sampleName)
			// sampleData may be undefined for a sample with an imaging file but no
			// annotation for the divide/overlay terms; it then stays in 'default'
			const sampleData = data.samples[sampleId]
			const samplePath = path.join(dirPath, sampleName) + '.nii'
			// divide-by: a multi-member sample is rendered in each of its groups
			let divideCategories = ['default']
			let overlayCategory = 'default'
			if (divideByTW && sampleData) {
				const value = sampleData[divideByTW.$id!]
				if (value) divideCategories = getCategories(divideByTW, value)
			}
			if (overlayTW && sampleData) {
				const value = sampleData[overlayTW.$id!]
				/* multivalue is not offered as overlay (see termdb.usecase.ts); a stale saved
				session may still carry one, then its memberships are joined into one category */
				if (value) {
					overlayCategory = getCategories(overlayTW, value).join(', ')
					uniqueOverlayTwCats.add(overlayCategory)
				}
			}
			for (const divideCategory of divideCategories) {
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
