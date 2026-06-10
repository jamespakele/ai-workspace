# ── Stage 1: Build the frontend ──────────────────────────────
FROM node:22-slim AS frontend

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM node:22-slim AS runtime

WORKDIR /app

# Install only production deps + express
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts 2>/dev/null; \
    npm install express 2>/dev/null; \
    true

# Copy the built frontend and server
COPY --from=frontend /app/dist ./dist
COPY server.js ./

# Default workspace directory
ENV WORKSPACE_ROOT=/root/.workspace
ENV WORKSPACE_AGENT=hermes
ENV PORT=3000

# Create default workspace structure
RUN mkdir -p /root/.workspace/skills /root/.workspace/plugins

EXPOSE 3000

CMD ["node", "server.js"]
