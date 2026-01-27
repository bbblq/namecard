# Stage 1: Build the frontend
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Node.js
FROM node:18-alpine

WORKDIR /app

# Install production dependencies for server
COPY package.json package-lock.json ./
RUN npm install --production

# Copy backend server code
COPY server ./server

# Copy built frontend assets from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory structure
RUN mkdir -p /app/data/fonts

# Environment variables
ENV PORT=80
ENV DATA_DIR=/app/data

EXPOSE 80

# Start the server
CMD ["node", "server/index.js"]
