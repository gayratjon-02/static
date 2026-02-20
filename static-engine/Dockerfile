# ---- Build Stage ----
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

RUN npm ci

# Copy source code
COPY . .

# Build the NestJS app
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy built app from builder
COPY --from=builder /usr/src/app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads

EXPOSE 5009

CMD ["node", "dist/src/main"]
