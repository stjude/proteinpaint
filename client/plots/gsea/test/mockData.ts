import { GENE_EXPRESSION } from '#shared/terms.js'
import * as testData from '#plots/volcano/test/testData.js'

export function getMockGSEAConfig(opts = {}) {
    const defaultConfig = {
        chartType: 'differentialAnalysis',
        childType: 'gsea',
        termType: GENE_EXPRESSION,
        highlightGenes: [],
        hightlightData: [],
        gsea_params: {
            geneset_name: null,
            pathway: 'H: hallmark gene sets'
        },
        samplelst: { groups: testData.groups },
        tw: {
            q: { groups: testData.groups },
            term: {
                name: 'Sensitive vs Resistant',
                type: 'samplelst',
                values: {
                    Sensitive: {
                        color: '#1b9e77',
                        key: 'Sensitive',
                        label: 'Sensitive',
                        list: testData.group1Values
                    },
                    Resistant: {
                        color: '#d95f02',
                        key: 'Resistant',
                        label: 'Resistant',
                        list: testData.group2Values
                    }
                }
            }
        },
        settings: { gsea: getMockGseaSettings() }
    }
    return Object.assign({}, defaultConfig, opts)
}

export function getMockPathwayOpts() {
    return [
        { label: '-', value: '-' },
        { label: 'Hallmark', value: 'H: hallmark gene sets' },
        { label: 'Curated', value: 'C2: curated gene sets' }
    ]
}

export function getMockGseaSettings(opts: any = {}) {
    return Object.assign(
        {
            fdr_cutoff: 0.05,
            num_permutations: 1000,
            top_genesets: 40,
            pathway: 'H: hallmark gene sets',
            geneset_name: null,
            min_gene_set_size_cutoff: 0,
            max_gene_set_size_cutoff: 20000,
            filter_non_coding_genes: true,
            fdr_or_top: 'top',
            gsea_method: 'blitzgsea'
        },
        opts
    )
}

export function getMockGseaParams(opts: any = {}) {
    return Object.assign(
        {
            genome: 'hg38-test',
            dslabel: 'TermdbTest',
            genes: ['G1', 'G2', 'G3', 'G4'],
            fold_change: [0.5, -1.2, 2.3, 0.1],
            geneset_name: null
        },
        opts
    )
}

export function getMockBlitzOutputMap() {
    return {
        SET_A: {
            geneset_size: 10,
            leading_edge: 'G1,G2',
            fdr: 0.0023,
            pvalue: 0.0008,
            nes: 1.8
        },
        SET_B: {
            geneset_size: 30,
            leading_edge: 'G2,G3',
            fdr: 0.021,
            pvalue: 0.008,
            nes: -1.4
        },
        SET_C: {
            geneset_size: 5,
            leading_edge: 'G4',
            fdr: 0.11,
            pvalue: 0.07,
            nes: 0.9
        }
    }
}

export function getMockCernoOutputMap() {
    return {
        SET_A: {
            geneset_size: 10,
            leading_edge: 'G1,G2',
            fdr: 0.004,
            pvalue: 0.0012,
            auc: 0.83,
            es: 1.21
        },
        SET_B: {
            geneset_size: 30,
            leading_edge: 'G2,G3',
            fdr: 0.03,
            pvalue: 0.01,
            auc: 0.66,
            es: -0.54
        },
        SET_C: {
            geneset_size: 20001,
            leading_edge: 'G4',
            fdr: 0.001,
            pvalue: 0.0005,
            auc: 0.9,
            es: 1.8
        }
    }
}

export function getMockRankedDE() {
    return {
        genes: ['G1', 'G2', 'G3', 'G4'],
        fold_change: [0.4, -2.1, 1.8, 0.7]
    }
}

export function getMockGSEA(opts: any = {}) {
    const settings = getMockGseaSettings(opts.settings)
    const gsea_params = getMockGseaParams(opts.gsea_params)
    const stateGenesetName = opts.stateGenesetName ?? gsea_params.geneset_name ?? null

    return {
        app: {
            opts: {
                genome: {
                    termdbs: {
                        msigdb: {
                            analysisGenesetGroups: getMockPathwayOpts()
                        }
                    }
                }
            }
        },
        state: {
            config: {
                chartType: opts.chartType || 'differentialAnalysis',
                settings: {
                    gsea: settings
                },
                gsea_params: {
                    geneset_name: stateGenesetName
                }
            }
        },
        gsea_params,
        testEnabled: opts.testEnabled || false,
        imageUrl: opts.imageUrl || null,
        model: {
            runEnrichment:
                opts.runEnrichment ||
                (async () => {
                    return { data: getMockBlitzOutputMap() }
                })
        }
    }
}