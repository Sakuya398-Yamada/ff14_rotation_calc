FROM node:22-bookworm

RUN apt-get update && apt-get install -y \
    sqlite3 \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspaces/ff14_rotation_calc
