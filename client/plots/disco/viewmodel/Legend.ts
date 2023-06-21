import SnvLegendElement from "./SnvLegendElement";
import CnvLegend from "./CnvLegend";
import LohLegend from "./LohLegend";
import {CnvType} from "./CnvType";

export default class Legend {

    snvTitle: string
    snvClassMap: Map<string, SnvLegendElement>

    cnvTitle: string
    cnvClassMap: Map<CnvType, CnvLegend>

    lohTitle: string;
    lohLegend?: LohLegend;

    fusionTitle: string
    fusionLegend: boolean


    constructor(
        snvTitle: string,
        cnvTitle: string,
        lohTitle: string,
        fusionTitle: string,
        snvClassMap: Map<string, SnvLegendElement>,
        cnvClassMap: Map<CnvType, CnvLegend>,
        fusionLegend: boolean,
        lohLegend?: LohLegend,
    ) {
        this.snvTitle = snvTitle
        this.cnvTitle = cnvTitle
        this.lohTitle = lohTitle
        this.fusionTitle = fusionTitle
        this.snvClassMap = snvClassMap;
        this.cnvClassMap = cnvClassMap;
        this.lohLegend = lohLegend
        this.fusionLegend = fusionLegend
    }

    legendCount(): number {
        return ((this.snvClassMap.size > 0) ? 1 : 0) +
            ((this.cnvClassMap.size > 0) ? 1 : 0) +
            (this.lohLegend ? 1 : 0) +
            (this.fusionLegend ? 1 : 0)
    }
}