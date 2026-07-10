FROM node:20-alpine

# The timezone database. Node resolves TZ (America/Los_Angeles, set in
# docker-compose.yml) through its own bundled ICU data, so quiet hours and the
# morning prompt were already reading her wall clock without this. But alpine
# ships no /usr/share/zoneinfo, so every SHELL tool in the container — `date`,
# and anything that reads /etc/localtime — still printed UTC. That made the
# container look broken while it was fine, which is its own kind of bug: the
# next person to check `docker exec ... date` shouldn't have to know about ICU.
RUN apk add --no-cache tzdata

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
