import Arc from "./Arc";

export default class SnvArc extends Arc {
    constructor(
        startAngle: number,
        endAngle: number,
        innerRadius: number,
        outerRadius: number,
        cssClass: string,
        label: string,
        width: number = -1,
        readonly dataClass: string,
        readonly mname: string,
        readonly chr: string,
        readonly pos: number
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