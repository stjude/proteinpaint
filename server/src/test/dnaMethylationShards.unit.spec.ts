import tape from 'tape'
import { validate_query_dnaMethylation, readsCpgShard } from '../mds3.init.js'
import { addNonDictionaryQueries } from '../routes/termdb.config.ts'

/*
CpG shards (dnaMethylation.cpgByChr) on a dataset whose terms are served from an element matrix.

Two contracts, both silent when broken:
- only a 'region' term reads a shard; a promoter/gene/enhancer term reads the matrix elementForTerms
  nominates, otherwise that setting has no effect on any chromosome with a shard
- a cpgByChr template matching no shard (directory missing, or present but empty) does not fail
  dataset init; the setting is dropped and the element matrices serve every path

Init is run against the TermdbTest fixtures: dnaMeth.h5 holds only chr17 CpGs, so a directory
linking it as chr17.h5 is a one-shard build. Sample ids are not checked here, so every name maps.

The sample types offered to the client's sample type selector are those of the samples a term
can be read for; a sample with no sample type is skipped rather than offered as null. Both term
getters, CpG .file and element matrix, read each term for its own sample types.
*/

const tdir = 'files/hg38/TermdbTest'
// a committed one-shard dir, with a copy of dnaMeth.h5 as chr17.h5, since tp may be mounted read-only
const shardDir = `${tdir}/cpgShards`

function getDs(cpgByChr: string) {
	return {
		label: 'TermdbTest',
		cohort: { termdb: { q: { sampleName2id: () => 1 } } },
		sampleId2Type: new Map([[1, 2]]),
		queries: {
			dnaMethylation: {
				cpgByChr,
				elementForTerms: 'promoter',
				elements: { promoter: { file: `${tdir}/dnaMethPromoterMvalue.h5`, unit: 'Average M-value' } }
			}
		}
	} as any
}

const term = (genomicFeatureType: string, chr = 'chr17') => ({ genomicFeatureType, chr })

tape('readsCpgShard() - only a region term on a chromosome with a shard reads it', t => {
	const q = { cpgChroms: new Set(['chr17']) }
	t.equal(readsCpgShard(q, term('region')), true, 'region term on a sharded chromosome')
	for (const type of ['promoter', 'gene', 'enhancer'])
		t.equal(readsCpgShard(q, term(type)), false, `${type} term reads the element matrix`)
	t.equal(readsCpgShard(q, term('region', 'chr1')), false, 'region term on a chromosome with no shard')
	t.equal(readsCpgShard({}, term('region')), false, 'dataset with no shards')
	t.end()
})

tape('validate_query_dnaMethylation() - one shard is kept and serves region terms', async t => {
	const ds = getDs(`${shardDir}/{chr}.h5`)
	await validate_query_dnaMethylation(ds, {})
	const q = ds.queries.dnaMethylation
	t.deepEqual([...q.cpgChroms], ['chr17'], 'chr17 shard found')
	t.equal(typeof q.get, 'function', 'term getter set')
	t.equal(readsCpgShard(q, term('region')), true, 'region term reads the shard')
	t.equal(readsCpgShard(q, term('promoter')), false, 'promoter term still reads the element matrix')
	t.end()
})

tape('validate_query_dnaMethylation() - no matching shard falls back to element matrices', async t => {
	for (const [label, cpgByChr] of [
		['missing directory', `${tdir}/__noSuchDir/{chr}.h5`],
		// the directory exists but holds no file of this name pattern
		['directory with no matching shard', `${tdir}/noSuchPrefix_{chr}.h5`]
	]) {
		const ds = getDs(cpgByChr)
		try {
			await validate_query_dnaMethylation(ds, {})
		} catch (e) {
			t.fail(`${label}: init should not throw, got: ${e}`)
			continue
		}
		const q = ds.queries.dnaMethylation
		t.equal(q.cpgByChr, undefined, `${label}: cpgByChr dropped`)
		t.equal(q.cpgChroms, undefined, `${label}: cpgChroms dropped`)
		t.equal(typeof q.get, 'function', `${label}: element-backed term getter still set`)
		t.equal(q.unit, 'Average M-value', `${label}: unit taken from the element entry`)
		t.equal(readsCpgShard(q, term('region')), false, `${label}: region term reads the element matrix`)
	}
	t.end()
})

