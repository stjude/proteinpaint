/********************************************
Test script for 'rust/src/cerno.rs'
This script must be run from the sjpp directory

cd ~/sjpp && node proteinpaint/rust/test/cerno.unit.spec.js

*********************************************/

// Import necessary modules
import tape from 'tape'
import fs from 'fs'
import path from 'path'
import serverconfig from '@sjcrh/proteinpaint-server/src/serverconfig.js'
import { run_rust } from '@sjcrh/proteinpaint-rust'

const p_value_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail
const geneset_size_cutoff = 0.001 // If the difference between the actual and expected p-value is greater than this, the test will fail
const auc_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail
const es_cutoff = 0.0001 // If the difference between the actual and expected p-value is greater than this, the test will fail

//CERNO gsea test
tape('rust GSEA cerno unit test upregulated', async function (test) {
	const inJson =
		'{"genes":["DDX11L1","MIR1302-2HG","MIR1302-2","AL627309.5","AL627309.4","RP5-857K21.15","RP11-206L10.3","AL669831.2","LINC00115","LINC01128","FAM41C","LINC02593","SAMD11","PERM1","C1ORF170","AL645608.7","AL645608.5","UBE2J2","LINC01786","CPSF3L","GLTPD1","TAS1R3","DVL1","MXRA8","AURKAIP1","CCNL2","MRPL20","LINC01770","ATAD3C","ATAD3A","TMEM240","AL645728.1","MIB2","MMP23B","SLC35E2B","CDK11A","AL031282.2","NADK","AL391845.2","GABRD","AL391845.1","PRKCZ","AL590822.2","C1ORF86","AL590822.1","AL589739.1","AL513477.2","PEX10","PLCH2","AL139246.4","HES5","TNFRSF14-AS1","TNFRSF14","PRXL2B","BCR"],"fold_change":[-0.00754244003567638,1.60819437156595,0.273132148410086,-1.54780910187351,-1.31612193725743,1.31157468777787,-1.69451733074357,-3.15083563013724,-1.84408715886437,4.90464481401721,-0.00145136199969856,-0.0477762124074337,-1.42830474601444,3.17820265771325,0.695037768807506,-1.95627514090831,-0.00118410223435209,0.412209338217798,-1.38736232413806,-0.677239941393979,-0.890049995899678,0.51515222528188,-1.91283184602664,-0.944650418678798,1.23059428646863,7.25589303524136,-2.53188386010605,3.10566034553914,-1.81251772730318,-0.458145012418429,-0.310293891279236,-0.665168162186501,2.44545768970446,0.257150250190794,-1.95710225853658,0.289226337016921,2.67903659417567,2.2406675677287,0.993659855026679,-0.358329112765639,-1.07086613915285,-0.81465600530406,-0.312773063730378,-0.0715093793637155,-0.649697604900669,0.511794952916182,0.385114483689945,-1.46700441987008,3.92892882952689,-0.810265729235774,-0.0969183063005581,0.669735342633645,-0.321181904254173,0.280835178205363,1.64524995455478],"db":"' +
		serverconfig.binpath +
		'/test/tp/files/hg38/TermdbTest/msigdb/db","geneset_group":"H: hallmark gene sets","genedb":"' +
		serverconfig.binpath +
		'/test/tp/anno/genes.hg38.test.db","filter_non_coding_genes":true}'

	const Rustout = await run_rust('cerno', inJson)
	const out = JSON.parse(Rustout)

	const expJson = JSON.parse(
		fs.readFileSync(
			path.join(
				serverconfig.binpath + '/test/tp/files/hg38/TermdbTest',
				'TermdbTest_cerno_exp_upregulated_output.json'
			),
			{
				encoding: 'utf8'
			}
		)
	)

	//     // Pathway1
	const pathway1_id = 'HALLMARK_DNA_REPAIR'
	const pathway1_out = out[pathway1_id]
	const pathway1_exp_out = expJson[pathway1_id]
	test.ok(
		pathway1_out.pval - pathway1_exp_out.pval < p_value_cutoff,
		`For ${pathway1_id}, original pvalue=${pathway1_out.pval}, expected pvalue=${pathway1_exp_out.pval}`
	)
	test.ok(
		pathway1_out.fdr - pathway1_exp_out.fdr < p_value_cutoff,
		`For ${pathway1_id}, original adj_pvalue=${pathway1_out.fdr}, expected adj_pvalue=${pathway1_exp_out.fdr}`
	)
	test.ok(
		pathway1_out.geneset_size - pathway1_exp_out.geneset_size < geneset_size_cutoff,
		`For ${pathway1_id}, original geneset_size=${pathway1_out.geneset_size}, expected geneset_size=${pathway1_exp_out.geneset_size}`
	)
	test.ok(
		pathway1_out.es - pathway1_exp_out.es < es_cutoff,
		`For ${pathway1_id}, original es=${pathway1_out.es}, expected es=${pathway1_exp_out.es}`
	)
	test.ok(
		pathway1_out.auc - pathway1_exp_out.auc < auc_cutoff,
		`For ${pathway1_id}, original auc=${pathway1_out.auc}, expected auc=${pathway1_exp_out.auc}`
	)

	//     // Pathway2
	const pathway2_id = 'HALLMARK_BILE_ACID_METABOLISM'
	const pathway2_out = out[pathway2_id]
	const pathway2_exp_out = expJson[pathway2_id]
	test.ok(
		pathway2_out.pval - pathway2_exp_out.pval < p_value_cutoff,
		`For ${pathway2_id}, original pvalue=${pathway2_out.pval}, expected pvalue=${pathway2_exp_out.pval}`
	)
	test.ok(
		pathway2_out.fdr - pathway2_exp_out.fdr < p_value_cutoff,
		`For ${pathway2_id}, original adj_pvalue=${pathway2_out.fdr}, expected adj_pvalue=${pathway2_exp_out.fdr}`
	)
	test.ok(
		pathway2_out.geneset_size - pathway2_exp_out.geneset_size < geneset_size_cutoff,
		`For ${pathway2_id}, original geneset_size=${pathway2_out.geneset_size}, expected geneset_size=${pathway2_exp_out.geneset_size}`
	)
	test.ok(
		pathway2_out.es - pathway2_exp_out.es < es_cutoff,
		`For ${pathway2_id}, original es=${pathway2_out.es}, expected es=${pathway2_exp_out.es}`
	)
	test.ok(
		pathway2_out.auc - pathway2_exp_out.auc < auc_cutoff,
		`For ${pathway2_id}, original auc=${pathway2_out.auc}, expected auc=${pathway2_exp_out.auc}`
	)

	//     // Pathway3
	const pathway3_id = 'HALLMARK_ANGIOGENESIS'
	const pathway3_out = out[pathway3_id]
	const pathway3_exp_out = expJson[pathway3_id]
	test.ok(
		pathway3_out.pval - pathway3_exp_out.pval < p_value_cutoff,
		`For ${pathway3_id}, original pvalue=${pathway3_out.pval}, expected pvalue=${pathway3_exp_out.pval}`
	)
	test.ok(
		pathway3_out.fdr - pathway3_exp_out.fdr < p_value_cutoff,
		`For ${pathway3_id}, original adj_pvalue=${pathway3_out.fdr}, expected adj_pvalue=${pathway3_exp_out.fdr}`
	)
	test.ok(
		pathway3_out.geneset_size - pathway3_exp_out.geneset_size < geneset_size_cutoff,
		`For ${pathway3_id}, original geneset_size=${pathway3_out.geneset_size}, expected geneset_size=${pathway3_exp_out.geneset_size}`
	)
	test.ok(
		pathway3_out.es - pathway3_exp_out.es < es_cutoff,
		`For ${pathway3_id}, original es=${pathway3_out.es}, expected es=${pathway3_exp_out.es}`
	)
	test.ok(
		pathway3_out.auc - pathway3_exp_out.auc < auc_cutoff,
		`For ${pathway3_id}, original auc=${pathway3_out.auc}, expected auc=${pathway3_exp_out.auc}`
	)
	test.end()
})

