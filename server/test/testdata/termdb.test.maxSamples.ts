import type { Mds3 } from '#types'
// see dataset/protected.test.ts on using the .js extension when importing termdb.test
import termdbTestInit from '../../dataset/termdb.test.js'

/*
	TermdbTest with a sample limit for differential expression (rnaseqGeneCount.maxSamples) below its 100 samples,
	for request tests of the limit that termdb/DE applies to a run. The limit of every differential analysis
	(maxSampleCutoff in #shared) is above the size of any test dataset, and the same check applies both.

	Load it from a test serverconfig with:
	{ "name": "TermdbTest", "jsfile": "test/testdata/termdb.test.maxSamples.ts" }
*/

export const maxSamples = 20

export default function (): Mds3 {
	const ds = termdbTestInit()
	ds.queries!.rnaseqGeneCount!.maxSamples = maxSamples
	return ds
}
