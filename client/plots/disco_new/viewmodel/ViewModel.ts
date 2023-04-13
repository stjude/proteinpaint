import Ring from "../Ring";

export default class ViewModel {

    width = 579.4970092773438
    height = 579.4970092773438

    margin = {left: 5, right: 5, top: 10, bottom: 10}

    rings: Array<Ring>

    constructor(rings: Array<Ring>) {
        this.rings = rings
    }
}