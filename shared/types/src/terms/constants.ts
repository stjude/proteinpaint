export const CATEGORICAL = 'categorical'
export const CONDITION = 'condition'
export const DATE = 'date'
export const DNA_METHYLATION = 'dnaMethylation'
export const FLOAT = 'float'
export const GENE_VARIANT = 'geneVariant'
export const GENE_EXPRESSION = 'geneExpression'
export const ISOFORM_EXPRESSION = 'isoformExpression'
export const INTEGER = 'integer'
export const METABOLITE_INTENSITY = 'metaboliteIntensity'
export const MULTIVALUE = 'multivalue'
export const SAMPLELST = 'samplelst'
export const SINGLECELL_CELLTYPE = 'singleCellCellType'
export const SINGLECELL_GENE_EXPRESSION = 'singleCellGeneExpression'
export const SNP = 'snp'
export const SNP_LIST = 'snplst'
export const SNP_LOCUS = 'snplocus'
export const SSGSEA = 'ssGSEA'
export const SURVIVAL = 'survival'
export const TERM_COLLECTION = 'termCollection'
export const PROTEOME_ABUNDANCE = 'proteomeAbundance'
export const PROTEOME_DAP = 'proteomeDAP'

//Term types should be used gradually using these constants instead of hardcoding the values,
// eg: type == CATEGORICAL instead of type == 'categorical'
export const TermTypes: { [key: string]: string } = {
	GENE_VARIANT,
	GENE_EXPRESSION,
	ISOFORM_EXPRESSION,
	SSGSEA,
	DNA_METHYLATION,
	CATEGORICAL,
	INTEGER,
	FLOAT,
	SNP,
	SNP_LIST,
	SNP_LOCUS,
	CONDITION,
	SURVIVAL,
	SAMPLELST,
	METABOLITE_INTENSITY,
	PROTEOME_ABUNDANCE,
	SINGLECELL_CELLTYPE,
	SINGLECELL_GENE_EXPRESSION,
	MULTIVALUE,
	DATE,
	TERM_COLLECTION
}
