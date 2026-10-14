import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '../serverconfig.js'
import { validate_query_dnaMethylation, readsCpgShard } from '../mds3.init.js'

/*
CpG shards (dnaMethylation.cpgByChr) on a dataset whose terms are served from an element matrix.

Two contracts, both silent when broken:
- only a 'region' term reads a shard; a promoter/gene/enhancer term reads the matrix elementForTerms
  nominates, otherwise that setting has no effect on any chromosome with a shard
- a cpgByChr template matching no shard (directory missing, or present but empty) does not fail
  dataset init; the setting is dropped and the element matrices serve every path

Init is run against the TermdbTest fixtures: dnaMeth.h5 holds only chr17 CpGs, so a directory
linking it as chr17.h5 is a one-shard build. Sample ids are not checked here, so every name maps.
*/

const tdir = 'files/hg38/TermdbTest'
const shardDir = `${tdir}/__cpgShardsTest`

function getDs(cpgByChr: string) {
	return {
		label: 'TermdbTest',
		cohort: { termdb: { q: { sampleName2id: () => 1 } } },
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
	const dir = path.join(serverconfig.tpmasterdir, shardDir)
	fs.mkdirSync(dir, { recursive: true })
	fs.symlinkSync(path.join(serverconfig.tpmasterdir, tdir, 'dnaMeth.h5'), path.join(dir, 'chr17.h5'))
	try {
		const ds = getDs(`${shardDir}/{chr}.h5`)
		await validate_query_dnaMethylation(ds, {})
		const q = ds.queries.dnaMethylation
		t.deepEqual([...q.cpgChroms], ['chr17'], 'chr17 shard found')
		t.equal(typeof q.get, 'function', 'term getter set')
		t.equal(readsCpgShard(q, term('region')), true, 'region term reads the shard')
		t.equal(readsCpgShard(q, term('promoter')), false, 'promoter term still reads the element matrix')
	} finally {
		fs.rmSync(dir, { recursive: true, force: true })
	}
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
