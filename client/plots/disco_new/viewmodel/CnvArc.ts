import Arc from "./Arc";

export default class CnvArc extends Arc {
    constructor(
        startAngle: number,
        endAngle: number,
        innerRadius: number,
        outerRadius: number,
        cssClass: string,
        label: string,
        // TODO remove width
        width: number = -1,
        readonly chr: string,
        readonly start: number,
        readonly stop: number,
        readonly value: number
    ) {
        super(startAngle,
            endAngle,
            innerRadius,
            outerRadius,
            cssClass,
            width,
            label)
    }

}