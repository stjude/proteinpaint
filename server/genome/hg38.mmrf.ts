import { getHg38 } from './hg38.base.js'

const genome = getHg38()

genome.genedb.dbfile = 'anno/genes.hg38.mmrf.db'
if (genome.tracks?.[1]) {
	genome.tracks[1].name = 'GENCODE v32'
	genome.tracks[1].file = 'anno/gencode.v32.hg38.gz'
} else {
	throw new Error('Expected hg38 genome to include a second track')
}

export default genome
