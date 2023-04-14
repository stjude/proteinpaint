import Arc from "#plots/disco_new/viewmodel/Arc";

export default class Chromosome extends Arc {
    key: string
    start: number
    size: number
    factor: number

    constructor(key: string, start: number, size: number, factor: number) {
        super();
        this.key = key
        this.start = start
        this.size = size
        this.factor = factor
    }
}