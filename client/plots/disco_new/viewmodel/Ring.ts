import Arc from "#plots/disco_new/viewmodel/Arc";
import Ribbon from "#plots/disco_new/viewmodel/Ribbon";
import Label from "#plots/disco_new/viewmodel/Label";

export default class Ring<T extends Arc> {
    radius: number
    width: number

    innerRadius: number
    outerRadius: number

    elements: Array<T>
    labels?: Array<Label>
    ribbons?: Array<Ribbon>

    constructor(radius: number, width: number, elements: Array<T>,  labels?: Array<Label>) {
        this.radius = radius

        const halfOfWidth = width / 2;
        this.innerRadius = radius - halfOfWidth
        this.outerRadius = radius + halfOfWidth

        this.elements = elements
        this.labels = labels
    }
}