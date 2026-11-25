#!/usr/bin/env bash
# One-off (and yearly refresh) build of the road graph our routing server uses.
# Run on the VPS:  bash infra/osrm/setup.sh
# Needs ~4 GB free RAM and ~6 GB disk while it runs; the running server then needs well under 1 GB.
# Roads come from OpenStreetMap (Geofabrik's Nigeria extract, ~700 MB).
set -euo pipefail

DATA=/opt/avdan/osrm-data
IMAGE=ghcr.io/project-osrm/osrm-backend:v5.27.1
mkdir -p "$DATA"
cd "$DATA"

echo "Downloading Nigeria road data..."
curl -fL --retry 3 -o nigeria.osm.pbf https://download.geofabrik.de/africa/nigeria-latest.osm.pbf

run() { docker run --rm -m 5g -v "$DATA:/data" "$IMAGE" "$@"; }
run osrm-extract -p /opt/car.lua --threads 2 /data/nigeria.osm.pbf
run osrm-partition /data/nigeria.osrm
run osrm-customize /data/nigeria.osrm
rm -f nigeria.osm.pbf
echo "Done. Start it with: docker compose up -d osrm"
