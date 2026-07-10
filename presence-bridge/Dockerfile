FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json ./

# Install production dependencies from the committed lockfile (reproducible,
# no fresh resolution on every build into a container that holds every secret)
RUN npm ci --omit=dev

# Copy source
COPY index.js ./

# Drop root — the node:20-alpine image ships an unprivileged `node` user.
# Placed after COPY so the copied files stay readable.
USER node

# .env is NOT baked in — it's provided via env_file at runtime (see docker-compose.yml)
CMD ["node", "index.js"]
