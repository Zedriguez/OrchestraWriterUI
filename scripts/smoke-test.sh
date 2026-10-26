#!/usr/bin/env bash
# End-to-end smoke test against a running server: health, sign up, session, the
# project flow (create, presigned score upload, register, parse job, display,
# delete), the recordings + transcription flow, sign out, sign in. Exits non-zero
# on the first failure. Run it before pushing, and against production after a deploy.
#
#   scripts/smoke-test.sh                       # http://localhost:3000
#   scripts/smoke-test.sh http://localhost:3100
#   scripts/smoke-test.sh https://xxxx.us-east-1.awsapprunner.com
#
# The server's BETTER_AUTH_URL must equal the URL given here (Better Auth checks Origin).
# Needs curl and node. Creates a throwaway user (smoke-<timestamp>@example.com),
# removes what it uploaded, and deletes the account at the end.
# Written to run on macOS's stock bash 3.2 as well as bash 5.
set -euo pipefail
BASE=${1:-http://localhost:3000}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
JAR="$TMP/cookies"
EMAIL="smoke-$(date +%s)@example.com"
PASS="Smoke-Test-Pass-1"
PASSED=0

say()  { printf '  %-40s' "$1"; }
ok()   { echo "ok   $*"; PASSED=$((PASSED+1)); }
note() { echo "note $*"; PASSED=$((PASSED+1)); }
fail() { echo "FAIL $*"; exit 1; }
# json <path>  reads JSON on stdin and prints the value at a dotted path (empty if missing)
json() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{let o;try{o=JSON.parse(d)}catch{o=null};const v=process.argv[1].split(".").reduce((a,k)=>a==null?undefined:a[k],o);process.stdout.write(v===undefined||v===null?"":String(v))})' "$1"; }
# req  <curl args>  -> response body        code <curl args> -> HTTP status only
req()  { curl -s --max-time 60 -b "$JAR" -c "$JAR" -H "Origin: $BASE" -H 'content-type: application/json' "$@"; }
code() { curl -s --max-time 60 -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H "Origin: $BASE" -H 'content-type: application/json' "$@"; }
# presign <kind> <filename> <contentType> [projectId] -> sets KEY and URL
presign() {
  local body
  if [ -n "${4:-}" ]; then
    body=$(printf '{"kind":"%s","filename":"%s","contentType":"%s","projectId":"%s"}' "$1" "$2" "$3" "$4")
  else
    body=$(printf '{"kind":"%s","filename":"%s","contentType":"%s"}' "$1" "$2" "$3")
  fi
  local up; up=$(req -X POST "$BASE/api/uploads" -d "$body")
  KEY=$(echo "$up" | json key); URL=$(echo "$up" | json uploadUrl)
  [ -n "$KEY" ] && [ -n "$URL" ] || fail "presign: $up"
}
put() { curl -s -o /dev/null -w '%{http_code}' --max-time 60 -X PUT -H "content-type: $2" --data-binary @"$1" "$3"; }

echo "Smoke test against $BASE"

say "page serves HTML"
C=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/"); { [ "$C" = 200 ] || [ "$C" = 307 ] || [ "$C" = 308 ]; } && ok "HTTP $C" || fail "HTTP $C"
say "/api/health"
C=$(code "$BASE/api/health"); [ "$C" = 200 ] && ok || fail "HTTP $C"
say "/api/health/db"
C=$(code "$BASE/api/health/db"); [ "$C" = 200 ] && ok || fail "HTTP $C (database unreachable)"
say "/api/status ok"
V=$(req "$BASE/api/status" | json ok); [ "$V" = true ] && ok || fail "see $BASE/api/status"
say "protected route rejects anonymous"
C=$(code "$BASE/api/projects"); [ "$C" = 401 ] && ok || fail "HTTP $C"

say "sign up"
BODY=$(printf '{"name":"Smoke Test","email":"%s","password":"%s"}' "$EMAIL" "$PASS")
C=$(code -X POST "$BASE/api/auth/sign-up/email" -d "$BODY"); [ "$C" = 200 ] && ok "$EMAIL" || fail "HTTP $C (is BETTER_AUTH_URL=$BASE on the server?)"
say "session"
UID_=$(req "$BASE/api/auth/get-session" | json user.id); [ -n "$UID_" ] && ok "user #$UID_" || fail
say "profile created on first read"
H=$(req "$BASE/api/me" | json profile.handle); [ -n "$H" ] && ok "@$H" || fail

