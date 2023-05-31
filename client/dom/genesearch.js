import { keyupEnter, gmlst2loci } from '#src/client'
import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import { invalidcoord, string2pos } from '#src/coord'

/*
*********************************** EXPORT
addGeneSearchbox()
string2variant()


TODO
-- allow to hide searchStat dom
-- dedup code with block.js
-- dedup code with app header
-- unify help message from gdc bam slicing ui and termsetting.snplst

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

.geneOnly: true
	optional
	if true, search for gene name only
	input can be symbol or alias
	result is {geneSymbol:str}, will not map to coord
	cannot map isoform to gene name!
	(later may need geneOrIsoform flag to query both)

.geneSymbol: str
	default gene name to fill into search box

.allowVariant: true
	if true, allow to enter chr.pos.ref.alt or hgvs (see next section)
	otherwise, only allow chr:start-stop

.focusOff: true
	optional
	If true, user must click on search box and enter instead of automatically 
	focusing on search box. Use to render d3 animations smoothly.

.callback()
	optional
	triggered when a valid hit is found, and has been written to RESULT object (see below)
	no parameter is supplied

.hideHelp: true
	if true, hide the text msg on the right of <input>

***********************************
by calling addGeneSearchbox(), it redirectly returns a RESULT object detailed below without await

RESULT{}
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

***********************************
if arg.callback() is not provided:
	any match is silently written to RESULT
	with repeated search the latest match is written to RESULT
	common pattern is that user will press a button to launch some logic that will check RESULT
	it's up to the calling code to decide when to access RESULT (e.g. pressing some button in caller's ui)
	usecase: block.tk.bam.gdc.js

if arg.callback() is provided:
	upon a match, RESULT is updated and callback is triggered
	as a way to notify caller to do subsequent steps
	usecase: geneSearch4GDCmds3.js


***********************************
partial support of hgvs https://varnomen.hgvs.org/recommendations/DNA/

limited to substitution/insertion/deletion on "g."
other references (o. m. c. n.) are not supported

entered positions are 1-based, parse to 0-based

snv
	given chr14:g.104780214C>T
	parse to chr14.104780214.C.T

mnv
	given chr2:g.119955155_119955159delinsTTTTT
	parse to chr2.119955155.AGCTG.TTTTT
	must query ref allele

deletion
	chr17:g.7673802delCGCACCTCAAAGCTGTTC
	parse to chr17.7673802.CGCACCTCAAAGCTGTTC.-

	chr?:g.33344591del
	parse to chr?.33344591.A.-
	must query ref allele

	if allele is present after "del", will use the allele
	otherwise decide by position/range
	https://varnomen.hgvs.org/recommendations/DNA/variant/deletion/

insertion
	chr5:g.171410539_171410540insTCTG
	parse to chr5.171410539.-.TCTG
*/

