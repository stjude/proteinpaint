import SnvLegendElement from "./SnvLegendElement";
import CnvLegend from "./CnvLegend";
import LohLegend from "./LohLegend";
import {CnvType} from "./CnvType";
import {FusionLegend} from "./FusionLegend";

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
        snvClassMap: Map<string, SnvLegendElement>,
        cnvClassMap: Map<CnvType, CnvLegend>,
        fusionLegend: boolean,
        lohLegend?: LohLegend,

    ) {
        this.snvTitle = "SNV"
        this.cnvTitle = "CNV (log2 ratio)"
        this.lohTitle = "LOH seg. mean"
        this.fusionTitle = "Structural Variants (color by co-location)"
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