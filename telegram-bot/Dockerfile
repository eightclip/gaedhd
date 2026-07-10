FROM node:20-alpine

# Create app directory
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

# .env is NOT baked in — mount it at runtime or pass env vars
# e.g. docker run --env-file .env gaedhd-telegram-bot

CMD ["node", "index.js"]
