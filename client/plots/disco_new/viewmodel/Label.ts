import Arc from "./Arc";
import Line from "./Line";
import Point from "./Point";

export default class Label extends Arc {
    constructor(
        readonly startAngle: number,
        readonly endAngle: number,
        readonly innerRadius: number,
        readonly outerRadius: number,
        readonly angle: number,
        readonly value: number,
        label: string,
        cssClass: any,
        readonly transform: string,
        readonly textAnchor: string,
        readonly ccAngle: number,
        readonly line: Line,
        readonly isCancerGene: boolean) {
        //  TODO handle -1
        super(startAngle, endAngle, innerRadius, outerRadius,  cssClass, -1, label)
    }
}