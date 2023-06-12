export default interface Settings {

    verticalPadding: number;
    horizontalPadding: number;

    rings: {
        fusionRadius: number;
        chromosomeInnerRadius: number;
        cnvWidth: number;
        lohWidth: number;
        svnInnerRadius: number;
        chromosomeWidth: number;
        lohInnerRadius: number;
        labelsToLinesGap: number;
        cnvInnerRadius: number;
        nonExonicWidht: number;
        svnWidth: number;
        nonExonicInnerRadius: number;
        labelsToLinesDistance: number;
        labelLinesInnerRadius: number
    };
    cnv: {
        cappedAmpColor: string;
        ampColor: string;
        ampCapped: number;
        cappedLossColor: string;
        lossCapped: number;
        lossColor: string
    };
    label: {
        maxDeltaAngle: number;
        fontSize: number,
        animationDuration: number,
        overlapAngleFactor: number
    };
    padAngle: number;
    layerScaler: number,
    menu: {
        padding: number

    }
}