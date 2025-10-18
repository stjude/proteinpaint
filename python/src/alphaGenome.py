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

try:
    input_data = sys.stdin.read()
    parsed_data = json.loads(input_data)
    position = int(parsed_data['position']) or 36201698
    chromosome = parsed_data['chromosome'] or 'chr22'
    reference = parsed_data['reference'] or 'A'
    alternate = parsed_data['alternate'] or 'C'
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
    #alphagenone uses hg38 genome coordinates

    API_KEY = os.getenv("API_KEY")
    model = dna_client.create(API_KEY)
    len = 1024  #16384//2
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
        requested_outputs=[
            dna_client.OutputType.RNA_SEQ
        ],
    )

    # Calculate the difference between alt and ref tracks
    # output.alt.values and output.ref.values are NumPy arrays
    scores = np.abs(outputs.alternate.rna_seq.values - outputs.reference.rna_seq.values)
    scores = np.max(scores, axis=0) #Get the max value on the y-axis for each track


    # Get the indices of the tracks, sorted from highest to lowest score
    sorted_indices = np.argsort(scores)[::-1]# [start : stop : step], [::-1] means order all the scores in reversed order.
    # Choose how many of the top tracks to display
    top_k = 20 
    top_indices = sorted_indices[:top_k]

    # Select the raw data for the top k tracks using NumPy indexing
    top_k_ref_values = outputs.reference.rna_seq[:, top_indices] #The : means “all positions on the x-axis”
    top_k_alt_values = outputs.alternate.rna_seq[:, top_indices]

    #print(top_indices)
    # Get the maximum absolute score across all track outputs for the single variant
    max_score = np.max(scores)

    tdata = {
                'REF': top_k_ref_values,
                'ALT': top_k_alt_values,
            }
    fig = plot_components.plot(
        [
            plot_components.OverlaidTracks(
                tdata=tdata,
                colors={'REF': 'dimgrey', 'ALT': 'red'},
                ylabel_template='{biosample_name} ({strand})\n{name}'
            ),
        ],
        interval=outputs.reference.rna_seq.interval,
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
    sys.exit(1)