from flask_cors import CORS
from pathlib import Path
from tiatoolbox.wsicore.wsireader import WSIReader
from tiatoolbox.visualization.tileserver import TileServer
import glob
import os


# def remap_host_path(path: Path) -> Path:
#     print(path)
#     host_mount = os.environ.get('TILESERVER_HOST_MOUNT')
#     container_mount = os.environ.get('TILESERVER_CONTAINER_MOUNT', '/home/root/tileserver/tp')

#     if not host_mount:
#         return path

#     normalized_path = os.path.normpath(str(path))
#     normalized_host_mount = os.path.normpath(host_mount)

#     if normalized_path == normalized_host_mount:
#         return Path(container_mount)

#     relative_path = os.path.relpath(normalized_path, normalized_host_mount)
#     if relative_path == os.pardir or relative_path.startswith(f'{os.pardir}{os.sep}'):
#         return path

#     return Path(container_mount) / relative_path


# class ProteinPaintTileServer(TileServer):
#     @staticmethod
#     def decode_safe_name(name: str) -> Path:
#         decoded_path = Path(os.path.normpath(os.path.expanduser(os.path.expandvars(name))))
        # return remap_host_path(decoded_path)

# Initialize and run the TileServer
app = TileServer(
    title="Tiatoolbox TileServer",
    layers={},
)
CORS(app, send_wildcard=True)

# Gunicorn will look for 'app' in this script
if __name__ == "__main__":
    # Only for development; use gunicorn for production
    app.run(host='0.0.0.0', port=5000)
