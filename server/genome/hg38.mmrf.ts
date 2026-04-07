import { getHg38 } from './hg38.base.ts'

const genome = getHg38()
genome.genedb.dbfile = 'anno/genes.hg38.mmrf.db'
genome.tracks[1].name = 'GENCODE v32'
genome.tracks[1].file = 'anno/gencode.v32.hg38.gz'

export default genome
