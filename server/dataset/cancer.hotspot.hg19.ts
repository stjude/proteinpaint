import { Mds3 } from '../shared/types'

export default <Mds3> {
	isMds3: true,
	dsinfo: [
		{ k: 'Data type', v: 'SNV/Indel' },
		{ k: 'Gene annotation', v: 'VEP version 107' },
		{ k: 'Download date', v: 'August 2022' }
	],
	genome: 'hg19',
	queries: {
		snvindel: {
			forTrack: true,
			byrange: {
				bcffile: 'hg19/cancerHotspot.sorted.vep.hgvsp_short.bcf.gz',
				infoFields: [
				]
			},
		}
	}
}
