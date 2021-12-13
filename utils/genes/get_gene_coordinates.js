/*
######################################################
#
# Retrieve gene coordinates from a gene database table
#
######################################################

Objective: determine the coordinates of each gene in a gene database table based on the coordinates of the gene's isoforms. If a gene has an annotated default isoform, assign the coordinates of the default isoform to be the coordinates of the gene. Otherwise, assign the coordinates of the longest isoform to be the coordinates of the gene. Only consider isoforms on major chromosomes.

Note: for isoforms within pseudoautosomal regions (i.e. present in both X and Y chromosomes), only the X chromosome coordinates are retained. This setting may not be desirable if the input gene database table is derived from a species whose sex chromosomes are not strictly "X" and "Y".
*/

if (process.argv.length != 3) {
	console.log('Usage: node get_gene_coordinates.js <genes.txt> > genes.coordinates.txt')
	process.exit()
}

const fs = require('fs')
const readline = require('readline')

const genesFile = process.argv[2]

/*
Populate an object with gene annotations from the gene database table. The object will have the following format.
genes: {
    gene: {
        isoform: {
            default: <0/1>
            chromosome: <chr*>
            start: <start position>
            stop: <end position>
            length: <isoform length>
}}}
*/
const genes = Object.create(null)

const genesInt = readline.createInterface({
	input: fs.createReadStream(genesFile, { encoding: 'utf8' }),
	crlfDelay: Infinity
})

genesInt.on('line', line => {
	const lineFields = line.split('\t')
	const gene = lineFields[0]
	const isoform = lineFields[1]
	const isDefault = Number(lineFields[2])
	const annot = JSON.parse(lineFields[3])
	//Discard isoforms that are on minor chromosomes or contigs
	if (annot.chr.includes('_') || annot.chr === 'chrMT') {
		return
	}
	if (!(gene in genes)) {
		genes[gene] = Object.create(null)
	}
	//If the isoform has multiple entries, in which one is on the X chromosome and the other is on the Y chromosome, then choose the entry on the X chromosome.
	if (isoform in genes[gene]) {
		if (annot.chr === 'chrX' && genes[gene][isoform].chr === 'chrY') {
			genes[gene][isoform] = Object.create(null)
		} else if (annot.chr === 'chrY' && genes[gene][isoform].chr === 'chrX') {
			return
		} else {
			console.error('Error: ' + isoform + ' has multiple entries')
			return
		}
	}
	genes[gene][isoform] = Object.create(null)
	genes[gene][isoform]['default'] = isDefault
	genes[gene][isoform]['chr'] = annot.chr
	genes[gene][isoform]['start'] = Number(annot.start)
	genes[gene][isoform]['stop'] = Number(annot.stop)
	genes[gene][isoform]['length'] = Number(annot.stop) - Number(annot.start)
})

//For each gene, assign the coordinates of the default isoform to be the coordinates of the gene. If no default isoform is annotated, assign the coordinates of the longest isoform to be the coordinates of the gene.
console.log('name' + '\t' + 'chr' + '\t' + 'start' + '\t' + 'stop') // header
genesInt.on('close', () => {
	for (let gene in genes) {
		let defaultIsoform = ''
		let longestIsoform = ['', 0]
		for (let isoform in genes[gene]) {
			if (genes[gene][isoform]['default'] === 1) {
				defaultIsoform = isoform
				break
			} else {
				if (genes[gene][isoform]['length'] > longestIsoform[1]) {
					longestIsoform = [isoform, genes[gene][isoform]['length']]
				}
			}
		}
		//If no default isoform is annotated for the gene, then assign the longest isoform to be the default isoform
		if (defaultIsoform === '') {
			defaultIsoform = longestIsoform[0]
		}
		//Assign the coordinates of the default isoform to be the coordinates of the gene
		gene_chr = genes[gene][defaultIsoform]['chr']
		gene_start = genes[gene][defaultIsoform]['start']
		gene_stop = genes[gene][defaultIsoform]['stop']
		//Output the gene coordinates
		console.log(gene + '\t' + gene_chr + '\t' + gene_start + '\t' + gene_stop)
	}
})
