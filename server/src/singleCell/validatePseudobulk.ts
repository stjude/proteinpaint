import { PSEUDOBULK } from '#shared/terms.js'
import { plotColor } from '#shared/common.js'
import type { GetPseudobulkDataArg } from '#types'
import path from 'path'
import serverconfig from '#src/serverconfig.js'
import { file_is_readable } from '#src/utils.js'
import { run_python } from '@sjcrh/proteinpaint-python'
import { mayLog } from '#src/helpers.ts'

/**
 * 1. Validate the structure of the pseudobulk object in the dataset.
 * 
 * 2. Convert the pseudobulk terms into term objects and add them to 
 * ds.queries.singleCell.terms for use in termdbConfig.termType2terms.pseudobulk.
 * 
 * 3. Adds ds.queries.singleCell.pseudobulk.get()
 * 
 */
export function validatePseudobulk(ds: any) {
    const pseudobulk = ds.queries.singleCell.pseudobulk

    if (typeof pseudobulk != 'object') throw new Error('singleCell.pseudobulk is not object')
    for (const assayKey of Object.keys(pseudobulk)) {
        const assay = pseudobulk[assayKey]
        if (typeof assay != 'object') throw new Error(`singleCell.pseudobulk.${assayKey} is not object`)

        /** In termdb.config, these terms are added to termdbConfig.termType2terms.pseudobulk
         * for access on the client. */
        if (!ds.queries.singleCell.terms) ds.queries.singleCell.terms = []
        for (const termId of Object.keys(assay)) {
            const term = assay[termId]
            Object.entries(term.categories ?? {}).forEach(([key, c]: [string, any]) => {
                ds.queries.singleCell.terms.push({
                    name: c.label || key,
                    id: key,
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

    pseudobulk.get = async ({ termlst, assay, memberId }: GetPseudobulkDataArg) => {
        const member = pseudobulk[assay]?.[memberId]
        if (!member) throw new Error(`No pseudobulk data for assay ${assay} and memberId ${memberId}`)
        const categories = member?.categories
        if (!categories) throw new Error(`No pseudobulk data for assay ${assay} and memberId ${memberId}`)
        
        const data = {}
        for (const term of termlst) {
            const cat = categories[term.id]
            if (!cat) throw new Error(`No pseudobulk data for term ${term.id} in assay ${assay} and memberId ${memberId}`)

            if (!term.genes || !Array.isArray(term.genes) || term.genes.length < 1) {
                throw new Error(`No genes provided for term ${term.id} in assay ${assay} and memberId ${memberId}`)
            }

            const meanH5file = path.join(serverconfig.tpmasterdir, member.folder, term.name, member.meanH5)
            await file_is_readable(meanH5file)

            data[term.id] = {}

            for (const gene of term.genes) {
                const hdf5InputType = { query: [gene], hdf5_file: meanH5file }
                const time1 = Date.now()
                const pythonOutput = await run_python('readHDF5.py', JSON.stringify(hdf5InputType))
                mayLog('Time taken to query HDF5 file:', Date.now() - time1, 'ms')
                
                const result = JSON.parse(pythonOutput)
                const out = result.query_output[gene]?.samples
		        if (!out) throw new Error(`No expression data for ${gene}`)
                
                data[term.id][gene] = out
            }

        }
        return data
    }
}