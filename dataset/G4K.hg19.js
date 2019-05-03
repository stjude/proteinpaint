const common=require('../src/common')


const samplenamekey = 'sample_name'

const valuePerSample={
	key:'percentage',
	label:'Percentage',
	cutoffValueLst:[
		{side:'>',value:5,label:'>5%'},
		{side:'>',value:10,label:'>10%'},
		{side:'>',value:20,label:'>20%'},
		{side:'>',value:30,label:'>30%'},
		{side:'>',value:40,label:'>40%'}
	]
}


module.exports={
	genome:'hg19',
	isMds:true,


	about:[
	],
	
	sampleAssayTrack:{
		file:'hg19/G4K/tracktable/__table'
	},
	

	/*
	cohort and sample annotation
	*/

	cohort:{
		files:[
			{file:'hg19/G4K/sampletable/G4K.sample'},
		],
		samplenamekey:samplenamekey,
		tohash:(item, ds)=>{
			const samplename = item[samplenamekey]
			if(!samplename) return console.error(samplenamekey+' missing from a line: '+JSON.stringify(item))
			if(ds.cohort.annotation[samplename]){
				// append info
				for(const k in item){
					ds.cohort.annotation[samplename][k] = item[k]
				}
			} else {
				// new sample
				ds.cohort.annotation[samplename] = item
			}
		},
		/*
		sampleAttribute:{

		}
		*/
	},
	mutationAttribute:{
		attributes:{
			dna_assay:{
				label:'DNA assay',
				values:{
					wgs:{ name:'WGS', label:'Whole-genome sequencing' },
					wes:{ name:'WES', label:'Whole-exome sequencing'},
				},
				hidden:1,
				filter:1
			},
			vorigin:{
				label:'Variant origin',
				values:{
					somatic:{name:'Somatic'},
					germline:{name:'Germline'}
				},
				filter:1
			},
			manual_review:{
				label:'Manual Review',
				values:{
					good:{name:'Good'},
					bad:{name:'Bad'},
					ambiguous:{name:'Ambiguous'}
				},
				filter:1
			}
		}
	},
	queries:{
		svcnv:{
			name:'G4K mutation',
			istrack:true,
			type:common.tkt.mdssvcnv,
			file:'hg19/G4K/G4K.svcnv.gz',

			no_loh:1,

			// cnv
			valueCutoff:0.2,
			bplengthUpperLimit:2000000, // limit cnv length to focal events

			// loh
			segmeanValueCutoff:0.1,
			lohLengthUpperLimit:2000000,
			/*
			groupsamplebyattr:{

			},
			*/

			expressionrank_querykey:'genefpkm',
			vcf_querykey:'snvindel',

			multihidelabel_vcf:true,
			multihidelabel_fusion:false,
			multihidelabel_sv:true,

			legend_corigin:{
				key:'vorigin',
				somatic:'somatic',
				germline:'germline'
			},
		},

		snvindel:{
			hideforthemoment:1,
			name:'G4k SNV/indel',
			istrack:true,
			type:common.tkt.mdsvcf,
			viewrangeupperlimit:2000000,
			tracks:[
				{
					file:'hg19/G4K/G4K.vcf.gz',
					type:'vcf',
				}
			]
		},

		genefpkm:{
			hideforthemoment:1,
			name:'G4K RNA-seq gene FPKM',
			isgenenumeric:true,
			file:'hg19/G4K/G4K.fpkm.gz',
			datatype:'FPKM',

			// for boxplots & circles, and the standalone expression track
			itemcolor:'green',

			// for expression rank checking when coupled to svcnv
			viewrangeupperlimit:5000000,
			/*
			boxplotbysamplegroup:{

			},
			*/
		}
	}
}
