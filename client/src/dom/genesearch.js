import { keyupEnter, gmlst2loci } from '../client'
import { debounce } from 'debounce'
import { dofetch3 } from '../common/dofetch'
import { invalidcoord, string2pos } from '../coord'

/*

TODO
1. allow only searching by gene name, disable coorinput
   this allows to replace gene_searchbox() in client/src/gene.js
   use only shallow (not "deep") query to find gene symbol
   do not map gene to coord
2. dedup code with block.js

***********************************
function argument object {}

.tip
	required. menu instance to show list of matching genes

.genome{}
	required. client-side genome obj

.row
	required. d3 element in which <input> is created

.defaultCoord{}
	optional
	read-only; this script should not try to modify it
	if allowVariant is false, value can only be {chr, start, stop}
	if allowVariant is true, value can also be {chr, pos, ref, alt, isVariant:true}
	set to {chr, start, stop} to fill default position into <input>
	when missing, just show placeholder

.allowVariant: true
	optional
	if true, allow to enter chr.pos.ref.alt
	otherwise, only allow chr:start-stop
	support hgvs notations for substitution/insertion/deletion
		chr14:g.104780214C>T
		chr5:g.171410539_171410540insTCTG
		chr17:g.7673802delCGCACCTCAAAGCTGTTC

.callback()
	optional
	triggered when a valid hit is found, and has been written to returned result{} object

***********************************
result object returned by the function

.chr
	"chr" is always included
.start
.stop
	"start/stop" are included when entered a coordinate or the coord is mapped from a gene/snp
.geneSymbol

.pos
.ref
.alt
	"pos/ref/alt" are included when entered a variant
*/
export function addGeneSearchbox(arg) {
	const tip = arg.tip,
		row = arg.row

	const searchbox = row
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', 'Gene, position' + (arg.genome.hasSNP ? ', SNP' : ''))
		.style('width', '200px')
		.on('focus', () => {
			event.target.select()
		})
		.on('keyup', async () => {
			const input = event.target
			const v = input.value.trim()
			if (v.length <= 1) return tip.hide()

			// typed 2 or more chars, prompt user to press enter to search
			searchStat.mark.html('')
			searchStat.word.text('Press ENTER to search, ESC to cancel')

			if (keyupEnter()) {
				// pressed enter
				input.blur()
				tip.hide()

				// if input can be parsed as either variant or coord
				// then no need to match with gene/snp

				if (arg.allowVariant) {
					const variant = string2variant(v, arg.genome)
					if (variant) {
						getResult(variant, 'Valid variant')
						return
					}
				}

				const pos = string2pos(v, arg.genome)
				if (pos) {
					// input is coordinate
					getResult(pos, 'Valid coordinate')
					return
				}
				// input is not coord; see if tip is showing gene matches
				input.disabled = true
				const hitgene = tip.d.select('.sja_menuoption')
				if (hitgene.size() > 0 && hitgene.attr('isgene')) {
					// matched with some gene names, query the first one
					await geneCoordSearch(hitgene.text())
				} else {
					// directly search with input string for gene/snp match
					await geneCoordSearch(v)
				}
				input.disabled = false
				return
			}
			if (event.code == 'Escape') {
				// abandon changes to <input>
				tip.hide()
				if (result.chr) {
					getResult(result, result.fromWhat)
				} else if (arg.defaultCoord) {
					const d = arg.defaultCoord
					input.value = d.chr + (d.isVariant ? '.' + d.pos + '.' + d.ref + '.' + d.alt : ':' + d.start + '-' + d.stop)
				}
				input.blur()
				return
			}
			debouncer()
		})
	searchbox.node().focus()

	const searchStat = {
		mark: row.append('span').style('margin-left', '5px'),
		word: row
			.append('span')
			.style('margin-left', '5px')
			.style('font-size', '.8em')
			.style('opacity', 0.6)
	}

	async function inputIsCoordOrGenename() {
		// doing quick check only, no snp query
		// first check if input is coord; if so return and do not query for gene
		// otherwise, query for gene name match
		const v = searchbox.property('value').trim()
		if (!v) return

		if (arg.allowVariant) {
			const variant = string2variant(v, arg.genome)
			if (variant) {
				// is valid variant
				// do not write to result
				//getResult(variant, 'Valid variant')
				return
			}
		}

		// see if input is coord
		const pos = string2pos(v, arg.genome, true)
		if (pos) {
			// input is coordinate
			/*
			const r = { chr: pos.chr, start: pos.start, stop: pos.stop }
			if(pos.actualposition) {
				r.start = pos.actualposition.position
				r.stop = pos.actualposition.position+pos.actualposition.len
			}
			getResult(r, 'Valid coordinate')
			*/
			return
		}

		// input is neither variant or coord
		// query for gene

		tip.showunder(searchbox.node()).clear()
		try {
			const data = await dofetch3('genelookup', {
				method: 'POST',
				body: JSON.stringify({ genome: arg.genome.name, input: v })
			})
			if (data.error) throw data.error
			if (!data.hits || data.hits.length == 0) return tip.hide()
			for (const s of data.hits) {
				tip.d
					.append('div')
					.text(s)
					.attr('class', 'sja_menuoption')
					.attr('isgene', 1)
					.on('click', () => {
						geneCoordSearch(s)
					})
			}
		} catch (e) {
			tip.d.append('div').text(e.message || e)
		}
	}
	const debouncer = debounce(inputIsCoordOrGenename, 500)

	async function geneCoordSearch(s) {
		tip.hide()
		try {
			const data = await dofetch3('genelookup', {
				method: 'POST',
				body: JSON.stringify({ genome: arg.genome.name, input: s, deep: 1 })
			})
			if (data.error) throw data.error
			if (!data.gmlst || data.gmlst.length == 0) {
				// no match to gene
				if (arg.genome.hasSNP) {
					if (s.toLowerCase().startsWith('rs')) {
						// genome has snp and input looks like a snp
						await searchSNP(s)
					} else {
						getResult(null, 'Not a gene or SNP')
					}
				} else {
					getResult(null, 'No match to gene name')
				}
				return
			}
			// matches with some isoforms
			const loci = gmlst2loci(data.gmlst)
			if (loci.length == 1) {
				// all isoforms are at the same locus
				// in case searched by isoform, check gmlst[0].name as gene name instead
				const geneSymbol = data.gmlst[0].name || s
				getResult(loci[0], s, geneSymbol)
				return
			}
			// isoform are spread across multiple discontinuous loci
			tip.showunder(searchbox.node()).clear()
			for (const r of loci) {
				tip.d
					.append('div')
					.attr('class', 'sja_menuoption')
					.text(r.name + ' ' + r.chr + ':' + r.start + '-' + r.stop)
					.on('click', () => {
						tip.hide()
						getResult(r, s + ', ' + r.name, r.name)
					})
			}
		} catch (e) {
			getResult(null, e.message || e)
		}
	}

	async function searchSNP(s) {
		const data = await dofetch3('snp', {
			method: 'POST',
			body: JSON.stringify({ byName: true, genome: arg.genome.name, lst: [s] })
		})
		if (data.error) throw data.error
		if (!data.results || data.results.length == 0) throw 'Not a gene or SNP'
		const r = data.results[0]
		getResult({ chr: r.chrom, start: r.chromStart, stop: r.chromEnd }, s)
	}

	const result = {}

	if (arg.defaultCoord) {
		const d = arg.defaultCoord
		if (d.isVariant) {
			searchbox.property('value', d.chr + '.' + d.pos + '.' + d.ref + '.' + d.alt)
			result.pos = d.pos
			result.ref = d.ref
			result.alt = d.alt
		} else {
			searchbox.property('value', d.chr + ':' + d.start + '-' + d.stop)
			result.start = d.start
			result.stop = d.stop
		}
		result.chr = d.chr
	}

	/* call to show a valid result, or error
	if result is valid, provide r: {chr,start,stop} to show coord in <input>, also show &check;
	if result is invalid, r is null, show &cross;
	fromWhat is optional gene or snp name to show in search stat
	*/
	async function getResult(r, fromWhat, geneSymbol) {
		if (r) {
			// got hit (coord or variant), clear result{}
			for (const k in result) delete result[k]
			if (r.isVariant) {
				// do not update searchbox
				result.chr = r.chr
				result.pos = r.pos
				result.ref = r.ref
				result.alt = r.alt
			} else {
				// is coord, maybe from gene
				searchbox.property('value', r.chr + ':' + r.start + '-' + r.stop)
				result.chr = r.chr
				result.start = r.start
				result.stop = r.stop
			}
			searchStat.mark.style('color', 'green').html('&check;')

			if (geneSymbol) {
				// tell caller they found a gene
				result.geneSymbol = geneSymbol
			}

			if (arg.callback) await arg.callback()
		} else {
			// no hit
			searchStat.mark.style('color', 'red').html('&cross;')
		}
		searchStat.word.text(fromWhat || '')
	}

	return result //searchbox
}

function string2variant(v, genome) {
	const tmp = v.split('.')
	if (tmp.length != 4) return
	const chr = tmp[0]
	const pos = Number(tmp[1])
	const e = invalidcoord(genome, chr, pos, pos)
	if (e) return
	return {
		isVariant: true,
		chr,
		pos,
		ref: tmp[2],
		alt: tmp[3]
	}
}