tape('validate_query_dnaMethylation() - sample types of the term samples are offered to the client', async t => {
	const ds = getDs(`${tdir}/__noSuchDir/{chr}.h5`)
	const name2id = new Map()
	ds.cohort.termdb.q.sampleName2id = sn => {
		if (!name2id.has(sn)) name2id.set(sn, name2id.size + 1)
		return name2id.get(sn)
	}
	// sample 1 is a type 3, sample 2 has no type, every other sample is a type 2
	ds.sampleId2Type = { get: id => (id == 1 ? 3 : id == 2 ? undefined : 2) }
	ds.cohort.termdb.sampleTypesByTerms = { 'samples.event': { Baseline: [2], Relapse: [3], Remission: [5] } }
	await validate_query_dnaMethylation(ds, {})
	const q = ds.queries.dnaMethylation
	t.deepEqual([...q.sampleTypes].sort(), [2, 3], 'one entry per sample type, the untyped sample skipped')
	t.deepEqual(
		q.sampleTypesByTerms,
		{ 'samples.event': { Baseline: [2], Relapse: [3] } },
		'by-terms values limited to the offered sample types'
	)
	const c: any = {}
	addNonDictionaryQueries(c, ds, {})
	t.deepEqual(c.queries.dnaMethylation.sampleTypes, q.sampleTypes, 'termdb config exposes the sample types')
	t.deepEqual(c.queries.dnaMethylation.sampleTypesByTerms, q.sampleTypesByTerms, 'and the by-terms values')
	t.end()
})

tape('dnaMethylation term getters read each term for its own sample types', async t => {
	// the fixture sample names are integer ids; odd ones are made a type 2, even ones a type 3
	const typed = (ds: any) => {
		ds.cohort.termdb.q.sampleName2id = sn => Number(sn)
		ds.cohort.termdb.q.id2sampleName = id => String(id)
		ds.sampleId2Type = new Map()
		return ds
	}
	const region = { chr: 'chr17', start: 7669000, stop: 7680000 }
	const tw = ($id: string, sampleTypes?: number[]) => ({
		$id,
		term: { type: 'dnaMethylation', id: 'chr17:7669000-7680000', genomicFeatureType: 'region', ...region, sampleTypes }
	})
	const elementDs = typed(getDs(`${tdir}/__noSuchDir/{chr}.h5`))
	const fileDs = typed(getDs(`${tdir}/__noSuchDir/{chr}.h5`))
	fileDs.queries.dnaMethylation = { file: `${tdir}/dnaMeth.h5`, unit: 'Average Beta Value' }
	for (const [label, ds] of [
		['element getter', elementDs],
		['CpG file getter', fileDs]
	]) {
		await validate_query_dnaMethylation(ds, {})
		const q = ds.queries.dnaMethylation
		for (const id of q.samples || q.elements.promoter.allSampleNames.map(Number))
			ds.sampleId2Type.set(id, id % 2 ? 2 : 3)
		const data = await q.get({ terms: [tw('odd', [2]), tw('even', [3]), tw('all')] }, ds)
		const ids = $id => Object.keys(data.term2sample2value.get($id) || {}).map(Number)
		t.ok(ids('odd').length && ids('odd').every(id => id % 2), `${label}: a type 2 term reads only type 2 samples`)
		t.ok(ids('even').length && ids('even').every(id => !(id % 2)), `${label}: a type 3 term reads only type 3 samples`)
		t.equal(ids('all').length, ids('odd').length + ids('even').length, `${label}: a term without its own reads both`)
	}
	t.end()
})
