import tape from 'tape'
import { gseaKeyInputs } from '../genesetEnrichment.ts'
import { generateHash } from '#src/utils/cacheOrRecompute.ts'

/*
Tests:
	gseaKeyInputs() gives a different cache id for a different gene set db file
*/

const genomeWith = (file: string) => ({ hg38: { termdbs: { msigdb: { cohort: { db: { file } } } } } })
const q: any = {
	genome: 'hg38',
	geneSetGroup: 'REACTOME subset of CP',
	num_permutations: 1000,
	filter_non_coding_genes: true
}

tape('gseaKeyInputs() gives a different cache id for a different gene set db file', t => {
	const key = (file: string) => generateHash(gseaKeyInputs(q, ['A', 'B'], [1, -1], genomeWith(file)))
	const old = key('anno/msigdb/db_2023.2.Hs')
	t.equal(old, key('anno/msigdb/db_2023.2.Hs'), 'same db file, same cache id')
	t.notEqual(old, key('anno/msigdb/db_2026.2.Hs'), 'another MSigDB release, another cache id')
	t.end()
})
