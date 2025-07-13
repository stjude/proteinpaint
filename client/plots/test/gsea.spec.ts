import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { group1Values, group2Values } from '#plots/volcano/test/testData.js'

/* 

DO NOT ENABLE THIS FILE ON CI. ITS FOR PROTOTYPING 
AND MANUAL CHECKS ONLY

Tests:
    - Default gsea
    - gsea with .tw instead of .gsea_params
*/

/*************************
 reusable helper functions
**************************/

const runpp = helpers.getRunPp('mass', {
	state: {
		nav: {
			header_mode: 'hidden'
		},
		vocab: {
			//Eventually need to add data to TermdbTest
			//and switch dataset and genome
			dslabel: 'ALL-pharmacotyping',
			genome: 'hg38'
		}
	},
	debug: 1
})

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- plots/gsea -***-')
	test.end()
})

tape('Default gsea', function (test) {
	test.timeoutAfter(10000)

	runpp({
		state: {
			plots: [
				{
					chartType: 'gsea',
					gsea_params: {
						fold_change: [
							0.113097310076855, 0.157254679903013, -0.127936030474977, 0.16699322548421, 0.619875078541592,
							-0.0018770476364016, 0.486726850074203, 0.07540827279123, 0.0748731299596796, 0.0993776928538957,
							0.559956200188964, 0.0999869970669802, 0.0126316752903372, 0.112925394917171, 0.394113812276856,
							0.35592551290649, 0.1840033562215, 0.18206056375666, -0.00868220249516343, 0.103880273510196,
							0.129639019226236, 0.151537979759429, 0.115082634164981, 0.146197042215162, -0.135556607923602,
							0.250333143934522, -0.292286174756983, 0.116050630259789, -0.224005880415048, 1.16963466890901,
							0.0144028434473631, 0.248969711686591, 0.0820881073777663, -0.592539805306932, -0.228776528342734,
							0.0518526477674184, -0.286422362913797, 0.604655305896235, -0.0307507413306705, -0.104970217129171,
							0.245055384131712, -0.00754206597795693, -0.16846921806544, 0.0839259341137602, -0.0786107372725477,
							0.27129301756416, 0.388027392643709, 0.588958257779114, -0.0893276262249536, 0.983374092326347,
							0.0042962552494149, 0.314678574844076, 1.21864578571798, -0.0436476955729076, 0.206111125400003,
							1.2590564037523, 0.128655373408362, -0.122853207897171, -0.0400658724968593, 0.238204436142162,
							0.43957127395714, 0.0311902272216038, 0.0297377536204381, -0.0936549746211766, 0.31901446331885,
							1.00170735856865, -0.106288920776937, -0.280026300769086, 0.267813214704395, 0.0324379840201137,
							-0.291288125487674, -0.473290279456958, 0.472060338655449, -0.00872539236361968, -0.312253891796986,
							0.0339046746517461, 0.0382419550599798, 0.193155648176449, -0.11630327171418, -0.133911209011832,
							-0.111103081503898, 0.00565284542727916, -0.133495691240326, -0.01989566082773, -0.158566084689259,
							-0.0160336177513792, 0.117068091540893, -0.656007114575157, -0.102815248235843, -0.204037923955579,
							-0.102256404410142, -0.201255918210509, -0.584038063096008, 0.119374174613562, -0.230695037769633,
							-0.00950131217129318, -0.000557963878288915, -0.162886506254939, 0.355027243535284, 0.0729969358140364
						],
						genes: [
							'SAMD11',
							'NOC2L',
							'KLHL17',
							'ISG15',
							'AGRN',
							'C1orf159',
							'SDF4',
							'B3GALT6',
							'UBE2J2',
							'SCNN1D',
							'ACAP3',
							'PUSL1',
							'INTS11',
							'CPTP',
							'DVL1',
							'MXRA8',
							'AURKAIP1',
							'CCNL2',
							'MRPL20',
							'ATAD3B',
							'ATAD3A',
							'SSU72',
							'MIB2',
							'CDK11B',
							'SLC35E2B',
							'CDK11A',
							'NADK',
							'GNB1',
							'FAAP20',
							'SKI',
							'MORN1',
							'RER1',
							'PEX10',
							'PLCH2',
							'PANK4',
							'TNFRSF14',
							'PRXL2B',
							'MEGF6',
							'TPRG1L',
							'WRAP73',
							'TP73',
							'LRRC47',
							'CEP104',
							'DFFB',
							'C1orf174',
							'NPHP4',
							'KCNAB2',
							'RPL22',
							'ICMT',
							'GPR153',
							'ACOT7',
							'TNFRSF25',
							'PLEKHG5',
							'NOL9',
							'ZBTB48',
							'KLHL21',
							'PHF13',
							'THAP3',
							'DNAJC11',
							'CAMTA1',
							'VAMP3',
							'PER3',
							'PARK7',
							'RERE',
							'ENO1',
							'SLC2A5',
							'H6PD',
							'SPSB1',
							'SLC25A33',
							'TMEM201',
							'PIK3CD',
							'CLSTN1',
							'CTNNBIP1',
							'LZIC',
							'NMNAT1',
							'UBE4B',
							'KIF1B',
							'PGD',
							'CENPS',
							'CENPS-CORT',
							'DFFA',
							'PEX14',
							'CASZ1',
							'TARDBP',
							'MASP2',
							'SRM',
							'EXOSC10',
							'MTOR',
							'UBIAD1',
							'FBXO44',
							'FBXO6',
							'MAD2L2',
							'DRAXIN',
							'AGTRAP',
							'C1orf167',
							'MTHFR',
							'CLCN6',
							'KIAA2013',
							'PLOD1',
							'MFN2'
						],
						genome: 'hg38',
						genes_length: 100
					}
				}
			]
		},
		gsea: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(gsea) {
		gsea.on('postRender.test', null)
		// test.true(true, 'gsea rendered')

		// if (test['_ok']) gsea.Inner.app.destroy()
		test.end()
	}
})

tape.skip('gsea with .tw instead of .gsea_params', test => {
	test.timeoutAfter(10000)

	const groups = [
		{
			name: 'Sensitive',
			in: true,
			values: group1Values
		},
		{
			name: 'Resistant',
			in: true,
			values: group2Values
		}
	]
	runpp({
		state: {
			plots: [
				{
					chartType: 'differentialAnalysis',
					childType: 'gsea',
					samplelst: {
						groups
					},
					termType: 'geneExpression',
					tw: {
						q: {
							groups
						},
						term: {
							name: 'Sensitive vs Resistant',
							type: 'samplelst',
							values: {
								Sensitive: {
									color: '#1b9e77',
									key: 'Sensitive',
									label: 'Sensitive',
									list: group1Values
								},
								Resistant: {
									color: '#d95f02',
									key: 'Resistant',
									label: 'Resistant',
									list: group2Values
								}
							}
						}
					}
				}
			]
		},
		differentialAnalysis: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(differentialAnalysis) {
		differentialAnalysis.on('postRender.test', null)

		// test.true(true, 'differentialAnalysis rendered')

		// if (test['_ok']) differentialAnalysis.Inner.app.destroy()
		test.end()
	}
})
