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

# --- Node 22 (Eleventy + site tooling) ---
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
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
RUN curl -fsSL https://raw.githubusercontent.com/MystenLabs/suiup/main/install.sh | bash \
    && suiup install sui \
    && suiup install walrus \
    && suiup install site-builder

# --- Pre-fetch walrus-sites testnet config (docs/SETUP.md §5) ---
RUN mkdir -p /home/cortex/.config/walrus \
    && curl -fsSL https://raw.githubusercontent.com/MystenLabs/walrus-sites/refs/heads/testnet/sites-config.yaml \
        -o /home/cortex/.config/walrus/sites-config.yaml || \
       echo "WARN: sites-config.yaml fetch failed — fetch manually inside container (see docs/DOCKER.md)"

WORKDIR /workspace

# Keep the container alive for `docker compose exec` (dev container pattern).
CMD ["sleep", "infinity"]
