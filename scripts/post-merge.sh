#!/bin/bash
set -e

echo "=== Post-merge setup ==="

echo "Installing npm dependencies..."
npm install --legacy-peer-deps --yes

echo "=== Post-merge setup complete ==="
