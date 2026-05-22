import { PlotBase } from './PlotBase.ts'
import { getCompInit, copyMerge, type ComponentApi, type RxComponent } from '#rx'
import { NumericModes } from '#shared/terms.js'
import { sayerror, Tabs, Menu, table2col } from '#dom'
import { TermTypeGroups } from '#shared/common.js'
import { getDefaultVolcanoSettings } from './volcano/settings/defaults.ts'
import { getDefaultGseaSettings } from './gsea.js'
import { dofetch3 } from '#common/dofetch'
import { PROTEOME_DAP, type ProteomeDetails } from '#types'

export class ProteomeInput extends PlotBase implements RxComponent {
	static type = 'ProteomeInput'

	type: string
	dom!: { [index: string]: any }
	tabs!: any

	constructor(opts: any, api: ComponentApi) {
		super(opts, api)
		this.type = ProteomeInput.type
		this.opts = opts
		this.components = {}
	}

	getState(appState: any) {
		const config = appState.plots.find((p: any) => p.id === this.id)
		if (!config) {
			throw `No plot with id='${this.id}' found. Did you set this.id before this.api = getComponentApi(this)?`
		}
		return {
			config,
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig
		}
	}

	async init(appState: any) {
		const state = this.getState(appState)
		const proteomeDetails: ProteomeDetails = state.config.proteomeDetails
		const { organism, assay, cohort } = proteomeDetails
		const organisms = state.termdbConfig?.queries?.proteome?.organisms || {}
		const cohortConfig = organisms[organism]?.assays?.[assay]?.cohorts?.[cohort]

		this.dom = this.initDom(proteomeDetails)

		this.tabs = [
			{
				label: 'Single protein',
				isVisible: () => true,
				callback: async (_event: any, tab: any) => {
					await this.renderSingleProtein(tab, proteomeDetails, state.activeCohort)
					delete tab.callback
				}
			},
			{
				label: 'Two proteins',
				isVisible: () => true,
				callback: async (_event: any, tab: any) => {
					await this.renderTwoProteinSelect(tab, proteomeDetails, state.activeCohort)
					delete tab.callback
				}
			},
			{
				label: 'Hierarchical clustering',
				isVisible: () => true,
				callback: async (_event: any, tab: any) => {
					await this.renderMultiProteinSelect(tab, proteomeDetails, state.activeCohort)
					delete tab.callback
				}
			},
			{
				label: 'DAP Volcano',
				isVisible: () => !!cohortConfig?.DAPfile,
				callback: async (_event: any, tab: any) => {
					await this.renderDapVolcano(tab, proteomeDetails)
					delete tab.callback
				}
			}
		]

		const chartTabs = new Tabs({
			holder: this.dom.tabs,
			tabs: this.tabs,
			tabsPosition: 'vertical'
		})
		await chartTabs.main()
	}

	initDom(proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		this.opts.header.append('span').style('padding-right', '5px').text(`${organism} ${assay}: ${cohort}`)
		this.opts.header.append('span').text('PROTEOME').style('font-size', '0.7em').style('opacity', '0.6')

		return {
			tabs: this.opts.holder
				.append('div')
				.style('margin', '10px')
				.attr('data-testid', 'sjpp-proteome-input-tabs-wrapper')
		}
	}

	private getUsecase(proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		return {
			target: 'proteomeAbundance',
			detail: 'term',
			proteomeDetails: { organism, assay, cohort },
			label: `Organism: ${organism}; Assay: ${assay}; Sample set: ${cohort}`
		}
	}

	async renderSingleProtein(tab: any, proteomeDetails: ProteomeDetails, activeCohort: number) {
		const { organism, assay, cohort } = proteomeDetails
		const row = tab.contentHolder.style('padding', '15px')
		row.append('div').style('padding', '5px').style('margin-bottom', '5px').text('Select a protein:')

		const treeHolder = row.append('div')
		const termdb = await import('../termdb/app')
		termdb.appInit({
			vocabApi: this.app.vocabApi,
			holder: treeHolder,
			state: {
				activeCohort,
				nav: { header_mode: 'search_only' },
				tree: { usecase: this.getUsecase(proteomeDetails) }
			},
			tree: {
				click_term: (term: any) => {
					const t = structuredClone(term.term || term)
					t.dataTypeDetails = { organism, assay, cohort }
					const config: any = {
						chartType: 'summary',
						term: { term: t, q: { mode: NumericModes.continuous } },
						assayCohortTitle: `${organism} ${assay}: ${cohort}`,
						proteomeDetails: { organism, assay, cohort }
					}
					const overlayTerm = this.getState(this.app.getState()).termdbConfig?.queries?.proteome?.organisms?.[organism]
						?.overlayTerm
					if (overlayTerm) config.term2 = { term: structuredClone(overlayTerm), q: {} }
					this.dispatchEdits(config)
				}
			}
		})
	}

