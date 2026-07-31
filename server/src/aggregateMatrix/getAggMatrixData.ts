import type { TermdbAggregateMatrixRequest, HasValidAggMatrixResponse, AggMatrixDot, AxisSection, AxisMember } from '#types'
import { PSEUDOBULK, GENE_EXPRESSION } from '#types'
import { mayLog } from '#src/helpers.ts'
import { run_python } from '@sjcrh/proteinpaint-python'
import { scaleLinear } from 'd3-scale'

type ColData = {
    member: string
    category: string
    colorTmp: Record<string, number | null>
    sizeTmp: Record<string, number | null>
}

export async function getAggMatrixData(q: TermdbAggregateMatrixRequest, ds: any): Promise<HasValidAggMatrixResponse> {
    const queries = new Set<string>()
    const rowSections: AxisSection[] = []
    let termCount = 0, rowLongest = ''

    for (const section in q.entries) {
        const terms = q.entries[section].map(tw => {
            const label = tw.term.name || tw.term.id
            if (tw.term.type == GENE_EXPRESSION) queries.add(label.trim())
            if (label.length > rowLongest.length) rowLongest = label
            termCount++
            return { id: tw.term.id, label }
        })
        rowSections.push({ id: section, terms })
    }

    const columns: ColData[] = []
    const colMembers: AxisMember[] = []
    let colorMin = Infinity, colorMax = -Infinity
    let sizeMin = Infinity, sizeMax = -Infinity
    let categoryCount = 0, colLongest = ''

    for (const member in q.categories) {
        const categories = q.categories[member].map(tw => {
            const label = tw.term.name || tw.term.id
            if (label.length > colLongest.length) colLongest = label
            categoryCount++
            return { id: tw.term.id, label }
        })
        colMembers.push({ id: member, categories })

        for (const tw of q.categories[member]) {
            const { colorTmp, sizeTmp, colorMin: cMin, colorMax: cMax, sizeMin: sMin, sizeMax: sMax }
                = await processMemberTerm(tw.term, q, ds, queries)
            if (cMin < colorMin) colorMin = cMin
            if (cMax > colorMax) colorMax = cMax
            if (sMin < sizeMin) sizeMin = sMin
            if (sMax > sizeMax) sizeMax = sMax
            columns.push({ member, category: tw.term.id, colorTmp, sizeTmp })
        }
    }

    // One inner array per entry term (row), each containing one dot per column
    const data: AggMatrixDot[][] = []
    const sizeScale = scaleLinear()
        .domain([sizeMin, sizeMax])
        .range([q.minDotSize, q.maxDotSize])

    for (const { terms } of rowSections) {
        for (const { id: term } of terms) {
            const row: AggMatrixDot[] = columns.map(col => {
                const sizeValue = col.sizeTmp[term] ?? 0
                console.log(sizeValue, sizeScale(sizeValue))
                return {
                    entryTerm: term,
                    category: col.category,
                    colorValue: col.colorTmp[term] ?? 0,
                    sizeValue,
                    dotSize: sizeScale(sizeValue)
                }
            })
            data.push(row)
        }
    }

    return {
        colorScale: { min: colorMin, max: colorMax },
        data,
        axesLayout: {
            rows: { sections: rowSections, termCount, longestLabel: rowLongest },
            columns: { members: colMembers, categoryCount, longestLabel: colLongest }
        }
    }
}

async function processMemberTerm(term, q: TermdbAggregateMatrixRequest, ds: any, queries: Set<string>) {
    if (term.type === PSEUDOBULK) {
        const pseudobulk = ds.queries.singleCell.pseudobulk
        const member = pseudobulk[term.assay][term.memberId]
        if (!member) throw new Error(`Member: ${term.memberId} not found for term: ${term.id} in pseudobulk assay: ${term.assay}`)

        const gradientFile = member.categories[term.id][`${q.gradientMethod}File`]
        const gradientData = await getHDF5Data(Array.from(queries), gradientFile)
        const { tmp: colorTmp, min: colorMin, max: colorMax } = processHDF5Data(gradientData)

        const sizeFile = member.categories[term.id][`${q.sizeMethod}File`]
        const sizeData = await getHDF5Data(Array.from(queries), sizeFile)
        const { tmp: sizeTmp, min: sizeMin, max: sizeMax } = processHDF5Data(sizeData)

        return { colorTmp, sizeTmp, colorMin, colorMax, sizeMin, sizeMax }
    } else throw new Error(`Term type: ${term.type} not supported in aggregate matrix route.`)
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