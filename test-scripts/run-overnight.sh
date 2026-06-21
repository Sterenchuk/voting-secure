#!/bin/bash
set -e


# 3. Launch the test
# k6 depends on nginx, which depends on healthy backends
docker compose --profile stress-test up --abort-on-container-exit k6
