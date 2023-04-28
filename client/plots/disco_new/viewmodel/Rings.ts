import Label from "#plots/disco_new/viewmodel/Label";
import Ring from "#plots/disco_new/viewmodel/Ring";
import Chromosome from "#plots/disco_new/viewmodel/Chromosome";

export default class Rings {

    labelsRing: Ring<Label>
    chromosomesRing: Ring<Chromosome>

    constructor(labelsRing: Ring<Label>, chromosomesRing: Ring<Chromosome>) {
        this.labelsRing = labelsRing;
        this.chromosomesRing = chromosomesRing;
    }
}