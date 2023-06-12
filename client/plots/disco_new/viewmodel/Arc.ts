
import {DefaultArcObject} from "d3-shape";

export default class Arc implements DefaultArcObject {

    startAngle: number
    endAngle: number
    readonly innerRadius: number
    readonly outerRadius: number
    readonly text: string
    readonly color: any

    readonly padAngle?: number | undefined

    constructor(startAngle: number,
                endAngle: number,
                innerRadius: number,
                outerRadius: number,
                color: string,
                text: string,
                padAngle = undefined) {
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.color = color;
        this.text = text
        this.padAngle = padAngle
    }
}