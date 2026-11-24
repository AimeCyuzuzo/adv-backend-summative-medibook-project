#!/bin/sh
# Live, coloured view of logs/audit.log (one line per event, time in Kigali).
# Usage: npm run logs        (Ctrl+C to stop)
# Needs jq (pre-installed on macOS; `brew install jq` / `apt install jq` otherwise).

LOG_FILE="${AUDIT_LOG_PATH:-$(dirname "$0")/../logs/audit.log}"

# -F keeps following if the file doesn't exist yet or is deleted and recreated.
tail -n 20 -F "$LOG_FILE" 2>/dev/null | jq -r --unbuffered '
  ({ "APPOINTMENT_BOOKED":        "32",
     "APPOINTMENT_CANCELLED":     "33",
     "NOTIFICATION_SENT":         "36",
     "WAITLIST_PROMOTED":         "35",
     "WAITLIST_PROMOTION_FAILED": "31" }[.event] // "37") as $colour
  | (.timestamp | sub("\\.[0-9]+Z$"; "Z") | fromdateiso8601 + 7200 | strftime("%H:%M:%S")) as $time
  | "\u001b[90m\($time)\u001b[0m \u001b[1;\($colour)m\(.event)\u001b[0m \(del(.timestamp, .event) | tojson)"
'
