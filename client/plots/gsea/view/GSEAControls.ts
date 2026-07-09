import type { GSEA } from '../gsea'
import { controlsInit } from '#plots/controls.js'

export async function setControls(controlsDiv, gsea: GSEA) {
	const inputs: any = [
		{
			label: 'Minimum Gene Set Size Filter Cutoff',
			type: 'number',
			chartType: 'gsea',
			settingsKey: 'min_gene_set_size_cutoff',
			title: 'Minimum Gene set size cutoff. Helps in filtering out small gene sets',
			min: 0
		},
		{
			label: 'Maximum Gene Set Size Filter Cutoff',
			type: 'number',
			chartType: 'gsea',
			settingsKey: 'max_gene_set_size_cutoff',
			title: 'Maximum Gene set size cutoff. Helps in filtering out large gene sets',
			max: 25000
		},
		{
			label: 'Filter Non-coding Genes',
			type: 'checkbox',
			chartType: 'gsea',
			settingsKey: 'filter_non_coding_genes',
			title: 'Filter non-coding genes',
			boxLabel: ''
		},
		{
			label: 'FDR or Top Gene Sets',
			type: 'radio',
			chartType: 'gsea',
			settingsKey: 'fdr_or_top',
			title: 'Toggle between FDR cutoff and top gene sets in ascending order of FDR',
			options: [
				{ label: 'FDR', value: 'fdr' },
				{ label: 'Top Gene Sets', value: 'top' }
			]
		},
		{
			label: 'GSEA method',
			type: 'radio',
			chartType: 'gsea',
			settingsKey: 'gsea_method',
			title: 'Toggle between blitzgsea and CERNO method',
			options: [
				{ label: 'blitzgsea', value: 'blitzgsea' },
				{ label: 'CERNO', value: 'cerno' }
			],
			getDisplayStyle: () => {
				return gsea.testEnabled ? '' : 'none'
			}
		},

		{
			label: 'Number of Permutations',
			type: 'number',
			chartType: 'gsea',
			settingsKey: 'num_permutations',
			title: 'Number of permutations to be used for GSEA. Higher number increases accuracy but also compute time.',
			min: 0,
			max: 40000, // Setting it to pretty lenient limit for testing
			getDisplayStyle: plot => {
				const settings = plot.settings.gsea
				return settings.gsea_method === 'blitzgsea' ? '' : 'none'
			}
		},
		{
			label: 'FDR Filter Cutoff (Linear Scale)',
			type: 'number',
			chartType: 'gsea',
			settingsKey: 'fdr_cutoff',
			title: 'P-value significance',
			min: 0,
			max: 1,
			getDisplayStyle: plot => {
				const settings = plot.settings.gsea
				return settings.fdr_or_top == 'fdr' ? '' : 'none'
			}
		},
		{
			label: 'Number of top Gene Sets by FDR',
			type: 'number',
			chartType: 'gsea',
			settingsKey: 'top_genesets',
			title: 'Number of top gene sets to be displayed in ascending order of FDR',
			min: 0,
			max: 5000,
			getDisplayStyle: plot => {
				const settings = plot.settings.gsea
				return settings.fdr_or_top == 'top' ? '' : 'none'
			}
		}
	]

	gsea.components.controls = await controlsInit({
		app: gsea.app,
		id: gsea.id,
		holder: controlsDiv,
		inputs: inputs
	})

	gsea.components.controls.on('downloadClick.gsea', () => {
		if (!gsea.imageUrl) return alert('No image to download')
		const dataUrl = gsea.imageUrl
		const downloadImgName = `${gsea.state.config.gsea_params.geneset_name || ''}_GSEA_IMG`
		const a = document.createElement('a')
		document.body.appendChild(a)

		a.addEventListener(
			'click',
			() => {
				// Download the image
				a.download = downloadImgName + '.png'
				a.href = dataUrl
				document.body.removeChild(a)
			},
			false
		)
		a.click()
	})
}
