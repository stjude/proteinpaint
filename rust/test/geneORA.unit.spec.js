/********************************************
Test script for 'rust/src/DEanalysis.rs'
This script must be run from the sjpp directory

cd ~/sjpp && node proteinpaint/rust/test/geneORA.unit.spec.js

*********************************************/

// Import necessary modules
import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const p_value_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail
const gene_set_size_cutoff = 0.001 // If the difference between the actual and expected p-value is greater than this, the test will fail

//Wilcoxon DE test
tape('rust DE wilcoxon unit test', async function (test) {
	const inJson = {
		sample_genes: 'AKT1,TP53,BCR,KRAS',
		msigdb: serverconfig.binpath + '/test/tp/files/hg38/TermdbTest/msigdb/db',
		gene_set_group: 'H: hallmark gene sets',
		filter_non_coding_genes: true,
		genedb: serverconfig.binpath + '/test/tp/anno/genes.hg38.test.db'
	}
	const Rustout = await run_rust('genesetORA', JSON.stringify(inJson))
	const out = JSON.parse(Rustout)

	const expJson = fs.readFileSync(
		path.join(serverconfig.binpath + '/test/tp/files/hg38/TermdbTest', 'TermdbTest_geneORA_exp_output.json'),
		{
			encoding: 'utf8'
		}
	)
	// Pathway1
	const pathway1_id = 'HALLMARK_DNA_REPAIR'
	const pathway1_out = out.pathways.find(user => user.pathway_name === pathway1_id)
	const pathway1_exp_out = JSON.parse(expJson).pathways.find(user => user.pathway_name === pathway1_id)
	test.ok(
		pathway1_out.p_value_original - pathway1_exp_out.p_value_original < p_value_cutoff,
		`For ${pathway1_id}, original pvalue=${pathway1_out.p_value_original}, expected pvalue=${pathway1_exp_out.p_value_original}`
	)
	test.ok(
		pathway1_out.p_value_adjusted - pathway1_exp_out.p_value_adjusted < p_value_cutoff,
		`For ${pathway1_id}, original adj_pvalue=${pathway1_out.p_value_adjusted}, expected adj_pvalue=${pathway1_exp_out.p_value_adjusted}`
	)
	test.ok(
		pathway1_out.gene_set_size - pathway1_exp_out.gene_set_size < gene_set_size_cutoff,
		`For ${pathway1_id}, original gene_set_size=${pathway1_out.gene_set_size}, expected gene_set_size=${pathway1_exp_out.gene_set_size}`
	)

	// Pathway2
	const pathway2_id = 'HALLMARK_BILE_ACID_METABOLISM'
	const pathway2_out = out.pathways.find(user => user.pathway_name === pathway2_id)
	const pathway2_exp_out = JSON.parse(expJson).pathways.find(user => user.pathway_name === pathway2_id)
	test.ok(
		pathway2_out.p_value_original - pathway2_exp_out.p_value_original < p_value_cutoff,
		`For ${pathway2_id}, original pvalue=${pathway2_out.p_value_original}, expected pvalue=${pathway2_exp_out.p_value_original}`
	)
	test.ok(
		pathway2_out.p_value_adjusted - pathway2_exp_out.p_value_adjusted < p_value_cutoff,
		`For ${pathway2_id}, original adj_pvalue=${pathway2_out.p_value_adjusted}, expected adj_pvalue=${pathway2_exp_out.p_value_adjusted}`
	)
	test.ok(
		pathway2_out.gene_set_size - pathway2_exp_out.gene_set_size < gene_set_size_cutoff,
		`For ${pathway2_id}, original gene_set_size=${pathway2_out.gene_set_size}, expected gene_set_size=${pathway2_exp_out.gene_set_size}`
	)

	// Pathway3
	const pathway3_id = 'HALLMARK_ANGIOGENESIS'
	const pathway3_out = out.pathways.find(user => user.pathway_name === pathway3_id)
	const pathway3_exp_out = JSON.parse(expJson).pathways.find(user => user.pathway_name === pathway3_id)
	test.ok(
		pathway3_out.p_value_original - pathway3_exp_out.p_value_original < p_value_cutoff,
		`For ${pathway3_id}, original pvalue=${pathway3_out.p_value_original}, expected pvalue=${pathway3_exp_out.p_value_original}`
	)
	test.ok(
		pathway3_out.p_value_adjusted - pathway3_exp_out.p_value_adjusted < p_value_cutoff,
		`For ${pathway3_id}, original adj_pvalue=${pathway3_out.p_value_adjusted}, expected adj_pvalue=${pathway3_exp_out.p_value_adjusted}`
	)
	test.ok(
		pathway3_out.gene_set_size - pathway3_exp_out.gene_set_size < gene_set_size_cutoff,
		`For ${pathway3_id}, original gene_set_size=${pathway3_out.gene_set_size}, expected gene_set_size=${pathway3_exp_out.gene_set_size}`
	)
	test.end()
})
