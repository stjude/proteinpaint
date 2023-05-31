/********* server/dataset interfaces *********/

interface DsInfoEntry {
    k: string
    v: string
}

interface InfoFieldsEntry {
    name: string,
    key: string,
    categories: string,
    separator: string
}

interface ByRangeEntry {
    bcffile: string,
    infoFields: InfoFieldsEntry[]
}

interface SnvIndel {
    forTrack: boolean,
    byrange: ByRangeEntry
}

export interface Mds3Dataset {
    isMds3: boolean,
    dsinfo: DsInfoEntry[],
    genome: string,
    queries: object
}