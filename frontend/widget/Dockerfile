# Widget Build Dockerfile
# This builds the widget and serves it via nginx
# The widget is a single JS file that clients embed on their websites

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build argument for API URL (the backend URL clients' widgets will call)
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=$VITE_API_URL

# Build the widget
RUN npm run build

# Stage 2: Serve via nginx (for self-hosted widget serving)
FROM nginx:alpine AS production

# Add labels
LABEL org.opencontainers.image.source="https://github.com/yourusername/CSAIProj"
LABEL org.opencontainers.image.description="CSAI Chat Widget CDN"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built widget from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# =============================================================================
# ALTERNATIVE: Extract artifact only (for CDN deployment)
# =============================================================================
# To extract just the built widget.js for CDN deployment:
#
# docker build --target builder -t widget-builder .
# docker create --name temp-widget widget-builder
# docker cp temp-widget:/app/dist/widget.js ./widget.js
# docker rm temp-widget
#
# Then upload widget.js to your CDN (Cloudflare R2, S3, etc.)
# =============================================================================
