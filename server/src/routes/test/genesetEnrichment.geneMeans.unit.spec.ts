import tape from 'tape'
import { meanFoldChangeByGene } from '../genesetEnrichment.ts'

/*
Tests:
	meanFoldChangeByGene() gives one value per gene, the mean of its rows
	meanFoldChangeByGene() skips rows it cannot use
*/

tape('meanFoldChangeByGene() gives one value per gene, the mean of its rows', t => {
	const out = meanFoldChangeByGene([
		{ gene_name: 'A', fold_change: 3 },
		{ gene_name: 'B', fold_change: -1 },
		{ gene_name: 'A', fold_change: -1 },
		{ gene_name: 'A', fold_change: 1 }
	])
	t.deepEqual(out.genes, ['A', 'B'], 'each gene once, in order of first appearance')
	t.deepEqual(out.fold_change, [1, -1], 'the mean of the three A rows, not the highest (3)')
	t.end()
})

tape('meanFoldChangeByGene() skips rows it cannot use', t => {
	const out = meanFoldChangeByGene([
		{ gene_name: '', fold_change: 2 },
		{ gene_name: 'A', fold_change: NaN },
		{ gene_name: 'A, B', fold_change: 4 },
		{ gene_name: 'B', fold_change: 2 },
		{ gene_name: undefined as any, fold_change: 1 }
	])
	t.deepEqual(out.genes, ['A', 'B'], 'no empty name; a row naming two genes counts toward each')
	t.deepEqual(out.fold_change, [4, 3], 'a non-finite value does not enter a mean')
	t.end()
})
