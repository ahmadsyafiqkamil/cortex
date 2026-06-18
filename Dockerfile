# Cortex dev container — reproducible tooling for Sui Overflow 2026 (Walrus Track).
#
# Design: TOOLING lives in the image; SECRETS/STATE live in volumes + env.
# The Sui keystore, Walrus config, agent/.cortex/, and LLM_API_KEY are NEVER
# baked into the image (CLAUDE.md aturan keras #7; no hardcoded secrets).
#
# Base: ubuntu 24.04 ships Python 3.12 (>=3.11 required) without extra PPAs.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PATH="/home/cortex/.local/bin:${PATH}"

# --- System deps (per docs/SETUP.md §1) ---
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl git build-essential libssl-dev pkg-config ca-certificates \
        python3 python3-venv python3-pip \
        sudo unzip jq \
    && rm -rf /var/lib/apt/lists/*

# --- Node 22 (Vite + React frontend) ---
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && npm install -g pnpm \
    && rm -rf /var/lib/apt/lists/*

# --- Non-root user (sane perms on mounted volumes) ---
RUN useradd -m -s /bin/bash cortex \
    && echo "cortex ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/cortex \
    && chmod 0440 /etc/sudoers.d/cortex
USER cortex
WORKDIR /home/cortex

# --- suiup: official installer for sui / walrus / site-builder ---
# suiup ships prebuilt binaries (no Rust toolchain needed in the image).
# If the install URL changes, see github.com/MystenLabs/suiup and docs.sui.io.
# Install, then explicitly set each binary as the active default so
# `sui`/`walrus`/`site-builder` resolve on PATH (install alone does not set a default).
#
# suiup + install.sh hit the GitHub API for release lists. The anonymous limit is
# 60 req/hr per IP — a clean rebuild can 403 if that budget is exhausted. Pass a token
# (5000 req/hr) to avoid it:  docker compose build --build-arg GITHUB_TOKEN=ghp_xxx
# suiup honors GITHUB_TOKEN via [env: GITHUB_TOKEN]. Leave empty for anonymous.
ARG GITHUB_TOKEN=""
ENV GITHUB_TOKEN=${GITHUB_TOKEN}
RUN curl -fsSL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | bash \
    && suiup install sui -y \
    && suiup install walrus -y \
    && suiup install site-builder -y \
    && suiup default set sui@testnet \
    && suiup default set walrus@testnet \
    && suiup default set site-builder@mainnet \
    && suiup show \
    # Fail the build if the defaults didn't land on PATH.
    && sui --version && walrus --version && site-builder --version

# --- Pre-fetch walrus configs (storage client + sites) ---
# Storage client config (for `walrus store/read`):
RUN mkdir -p /home/cortex/.config/walrus \
    && curl -fsSL https://docs.wal.app/setup/client_config.yaml \
        -o /home/cortex/.config/walrus/client_config.yaml || \
       echo "WARN: client_config.yaml fetch failed — run bootstrap-inside.sh inside container" \
    # Sites config (for `site-builder deploy`):
    && curl -fsSL https://raw.githubusercontent.com/MystenLabs/walrus-sites/refs/heads/testnet/sites-config.yaml \
        -o /home/cortex/.config/walrus/sites-config.yaml || \
       echo "WARN: sites-config.yaml fetch failed — fetch manually inside container (see docs/DOCKER.md)"

WORKDIR /workspace

# --- Python venv for agent deps (avoids PEP 668 on ubuntu 24.04) ---
# Copied from host at build time so VENV is baked into the image.
COPY agent/requirements.txt /tmp/cortex-requirements.txt
RUN python3 -m venv /home/cortex/venv \
    && /home/cortex/venv/bin/pip install --no-cache-dir -r /tmp/cortex-requirements.txt
ENV PATH="/home/cortex/venv/bin:${PATH}"

# Keep the container alive for `docker compose exec` (dev container pattern).
CMD ["sleep", "infinity"]