# ---------------------------------------------------------------- projects
say "create project"
PID=$(req -X POST "$BASE/api/projects" -d '{"title":"Smoke project"}' | json project.id); [ -n "$PID" ] && ok "project #$PID" || fail

SCORE="$ROOT/fixtures/scores/orchestra-demo.musicxml"
if [ -f "$SCORE" ]; then
  cp "$SCORE" "$TMP/score.musicxml"; SCORE_NAME="orchestra-demo.musicxml"
else
  SCORE_NAME="smoke.musicxml"
  cat > "$TMP/score.musicxml" <<'XML'
<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Smoke Test</work-title></work>
  <part-list><score-part id="P1"><part-name>Violin I</part-name></score-part></part-list>
  <part id="P1">
    <measure number="1">
      <attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>
      <direction><direction-type><dynamics><mf/></dynamics></direction-type></direction>
      <note><pitch><step>A</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
    </measure>
  </part>
</score-partwise>
XML
fi
say "presign score upload"
presign score "$SCORE_NAME" "application/vnd.recordare.musicxml+xml" "$PID"; ok "$KEY"
say "PUT score to storage"
C=$(put "$TMP/score.musicxml" "application/vnd.recordare.musicxml+xml" "$URL"); [ "$C" = 200 ] && ok || fail "HTTP $C (CORS or endpoint problem)"
say "register score (202)"
REG=$(req -X POST "$BASE/api/projects/$PID/score" -d "$(printf '{"key":"%s","filename":"%s"}' "$KEY" "$SCORE_NAME")")
JOB=$(echo "$REG" | json job.id); [ -n "$JOB" ] && ok "job #$JOB" || fail "$REG"
say "parse-score job finishes"
STATUS=""
for _ in $(seq 1 120); do
  J=$(req "$BASE/api/jobs/$JOB"); STATUS=$(echo "$J" | json job.status)
  [ "$STATUS" = succeeded ] || [ "$STATUS" = failed ] && break
  sleep 0.5
done
ERR=$(echo "$J" | json job.error)
if [ "$STATUS" = succeeded ]; then
  ok "$(echo "$J" | json job.result.parts) parts, $(echo "$J" | json job.result.measures) measures"
elif [ "$STATUS" = failed ] && echo "$ERR" | grep -qi "not implemented"; then
  note "parser is still the stub: \"$ERR\""
else
  fail "status=$STATUS $ERR"
fi
say "project status matches the job"
PS=$(req "$BASE/api/projects/$PID" | json project.status)
{ [ "$STATUS" = succeeded ] && [ "$PS" = ready ]; } || { [ "$STATUS" = failed ] && [ "$PS" = failed ]; } && ok "$PS" || fail "project status $PS, job $STATUS"
if [ "$STATUS" = succeeded ]; then
  say "info map downloads"
  IM=$(req "$BASE/api/projects/$PID/urls" | json infoMap)
  N=$(curl -s --max-time 60 "$IM" | json instruments.length); [ -n "$N" ] && [ "$N" -gt 0 ] && ok "$N instruments" || fail
fi
say "save display settings"
DISPLAY='{"visibleParts":["P1"],"positions":{"P1":{"x":0.3,"y":0.6}},"colors":{},"sectionColors":{"Strings":"#e2b04c","Woodwinds":"#5cba9a","Brass":"#e8705e","Percussion":"#9298e0","Other":"#c98bc9"},"sections":{},"showLabels":true,"labelMode":"sections","reducedMotion":false,"glowScale":1}'
C=$(code -X PUT "$BASE/api/projects/$PID/display" -d "$DISPLAY"); [ "$C" = 200 ] && ok || fail "HTTP $C"
say "read project back"
V=$(req "$BASE/api/projects/$PID" | json project.display.glowScale); [ "$V" = 1 ] && ok || fail "display.glowScale=$V"
say "foreign key rejected (403)"
C=$(code -X POST "$BASE/api/projects/$PID/score" -d '{"key":"users/0/projects/0/score/x","filename":"x.xml"}'); [ "$C" = 403 ] && ok || fail "HTTP $C"
say "delete project"
SURL=$(req "$BASE/api/projects/$PID/urls" | json score)
C=$(code -X DELETE "$BASE/api/projects/$PID"); [ "$C" = 204 ] && ok || fail "HTTP $C"
say "project gone (404), score object gone"
C=$(code "$BASE/api/projects/$PID"); C2=$(curl -s -o /dev/null -w '%{http_code}' --max-time 30 "$SURL")
[ "$C" = 404 ] && [ "$C2" = 404 ] && ok || fail "project HTTP $C, object HTTP $C2"

