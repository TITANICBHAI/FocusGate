#!/bin/bash
# Sync the repo copy once, then run every test file in its own process so one broken import cannot hide the rest.
S=/tmp/claude-0/-home-claude/1d3d810c-0866-503f-8b36-d437fcdf9427/scratchpad
cd /home/claude/work/focusgate
bash $S/rt.sh tests/ui/spokenPassword.test.ts > /dev/null 2>&1
FILES=$(find tests -type f \( -name "*.test.ts" -o -name "*.test.tsx" -o -name "*.test.js" \) | sort)
: > $S/each-result.txt
cd $S/run
for f in $FILES; do
  out=$(timeout 120 node --import /home/claude/.npm-global/lib/node_modules/tsx/dist/loader.mjs run.mjs $f 2>&1)
  line=$(echo "$out" | grep -E "^$f: [0-9]+ passed, [0-9]+ failed" | tail -n 1)
  if [ -z "$line" ]; then
    err=$(echo "$out" | grep -E "Error|error" | head -n 1 | cut -c1-150)
    echo "$f: DID NOT RUN  $err" >> $S/each-result.txt
  else
    echo "$line" >> $S/each-result.txt
  fi
done
echo "files: $(wc -l < $S/each-result.txt)  passed: $(grep -oE '[0-9]+ passed' $S/each-result.txt | awk '{s+=$1} END{print s}')  failed: $(grep -oE '[0-9]+ failed' $S/each-result.txt | awk '{s+=$1} END{print s}')  did-not-run: $(grep -c 'DID NOT RUN' $S/each-result.txt)"
grep -E "DID NOT RUN|[1-9][0-9]* failed" $S/each-result.txt
