const common = require('../src/common')


module.exports = {
	color:'#545454',
	genome:'hg38',
	dbfile:'anno/db/test/hg38test.db',

/*
	cohort:{
		levels:[
			{k:'race',label:'Race'}
		],
		files:[
			{file:'anno/db/test/example.sampleannotation.txt'}
		],
		tosampleannotation:{
			// to trigger generating .ds.cohort.annotation{}, samples as keys
			samplekey:'bcr_patient_barcode'
		},
		fbarfg:'#9F80FF',
		fbarbg:'#ECE5FF',
		variantsunburst:true,
		sampleattribute:{
			lst:[
				{k:'race',label:'Race'},
				{k:'histologic_diagnosis',label:'Histology'}
			]
		},
		key4annotation:'patient',
		// use the value of "patient" to find metadata annotation
	},
	*/



	queries:[
		{
			name:'snvindel',
			makequery:q=>{
				const k=q.isoform
				if(!k) return null
				return 'select * from maf where Transcript_Id=\''+k.toUpperCase()+'\' COLLATE NOCASE'
			},
			tidy:m=> {
				m.isoform=m.Transcript_Id
				delete m.Transcript_Id
				m.chr=m.Chromosome
				delete m.Chromosome
				m.pos=m.Start_Position-1
				delete m.Start_Position
				m.ref=m.Reference_Allele
				delete m.Reference_Allele
				m.alt=m.Alternate_Allele
				delete m.Alternate_Allele
				m.mname= m.HGVSp_Short

				// dataset-specific logic of fixing sample/patient names
				{
					const l = m.Tumor_Sample_Barcode.split('-')
					m.patient = l[0]+'-'+l[1]+'-'+l[2]
					// "patient" goes with cohort.key4annotation and match with patient names in clinical file
					m.sample  = m.patient+'-'+l[3]
					// "sample" match with gene expression sample name
				}
				delete m.Tumor_Sample_Barcode

				if(m.Variant_Classification) {
					const c=common.mclasstester(m.Variant_Classification)
					if(c) {
						m.class=c
						delete m.Variant_Classification
					}
				}
				if(!m.class) {
					m.class=common.mclassnonstandard
				}

				m.dt = common.dtsnvindel
				m.origin = common.moriginsomatic

				return m
			},
		},
		/*
		{
			name:'fpkm gene expression',
			isgeneexpression:true,
			makequery:q=>{
				const k=q.genename
				if(!k) return null
				return 'select gene,value,sample from geneexpression where gene=\''+k.toLowerCase()+'\''
			},
			tidy:item=>{
				const l=item.sample.split('-')
				item.patient = l[0]+'-'+l[1]+'-'+l[2]
				// patient goes with .cohort.key4annotation
				item.sample = item.patient+'-'+l[3]
				return item
			},
			config:{
				// client-side, tk-specific attributes
				usecohort:true,
				name:'RNA-seq gene expression',
				sampletype:'sample',
				datatype:'FPKM',
				ongene:true,
				hlcolor:'#f53d00',
				hlcolor2:'#FFBEA8',
			},
		},
		*/
	],
}
