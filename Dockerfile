# Step 1: Build Stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# 1. Build Payment Middleware first
# Copy middleware source
COPY payment-middleware ./payment-middleware
WORKDIR /usr/src/app/payment-middleware
# Install deps, build, and PACK into tarball
RUN npm install && npm run build

# 2. Build Server
WORKDIR /usr/src/app/server
# Copy server package files
COPY server/package.json ./

# Copy server source and build
COPY server/ .

# Install server dependencies
RUN rm -f package-lock.json
RUN npm install
RUN npm run build

# Step 2: Production Stage
FROM node:20-alpine

WORKDIR /usr/src/app/server

# Copy necessary files from builder
# We need payment-middleware available for the local file dependency reference
COPY --from=builder /usr/src/app/payment-middleware ../payment-middleware
COPY --from=builder /usr/src/app/server/package*.json ./
COPY --from=builder /usr/src/app/server/dist ./dist

# Install only production dependencies
RUN npm install --omit=dev

# Expose the port your app runs on
EXPOSE 5000

# Start the server
CMD ["node", "dist/server.js"]