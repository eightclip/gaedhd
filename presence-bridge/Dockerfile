FROM node:20-alpine

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source
COPY index.js ./

# .env is NOT baked in — it's provided via env_file at runtime (see docker-compose.yml)
CMD ["node", "index.js"]
