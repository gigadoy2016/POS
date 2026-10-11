# Stage: Production Runtime
FROM node:20-alpine

WORKDIR /app

# Install temporary build dependencies in case native modules need compilation
RUN apk add --no-cache python3 make g++

# Copy dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Clean up build tools to minimize image size
RUN apk del python3 make g++

# Copy application source files
COPY . .

# Ensure directory structure and set proper permissions
RUN mkdir -p public/uploads public/img/products && \
    chown -R node:node /app

# Run as non-root user for security best practice
USER node

# Environment defaults for Cloud Run
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
