import Arc from "#plots/disco_new/viewmodel/Arc";
import Ribbon from "#plots/disco_new/viewmodel/Ribbon";

export default class Ring<T extends Arc> {
    width: number

    innerRadius: number
    outerRadius: number

    elements: Array<T>
    ribbons?: Array<Ribbon>

    constructor(innerRadius: number, width: number, elements: Array<T>) {
        this.innerRadius = innerRadius
        this.outerRadius = innerRadius + width

        this.elements = elements
    }
}