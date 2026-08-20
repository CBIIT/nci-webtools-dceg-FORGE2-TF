# data/

Reference data for FORGE2-TF, mounted into the containers by
`docker-compose-local.yml` (the local stand-in for the EFS mounts used on
Fargate). Inside the backend this folder is mounted at `/deploy/data`.

Stage the following here before running locally:
- tabix-indexed data files (`*.gz` + `*.gz.tbi`)
- the SQLite SNP-filter DB (build with `scripts/create-snp-filter-db.py`)
- `motif-logos/` — motif logo images served by the frontend
- `tmp/` — scratch space (created automatically)

The contents are not committed to git (see `.gitignore`); only this folder
skeleton is kept.
