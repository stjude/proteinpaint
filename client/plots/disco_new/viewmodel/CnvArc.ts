import Arc from "./Arc";

export default class CnvArc extends Arc {
    constructor(
        startAngle: number,
        endAngle: number,
        innerRadius: number,
        outerRadius: number,
        color: string,
        text: string,
        readonly chr: string,
        readonly start: number,
        readonly stop: number,
        readonly value: number,
        readonly unit: string
    ) {
        super(startAngle,
            endAngle,
            innerRadius,
            outerRadius,
            color,
            text)
    }

}