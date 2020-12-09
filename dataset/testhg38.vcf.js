module.exports = {
	color: '#545454',
	genome: 'hg38',
	dbfile: 'anno/db/test/hg38test.db',

	cohort: {
		levels: [{ k: 'race', label: 'Race' }],
		files: [{ file: 'anno/db/test/example.sampleannotation.txt' }],
		tosampleannotation: {
			samplekey: 'bcr_patient_barcode'
		},
		sampleattribute: {
			lst: [{ k: 'race', label: 'Race' }, { k: 'histologic_diagnosis', label: 'Histology' }]
		},
		fbarfg: '#9F80FF',
		fbarbg: '#ECE5FF',
		variantsunburst: true,
		key4annotation: 'patient'
	},

	vcfinfofilter: {
		lst: [
			{
				name: 'Population frequency filter',
				altalleleinfo: { key: 'AF' },
				numericfilter: [0.0001, 0.001, 0.01, 0.1]
			}
		],
		setidx4numeric: 0
	},
	vcfcohorttrack: {
		file: 'anno/db/test/cohort.vcf.gz',
		samplenamemap: s => {
			const l = s.name.split('-')
			s.patient = l[0] + '-' + l[1] + '-' + l[2] // to match with key4annotation
			return s
		}
	},

	queries: [
		{
			name: 'snvindel',
			vcffile: 'anno/db/test/variantonly.vcf.gz'
		},
		{
			name: 'fpkm gene expression',
			isgeneexpression: true,
			makequery: q => {
				const k = q.genename
				if (!k) return null
				return "select gene,value,sample from geneexpression where gene='" + k.toLowerCase() + "'"
			},
			tidy: item => {
				const l = item.sample.split('-')
				item.patient = l[0] + '-' + l[1] + '-' + l[2]
				// patient goes with .cohort.key4annotation
				return item
			},
			config: {
				// client-side, tk-specific attributes
				usecohort: true,
				name: 'RNA-seq gene expression',
				sampletype: 'sample',
				datatype: 'FPKM',
				ongene: true,
				hlcolor: '#f53d00',
				hlcolor2: '#FFBEA8'
			}
		}
	]
}
