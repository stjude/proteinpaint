import * as client from './client'
import { debounce } from 'debounce'

export function gene_searchbox(p) {
	/*
make a <input> to search for gene names as you type into it
matching genes are shown beneath the input

.div
.width: 100px
.genome
.callback
.tip (optional)
.resultdiv (optional)

if .resultdiv is provided, show gene list inside <div>;
if .tip is provided, show under <input> to show matches;
otherwise to show in client.tip
*/
	// for auto gene column, show
	const input = p.div
		.append('input')
		.attr('placeholder', 'Search gene')
		.style('width', p.width || '100px')

	const printdiv = p.resultdiv || (p.tip ? p.tip.d : client.tip.d)

	function fold() {
		if (p.resultdiv) {
			p.resultdiv.selectAll('*').remove()
		} else if (p.tip) {
			p.tip.hide()
		} else {
			client.tip.hide()
		}
	}

	input.on('keyup', event => {
		const str = event.target.value
		if (str.length <= 1) {
			fold()
			return
		}

		if (client.keyupEnter(event)) {
			const hitgene = printdiv.select('.sja_menuoption')
			if (hitgene.size() > 0) {
				p.callback(hitgene.text())
				fold()
			}
			return
		}
		debouncer()
	})
	input.node().focus()

	function genesearch() {
		client
			.dofetch('genelookup', { genome: p.genome, input: input.property('value') })
			.then(data => {
				if (data.error) throw data.error
				if (!data.hits) throw '.hits[] missing'

				if (p.resultdiv) {
					p.resultdiv.selectAll('*').remove()
				} else if (p.tip) {
					p.tip.clear().showunder(input.node())
				} else {
					client.tip.clear().showunder(input.node())
				}

				for (const name of data.hits) {
					printdiv
						.append('div')
						.attr('class', 'sja_menuoption')
						.text(name)
						.on('click', () => {
							p.callback(name)
							fold()
						})
				}
			})
			.catch(err => {
				printdiv.append('div').text(err.message || err)
				if (err.stack) console.log(err.stack)
			})
	}
	const debouncer = debounce(genesearch, 300)
}

export function findgenemodel_bysymbol(genome, str) {
	return client
		.dofetch('genelookup', {
			deep: 1,
			input: str,
			genome: genome
		})
		.then(data => {
			if (data.error) throw data.error
			if (!data.gmlst || data.gmlst.length == 0) return null
			return data.gmlst
		})
}
