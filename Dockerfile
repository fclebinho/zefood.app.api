# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate Prisma client (need dummy DATABASE_URL for generation)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose port
EXPOSE 3001

# Create startup script that runs migrations before starting
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'npx prisma db push --skip-generate' >> /app/start.sh && \
    echo 'node dist/main.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# Start the application with migrations
CMD ["/bin/sh", "/app/start.sh"]
