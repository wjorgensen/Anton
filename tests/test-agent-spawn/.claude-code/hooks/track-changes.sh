#!/bin/bash
echo "Track changes hook executed"
find . -type f -newer /tmp/last_run 2>/dev/null || find . -type f
