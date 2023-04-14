import Arc from "#plots/disco_new/viewmodel/Arc";

export default class Ring<T extends Arc> {
    radius: number
    width: number

    innerRadius: number
    outerRadius: number

    elements: Array<T>
    ribbons?: Array<Ribbon>

    constructor(radius: number, width: number, elements: Array<T>) {
        this.radius = radius
        const halfOfWidth = width / 2;
        this.innerRadius = radius - halfOfWidth
        this.outerRadius = radius + halfOfWidth

        this.elements = elements
    }
}