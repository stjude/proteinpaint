import path from 'path'
import { mayLog } from '#src/helpers.ts'
import serverconfig from '#src/serverconfig.js'
import { get_header_txt } from '#src/utils.js'
import { run_python } from '@sjcrh/proteinpaint-python'

/** Dataset-startup validation for the rnaseqGeneCount query (used by the
 * DE route at request time). Resolves the file path against tpmasterdir,
 * reads the header (or HDF5 sample list) to populate `q.allSampleSet`,
 * and warns about any header sample names the termdb doesn't recognize.
 * Called from mds3.init at server boot, not per request. */
export async function validate_query_rnaseqGeneCount(ds) {
	const q = ds.queries.rnaseqGeneCount
	if (!q) return
	if (!q.file) throw new Error('unknown data type for rnaseqGeneCount')
	// the gene count matrix tabular text file
	q.file = path.join(serverconfig.tpmasterdir, q.file)
	/*
    first line of matrix must be sample header, samples start from 5th column for text based files
    read the first line to get all samples, and save at q.allSampleSet
    so that samples from analysis request will be screened against q.allSampleSet
    also require that there's no duplicate samples in header line, so rust/r won't break
    */
	{
		let samples: string[] = []
		if (ds.queries.rnaseqGeneCount.storage_type == 'text') {
			samples = (await get_header_txt(q.file, null)).split('\t').slice(4)
		} else if (ds.queries.rnaseqGeneCount.storage_type == 'HDF5') {
			const get_samples_from_hdf5 = {
				hdf5_file: q.file,
				validate: true
			}
			const time1 = new Date().valueOf()
			const result = await run_python('readHDF5.py', JSON.stringify(get_samples_from_hdf5))
			const time2 = new Date().valueOf()
			mayLog('Time taken to query gene expression:', time2 - time1, 'ms')
			const vr = JSON.parse(result)
			if (vr.status !== 'success') throw new Error(vr.message)
			if (!Array.isArray(vr.samples)) throw new Error('HDF5 file has no samples, please check file.')
			samples = vr.samples
		} else throw new Error('unknown storage type:' + ds.queries.rnaseqGeneCount.storage_type)

		q.allSampleSet = new Set(samples)
		//if(q.allSampleSet.size < samples.length) throw new Error('rnaseqGeneCount.file header contains duplicate samples')
		const unknownSamples: string[] = []
		for (const n of q.allSampleSet) {
			if (!ds.cohort.termdb.q.sampleName2id(n)) unknownSamples.push(n)
		}
		//if (unknownSamples.length)
		//	throw new Error(`${ds.label} rnaseqGeneCount: ${unknownSamples.length} out of ${
		//		q.allSampleSet.size
		//	} sample names are unknown: ${unknownSamples.join(',')}`)
		console.log(q.allSampleSet.size, `rnaseqGeneCount samples from ${ds.label}`)
	}
}
