export default class CnvLegend {
    cnvType: string
    color: string
    value: number

    constructor(cnvType: string, color: string, value: number) {
        this.cnvType = cnvType;
        this.color = color;
        this.value = value;
    }
}