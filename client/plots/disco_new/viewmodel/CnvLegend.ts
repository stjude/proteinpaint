import {CnvType} from "./CnvType";

export default class CnvLegend {
    cnvType: CnvType
    color: string
    value: number

    constructor(cnvType: CnvType, color: string, value: number) {
        this.cnvType = cnvType;
        this.color = color;
        this.value = value;
    }
}