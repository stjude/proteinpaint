const samplenamekey = 'sample_name'

module.exports = function(common) {
	return {
		isMds: true,

		about: [],

		sampleAssayTrack: {
			file: 'Yanling/AML_Tanja/mds/assaytrack/table'
		},

		/*
		cohort:{
			files:[
				{file:'hg38/als/mds/sample.table'}
			],
			samplenamekey:samplenamekey,
			tohash:(item, ds)=>{
				ds.cohort.annotation[ item[samplenamekey] ] = item
			},
			sampleAttribute:{
				attributes:{
					ALSRD_Dx: {
						label:'ALSRD_Dx',
						filter:1,
					}
				}
			}
		},
		*/

		queries: {
			svcnv: {
				name: 'AML mutation & expression',
				showfullmode: true,
				istrack: true,
				type: common.tkt.mdssvcnv,
				file: 'Yanling/AML_Tanja/mds/svcnv.gz',

				// cnv
				valueCutoff: 0.2,
				bplengthUpperLimit: 2000000, // limit cnv length to focal events

				expressionrank_querykey: 'fpkm',
				vcf_querykey: 'vcf',

				multihidelabel_vcf: false,
				multihidelabel_sv: true
			},

			vcf: {
				hideforthemoment: 1,
				name: 'AML somatic SNV/indel',
				istrack: true,
				type: common.tkt.mdsvcf,
				viewrangeupperlimit: 2000000,
				tracks: [
					{
						file: 'Yanling/AML_Tanja/mds/vcf.vep.gz',
						type: 'vcf'
					}
				]
			},

			fpkm: {
				hideforthemoment: 1,
				name: 'AML FPKM',
				isgenenumeric: true,
				file: 'Yanling/AML_Tanja/mds/fpkm.gz',
				datatype: 'FPKM',

				// for boxplots & circles, and the standalone expression track
				itemcolor: 'green',

				// for expression rank checking when coupled to svcnv
				viewrangeupperlimit: 5000000
			}
		}
	}
}
