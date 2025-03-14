import type { RoutePayload } from './routeApi.js'

export type DERequest = {
	/** Genome build name */
	genome: string
	/** dataset label */
	dslabel: string
	/* Object containing two arrays of RNA seq count for DE analysis */
	samplelst: any //{number[]; number[];}
	/** Relative cpm cutoff for filtering a gene compared to all samples and genes in dataset */
	min_count: number
	/** Minimum total read count required for each sample */
	min_total_count: number
	/** Storage_type for storing data. Will deprecate text files */
	storage_type: 'text' | 'HDF5'
	/** Method of DE used wilcoxon/edgeR */
	method?: string
	/** Term for confounding variable1 (if present) */
	tw?: any
	/** Term for confounding variable2 (if present) */
	tw2?: any
}

export type ExpressionInput = {
	/** Case samples separated by , */
	case: string
	/** Control samples separated by , */
	control: string
	/** data_type instructs rust to carry out differential gene expression analysis */
	data_type: 'do_DE'
	/** File containing raw gene counts for DE analysis */
	input_file: string
	/** Relative cpm cutoff for filtering a gene compared to all samples and genes in dataset */
	min_count: number
	/** Minimum total read count required for each sample */
	min_total_count: number
	/** Type of storage file: HDF5 or text. Text will be deprecated in the future */
	storage_type: 'HDF5' | 'text'
	/** Confounding variable1 for DE analysis. Maybe array of string (Gender: Male/female) or number (Age). For now supporting 1 confounding variable. */
	conf1?: any[]
	/** Type of the confounding variable1 (continuous/discrete) */
	conf1_mode?: 'continuous' | 'discrete'
	/** Confounding variable2 for DE analysis. Maybe array of string (Gender: Male/female) or number (Age). For now supporting 1 confounding variable. */
	conf2?: any[]
	/** Type of the confounding variable2 (continuous/discrete) */
	conf2_mode?: 'continuous' | 'discrete'
	/** Number of variable genes to be included for DE analysis (optional) */
	VarGenes?: number
}

export type DEResponse = {
	/** Array containing objects of each gene containing foldchange, gene name, gene symbol, original pvalue, adjusted pvalue */
	data: DataEntry[]
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
	/** Method of DE used wilcoxon/edgeR */
	method: string
	/** QL: Image describing the quality of the fitting from QL pipeline, this is only generated for edgeR not for wilcoxon method  */
	/** MDS: Image showing the MDS plot of samples from both groups, this is only generated for edgeR not for wilcoxon method */
	images?: DEImage[]
}

export type DataEntry = {
	adjusted_p_value: number
	original_p_value: number
	fold_change: number
	gene_name: string
	gene_symbol: string
}

export type DEImage = {
	/** Image source */
	src: string
	/** File size */
	size: number
	/** Image identifier */
	key: string
}

export const diffExpPayload: RoutePayload = {
	request: {
		typeId: 'DERequest'
	},
	response: {
		typeId: 'DEResponse'
		// will combine this with type checker
		//valid: (t) => {}
	}
}
