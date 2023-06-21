export default class SnvLegendElement {
    snvType: string
    color: string
    count: number;

    constructor(snvType: string, color: string, count: number) {
        this.snvType = snvType;
        this.color = color;
        this.count = count
    }
}