import { type TermdbAggregateMatrixRequest, PSEUDOBULK, GENE_EXPRESSION } from '#types'
import { mayLog } from '#src/helpers.ts'
import { run_python } from '@sjcrh/proteinpaint-python'


export function getAggMatrixData(q: TermdbAggregateMatrixRequest, ds: any) {
    const entries = q.entries
    const queries = new Set()
    const result = {
        colorScale: {}
    }

    for (const section in entries) {
        const tws = entries[section]
        if (tws[0].term.type == GENE_EXPRESSION) {
            tws.forEach((tw) => { queries.add((tw.term.name || tw.term.id).trim()) })
        }
    }
    for (const member in q.categories) {
        const tws = q.categories[member]
        tws.forEach(async (tw) => {
            await processMemberTerm(tw.term, q, ds, queries, result)
        })
    }
}

async function processMemberTerm(term, q, ds, queries, result) {
    if (term.type === PSEUDOBULK) {
        const pseudobulk = ds.queries.singleCell.pseudobulk
        const member = pseudobulk[term.assay][term.memberId]
        if (!member) throw new Error(`Member: ${term.memberId} not found for term: ${term.id} in pseudobulk assay: ${term.assay}`)

        //Get gradient values
        {
            const gradientFile = member.categories[term.id][`${q.gradientMethod}File`]
            const gradientData = await getHDF5Data(Array.from(queries), gradientFile)
            const { tmp, min, max } = processHDF5Data(gradientData)
            result.colorScale = { min, max }
            console.log('Processed gradient data:', tmp)
        }

        //Get size values
        {
            const sizeFile = member.categories[term.id][`${q.sizeMethod}File`]
            const sizeData = await getHDF5Data(Array.from(queries), sizeFile)
            const { tmp, min, max } = processHDF5Data(sizeData)
            console.log('Processed size data:', { tmp, min, max })
        }
    } else throw new Error(`Term type: ${term.type} not supported in aggregate matrix route. `)
}

/** 
 * @queries array of gene names to query in the HDF5 file
 * @h5file full path to the HDF5 file to query
 */
async function getHDF5Data(queries, h5file) {
    const readHdf5Input = { query: queries, hdf5_file: h5file }
    const time1 = Date.now()
    const python_output = await run_python('readHDF5.py', JSON.stringify(readHdf5Input))
    mayLog('Time taken to query HDF5 file:', Date.now() - time1, 'ms')

    const result = JSON.parse(python_output)

    /** query_output = { [index/gene:string]: { dataId: string, samples: [Object]} 
     * Should be one entry per gene in query_output.*/
    const out = result.query_output

    if (!out) throw new Error(`No expression data for ${queries}`)
    return out
}

function processHDF5Data(data) {
    //TODO: Need to filter out samples if filter0
    const tmp = {}
    let min = Infinity
    let max = -Infinity

    for (const gene in data) {
        const values = Object.values(data[gene].samples)
        if (!values.length) throw new Error(`No samples found for gene: ${gene}`)
        const aggregate = getAggregate(values)
        if (aggregate !== null) {
            if (aggregate < min) min = aggregate
            if (aggregate > max) max = aggregate
        }
        tmp[gene] = aggregate
    }
    return { tmp, min, max }
}

/** Return aggregate mean of numeric values in the array  */
function getAggregate(data: unknown[]): number | null {
    const values = data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    if (values.length === 0) return null
    const sum = values.reduce((acc, value) => acc + value, 0)
    return sum / values.length
}