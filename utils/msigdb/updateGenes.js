if (process.argv.length != 7) {
	console.log(
		'<term2genes> <human.genealias> <wgEncodeGencodeAttrsV?.txt> <knownCanonicalGenecode.txt> <refseq.canonical> output to stdout'
	)
	process.exit()
}

const fs = require('fs'),
	readline = require('readline')

const file_term2genes = process.argv[2],
	file_humangenealias = process.argv[3],
	file_wgEncodeGencodeAttrs = process.argv[4],
	file_knownCanonicalGenecode = process.argv[5],
	file_refseqcanonical = process.argv[6]

const alias2symbol = get_alias2symbol(),
	[symbol2ensg, ensg2symbol] = get_symbol2ensg(),
	ensg2enst = get_ensg2enst(),
	symbol2refseq = get_refseqcanonical()

updateTerm2genes()

/////////////////////////////// helpers

function get_alias2symbol() {
	const map = new Map() // k: alias, v: symbol
	for (const line of fs
		.readFileSync(file_humangenealias, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		map.set(l[0], l[1])
	}
	return map
}

function get_symbol2ensg() {
	const symbol2ensg = new Map() // k: symbol, v: ENSG
	const ensg2symbol = new Map() // k: ENSG, v: symbol
	for (const line of fs
		.readFileSync(file_wgEncodeGencodeAttrs, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		if (!l[0].startsWith('ENSG')) throw 'not starting with ENSG'
		const ensg = l[0].split('.')[0]
		const symbol = l[1]

		if (!symbol) continue

		// lncRNA genes e.g. ENSG00000269155 will have ENSG name at 2nd column
		//if (symbol.startsWith('ENSG')) continue

		symbol2ensg.set(symbol, ensg)
		ensg2symbol.set(ensg, symbol)
	}
	return [symbol2ensg, ensg2symbol]
}

function get_ensg2enst() {
	const map = new Map() // k: ensg, v: canonical enst
	for (const line of fs
		.readFileSync(file_knownCanonicalGenecode, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		if (!l[4].startsWith('ENST')) throw 'not ENST'
		if (!l[5].startsWith('ENSG')) throw 'not ENSG'
		map.set(l[5].split('.')[0], l[4].split('.')[0])
	}
	return map
}

function get_refseqcanonical() {
	const map = new Map() // k: symbol, v: canonical refseq
	for (const line of fs
		.readFileSync(file_refseqcanonical, { encoding: 'utf8' })
		.trim()
		.split('\n')) {
		const l = line.split('\t')
		map.set(l[0], l[1])
	}
	return map
}

function updateTerm2genes() {
	const rl = readline.createInterface({ input: fs.createReadStream(file_term2genes) })
	rl.on('line', line => {
		const l = line.split('\t')
		const genesetName = l[0]
		const genes = [] // array of parsed genes from this geneset
		for (const name of l[1].split(',')) {
			// for this name, find if it is valid symbol, or alias that can map to a symbol
			let symbol

			if (symbol2ensg.has(name)) {
				// is valid symbol
				// assuming that all valid gene symbols will have matching ENSG
				symbol = name
			} else if (alias2symbol.has(name)) {
				// is alias that maps to a symbol
				symbol = alias2symbol.get(name)
			} else if (ensg2symbol.has(name)) {
				// is ensg and maps back to its symbol
				symbol = ensg2symbol.get(name)
			} else {
				console.error('gene name without a match:', name)
				continue
			}

			const gene = {
				symbol,
				ensg: symbol2ensg.get(symbol)
			}

			if (ensg2enst.has(gene.ensg)) {
				gene.enstCanonical = ensg2enst.get(gene.ensg)
			}

			if (symbol2refseq.has(symbol)) {
				gene.refseqCanonical = symbol2refseq.get(symbol)
			}

			genes.push(gene)
		}

		console.log(`${genesetName}\t${JSON.stringify(genes)}`)
	})
}
