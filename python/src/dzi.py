import sys
import pyvips

try:
    # Check if the correct number of arguments are provided
    if len(sys.argv) != 3:
        print("Usage: python3 /dzi.py /path/to/file.svs /path/to/output_file")
        sys.exit(1)

    # Load the SVS image
    svs_image = pyvips.Image.new_from_file(sys.argv[1], access='sequential')

    # Save the image as a DZI file
    svs_image.dzsave(sys.argv[2])
    #     svs_image.dzsave(sys.argv[2], suffix=".png")
except Exception as e:
    print(f"An error occurred: {e}")