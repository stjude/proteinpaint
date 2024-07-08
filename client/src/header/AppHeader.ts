import { first_genetrack_tolist } from '#common/1stGenetk'
import { InputSearch } from '../../dom/search.ts'
import { searchItems } from './omniSearch.js'
import { newSandboxDiv } from '../../dom/sandbox.ts'
import { appDrawerInit } from '../../appdrawer/app.js'
import { rgb as d3rgb } from 'd3-color'
import * as common from '../../shared/common.js'
import { Menu } from '../../dom/menu.js'
import * as client from '../client'
import { dofetch3 } from '#common/dofetch'

type AppHeaderOpts = {
	headtip: Menu
	app: any
	/** server returned data */
	data: any
	/** token */
	jwt: any
}

export class AppHeader {
	headtip: Menu
	app: any
	data: any
	jwt: any
	publications: any
	static help = [
		/** Used in both the Help button and omni search */
		{
			label: 'Embed in your website',
			link: 'https://github.com/stjude/proteinpaint/wiki/Embedding'
		},
		{
			label: 'URL parameters',
			link: 'https://github.com/stjude/proteinpaint/wiki/URL-parameters'
		},
		{
			label: 'All tutorials',
			link: 'https://github.com/stjude/proteinpaint/wiki/'
		},
		{
			label: 'User community',
			link: 'https://groups.google.com/g/proteinpaint'
		},
		{
			label: 'License ProteinPaint',
			link: 'https://www.stjude.org/research/why-st-jude/shared-resources/technology-licensing/technologies/proteinpaint-web-application-for-visualizing-genomic-data-sj-15-0021.html',
			onlySearch: true
		},
		{
			label: 'Our Team',
			link: 'https://proteinpaint.stjude.org/team/',
			onlySearch: true
		}
	]

	constructor(opts: AppHeaderOpts) {
		this.headtip = opts.headtip
		this.app = opts.app
		this.data = opts.data
		this.jwt = opts.jwt
	}

	async createPublicationsList(app) {
		const re = await dofetch3(app.cardsPath + '/citations.json')
		if (re.error) console.error(`Problem retrieving ../cards/citations.json`)
		this.publications = re.publications
	}

