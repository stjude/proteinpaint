import tape from 'tape'
import { anyMethylationSamples, eligibleMethylationSamples } from '#src/utils/methylationMatrix.ts'

/*
test sections:

anyMethylationSamples: the samples of every element class, not only of the default one
anyMethylationSamples: a CpG-backed dataset counts each class with the samples its CpG matrix holds
anyMethylationSamples: a class that does not resolve is skipped; none resolving throws
*/

/** a dataset whose methylation query has `dm` */
const dataset = (dm: any) => ({ label: 'test', queries: { dnaMethylation: dm } })
const sorted = (s: Set<string>) => [...s].sort()

tape('\n', t => {
	t.comment('-***- anyMethylationSamples specs -***-')
	t.end()
})

tape('anyMethylationSamples: the samples of every element class, not only of the default one', t => {
	const ds = dataset({
		defaultElementType: 'promoter',
		elements: {
			promoter: { file: 'promoter.h5', allSampleSet: new Set(['a', 'b']) },
			enhancer: { file: 'enhancer.h5', allSampleSet: new Set(['b', 'c']) }
		}
	})
	t.deepEqual(sorted(eligibleMethylationSamples(ds, undefined)), ['a', 'b'], 'the default class alone lacks c')
	t.deepEqual(sorted(anyMethylationSamples(ds)), ['a', 'b', 'c'], 'should count a sample of any class once')
	t.end()
})

tape('anyMethylationSamples: a CpG-backed dataset counts each class with the samples its CpG matrix holds', t => {
	const ds = dataset({
		defaultElementType: 'promoter',
		cpgChroms: new Set(['chr1']),
		regionSampleSet: new Set(['a', 'b', 'c']),
		elements: {
			promoter: { file: 'promoter.h5', allSampleSet: new Set(['a']) },
			enhancer: { file: 'enhancer.h5', allSampleSet: new Set(['c', 'z']) }
		}
	})
	t.deepEqual(
		sorted(anyMethylationSamples(ds)),
		['a', 'c'],
		'should leave out a class sample that the CpG matrix does not hold, as eligibleMethylationSamples does'
	)
	t.end()
})

tape('anyMethylationSamples: a class that does not resolve is skipped; none resolving throws', t => {
	// a legacy promoter entry without a file does not resolve; the region samples still do
	const ds = dataset({ promoter: {}, regionSampleSet: new Set(['a']) })
	t.deepEqual(sorted(anyMethylationSamples(ds)), ['a'], 'should count the classes that resolve')
	t.throws(() => anyMethylationSamples(dataset({})), /does not support DNA methylation/, 'should throw when none does')
	t.throws(() => anyMethylationSamples({ queries: {} }), /does not support DNA methylation/, 'should throw without it')
	t.end()
})