	private addProteinSearchbox(row: any, proteomeDetails: ProteomeDetails, onSelect: (term: any) => void) {
		const usecase = this.getUsecase(proteomeDetails)
		const tip = new Menu({ padding: '0px' })
		const searchbox = row
			.append('input')
			.attr('type', 'search')
			.attr('placeholder', 'Protein')
			.attr('class', 'sja_genesearchinput')
			.style('width', '200px')
		const mark = row.append('span').style('margin-left', '5px')
		const word = row.append('span').style('margin-left', '5px').style('font-size', '.8em').style('opacity', 0.6)

		let debounceTimer: ReturnType<typeof setTimeout>
		const doSearch = async () => {
			const v = searchbox.property('value').trim()
			if (v.length < 2) {
				tip.hide()
				return
			}
			try {
				const data = await this.app.vocabApi.findTerm(v, '', usecase, TermTypeGroups.PROTEOME_ABUNDANCE)
				if (!data.lst?.length) {
					mark.style('color', 'red').html('&cross;')
					word.text('No match')
					tip.hide()
				} else {
					tip.clear().showunder(searchbox.node())
					for (const term of data.lst) {
						tip.d
							.append('div')
							.attr('class', 'sja_menuoption')
							.style('border-radius', '0px')
							.text(term.name)
							.on('click', () => {
								tip.hide()
								searchbox.property('value', term.name)
								mark.style('color', 'green').html('&check;')
								word.text(term.name)
								onSelect(term)
							})
					}
				}
			} catch (e: any) {
				mark.style('color', 'red').html('&cross;')
				word.text(e.message || 'Error')
			}
		}

		searchbox.on('keyup', async (event: any) => {
			if (event.key === 'Escape') {
				tip.hide()
				return
			}
			clearTimeout(debounceTimer)
			mark.html('')
			word.text('')
			debounceTimer = setTimeout(doSearch, 300)
		})

		return { searchbox, mark, word }
	}

	async renderTwoProteinSelect(tab: any, proteomeDetails: ProteomeDetails, _activeCohort: number) {
		const { organism, assay, cohort } = proteomeDetails
		const holder = tab.contentHolder.style('padding', '10px')
		let selectedTerm1: any = null
		let selectedTerm2: any = null

		const gene1row = holder.append('div').style('padding', '5px')
		const gene2row = holder.append('div').style('padding', '5px').style('display', 'none')
		const submitBtn = holder.append('button').attr('type', 'button').attr('disabled', true)

		gene1row.append('span').text('Select the first protein:')
		this.addProteinSearchbox(gene1row, proteomeDetails, (term: any) => {
			selectedTerm1 = term
			gene2row.style('display', 'block')
		})

		gene2row.append('span').text('Select the second protein:')
		this.addProteinSearchbox(gene2row, proteomeDetails, (term: any) => {
			selectedTerm2 = term
			submitBtn.attr('disabled', null)
		})

		submitBtn
			.text('Submit')
			.style('border', 'none')
			.style('border-radius', '20px')
			.style('padding', '10px 15px')
			.style('margin-top', '10px')
			.on('click', async () => {
				if (!selectedTerm1 || !selectedTerm2) {
					sayerror(holder, 'Please select two proteins.')
					return
				}
				const t1 = structuredClone(selectedTerm1)
				const t2 = structuredClone(selectedTerm2)
				t1.dataTypeDetails = { organism, assay, cohort }
				t2.dataTypeDetails = { organism, assay, cohort }
				await this.dispatchEdits({
					chartType: 'summary',
					term: { term: t1, q: { mode: NumericModes.continuous } },
					term2: { term: t2, q: { mode: NumericModes.continuous } },
					assayCohortTitle: `${organism} ${assay}: ${cohort}`,
					proteomeDetails: { organism, assay, cohort }
				})
			})
	}

