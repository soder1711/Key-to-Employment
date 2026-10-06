cd worker
# Remote (production D1)
wrangler d1 execute task_portal --remote --file=../schema/secret.sql
# wrangler d1 execute task_portal --remote --file=../schema/002_seed.sql

cd ..