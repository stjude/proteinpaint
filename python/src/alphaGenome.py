#
# AlphaGenome is an AI application developed by Google DeepMind that predicts the effects of genetic variants on gene regulation 
# and other molecular processes. It takes a DNA sequence as input and predicts thousands of functional genomic features, 
# including gene expression, chromatin accessibility, and splicing, with single base-pair resolution. The application provides tools to 
# analyze the impact of specific mutations, helping researchers in areas like disease diagnosis, drug discovery, and synthetic biology. 
# Below is an example of making a variant prediction. We can predict the effect of a variant on a specific output type and tissue 
# by making predictions for the reference (REF) and alternative (ALT) allele sequences.
#
# Identifying driver mutations: A cancer genome has numerous mutations, but only a small fraction, known as "driver variants," contribute to 
# tumor growth. Variant predictors help distinguish these from "passenger variants," which do not influence tumor progression, 
# by identifying mutations with a significant functional effect. This is crucial for understanding the molecular mechanisms of cancer. 
# In this plot where the red and gray lines diverge, you can infer allele-specific expression (ASE) or transcriptional impact of the variant.
# If red (ALT) is higher than gray (REF), the variant increases expression. If red dips below gray, the variant may decrease expression or disrupt splicing.
# If the effect (divergence) appears only in one or few tissues, it’s tissue-specific. If it appears in many, it may have a broad regulatory effect.

#
#In order to test this code, you need to set the environment variable API_KEY to your API key.
#



from alphagenome.data import genome
from alphagenome.models import dna_client
from alphagenome.visualization import plot_components
import matplotlib.pyplot as plt
import numpy as np
import io
import sys
import json
import base64
import os
import traceback

try:
    input_data = sys.stdin.read()
    parsed_data = json.loads(input_data)
    API_KEY = parsed_data.get('API_KEY', os.getenv("API_KEY"))
    position = int(parsed_data['position'])
    chromosome = parsed_data['chromosome']
    reference = parsed_data['reference']
    alternate = parsed_data['alternate']
    ontology_terms = parsed_data.get('ontologyTerms', [
            'UBERON:0000955',  # brain
            'UBERON:0000310',  # breast
            'UBERON:0002367',  # prostate
            'UBERON:0001155',  # colon
            'UBERON:0002048',  # lung
            'UBERON:0013756',  # blood
            'UBERON:0002113',  # kidney
            'UBERON:0000945',  # stomach
            'UBERON:0002107',  # liver
        ])
    output_type = parsed_data.get('outputType', 4) # Default to RNA_SEQ
    interval = parsed_data.get('interval', 16384) # Default to 16384
    output_type = dna_client.OutputType(output_type)
    if(output_type == dna_client.OutputType.SPLICE_JUNCTIONS or output_type == dna_client.OutputType.CONTACT_MAPS):
        raise Exception("Output type not supported")
        #alphagenone uses hg38 genome coordinates

    model = dna_client.create(API_KEY)
    len = interval//2
    interval = genome.Interval(chromosome=chromosome, start=position-len, end=position+len)
    variant = genome.Variant(
        chromosome=chromosome,
        position=position,
        reference_bases=reference,
        alternate_bases=alternate,
    )

    outputs = model.predict_variant(
        interval=interval,
        variant=variant,
        ontology_terms=ontology_terms,
        requested_outputs=[output_type]
    )

    # Convert enum to its attribute name, usually lowercased
    output_name = output_type.name.lower()  # e.g. "RNA_SEQ" -> "rna_seq"

    # Dynamically access the attribute
    ref_output = getattr(outputs.reference, output_name)
    alt_output = getattr(outputs.alternate, output_name)

    if( ref_output.values.shape[1] > 10):  # if the output does not have junctions attribute
        # Calculate the difference between alt and ref tracks
        # output.alt.values and output.ref.values are NumPy arrays
        scores = np.abs(alt_output.values - ref_output.values)
        scores = np.max(scores, axis=0) #Get the max value on the y-axis for each track

        # Get the indices of the tracks, sorted from highest to lowest score
        sorted_indices = np.argsort(scores)[::-1]# [start : stop : step], [::-1] means order all the scores in reversed order.


        # # Choose how many of the top tracks to display
        top_k = 20 
        top_indices = sorted_indices[:top_k] 

        # Select the raw data for the top k tracks using NumPy indexing
        ref_output = ref_output[:, top_indices] #The : means “all positions on the x-axis”
        alt_output = alt_output[:, top_indices]

        #print(top_indices)
        # Get the maximum absolute score across all track outputs for the single variant
        #max_score = np.max(scores)
    tdata = {
        'REF': ref_output,
        'ALT': alt_output,
    }
    fig = plot_components.plot(
        [
            plot_components.OverlaidTracks(
                tdata=tdata,
                colors={'REF': 'dimgrey', 'ALT': 'red'},
                ylabel_template='({strand})\n{name}'
            ),
        ],
        interval=interval,
        # Annotate the location of the variant as a vertical line.
        annotations=[plot_components.VariantAnnotation([variant], alpha=0.8)],
    )


    # Output the image data to stdout
    buf = io.BytesIO()
    fig.savefig(buf, format='png', bbox_inches='tight', facecolor='white')
    data = base64.b64encode(buf.getbuffer()).decode("ascii")
    buffer_url = f"data:image/png;base64,{data}"
    buf.seek(0)
    plt.close()
    print(buffer_url)
except Exception as e:
    print(f"Error: {str(e)}", file=sys.stderr)
    #traceback.print_exc()

    sys.exit(1)