if (process.argv.length != 3) abort('<gft file> output bedj text to stdout')

function abort(m) {
	console.error(m)
	process.exit()
}

function tohash(str) {
	const h = {}
	for (const s of str.split('; ')) {
		const l = s.trim().split(' ')
		if (l.length != 2) abort('wrong field: ' + str)
		h[l[0]] = l[1].replace(/"/g, '')
	}
	return h
}

const isoforms = {}

function init_isoform(h, l) {
	const n = h.transcript_id
	if (!n) abort('no transcript_id: ' + l.join('\t'))
	if (!isoforms[n]) {
		isoforms[n] = {
			chr: l[0],
			name: h.gene_name || n,
			isoform: n,
			category: h.gene_type,
			strand: l[6],
			exon: [],
			utr: [],
			coding: []
		}
	}
	return isoforms[n]
}

const fs = require('fs')
const readline = require('readline')

const rl = readline.createInterface({ input: fs.createReadStream(process.argv[2], { encoding: 'utf8' }) })

let minusposcount = 0

rl.on('line', line => {
	if (line[0] == '#') return
	const l = line.split('\t')
	const start = Number.parseInt(l[3]) - 1
	const stop = Number.parseInt(l[4])
	if (Number.isNaN(start) || Number.isNaN(stop)) abort('invalid pos: ' + line)
	if (start < 0 || stop < 0) {
		minusposcount++
		return
	}

	const h = tohash(l[8])

	if (l[2] == 'exon') {
		const isoform = init_isoform(h, l)
		isoform.exon.push([start, stop])
		return
	}

	if (l[2] == 'CDS') {
		const isoform = init_isoform(h, l)
		isoform.coding.push([start, stop])
		return
	}

	if (l[2] == 'UTR') {
		const isoform = init_isoform(h, l)
		isoform.utr.push([start, stop])
		return
	}

	/* incorrect as it does not take strand into account
	if(l[2]=='stop_codon') {
		const isoform = init_isoform(h,l)
		isoform.codingstop = stop
		return
	}


	if(l[2]=='start_codon') {
		const isoform = init_isoform(h,l)
		isoform.codingstart = start
		return
	}
	*/
})

rl.on('close', () => {
	const categories = new Set()

	for (const n in isoforms) {
		const isoform = isoforms[n]

		if (isoform.exon.length == 0) {
			console.error('0 exon in ' + n)
			continue
		}

		if (isoform.category) categories.add(isoform.category)

		let start = (stop = isoform.exon[0][0])
		for (const e of isoform.exon) {
			start = Math.min(start, e[0])
			stop = Math.max(stop, e[1])
		}

		const forward = isoform.strand == '+'

		if (isoform.exon.length > 1) {
			isoform.intron = []

			if (forward) {
				isoform.exon.sort((a, b) => a[0] - b[0])
				for (let i = 0; i < isoform.exon.length - 1; i++) {
					isoform.intron.push([isoform.exon[i][1], isoform.exon[i + 1][0]])
				}
			} else {
				isoform.exon.sort((a, b) => b[0] - a[0])
				for (let i = 0; i < isoform.exon.length - 1; i++) {
					isoform.intron.push([isoform.exon[i + 1][1], isoform.exon[i][0]])
				}
			}
		}

		if (isoform.coding.length > 0) {
			isoform.codingstart = Math.min(...isoform.coding.map(i => i[0]))
			isoform.codingstop = Math.max(...isoform.coding.map(i => i[1]))

			if (isoform.utr.length) {
				const startcodon = forward ? isoform.codingstart : isoform.codingstop
				isoform.utr5 = []
				isoform.utr3 = []
				for (const e of isoform.utr) {
					if (forward) {
						if (e[0] < isoform.codingstart) {
							isoform.utr5.push(e)
						} else {
							isoform.utr3.push(e)
						}
					} else {
						if (e[1] > isoform.codingstart) {
							isoform.utr5.push(e)
						} else {
							isoform.utr3.push(e)
						}
					}
				}
			}
		} else {
			delete isoform.coding
		}

		delete isoform.utr

		const chr = isoform.chr
		delete isoform.chr

		console.log(chr + '\t' + start + '\t' + stop + '\t' + JSON.stringify(isoform))
	}

	console.error('categories: ' + [...categories].join(' '))
	console.error(minusposcount + ' rows dropped for minus start/stop')
})
