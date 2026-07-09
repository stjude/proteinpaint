import { GENE_EXPRESSION } from '#shared/terms.js'
import * as testData from '#plots/volcano/test/testData.js'

export function getMockGSEAConfig(opts = {}) {
    const defaultConfig = {
        chartType: "differentialAnalysis",
        childType: "gsea",
        termType: GENE_EXPRESSION,
        highlightGenes: [],
        hightlightData: [],
        gsea_params: {
            geneset_name: null,
            pathway: "H: hallmark gene sets"
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
        }
    }
    return Object.assign({}, defaultConfig, opts)
}