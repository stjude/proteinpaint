
import {DefaultArcObject} from "d3-shape";

// TODO change to interface?
// TODO Rename?
export default class Arc implements DefaultArcObject {

    startAngle: number
    endAngle: number
    readonly innerRadius: number
    readonly outerRadius: number
    readonly width: number
    readonly label: string
    readonly cssClass: any

    readonly padAngle?: number | undefined

    constructor(startAngle: number,
                endAngle: number,
                innerRadius: number,
                outerRadius: number,
                cssClass: string,
                width: number = -1,
                label: string,
                padAngle = undefined) {
        this.startAngle = startAngle;
        this.endAngle = endAngle;
        this.innerRadius = innerRadius;
        this.outerRadius = outerRadius;
        this.width = width;
        this.cssClass = cssClass;
        this.label = label
        this.padAngle = padAngle
    }
}