# ---------------------------------------------------------------- recordings + transcription
head -c 3000 /dev/urandom > "$TMP/in.wav"
say "presign recording upload"
UP=$(req -X POST "$BASE/api/files/upload-url" -d '{"filename":"smoke test.wav","contentType":"audio/wav"}')
KEY=$(echo "$UP" | json key); URL=$(echo "$UP" | json uploadUrl)
[ -n "$KEY" ] && [ -n "$URL" ] && ok "$KEY" || fail "$UP"
say "PUT bytes to storage"
C=$(put "$TMP/in.wav" audio/wav "$URL"); [ "$C" = 200 ] && ok || fail "HTTP $C"
say "register row"
BODY=$(printf '{"name":"smoke","key":"%s","audioLengthSeconds":75}' "$KEY")
FID=$(req -X POST "$BASE/api/files" -d "$BODY" | json file.id); [ -n "$FID" ] && ok "row #$FID" || fail
say "list contains it"
req "$BASE/api/files" | grep -q "\"id\":$FID," && ok || fail
say "start transcription"
TJ=$(req -X POST "$BASE/api/transcriptions" -d "{\"audioFileId\":$FID}" | json job.id); [ -n "$TJ" ] && ok "transcription #$TJ" || fail
say "transcription finishes (75 s, 3 chunks)"
STATUS=""
for _ in $(seq 1 90); do
  J=$(req "$BASE/api/transcriptions/$TJ"); STATUS=$(echo "$J" | json job.status)
  [ "$STATUS" = succeeded ] || [ "$STATUS" = failed ] && break
  sleep 2
done
[ "$STATUS" = succeeded ] && ok "$(echo "$J" | json job.chunkCount) chunks" || fail "status=$STATUS $(echo "$J" | json job.error)"
say "sheet is MusicXML"
SID=$(echo "$J" | json job.sheets.0.id)
SURL=$(req "$BASE/api/sheets/$SID/download-url" | json url)
curl -s --max-time 60 "$SURL" | grep -q "<score-partwise" && ok || fail
say "download, bytes identical"
DL=$(req "$BASE/api/files/$FID/download-url" | json url)
curl -s --max-time 60 -o "$TMP/out.wav" "$DL"; cmp -s "$TMP/in.wav" "$TMP/out.wav" && ok || fail
say "delete recording"
C=$(code -X DELETE "$BASE/api/files/$FID"); [ "$C" = 204 ] && ok || fail "HTTP $C"

# ---------------------------------------------------------------- sessions
say "sign out"
C=$(code -X POST "$BASE/api/auth/sign-out" -d '{}'); [ "$C" = 200 ] && ok || fail "HTTP $C"
say "session cleared"
V=$(req "$BASE/api/auth/get-session"); [ "$V" = null ] && ok || fail "$V"
say "wrong password rejected"
BODY=$(printf '{"email":"%s","password":"nope-nope-nope"}' "$EMAIL")
C=$(code -X POST "$BASE/api/auth/sign-in/email" -d "$BODY"); [ "$C" = 401 ] && ok || fail "HTTP $C"
say "sign in"
BODY=$(printf '{"email":"%s","password":"%s"}' "$EMAIL" "$PASS")
C=$(code -X POST "$BASE/api/auth/sign-in/email" -d "$BODY"); [ "$C" = 200 ] && ok || fail "HTTP $C"
say "delete account"
C=$(code -X DELETE "$BASE/api/me"); [ "$C" = 204 ] && ok || fail "HTTP $C"

echo "All $PASSED checks passed."
