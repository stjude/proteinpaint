import { PSEUDOBULK } from '#shared/terms.js'
import { plotColor } from '#shared/common.js'

export function validatePseudobulk(pseudobulk: any, ds: any) {
    if (typeof pseudobulk != 'object') throw new Error('singleCell.pseudobulk not object')
    for (const assayKey of Object.keys(pseudobulk)) {
        const assay = pseudobulk[assayKey]
        if (typeof assay != 'object') throw new Error('singleCell.pseudobulk[i] not object')
        if (!ds.queries.singleCell.terms) ds.queries.singleCell.terms = []
        for (const termId of Object.keys(assay)) {
            const term = assay[termId]
            Object.entries(term.categories ?? {}).forEach(([key, c]: [string, any]) => {
                ds.queries.singleCell.terms.push({
                    name: c.label || key,
                    type: PSEUDOBULK,
                    assay: assayKey,
                    memberId: termId,
                    color: c.color || plotColor,
                    isleaf: true,
                    bins: {
                        default: {
                            type: 'custom-bin',
                            lst: [],
                            isDummyPreset: true
                        },
                        less: {
                            type: 'custom-bin',
                            lst: [],
                            isDummyPreset: true
                        }
                    }
                })
            })
        }
    }
}