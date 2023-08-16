import {trigger_getViolinPlotData} from "#src/termdb.violin.js"
import {Filter} from "#shared/types/filter.ts"

function init({genomes}){
    return async (req:any, res:any): Promise<void> => {
        try{
            const g = genomes[req.query.genome]
            const ds = g.datasets[req.query.dslabel]
            if (!g) throw 'invalid genome name'
            const data = await trigger_getViolinPlotData(req.query, res, ds, g)
            res.send(data)
        } catch (e:any){
            res.send({error: e.message||e})
            if (e.stack) console.log(e)
        }
    }
}

export const api: any = {
    endpoint: 'termdb/violin',
    methods:{
        get:{
            init,
            request:{
                typeId:"getViolinDataRequest"
                },
            response:{
                typeId:"getViolinDataResponse"
            },
            // examples:[
            //     // {
            //     //     request: {
            //     //         body: { input: 'kr', genome: 'hg38-test' }
            //     //     },
            //     //     response: {
            //     //         header: { status: 200 },
                    
            //     //     }
            //     // }
            // ]
        },
        post:{
            alternativeFor: 'get',
            init
        }
    }
}

export type getViolinDataRequest = {
    genome: string
    dslabel: string
    embedder: string
    devicePixelRatio: number
    maxThickness: number
    screenThickness: number
    filter: Filter
    svgw: number
    orientation: "horizontal" | "vertical"
    datasymbol: string
    radius: number
    strokeWidth: number
    axisHeight: number
    rightMargin: number
    unit: string
    plotThickness: number
    termid: string
}

export type getViolinDataResponse = {
        min: number
        max: number
        plots: any
        
        // [
        //     {
        //         "label": "All samples",
        //         "plotValueCount": 4162,
        //         "src": "data:image/png;base64,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",
        //         "bins": [
        //             {
        //                 "x0": 0,
        //                 "x1": 500,
        //                 "binValueCount": 3521
        //             },
        //             {
        //                 "x0": 500,
        //                 "x1": 1000,
        //                 "binValueCount": 37
        //             },
        //             {
        //                 "x0": 1000,
        //                 "x1": 1500,
        //                 "binValueCount": 143
        //             },
        //             {
        //                 "x0": 1500,
        //                 "x1": 2000,
        //                 "binValueCount": 100
        //             },
        //             {
        //                 "x0": 2000,
        //                 "x1": 2500,
        //                 "binValueCount": 148
        //             },
        //             {
        //                 "x0": 2500,
        //                 "x1": 3000,
        //                 "binValueCount": 95
        //             },
        //             {
        //                 "x0": 3000,
        //                 "x1": 3500,
        //                 "binValueCount": 35
        //             },
        //             {
        //                 "x0": 3500,
        //                 "x1": 4000,
        //                 "binValueCount": 53
        //             },
        //             {
        //                 "x0": 4000,
        //                 "x1": 4500,
        //                 "binValueCount": 19
        //             },
        //             {
        //                 "x0": 4500,
        //                 "x1": 5000,
        //                 "binValueCount": 10
        //             },
        //             {
        //                 "x0": 5000,
        //                 "x1": 5000,
        //                 "binValueCount": 1
        //             },
        //             {
        //                 "x0": 5000,
        //                 "x1": 5000,
        //                 "binValueCount": 0
        //             }
        //         ],
        //         "biggestBin": 3521,
        //         "summaryStats": {
        //             "values": [
        //                 {
        //                     "id": "total",
        //                     "label": "Total",
        //                     "value": 4162
        //                 },
        //                 {
        //                     "id": "min",
        //                     "label": "Minimum",
        //                     "value": 0
        //                 },
        //                 {
        //                     "id": "p25",
        //                     "label": "1st quartile",
        //                     "value": 0
        //                 },
        //                 {
        //                     "id": "median",
        //                     "label": "Median",
        //                     "value": 0
        //                 },
        //                 {
        //                     "id": "mean",
        //                     "label": "Mean",
        //                     "value": 351.8
        //                 },
        //                 {
        //                     "id": "p75",
        //                     "label": "3rd quartile",
        //                     "value": 31
        //                 },
        //                 {
        //                     "id": "max",
        //                     "label": "Maximum",
        //                     "value": 5000
        //                 },
        //                 {
        //                     "id": "SD",
        //                     "label": "Standard deviation",
        //                     "value": 872.7
        //                 },
        //                 {
        //                     "id": "variance",
        //                     "label": "Variance",
        //                     "value": 761604.85
        //                 },
        //                 {
        //                     "id": "IQR",
        //                     "label": "Inter-quartile range",
        //                     "value": 31
        //                 }
        //             ]
        //         }
        //     }
        // ],
        "pvalues": number[]
        "plotThickness": number
        "uncomputableValueObj": any
        // {
        //     "exposed, dose unknown": number,
        //     "unknown exposure": number
        // }
}
