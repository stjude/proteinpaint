import Arc from "./Arc";
import Ribbon from "./Ribbon";
import SnvArc from "./SnvArc";

export default class Ring<T extends Arc> {
    width: number

    innerRadius: number
    outerRadius: number

    elements: Array<T>
    ribbons?: Array<Ribbon>

    constructor(innerRadius: number, width: number,  elements: Array<T>) {
        this.innerRadius = innerRadius
        this.outerRadius = innerRadius + width
        this.width = width
        this.elements = elements
    }
}