import fs from 'fs'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import type { BrainSample, BrainImagingSamplesRequest, BrainImagingSamplesResponse } from '#types'
import { getData } from '#src/termdb.matrix.js'
import { filterSampleNamesByAccess } from '#src/termdb.sql.js'

export function init({ genomes }) {
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
			/* send the error as plain text, NOT a json object: dofetch3 caches json
			response bodies for the page lifetime, so a transient failure would be
			replayed forever; string responses are not kept in that cache. clients
			treat a string response from this route as the error message */
			res.status(404).send(typeof e == 'string' ? e : 'Cannot get brain imaging samples')
		}
	}
}

async function getBrainImageSamples(query: BrainImagingSamplesRequest, genomes: any): Promise<BrainSample[]> {
	const ds = genomes[query.genome].datasets[query.dslabel]
	const q = ds.queries.NIdata
	// dataset-level access rule (e.g. sign-in required); throws for callers who may not use brain imaging
	ds.cohort?.termdb?.checkNIdataAccess?.(query)
	const key = query.refKey
	if (q[key].referenceFile && q[key].samples) {
		const dirPath = path.join(serverconfig.tpmasterdir, q[key].samples)
		// one async readdir instead of a sync stat per file: this route is on a hot path
		// (matrix click menus, sample view renders)
		const files = (await fs.promises.readdir(dirPath, { withFileTypes: true }))
			.filter(f => f.isFile() && f.name.endsWith('.nii'))
			.map(f => f.name)

		let sampleNames = files.map(name => name.split('.nii')[0])

		// restrict to imaging samples passing the termdb filter and access control
		sampleNames = await filterSampleNamesByAccess(query, ds, sampleNames)

		// callers that only need availability (e.g. sample view, matrix click menu)
		// can skip the annotation query below
		if (query.samplesOnly) return sampleNames.map(name => ({ sample: name }))

		if (q[key].sampleColumns) {
			// Build term wrappers for getData
			const terms = q[key].sampleColumns.map(term => {
				const termjson = ds.cohort.termdb.q.termjsonByOneid(term.termid)
				return {
					$id: term.termid,
					term: termjson,
					q: termjson?.type == 'float' || termjson?.type == 'integer' ? { mode: 'continuous' } : {}
				}
			})

			// Get data for all terms at once
			const data = await getData({ terms, __protected__: query.__protected__ }, ds)
			if (data.error) throw data.error

			const samples = {}
			for (const s of sampleNames) {
				const annoForOneS = { sample: s }
				const sid = ds.cohort.termdb.q.sampleName2id(s)

				// Extract values from getData result
				const sampleData = data.samples?.[sid]
				if (sampleData) {
					for (const term of q[key].sampleColumns) {
						const v = sampleData[term.termid]
						if (v?.value !== undefined) {
							annoForOneS[term.termid] = v.value
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
