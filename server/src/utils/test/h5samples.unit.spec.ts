import path from 'path'
import tape from 'tape'
import { getH5samples } from '#src/utils/h5samples.ts'

const TESTDATA_DIR = path.join(process.cwd(), 'server/test/tp/files/hg38/TermdbTest')

tape('\n', t => {
	t.comment('-***- src/utils/h5samples -***-')
	t.end()
})

tape('getH5samples reads rnaseq HDF5 samples dataset', async t => {
	const file = path.join(TESTDATA_DIR, 'rnaseq/TermdbTest.fpkm.matrix.new.h5')
	const samples = await getH5samples(file)

	t.equal(samples.length, 100, 'returns all 100 samples')
	t.equal(samples[0], '2646', 'first sample is parsed')
	t.equal(samples[59], '3472', 'last preclinical sample is parsed before numeric samples')
	t.equal(samples[60], '1', 'numeric sample segment starts at the expected position')
	t.equal(samples.at(-1), '40', 'last sample is parsed')
	t.end()
})

tape('getH5samples reads promoter methylation sample names dataset', async t => {
	const file = path.join(TESTDATA_DIR, 'dnaMethPromoterMvalue.h5')
	const samples = await getH5samples(file, '/meta/samples/names')

	t.equal(samples.length, 100, 'returns all 100 samples')
	t.equal(samples[0], '1', 'first sample is parsed')
	t.equal(samples[39], '40', 'last numeric sample is parsed before preclinical samples')
	t.equal(samples[40], '2646', 'preclinical sample segment starts at the expected position')
	t.equal(samples.at(-1), '3472', 'last sample is parsed')
	t.end()
})
