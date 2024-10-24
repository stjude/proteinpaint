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
}

export type DEResponse = {
	/** Array containing objects of each gene containing foldchange, gene name, gene symbol, original pvalue, adjusted pvalue */
	data: string
	/** Effective sample size for group 1 */
	sample_size1: number
	/** Effective sample size for group 2 */
	sample_size2: number
	/** Method of DE used wilcoxon/edgeR */
	method: string
}
