import Data from "#plots/disco_new/mapper/Data";

export default class DataMapper {
    map(data, sampleName) {
        const dataArray: Array<Data> = []

        data.forEach(dObject => {
            const instance = new Data()

            instance.alt = dObject.alt
            instance.chr = dObject.chr
            instance.class = dObject.class
            instance.dt = dObject.dt
            instance.gene = dObject.gene
            instance.mname = dObject.mname
            instance.pos = dObject.pos
            instance.position = dObject.position
            instance.ref = dObject.ref
            instance.sample = sampleName
            instance.posbins = dObject.posbins
            instance.poschr = dObject.poschr
            instance.poslabel = dObject.poslabel

            instance.ssm_id = dObject.ssm_id
            instance.start = dObject.start
            instance.stop = dObject.stop
            instance.value = dObject.value

            dataArray.push(instance)
        })

        return dataArray
    }
}