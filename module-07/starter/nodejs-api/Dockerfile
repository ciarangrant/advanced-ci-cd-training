# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
# npm ci is faster and more reliable in CI/CD than npm install
RUN npm ci
COPY src ./src

# Runtime stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Set to production to optimize performance in some libraries
ENV NODE_ENV=production

# Install production dependencies only (ignores devDependencies)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the source code from the build stage
COPY --from=build /app/src ./src

# Requirements: Expose port 3000
EXPOSE 3000

# Add a HEALTHCHECK for the /health endpoint
# Node apps start fast, so we don't need a massive start-period like Java
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r => { if (!r.ok) exit(1) }).catch(() => exit(1))" || exit 1

# Start the application
CMD ["node", "src/index.js"]