	async renderMultiProteinSelect(tab: any, proteomeDetails: ProteomeDetails, activeCohort: number) {
		const { organism, assay, cohort } = proteomeDetails
		const holder = tab.contentHolder.style('padding', '10px')

		const usecase = this.getUsecase(proteomeDetails)
		const termdb = await import('../termdb/app')

		const treeHolder = holder.append('div')

		termdb.appInit({
			vocabApi: this.app.vocabApi,
			holder: treeHolder,
			state: {
				activeCohort,
				nav: { header_mode: 'search_only' },
				tree: { usecase }
			},
			tree: {
				submit_lst: (termlst: any[]) => {
					const twlst = termlst.map((term: any) => {
						const t = structuredClone(term)
						t.dataTypeDetails = { organism, assay, cohort }
						return { term: t, q: { mode: NumericModes.continuous } }
					})

					if (twlst.length < 3) {
						alert('At least three proteins are required for hierarchical clustering. Please select more proteins.')
						return
					}

					this.dispatchEdits({
						chartType: 'hierCluster',
						dataType: 'proteomeAbundance',
						termgroups: [{ name: 'Protein Abundance Cluster', lst: twlst, type: 'hierCluster' }],
						assayCohortTitle: `${organism} ${assay}: ${cohort}`,
						proteomeDetails: { organism, assay, cohort }
					})
				}
			}
		})

		const enforceMinAndLayout = () => {
			const submitBtn = treeHolder.select('button').node() as HTMLButtonElement | null
			if (submitBtn) {
				const selectedCount = treeHolder.selectAll('.sja_menuoption[aria-label="Click to delete"]').size()
				submitBtn.disabled = selectedCount < 3
			}

			const node = treeHolder.node() as HTMLElement
			const divs = node.querySelectorAll('div')
			for (const div of divs) {
				if (div.style.flexWrap === 'wrap' && div.style.display === 'inline-block') {
					div.style.display = 'flex'
				}
			}
		}
		const observer = new MutationObserver(enforceMinAndLayout)
		observer.observe(treeHolder.node(), {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ['style']
		})
	}

	async renderDapVolcano(tab: any, proteomeDetails: ProteomeDetails) {
		const { organism, assay, cohort } = proteomeDetails
		const holder = tab.contentHolder.style('padding', '15px')

		const countsDiv = holder.append('div')
		countsDiv.append('span').text('Loading sample counts...')

		try {
			const result = await dofetch3('termdb/dapVolcano', {
				body: {
					genome: this.app.vocabApi.vocab.genome,
					dslabel: this.app.vocabApi.vocab.dslabel,
					organism,
					assay,
					cohort,
					countsOnly: true
				}
			})
			countsDiv.selectAll('*').remove()
			if (result.error) throw result.error
			const table = table2col({ holder: countsDiv })
			table.table.style('margin-left', '5px').style('padding', '5px 10px')
			{
				const [c1, c2] = table.addRow()
				c1.html(`<span style="font-size:.8em;font-weight:bold">CONTROL</span>`)
				c2.html(`${result.sample_size1} samples`)
			}
			{
				const [c1, c2] = table.addRow()
				c1.html(`<span style="font-size:.8em;font-weight:bold">CASE</span>`)
				c2.html(`${result.sample_size2} samples`)
			}
		} catch (e: any) {
			countsDiv.selectAll('*').remove()
			countsDiv.append('span').style('color', '#999').text('Sample counts unavailable')
			console.error(e.stack)
		}

		holder
			.append('button')
			.attr('class', 'sjpp_apply_btn sja_filter_tag_btn sja_sharp_border')
			.text('Launch Volcano')
			.on('click', async () => {
				await this.dispatchEdits({
					chartType: 'differentialAnalysis',
					childType: 'volcano',
					termType: PROTEOME_DAP,
					headerText: `${organism} ${assay}: ${cohort}`,
					proteomeDetails: { organism, assay, cohort },
					settings: {
						volcano: {
							...getDefaultVolcanoSettings({}, { termType: PROTEOME_DAP }),
							pValueType: 'original'
						},
						gsea: getDefaultGseaSettings({})
					},
					highlightedData: [],
					hidePlotFilter: true
				})
			})
	}

	async dispatchEdits(config: any) {
		await this.app.dispatch({
			type: 'app_refresh',
			subactions: [
				{ type: 'plot_create', config },
				{ type: 'plot_delete', id: this.id }
			]
		})
	}

	async main() {}
}

export const proteomeInputInit = getCompInit(ProteomeInput)
export const componentInit = proteomeInputInit

export function getPlotConfig(opts: any) {
	const config = {
		chartType: 'ProteomeInput',
		hidePlotFilter: true
	}
	return copyMerge(config, opts)
}
