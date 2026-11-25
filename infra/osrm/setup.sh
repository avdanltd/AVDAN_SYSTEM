#!/usr/bin/env bash
# Builds the road graph our routing server uses. Run on the VPS:  bash infra/osrm/setup.sh
#
# The whole of Nigeria needs more memory than the VPS can spare (the first attempt was killed at the
# graph-building step), so this clips the Geofabrik Nigeria extract to the south-west -- Lagos, Ogun,
# Oyo, Osun, Ondo, Ekiti and the area around them -- where AVDAN operates, then builds from that.
# Trips outside the box get no road route and the apps draw a straight line, as they do whenever
# routing is unavailable. Widen BBOX (west,south,east,north) once there is memory for it.
#
# Needs ~2-4 GB free RAM and ~6 GB disk while it runs; the running server needs well under 1 GB.
# Re-run yearly (or after widening BBOX) to pick up new OpenStreetMap roads, then restart `osrm`.
set -euo pipefail

DATA=/opt/avdan/osrm-data
IMAGE=ghcr.io/project-osrm/osrm-backend:v5.27.1
BBOX=${BBOX:-2.6,5.8,6.0,9.0}
mkdir -p "$DATA"

# clear leftovers of an earlier (failed) run, keeping a finished download; files made by containers
# are owned by root, so this runs in a container too
docker run --rm -v "$DATA:/data" alpine sh -c 'cd /data && for f in *; do case "$f" in nigeria.osm.pbf) ;; *) rm -rf "$f";; esac; done'

# Geofabrik's file is ~700 MB; a smaller one is a partial download, so fetch it again
if [ ! -f "$DATA/nigeria.osm.pbf" ] || [ "$(stat -c %s "$DATA/nigeria.osm.pbf")" -lt 700000000 ]; then
  echo "Downloading Nigeria road data..."
  curl -fL --retry 3 -o "$DATA/nigeria.osm.pbf" https://download.geofabrik.de/africa/nigeria-latest.osm.pbf
fi

echo "Clipping to $BBOX ..."
docker run --rm -m 4g -v "$DATA:/data" debian:bookworm-slim sh -c \
  "apt-get update -qq && apt-get install -y -qq osmium-tool >/dev/null && \
   osmium extract --bbox=$BBOX --strategy=simple -o /data/region.osm.pbf /data/nigeria.osm.pbf"
rm -f "$DATA/nigeria.osm.pbf"

run() { docker run --rm -m 5g -v "$DATA:/data" "$IMAGE" "$@"; }
run osrm-extract -p /opt/car.lua --threads 2 /data/region.osm.pbf
run osrm-partition /data/region.osrm
run osrm-customize /data/region.osrm
rm -f "$DATA/region.osm.pbf"
echo "Done. Start it with: docker compose up -d osrm"
