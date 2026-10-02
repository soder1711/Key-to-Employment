# Install wrangler
npm install -g wrangler

# Create D1 database
wrangler d1 create task_portal

# Local dev (uses a local SQLite copy)

# wrangler d1 execute task_portal --local  --file=./schema/001_init.sql
# wrangler d1 execute task_portal --local  --file=./schema/002_seed.sql

# Remote (production D1)
wrangler d1 execute task_portal --remote --file=../schema/001_init.sql
wrangler d1 execute task_portal --remote --file=../schema/002_seed.sql

# Set secrets (never in code)
wrangler secret put SESSION_SECRET        # generate with: openssl rand -base64 32
wrangler secret put GOOGLE_CLIENT_SECRET

# Deploy
wrangler deploy