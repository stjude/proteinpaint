import Data from "../mapper/Data";
import {ViewModelMapper} from "../mapper/ViewModelMapper";

export default interface Settings {

    verticalPadding: number;
    horizontalPadding: number;

    rings: {
        fusionRadius: number;

        cnvInnerRadius: number;
        cnvWidth: number;
        cnvCapping: number;
        cnvUnit: string;

        lohWidth: number;
        lohInnerRadius: number;

        svnInnerRadius: number;
        svnWidth: number;
        snvRingFilter: string;

        nonExonicInnerRadius: number;
        nonExonicWidht: number;
        nonExonicRingEnabled: boolean,

        chromosomeWidth: number;
        chromosomeInnerRadius: number;

        labelsToLinesGap: number;
        labelsToLinesDistance: number;
        labelLinesInnerRadius: number

        snvFilterValue: number,
        fusionFilterValue: number,
        cnvFilterValue: number,
        lohFilterValue: number,
        nonExonicFilterValue: string
    };
    cnv: {
        cappedAmpColor: string;
        ampColor: string;
        capping: number;
        cappedLossColor: string;
        lossColor: string,
        unit: string
    };
    label: {
        maxDeltaAngle: number;
        fontSize: number;
        animationDuration: number;
        overlapAngleFactor: number;
    };
    legend: {
        snvTitle: string;
        cnvTitle: string;
        lohTitle: string;
        fusionTitle: string;
        lohLegendEnabled: boolean,
    },
    padAngle: number;
    layerScaler: number,
    menu: {
        padding: number

    }
}