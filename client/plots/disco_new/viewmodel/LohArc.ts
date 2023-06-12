import Arc from "./Arc";

export default class LohArc extends Arc {
    constructor(
        startAngle: number,
        endAngle: number,
        innerRadius: number,
        outerRadius: number,
        color: string,
        label: string,
        readonly chr: string,
        readonly start: number,
        readonly stop: number,
        readonly value: number
    ) {
        super(startAngle,
            endAngle,
            innerRadius,
            outerRadius,
            color,
            label)
    }

}