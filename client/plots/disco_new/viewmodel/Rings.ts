import Label from "#plots/disco_new/viewmodel/Label";
import Ring from "#plots/disco_new/viewmodel/Ring";
import Chromosome from "#plots/disco_new/viewmodel/Chromosome";
import Labels from "#plots/disco_new/viewmodel/Labels";

export default class Rings {

    labelsRing: Labels<Label>
    chromosomesRing: Ring<Chromosome>
    constructor(labelsRing: Labels<Label>, chromosomesRing: Ring<Chromosome>) {
        this.labelsRing = labelsRing;
        this.chromosomesRing = chromosomesRing;
    }
}