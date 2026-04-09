import { Menu, addGeneSearchbox, sayerror, isoformSelect } from '#dom'
import type { GeneModel, IsoformTerm, IsoformCollectionTerm } from '#dom/types/isoformSelect'
import type { Div } from '../../types/d3'
import { dofetch3 } from '#common/dofetch'
import { ISOFORM_EXPRESSION } from '#shared/terms.js'

export class SearchHandler {
	callback!: (term: IsoformTerm | IsoformCollectionTerm) => void
	app: any
	dom!: { errDiv: Div; isoformDiv?: Div }
	currentGene: string | null = null

	init(opts) {
		this.callback = opts.callback
		this.app = opts.app
		const holder = opts.holder.append('div').style('padding', '10px 0px')
		this.dom = {
			errDiv: holder.append('div').style('margin', '5px 0px').style('display', 'none')
		}

		const geneSearch = addGeneSearchbox({
			tip: new Menu({ padding: '0px' }),
			genome: opts.genomeObj,
			row: holder,
			searchOnly: 'gene',
			callback: async () => {
				try {
					this.dom.errDiv.style('display', 'none')
					if (!geneSearch.geneSymbol) throw new Error('No gene selected')
					// guard against duplicate fires for the same gene
					if (geneSearch.geneSymbol === this.currentGene) return
					this.currentGene = geneSearch.geneSymbol
					// isoformDiv is created after the search box so results appear below
					if (this.dom.isoformDiv) this.dom.isoformDiv.remove()
					this.dom.isoformDiv = holder.append('div')
					await this.showIsoforms(geneSearch.geneSymbol, opts.genomeObj)
				} catch (e: unknown) {
					this.dom.errDiv.style('display', 'block')
					sayerror(this.dom.errDiv, 'Error: ' + (e instanceof Error ? e.message : String(e)))
				}
			}
		})
	}

	async showIsoforms(gene: string, genomeObj: any) {
		if (!gene) throw new Error('No gene selected')

		// deep lookup to get all isoforms for this gene
		const data = await dofetch3('genelookup', { body: { genome: genomeObj.name, input: gene, deep: 1 } })
		if (!data.gmlst?.length) throw new Error(`No isoforms found for ${gene}`)

		// filter to ENST isoforms, then check which have data via server-side lookup
		const enstCandidates = data.gmlst.filter((gm: any) => gm.isoform?.startsWith('ENST'))
		if (enstCandidates.length === 0) throw new Error(`No Ensembl transcript isoforms found for ${gene}`)

		const { available } = await dofetch3('termdb/isoformAvailability', {
			body: {
				genome: genomeObj.name,
				dslabel: this.app.vocabApi.vocab.dslabel,
				isoforms: enstCandidates.map((gm: any) => gm.isoform)
			}
		})
		const availableSet = new Set(available || [])
		const enstModels = enstCandidates.filter((gm: any) => availableSet.has(gm.isoform))
		if (enstModels.length === 0) throw new Error(`No isoforms with data found for ${gene}`)

		// bail if the user already searched a different gene while we were fetching
		if (gene !== this.currentGene) return

		const div = this.dom.isoformDiv!
		div.append('div').style('margin-bottom', '8px').style('opacity', 0.65).text(`${gene} — select isoform(s):`)

		isoformSelect({
			holder: div,
			allgm: enstModels,
			multiSelect: true,
			submitLabel: 'Create Collection',
			onMultiSelect: (selected: GeneModel[]) => {
				if (selected.length === 1) {
					// Single isoform: create individual isoformExpression term
					this.selectIsoform(selected[0].isoform, gene)
				} else {
					// Multiple isoforms: create a custom termCollection
					this.selectCollection(selected, gene)
				}
			}
		})
	}

	getUnit() {
		return this.app.vocabApi.termdbConfig.queries.isoformExpression?.unit || 'TPM'
	}

	selectIsoform(isoform: string, gene: string) {
		const name = `${isoform} ${this.getUnit()}`
		this.callback({ isoform, gene, name, type: ISOFORM_EXPRESSION })
	}

	selectCollection(gms: GeneModel[], gene: string) {
		const unit = this.getUnit()
		const termlst = gms.map(gm => ({
			id: gm.isoform,
			name: gm.isoform,
			type: 'float' as const,
			isoform: gm.isoform,
			dataType: 'isoformExpression'
		}))
		this.callback({
			type: 'termCollection',
			isCustom: true,
			memberType: 'numeric',
			name: `${gene} Isoforms (${unit})`,
			termlst,
			propsByTermId: {},
			isleaf: true
		})
	}
}

/** Filter gene models to ENST isoforms that exist in the available items list.
 *  If availableItems is empty, all ENST isoforms are returned (no filtering). */
export function filterIsoforms(gmlst: GeneModel[], availableItems: string[]) {
	const itemSet = new Set(availableItems)
	return gmlst.filter(gm => gm.isoform?.startsWith('ENST') && (itemSet.size === 0 || itemSet.has(gm.isoform)))
}