export function addGeneSearchbox(arg) {
	const tip = arg.tip,
		row = arg.row

	let placeholder,
		width = 150
	if (arg.geneOnly) {
		placeholder = 'Gene'
		width = 100 // use shorter width for inputting only one gene name
	} else {
		placeholder = 'Gene, position'
		if (arg.genome.hasSNP) {
			placeholder += ', dbSNP'
			width += 40
		}
		if (arg.allowVariant) {
			placeholder += ', variant'
			width += 40
		}
	}

	const searchbox = row
		.append('input')
		.attr('type', 'text')
		.attr('placeholder', placeholder)
		.attr('aria-label', 'Gene symbol, position, or alias')
		.attr('class', 'sja_genesearchinput')
		.style('width', width + 'px')
		.on('focus', event => {
			event.target.select()
		})
		.on('keyup', async event => {
			const input = event.target
			const v = input.value.trim()
			if (v.length <= 1) return tip.hide()

			// typed 2 or more chars, prompt user to press enter to search
			searchStat.mark.html('')
			searchStat.word.style('font-size', '0.7em')
			if (!arg.hideHelp) searchStat.word.text('Press ENTER to search, ESC to cancel')

			if (keyupEnter(event)) {
				// pressed enter
				input.blur()
				tip.hide()

				if (arg.geneOnly) {
					// searching gene only, yield result here
					const hitgene = tip.d.select('.sja_menuoption')
					if (hitgene.size() > 0 && hitgene.attr('isgene')) {
						// matched with gene names, use the first one
						const geneSymbol = hitgene.text()
						getResult({ geneSymbol }, v)
					} else {
						// err
						getResult(null, 'not a gene')
					}
					return
				}

				// if input can be parsed as either variant or coord
				// then no need to match with gene/snp

				if (arg.allowVariant) {
					const variant = await string2variant(v, arg.genome)
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
	// focusOff fix for jerky (unsmooth) app drawer sliding.
	// App drawer slide animation very jerky when .focus() is applied to any
	// input box. Set focusOff: true to smoothly execute animations.
	if (!arg.focusOff) searchbox.node().focus()

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
			const variant = await string2variant(v, arg.genome)
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
					.style('border-radius', '0px')
					.attr('isgene', 1)
					.on('click', () => {
						if (arg.geneOnly) {
							// finding gene only, got result
							getResult({ geneSymbol: s }, s)
							tip.hide()
						} else {
							// convert gene symbol to coord
							geneCoordSearch(s)
						}
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
					.style('border-radius', '0px')
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
			} else if (r.chr) {
				// is coord
				searchbox.property('value', r.chr + ':' + r.start + '-' + r.stop)
				result.chr = r.chr
				result.start = r.start
				result.stop = r.stop
			} else if (r.geneSymbol) {
				// is only a gene symbol
				searchbox.property('value', r.geneSymbol)
				result.geneSymbol = r.geneSymbol
			}

			searchStat.mark.style('color', 'green').html('&check;')

			if (geneSymbol) {
				// tell caller they found a gene
				result.geneSymbol = geneSymbol
			}
		} else {
			// no hit
			searchStat.mark.style('color', 'red').html('&cross;')
		}
		searchStat.word.text(fromWhat || '')

		// fromWhat is the original search string. pass it to caller as extra piece of info
		// useful when user enters isoform accession and matches to genesymbol, and wants to be able to refer back to which isoform was entered
		result.fromWhat = fromWhat

		if (r && arg.callback) {
			// has valid result, trigger callback (no need to await?)
			await arg.callback()
		}
	}

	if (arg.geneSymbol) {
		searchbox.property('value', arg.geneSymbol)
		setTimeout(() => getResult({ geneSymbol: arg.geneSymbol }, arg.geneSymbol), 10)
	}

	return result //searchbox
}

export async function string2variant(v, genome) {
	// try to parse as simple variant
	const variant = string2simpleVariant(v, genome)
	if (variant) {
		// is a simple variant, return
		return variant
	}
	// try to parse hgvs; if successful, return variant; otherwise return null as not a variant
	return await string2hgvs(v, genome)
}

function string2simpleVariant(v, genome) {
	// format: chr.pos.ref.alt
	// this format has conflict with hgvs e.g. NG_012232.1(NM_004006.2):c.93+1G>T
	// which is in fact not currently supported by this code
	// if it fails, return false and parse as hgvs next
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

async function string2hgvs(v, genome) {
	const tmp = v.split(':g.')
	if (tmp.length != 2) {
		// only supports "g." linear genomic reference. other ref types are not supported for now
		return
	}
	const chr = tmp[0]

	// if 'delins' is present, it can only be parsed as mnv (substitution)
	if (tmp[1].includes('delins')) {
		return await hgvs_delins(chr, tmp[1], genome)
	}
	// if 'delins' is absent but 'del' is found, can only be parsed as deletion
	if (tmp[1].includes('del')) {
		return await hgvs_del(chr, tmp[1], genome)
	}
	// if 'delins, del' are absent and 'ins' is found, can only be parsed as insertion
	if (tmp[1].includes('ins')) {
		return hgvs_ins(chr, tmp[1])
	}
	// 'delins, del, ins' are all absent. can only be parsed as snv
	return hgvs_snv(chr, tmp[1])
}

function hgvs_snv(chr, v) {
	// v: 104780214C>T
	const tmp = v.match(/^(\d+)([ATCG])>([ATCG])$/)
	if (!tmp || tmp.length != 4) {
		// not matching the required snv pattern
		return
	}
	// tmp: ['104780214C>T', '104780214', 'C', 'T']
	const pos = Number(tmp[1])
	if (!Number.isInteger(pos)) return
	return {
		isVariant: true,
		chr,
		pos,
		ref: tmp[2],
		alt: tmp[3]
	}
}

function hgvs_ins(chr, v) {
	// chr5:g.171410539_171410540insTCTG
	const [tmppos, altAllele] = v.split('ins')
	if (!altAllele) return
	const pos = Number(tmppos.split('_')[0])
	if (!Number.isInteger(pos)) return
	return {
		isVariant: true,
		chr,
		pos: pos + 1, // "pos1_pos2" from hgvs string means insertion between the two nucleotides
		// should use pos2 when ref allele is missing
		ref: '-',
		alt: altAllele
	}
}

async function hgvs_del(chr, v, genome) {
	//chr17:g.7673802delCGCACCTCAAAGCTGTTC
	const [tmppos, refAllele] = v.split('del')
	if (refAllele) {
		// deleted ref nt is given, simply parse position and done
		const pos = Number(tmppos.split('_')[0])
		if (!Number.isInteger(pos)) return
		return {
			isVariant: true,
			chr,
			pos,
			ref: refAllele,
			alt: '-'
		}
	}
	// deleted ref nt is not given. this info is coded in tmppos, either "333" or "333_334"
	// TODO to be tested!!!
	const [t1, t2] = tmppos.split('_')
	const start = Number(t1)
	const stop = t2 ? Number(t2) : start + 1
	if (!Number.isInteger(start) || !Number.isInteger(stop)) return
	const refAllele2 = await getRefAllele(chr, start, stop, genome)
	return {
		isVariant: true,
		chr,
		pos,
		ref: refAllele2,
		alt: '-'
	}
}

async function hgvs_delins(chr, v, genome) {
	// chr2:g.119955155_119955159delinsTTTTT
	const tmp = v.match(/^(\d+)_(\d+)delins([ATCG]+)$/)
	if (!tmp || tmp.length != 4) {
		// does not match with expected format
		return
	}
	const p1 = Number(tmp[1]),
		p2 = Number(tmp[2]),
		altAllele = tmp[3]
	if (!Number.isInteger(p1) || !Number.isInteger(p2)) return
	const refAllele = await getRefAllele(chr, p1, p2, genome)
	return {
		isVariant: true,
		chr,
		pos: p1,
		ref: refAllele,
		alt: altAllele
	}
}

async function getRefAllele(chr, start, stop, genome) {
	const arg = {
		coord: chr + ':' + start + '-' + stop,
		genome: genome.name
	}
	const d = await dofetch3('ntseq', { method: 'POST', body: JSON.stringify(arg) })
	return d.seq
}