// In this downregulated test, the fold change values have changed their sign so that the query is a mirror-image of the upregulated query.
tape('rust GSEA cerno unit test downregulated', async function (test) {
	const inJson =
		'{"genes":["DDX11L1","MIR1302-2HG","MIR1302-2","AL627309.5","AL627309.4","RP5-857K21.15","RP11-206L10.3","AL669831.2","LINC00115","LINC01128","FAM41C","LINC02593","SAMD11","PERM1","C1ORF170","AL645608.7","AL645608.5","UBE2J2","LINC01786","CPSF3L","GLTPD1","TAS1R3","DVL1","MXRA8","AURKAIP1","CCNL2","MRPL20","LINC01770","ATAD3C","ATAD3A","TMEM240","AL645728.1","MIB2","MMP23B","SLC35E2B","CDK11A","AL031282.2","NADK","AL391845.2","GABRD","AL391845.1","PRKCZ","AL590822.2","C1ORF86","AL590822.1","AL589739.1","AL513477.2","PEX10","PLCH2","AL139246.4","HES5","TNFRSF14-AS1","TNFRSF14","PRXL2B","BCR"],"fold_change":[0.00754244003567638,-1.60819437156595,-0.273132148410086,1.54780910187351,1.31612193725743,-1.31157468777787,1.69451733074357,3.15083563013724,1.84408715886437,-4.90464481401721,0.00145136199969856,0.0477762124074337,1.42830474601444,-3.17820265771325,-0.695037768807506,1.95627514090831,0.00118410223435209,-0.412209338217798,1.38736232413806,0.677239941393979,0.890049995899678,-0.51515222528188,1.91283184602664,0.944650418678798,-1.23059428646863,-7.25589303524136,2.53188386010605,-3.10566034553914,1.81251772730318,0.458145012418429,0.310293891279236,0.665168162186501,-2.44545768970446,-0.257150250190794,1.95710225853658,-0.289226337016921,-2.67903659417567,-2.2406675677287,-0.993659855026679,0.358329112765639,1.07086613915285,0.81465600530406,0.312773063730378,0.0715093793637155,0.649697604900669,-0.511794952916182,-0.385114483689945,1.46700441987008,-3.92892882952689,0.810265729235774,0.0969183063005581,-0.669735342633645,0.321181904254173,-0.280835178205363,-1.64524995455478],"db":"' +
		serverconfig.binpath +
		'/test/tp/files/hg38/TermdbTest/msigdb/db","geneset_group":"H: hallmark gene sets","genedb":"' +
		serverconfig.binpath +
		'/test/tp/anno/genes.hg38.test.db","filter_non_coding_genes":true}'

	const Rustout = await run_rust('cerno', inJson)
	const out = JSON.parse(Rustout)

	const expJson = JSON.parse(
		fs.readFileSync(
			path.join(
				serverconfig.binpath + '/test/tp/files/hg38/TermdbTest',
				'TermdbTest_cerno_exp_downregulated_output.json'
			),
			{
				encoding: 'utf8'
			}
		)
	)

	//     // Pathway1
	const pathway1_id = 'HALLMARK_DNA_REPAIR'
	const pathway1_out = out[pathway1_id]
	const pathway1_exp_out = expJson[pathway1_id]
	test.ok(
		Math.abs(pathway1_out.pval - pathway1_exp_out.pval) < p_value_cutoff,
		`For ${pathway1_id}, original pvalue=${pathway1_out.pval}, expected pvalue=${pathway1_exp_out.pval}`
	)
	test.ok(
		Math.abs(pathway1_out.fdr - pathway1_exp_out.fdr) < p_value_cutoff,
		`For ${pathway1_id}, original adj_pvalue=${pathway1_out.fdr}, expected adj_pvalue=${pathway1_exp_out.fdr}`
	)
	test.ok(
		Math.abs(pathway1_out.geneset_size - pathway1_exp_out.geneset_size) < geneset_size_cutoff,
		`For ${pathway1_id}, original geneset_size=${pathway1_out.geneset_size}, expected geneset_size=${pathway1_exp_out.geneset_size}`
	)
	test.ok(
		Math.abs(pathway1_out.es - pathway1_exp_out.es) < es_cutoff,
		`For ${pathway1_id}, original es=${pathway1_out.es}, expected es=${pathway1_exp_out.es}`
	)
	test.ok(
		Math.abs(pathway1_out.auc - pathway1_exp_out.auc) < auc_cutoff,
		`For ${pathway1_id}, original auc=${pathway1_out.auc}, expected auc=${pathway1_exp_out.auc}`
	)

	//     // Pathway2
	const pathway2_id = 'HALLMARK_BILE_ACID_METABOLISM'
	const pathway2_out = out[pathway2_id]
	const pathway2_exp_out = expJson[pathway2_id]
	test.ok(
		Math.abs(pathway2_out.pval - pathway2_exp_out.pval) < p_value_cutoff,
		`For ${pathway2_id}, original pvalue=${pathway2_out.pval}, expected pvalue=${pathway2_exp_out.pval}`
	)
	test.ok(
		Math.abs(pathway2_out.fdr - pathway2_exp_out.fdr) < p_value_cutoff,
		`For ${pathway2_id}, original adj_pvalue=${pathway2_out.fdr}, expected adj_pvalue=${pathway2_exp_out.fdr}`
	)
	test.ok(
		Math.abs(pathway2_out.geneset_size - pathway2_exp_out.geneset_size) < geneset_size_cutoff,
		`For ${pathway2_id}, original geneset_size=${pathway2_out.geneset_size}, expected geneset_size=${pathway2_exp_out.geneset_size}`
	)
	test.ok(
		Math.abs(pathway2_out.es - pathway2_exp_out.es) < es_cutoff,
		`For ${pathway2_id}, original es=${pathway2_out.es}, expected es=${pathway2_exp_out.es}`
	)
	test.ok(
		Math.abs(pathway2_out.auc - pathway2_exp_out.auc) < auc_cutoff,
		`For ${pathway2_id}, original auc=${pathway2_out.auc}, expected auc=${pathway2_exp_out.auc}`
	)

	//     // Pathway3
	const pathway3_id = 'HALLMARK_ANGIOGENESIS'
	const pathway3_out = out[pathway3_id]
	const pathway3_exp_out = expJson[pathway3_id]
	test.ok(
		Math.abs(pathway3_out.pval - pathway3_exp_out.pval) < p_value_cutoff,
		`For ${pathway3_id}, original pvalue=${pathway3_out.pval}, expected pvalue=${pathway3_exp_out.pval}`
	)
	test.ok(
		Math.abs(pathway3_out.fdr - pathway3_exp_out.fdr) < p_value_cutoff,
		`For ${pathway3_id}, original adj_pvalue=${pathway3_out.fdr}, expected adj_pvalue=${pathway3_exp_out.fdr}`
	)
	test.ok(
		Math.abs(pathway3_out.geneset_size - pathway3_exp_out.geneset_size) < geneset_size_cutoff,
		`For ${pathway3_id}, original geneset_size=${pathway3_out.geneset_size}, expected geneset_size=${pathway3_exp_out.geneset_size}`
	)
	test.ok(
		Math.abs(pathway3_out.es - pathway3_exp_out.es) < es_cutoff,
		`For ${pathway3_id}, original es=${pathway3_out.es}, expected es=${pathway3_exp_out.es}`
	)
	test.ok(
		Math.abs(pathway3_out.auc - pathway3_exp_out.auc) < auc_cutoff,
		`For ${pathway3_id}, original auc=${pathway3_out.auc}, expected auc=${pathway3_exp_out.auc}`
	)
	test.end()
})
