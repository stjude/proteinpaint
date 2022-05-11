if (process.argv.length != 4) {
	console.log('<wgEncodeGencodeAttrsV36.txt> <isoform_overrides_uniprot> output to stdout')
	process.exit()
}

const fs = require('fs')

const gencodefile = process.argv[2],
	isoformOverride = process.argv[3]

/* from wgEncodeGencodeAttrsV36, read ENSG to symbol mapping
later for outputting ENSG to gdc-defined canonical ENST
*/
const symbol2ensg = new Map()
// k: symbol, v: ENSG
for (const line of fs
	.readFileSync(gencodefile, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	const l = line.split('\t')
	const ensg = l[0].split('.')[0]
	const symbol = l[1]
	symbol2ensg.set(symbol, ensg)
}

/* from GDC override, output HUGO symbol to ENST mapping
for each symbol, if matching ENSG is found, output ENSG to ENST mapping

#enst_id	gene_name	refseq_id	ccds_id
ENST00000263100	A1BG	NM_130786.3	CCDS12976.1
*/
let isfirst = true
for (const line of fs
	.readFileSync(isoformOverride, { encoding: 'utf8' })
	.trim()
	.split('\n')) {
	if (isfirst) {
		isfirst = false
		continue
	}
	const [enst, symbol] = line.split('\t')
	console.log(symbol + '\t' + enst)
	const ensg = symbol2ensg.get(symbol)
	if (ensg) console.log(ensg + '\t' + enst)
}
