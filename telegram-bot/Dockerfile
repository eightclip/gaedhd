FROM node:20-alpine

# Create app directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy source
COPY index.js ./

# .env is NOT baked in — mount it at runtime or pass env vars
# e.g. docker run --env-file .env gaedhd-telegram-bot

CMD ["node", "index.js"]
