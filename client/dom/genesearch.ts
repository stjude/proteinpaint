import { keyupEnter, gmlst2loci } from '#src/client'
import { debounce } from 'debounce'
import { dofetch3 } from '#common/dofetch'
import { invalidcoord, string2pos } from '#src/coord'
import type { ClientGenome } from '../types/clientGenome'

/*
exports:

addGeneSearchbox()
string2variant()

typical usage:

	const arg={
		genome: <>,
		row: <>,
		callback: async ()=>{
			doAction(result)
		}
	}
	const result=addGeneSearchbox(arg)



TODO
-- need ci tests
-- allow to hide searchStat dom
-- dedup code with block.js
-- dedup code with app header
-- unify help message from gdc bam slicing ui and termsetting.snplst
*/

type GeneSearchBoxArg = {
	/** required. menu instance to show list of matching genes */
	tip: any
	/** required. d3 element in which <input> is created */
	row: any
	/** Optional. The default is 'Gene, position' */
	placeholder?: string
	/** 
	if 'gene':
		input can be symbol or alias
		result is {geneSymbol:str}, will not map to coord
		cannot map isoform to gene name!
		(later may need geneOrIsoform flag to query both) 
	if 'snp':
		user must select a single snp
		input can be dbSNP id, position, or variant format (chr.pos.ref.alt)
		allow to enter chr.pos.ref.alt or hgvs (see next section)
		otherwise, only allow chr:start-stop
	*/
	searchOnly?: 'gene' | 'snp'
	/** If true, user must click on search box and enter instead of automatically 
    focusing on search box. Use to render d3 animations smoothly. */
	focusOff?: boolean
	/**
	if no callback():
		any match is silently written to RESULT
		with repeated search the latest match is written to RESULT
		common pattern is that user will press a button to launch some logic that will check RESULT
		it's up to the calling code to decide when to access RESULT (e.g. pressing some button in caller's ui)
		usecase: block.tk.bam.gdc.js
	if has callback():
		upon a match, RESULT is updated and callback is triggered
		as a way to notify caller to do subsequent steps
		usecase: geneSearch4GDCmds3.js
		no parameter is supplied
	*/
	callback?: () => void
	/** optional
    triggered when the <input> is emptied. allows an app to de-select a gene in this way */
	emptyInputCallback?: () => void
	/** if true, hide the text msg on the right of <input> */
	hideHelp?: boolean
	/** optional
    read-only; this script should not try to modify it
    if allowVariant is false, value can only be {chr, start, stop}
    if allowVariant is true, value can also be {chr, pos, ref, alt, isVariant:true}
    set to {chr, start, stop} to fill default position into <input>
    when missing, just show placeholder */
	defaultCoord?: ResultArg
	/** required. client-side genome obj */
	genome: ClientGenome
	/** default gene name to fill into search box */
	geneSymbol?: string
	/** option to automatically trigger a search when a geneSymbol is specified */
	triggerSearch?: boolean
	/** option to hide the search input after search results are generated */
	hideInputBeforeCallback?: boolean
	/** option to disable the input, useful in demo mode */
	disableInput?: boolean
	/** if true, allow user to type in a sequence mutation
	partial support of hgvs https://varnomen.hgvs.org/recommendations/DNA/
	limited to substitution/insertion/deletion on "g."
	other references (o. m. c. n.) are not supported

	entered positions are 1-based, parse to 0-based (TODO: this needs to be verified)

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
	allowVariant?: boolean
}

/** "start/stop" are included when entered a coordinate or the coord is mapped from a gene/snp */
type GeneOrSNPResult = { start: number; stop: number; ref?: string; alt?: string[] | string }
/** "pos/ref/alt" are included when entered a variant */
type VariantResult = { pos: number; ref: string; alt: string; isVariant: boolean }
type ResultArg = (GeneOrSNPResult | VariantResult) & {
	/** is always included */
	chr: string
}

type Result = Partial<GeneOrSNPResult> &
	Partial<VariantResult> & { geneSymbol?: string; fromWhat?: string; chr?: string; searchbox?: any }

export const debounceDelay = 500

/*************************************
by calling addGeneSearchbox(), it redirectly returns a RESULT object detailed below without await
*/
export function addGeneSearchbox(arg: GeneSearchBoxArg) {
	const tip = arg.tip,
		row = arg.row
	const result: Result = {}

	if (arg?.searchOnly == 'snp' && !arg.genome.hasSNP) {
		row.append('span').text('Cannot support .searchOnly = "snp". Genome lacks SNP')
		return result
	}

	let placeholder: string,
		width = 150

	if ('placeholder' in arg) {
		placeholder = arg.placeholder!
	} else if (arg?.searchOnly == 'gene') {
		placeholder = 'Gene'
		width = 100 // use shorter width for inputting only one gene name
	} else {
		placeholder = arg?.searchOnly == 'snp' ? 'Position' : 'Gene, position'
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
		.property('disabled', arg.disableInput || false)
		.attr('class', 'sja_genesearchinput')
		.style('width', width + 'px')

	result.searchbox = searchbox

	searchbox
		.on('focus', event => {
			event.target.select()
		})
		.on('keyup', async event => {
			const input = event.target
			const v = input.value.trim()

			if (arg.emptyInputCallback && v.length == 0 && keyupEnter(event)) {
				// has such callback, should be triggered when <input> is emptied and hitting enter
				tip.hide()
				arg.emptyInputCallback()
				searchStat.word.text('')
				searchStat.mark.html('')
				return
			}

			if (v.length <= 1) return tip.hide()

			// typed 2 or more chars, prompt user to press enter to search
			searchStat.mark.html('')
			searchStat.word.style('font-size', '0.7em')
			if (arg.hideHelp) {
				// won't show prompt. must clear any old contents in word
				searchStat.word.text('')
			} else {
				// will show prompt and old contents are cleared
				searchStat.word.text('Press ENTER to search, ESC to cancel')
			}

			if (keyupEnter(event)) {
				// pressed enter

				// this call may repeat the last debounced checkInput using debouncer(),
				// but it's safer to call it again in case the Enter key was pressed after the debounceDelay
				// to ensure that the applicable /genelookup has finished before detecting/displaying errors.
				// In contrast, the previous Promise + setInterval + resolve detection is not reliable,
				// because there might not be a pending checkInput() call to reset the emptied currLookupValue.
				await checkInput()

				// try to parse as gene
				// get first gene match from menu
				if (arg?.searchOnly != 'snp') {
					const hitgene = tip.d.select(".sja_menuoption[isgene='1']")
					if (hitgene.size()) {
						// gene match
						const geneSymbol = hitgene.datum()
						if (arg.searchOnly == 'gene') {
							getResult({ geneSymbol }, geneSymbol)
							// hit is found. hide gene tip and blur input
							tip.hide()
							input.blur()
							// cancel debouncer to prevent repeating gene search and tip from showing up again
							debouncer.clear()
						} else {
							await geneCoordSearch(geneSymbol)
						}
						// must not clear tip, genes on multiple loci will show as further options
						return
					}
				}
				if (arg?.searchOnly == 'gene') {
					getResult(null, 'Gene not found')
					return
				}

				// try to parse as variant format (chr.pos.ref.alt)
				if (arg.allowVariant) {
					const variant = await string2variant(v, arg.genome)
					if (variant) {
						getResult(variant, v)
						return
					}
				}

				// try to parse as snp (i.e., dbsnp entry)
				// get first snp match from menu
				const hitsnp = tip.d.select(".sja_menuoption[issnp='1']")
				if (hitsnp.size()) {
					// snp match
					const hit = hitsnp.datum()
					getResult(
						{ chr: hit.chrom, start: hit.chromStart, stop: hit.chromEnd, ref: hit.ref, alt: hit.alt },
						hit.name || v
					)
					return
				}

				if (arg?.searchOnly == 'snp') {
					getResult(null, 'Variant not found')
					return
				}

				// try to parse as coord
				const pos = string2pos(v, arg.genome)
				if (pos) {
					getResult(pos, 'Valid coordinate')
					return
				}

				// no match
				getResult(null, 'No match')
				return
			}

			if (event.code == 'Escape') {
				// abandon changes to <input>
				tip.hide()
				if (result.chr) {
					getResult(result, result.fromWhat!)
				} else if (arg.defaultCoord) {
					const d = arg.defaultCoord as Result
					input.value = d.chr + (d.isVariant ? '.' + d.pos + '.' + d.ref + '.' + d.alt : ':' + d.start + '-' + d.stop)
				}
				input.blur()
				return
			}

			if (event.key == 'ArrowDown') {
				tip.d
					.selectAll('.sja_menuoption')
					.attr('tabindex', 0)
					.on('keyup', event => {
						if (event.key == 'Enter') {
							event.target.click()
						} else if (event.key == 'ArrowDown') {
							if (event.target.nextSibling) event.target.nextSibling.focus()
						} else if (event.key == 'ArrowUp') {
							if (event.target.previousSibling) event.target.previousSibling.focus()
						}
					})
				tip.d.select('.sja_menuoption').node().focus()
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
		word: row.append('span').style('margin-left', '5px').style('font-size', '.8em').style('opacity', 0.6)
	}

	async function checkInput() {
		// checking input format
		const v = searchbox.property('value').trim()
		if (!v) return
		tip.showunder(searchbox.node()).clear()

		// see if input is gene
		if (arg?.searchOnly != 'snp') {
			const gene = await dofetch3('genelookup', { body: { genome: arg.genome.name, input: v } })
			if (gene.error) throw gene.error
			if (gene.hits?.length) {
				tip.d
					.selectAll('div')
					.data(gene.hits)
					.join('div')
					.text(d => d)
					.attr('class', 'sja_menuoption')
					.style('border-radius', '0px')
					.attr('isgene', 1)
					.on('click', async (event, d) => {
						if (arg?.searchOnly == 'gene') {
							// finding gene only, got result
							getResult({ geneSymbol: d }, d)
							tip.hide()
						} else {
							// convert gene symbol to coord
							await geneCoordSearch(d)
						}
					})
				return
			}
		}

		if (arg?.searchOnly == 'gene') return

		// see if input is in variant format (chr.pos.ref.alt)
		if (arg.allowVariant) {
			const variant = await string2variant(v, arg.genome)
			if (variant) return
		}

		// see if input is dbsnp id
		const dbsnp = await dofetch3('snp', { body: { byName: true, genome: arg.genome.name, lst: [v] } })
		if (dbsnp.error) throw dbsnp.error
		if (dbsnp.results.length) {
			// display hits in menu
			displayVariantHits(tip, dbsnp.results)
			return
		}

		// see if input is coord
		const pos = string2pos(v, arg.genome, true)
		if (pos) {
			if (arg?.searchOnly == 'snp') {
				// only search for snps
				// query dbsnp for snps with matching positions
				// TODO: querying a position query where start=stop (e.g.,
				// chr1:3-3) is currently not supported, but it should be.
				// This should be supported when string2pos() is changed
				// to always output 0-based position/coordinate (see the
				// TODO below)
				if (!pos.actualposition?.len) return
				const chr = pos.chr
				const start = pos.actualposition.position - 1 // convert to 0-based // TODO: should change string2pos() to always output 0-based position/coordinate
				const stop = start + pos.actualposition.len
				const ranges = [{ start, stop }]
				const dbsnp = await dofetch3('snp', { body: { byCoord: true, genome: arg.genome.name, chr, ranges } })
				if (dbsnp.error) throw dbsnp.error
				if (dbsnp.results.length) {
					/* dbsnp hits found
					- hits will include variants whose coordinates overlap
					with, but may not match the query coordinates (e.g.,
					an indel will overlap with query coordinates, but its start coordinate may not match query start coordinate)
					- if query is for multiple bases (e.g., chr1:1-5), then
					display all hits
					- if query is for a single base (e.g., chr1:3 or
					chr1:3-4), then display hits whose start coordinate matches the query start coordinate*/
					const variants =
						pos.actualposition.len == 1 ? dbsnp.results.filter(hit => hit.chromStart == start) : dbsnp.results
					// display variants in menu
					displayVariantHits(tip, variants)
				}
			}
			return
		}
	}
	const debouncer = debounce(checkInput, debounceDelay)

	function displayVariantHits(tip, data) {
		tip.d
			.selectAll('div')
			.data(data)
			.join('div')
			.text(d => {
				const pos = `${d.chrom}:${d.chromStart + 1}`
				const alleles = `${d.ref}>${d.alt.join(',')}`
				return `${d.name} (${pos} ${alleles})`
			})
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.attr('issnp', 1)
			.on('click', (event, d) => {
				getResult({ chr: d.chrom, start: d.chromStart, stop: d.chromEnd, ref: d.ref, alt: d.alt }, d.name)
				tip.hide()
			})
	}

	async function geneCoordSearch(geneSymbol: string) {
		// geneSymbol is a valid gene symbol
		// retrieve its coordinates
		tip.hide()
		const data = await dofetch3('genelookup', { body: { genome: arg.genome.name, input: geneSymbol, deep: 1 } })
		if (data.error) throw data.error
		if (!data.gmlst?.length) throw 'cannot retrieve gene coordinates'
		const loci = gmlst2loci(data.gmlst)
		if (loci.length == 1) {
			// all isoforms are at the same locus
			getResult(loci[0], geneSymbol, geneSymbol)
			return
		}
		// isoforms are spread across multiple discontinuous loci
		tip.showunder(searchbox.node()).clear()
		tip.d
			.selectAll('div')
			.data(loci)
			.join('div')
			.attr('class', 'sja_menuoption')
			.style('border-radius', '0px')
			.text(d => d.name + ' ' + d.chr + ':' + d.start + '-' + d.stop)
			.on('click', (event, d) => {
				tip.hide()
				getResult(d, geneSymbol + ', ' + d.name, d.name)
			})
	}

	if (arg.defaultCoord) {
		const d = arg.defaultCoord as Result
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
	async function getResult(r: Partial<Result> | null, fromWhat: string, geneSymbol?: string) {
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
				if (r.ref) result.ref = r.ref
				if (r.alt) result.alt = r.alt
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
		// useful when user enters isoform accession and matches to genesymbol,
		// and wants to be able to refer back to which isoform was entered
		result.fromWhat = fromWhat

		if (r && arg.callback) {
			if (arg.hideInputBeforeCallback) {
				// hide this search box after getting the results
				searchbox.style('display', 'none') // hide input
				arg.row.selectAll(':scope>span').style('display', 'none') // hide input label, checkbox
			}
			// has valid result, trigger callback (no need to await?)
			await arg.callback()
		}
	}

	// need to capture arg.geneSymbol into another variable,
	// to pass type check and to have it is a "static" value when the timeout callback is called,
	// since using arg.geneSymbol directly is not guaranteed to have the same value after the timeout
	const geneSymbol = arg.geneSymbol || ''
	if (geneSymbol) {
		searchbox.property('value', geneSymbol)
		if (arg.triggerSearch)
			searchbox.node().dispatchEvent(
				new KeyboardEvent('keyup', {
					key: 'Enter',
					code: 'Enter',
					keyCode: 13, // deprecated but still widely used
					which: 13, // deprecated but still widely used
					bubbles: true, // important to allow the event to bubble up
					cancelable: true
				})
			)
		else setTimeout(() => getResult({ geneSymbol: arg.geneSymbol }, geneSymbol), 10)
	}

	return result //searchbox
}

export async function string2variant(v: string, genome: ClientGenome) {
	// try to parse as simple variant
	const variant = string2simpleVariant(v, genome)
	if (variant) {
		// is a simple variant, return
		return variant
	}
	// try to parse hgvs; if successful, return variant; otherwise return null as not a variant
	return await string2hgvs(v, genome)
}

function string2simpleVariant(v: string, genome: ClientGenome) {
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

async function string2hgvs(v: string, genome: ClientGenome) {
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

function hgvs_snv(chr: string, v: string) {
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

function hgvs_ins(chr: string, v: string) {
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

async function hgvs_del(chr: string, v: string, genome: ClientGenome) {
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
	//e.g. chr2:g.119955155_119955159del
	const [t1, t2] = tmppos.split('_')
	const start = Number(t1)
	const stop = t2 ? Number(t2) : start + 1
	if (!Number.isInteger(start) || !Number.isInteger(stop)) return
	const refAllele2 = await getRefAllele(chr, start, stop, genome)
	return {
		isVariant: true,
		chr,
		// pos, No variable to access??
		ref: refAllele2,
		alt: '-'
	}
}

async function hgvs_delins(chr: string, v: string, genome: ClientGenome) {
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

async function getRefAllele(chr: string, start: number, stop: number, genome: ClientGenome) {
	const body = {
		coord: chr + ':' + start + '-' + stop,
		genome: genome.name
	}
	const d = await dofetch3('ntseq', { body })
	return d.seq
}
