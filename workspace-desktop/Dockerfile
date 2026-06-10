# ── Stage 1: Build frontend ───────────────────────────────────
FROM node:22-slim AS frontend

WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY vite.config.js ./
COPY index.html ./
COPY src/ ./src/

RUN npm run build

# ── Stage 2: Build Rust binary ────────────────────────────────
FROM rust:1.87-slim AS backend

RUN apt-get update && apt-get install -y pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy workspace-level manifest first (for caching)
COPY Cargo.toml ./

# Copy crate manifests
COPY crates/workspace-core/Cargo.toml ./crates/workspace-core/Cargo.toml
COPY src-server/Cargo.toml ./src-server/Cargo.toml

# Also need src-tauri manifest for workspace resolution (but we won't build it)
COPY src-tauri/Cargo.toml ./src-tauri/Cargo.toml

# Create stub sources for dependency caching
RUN mkdir -p crates/workspace-core/src src-server/src src-tauri/src && \
    echo "pub fn stub() {}" > crates/workspace-core/src/lib.rs && \
    echo "fn main() {}" > src-server/src/main.rs && \
    echo "fn main() {}" > src-tauri/src/main.rs

# Pre-build dependencies (cached layer)
RUN cargo build --release -p workspace-server 2>/dev/null || true

# Copy actual source
COPY crates/ ./crates/
COPY src-server/ ./src-server/

# Build for real
RUN cargo build --release -p workspace-server

# ── Stage 3: Minimal runtime ─────────────────────────────────
FROM debian:bookworm-slim AS runtime

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash workspace

WORKDIR /app

COPY --from=backend /build/target/release/workspace-server ./workspace-server
COPY --from=frontend /build/dist ./dist

RUN chown -R workspace:workspace /app

USER workspace

# Workspace data volume
VOLUME ["/home/workspace/.workspace"]

ENV PORT=3000
ENV STATIC_DIR=/app/dist

EXPOSE 3000

CMD ["./workspace-server"]
