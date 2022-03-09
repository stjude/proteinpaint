import { keyupEnter, gmlst2loci } from '../client'
import { debounce } from 'debounce'
import { dofetch3 } from '../common/dofetch'
import { string2pos } from '../coord'

/*
some code duplication with block.js
uses result{} to remember previous hit

arg{}
.tip
.genome{}
.row
.defaultCoord{}
	set to {chr, start, stop} to fill default position into <input>
	when missing, just show placeholder
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
				// if input can be parsed as coord string (chr:pos or chr:start-stop), then no need to match with gene/snp
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
				if (arg.defaultCoord) {
					input.value = arg.defaultCoord.chr + ':' + arg.defaultCoord.start + '-' + arg.defaultCoord.stop
				} else if (result.chr) {
					getResult(result, result.fromWhat)
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

		// first, see if input is coord
		const pos = string2pos(v, arg.genome, true)
		if (pos) {
			// input is coordinate
			getResult(pos, 'Valid coordinate')
			return
		}

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
				getResult(loci[0], s)
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
						getResult(r, s + ', ' + r.name)
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
	// { chr, start, stop, fromWhat }

	if (arg.defaultCoord) {
		searchbox.property('value', arg.defaultCoord.chr + ':' + arg.defaultCoord.start + '-' + arg.defaultCoord.stop)
		result.chr = arg.defaultCoord.chr
		result.start = arg.defaultCoord.start
		result.stop = arg.defaultCoord.stop
	}

	function getResult(r, fromWhat) {
		// call to show a valid result, or error
		// if result is valid, provide r: {chr,start,stop} to show coord in <input>, also show &check;
		// if result is invalid, r is null, show &cross;
		// fromWhat is optional gene or snp name to show in search stat
		if (r) {
			searchbox.property('value', r.chr + ':' + r.start + '-' + r.stop)
			result.chr = r.chr
			result.start = r.start
			result.stop = r.stop
			result.fromWhat = fromWhat
			searchStat.mark.style('color', 'green').html('&check;')
		} else {
			searchStat.mark.style('color', 'red').html('&cross;')
		}
		searchStat.word.text(fromWhat || '')
	}

	return result //searchbox
}
