export default interface Processor {

    main (data: any): string

    hits(data: any, sample: any, gene: any, cls: any): any

    setLayer(plot, sampleName): any
}