	async makeheader() {
		await this.createPublicationsList(this.app)

		const color = d3rgb(common.defaultcolor)
		const padw_lg = '13px'
		const padw_input = '5px 10px'
		const padw_sm = '7px 10px'
		const doc_width = document.documentElement.clientWidth
		// head
		const row = this.app.holder
			.append('div')
			.style('white-space', 'nowrap')
			.style(
				'border-bottom',
				doc_width > 1600 ? 'solid 1px rgba(' + color.r + ',' + color.g + ',' + color.b + ',.3)' : ''
			)

		const headbox = row
			.append('div')
			.style('margin', '10px')
			.style('padding', '8px')
			.style('padding-bottom', '12px')
			.style('display', doc_width < 1600 ? 'block' : 'inline-block')
			.style(
				'border-bottom',
				doc_width < 1600 ? 'solid 1px rgba(' + color.r + ',' + color.g + ',' + color.b + ',.3)' : ''
			)

		// .style('border-radius', '5px')
		// .style('background-color', 'rgba(' + color.r + ',' + color.g + ',' + color.b + ',.1)')
		const headinfo = row
			.append('div')
			.style('display', 'inline-block')
			.style('padding', padw_sm)
			.style('padding-left', '25px')
			.style('font-size', '.8em')
			.style('color', d3rgb(common.defaultcolor).darker())

		{
			// a row for server stats
			const row = headinfo.append('div').style('padding-left', '15px')
			row
				.append('span')
				.text(
					'Code updated: ' + (this.data.codedate || '??') + ', server launched: ' + (this.data.launchdate || '??') + '.'
				)
			if (this.data.hasblat) {
				row
					.append('a')
					.style('margin-left', '10px')
					.text('Running BLAT')
					.on('click', async event => {
						this.headtip.clear().showunder(event.target)
						const div = this.headtip.d.append('div').style('margin', '10px')
						const wait = div.append('div').text('Loading...')
						try {
							const data = await client.dofetch2('blat?serverstat=1')
							if (data.error) throw data.error
							if (!data.lst) throw 'invalid response'
							wait.remove()
							for (const i of data.lst) {
								div.append('div').text(i)
							}
						} catch (e: any) {
							wait.text(e.message || e)
							if (e.stack) console.error(e.stack)
						}
					})
			}
		}
		if (this.data.headermessage) {
			headinfo.append('div').html(this.data.headermessage)
		}

		// 1
		headbox
			.append('div')
			.text('ProteinPaint')
			.style('display', 'inline-block')
			.style('padding', padw_lg)
			.style('color', common.defaultcolor)
			.style('font-size', '1.3em')
			.style('font-weight', 'bold')

		// 2, search box
		const tip = new Menu({ border: '', padding: '0px' })

		const omniSearch = new InputSearch({
			holder: headbox,
			tip,
			style: {
				padding: padw_sm,
				border: `'solid 1px ${common.defaultcolor}`
			},
			size: 32,
			placeholder: 'Gene, position, SNP, app, or dataset',
			title: 'Search by gene, SNP, position, app, or dataset',
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			searchItems: async () => {
				return await searchItems(this.app, this.headtip, AppHeader.help, this.publications, this.jwt)
			}
		})

		omniSearch.initUI()

		const genome_select_div = headbox.append('div').attr('class', 'sjpp-genome-select-div').style('padding', padw_sm)

		const get_placeholder = () => {
			const currG = this.app.genomes[this.app.selectgenome.property('value')]
			/** Defaults */
			const opts2Show = ['Gene', 'position', 'app']
			/** Show all the genomic options together */
			if (currG.hasSNP) opts2Show.splice(2, 0, 'SNP')
			if (Object.keys(currG.datasets).length) opts2Show.push('dataset')
			const str = opts2Show.join(', ').replace(/,(?=[^,]*$)/, ', or')
			return str
		}

		this.app.selectgenome = genome_select_div
			.append('select')
			.attr('title', 'Select a genome')
			.attr('class', 'sjpp-genome-select')
			.style('padding', padw_input)
			.style('border', 'solid 1px ' + common.defaultcolor)
			.on('change', () => {
				this.update_genome_browser_btn(this.app)
				omniSearch.updatePlaceholder(get_placeholder())
			})

		for (const n in this.app.genomes) {
			this.app.selectgenome
				.append('option')
				.attr('n', n)
				.text(this.app.genomes[n].species + ' ' + n)
				.property('value', n)
		}
		this.app.genome_browser_btn = this.make_genome_browser_btn(this.app, headbox, this.jwt)

		this.app.drawer = await appDrawerInit({
			holder: this.app.holder,
			genomes: this.app.genomes,
			drawerRow: this.app.holder
				.append('div')
				.style('position', 'relative')
				.style('overflow-x', 'visible')
				.style('overflow-y', 'hidden')
				.classed('sjpp-drawer-row', true),
			sandboxDiv: this.app.holder.append('div').style('margin-top', '15px').classed('sjpp-drawer-sandbox', true),
			genome_browser_btn: this.app.genome_browser_btn,
			debugmode: this.app.debugmode,
			headbox,
			padw_sm,
			cardsPath: this.app.cardsPath
		})

		//Help button
		headbox
			.append('span')
			.classed('sja_menuoption', true)
			.style('padding', padw_sm)
			.text('Help')
			.on('click', async event => {
				const p = event.target.getBoundingClientRect()
				const div = this.headtip.clear().show(p.left - 0, p.top + p.height + 5)

				await div.d
					.append('div')
					.style('padding', '5px 20px')
					.selectAll('p')
					.data(AppHeader.help.filter(d => !d.onlySearch))
					.enter()
					.append('p')
					.html(d => `<a href=${d.link} target=_blank>${d.label}</a>`)
			})

		//Publications button
		headbox
			.append('span')
			.classed('sja_menuoption', true)
			.style('padding', padw_sm)
			.style('margin', '0px 5px')
			.text('Publications')
			.on('click', async event => {
				const p = event.target.getBoundingClientRect()
				const div = this.headtip.clear().show(p.left - 0, p.top + p.height + 5)

				await div.d
					.append('div')
					.style('padding', '5px 20px')
					.selectAll('p')
					.data(this.publications)
					.enter()
					.append('p')
					.html((d: any) => `<a href=${d.doi} target=_blank>${d.title}</a>`)
			})
	}

	make_genome_browser_btn(app, headbox, jwt) {
		const padw = '8px'
		const genome_btn_div = headbox.append('span')
		const genomename = app.selectgenome.node().options[app.selectgenome.property('selectedIndex')].value

		const g_browser_btn = genome_btn_div
			.attr('class', 'sja_menuoption')
			.attr('id', 'genome_btn')
			.style('padding', padw)
			.datum(genomename)
			.text(genomename + ' genome browser')
			.on('click', () => {
				const g = app.genomes[genomename]
				if (!g) {
					alert('Invalid genome name: ' + genomename)
					return
				}
				const sandbox_div = newSandboxDiv(app.drawer.opts.sandboxDiv)
				sandbox_div.header.text(genomename + ' genome browser')

				const par = {
					hostURL: app.hostURL,
					jwt,
					holder: sandbox_div.body,
					genome: g,
					chr: g.defaultcoord.chr,
					start: g.defaultcoord.start,
					stop: g.defaultcoord.stop,
					nobox: true,
					tklst: [],
					debugmode: app.debugmode
				}
				first_genetrack_tolist(g, par.tklst)

				import('../block.js').then(b => new b.Block(par))
				app.drawer.dispatch({ type: 'is_apps_btn_active', value: false })
			})
		return g_browser_btn
	}

	update_genome_browser_btn(app) {
		app.genome_browser_btn.text(app.selectgenome.node().value + ' genome browser')
		app.genome_browser_btn.datum(app.selectgenome.node().value)
	}
}
