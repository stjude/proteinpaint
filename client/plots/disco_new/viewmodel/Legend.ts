import SnvLegendElement from "./SnvLegendElement";
import CnvLegend from "./CnvLegend";
import LohLegend from "./LohLegend";

export default class Legend {
    snvTitle: string
    snvClassMap: Map<string, SnvLegendElement>

    cnvTitle: string
    cnvClassMap: Map<string, CnvLegend>

    constructor(snvTitle: string,
                snvClassMap: Map<string, SnvLegendElement>,
                cnvTitle: string,
                cnvClassMap: Map<string, CnvLegend>,
                logTitle: string,
                lohLegend: LohLegend
                ) {
        this.snvTitle = snvTitle;
        this.snvClassMap = snvClassMap;
        this.cnvTitle = cnvTitle;
        this.cnvClassMap = cnvClassMap;
    }
}