import json
import pathlib
import urllib.error
import urllib.request

key = pathlib.Path("/tmp/speedbot_key.txt").read_text().strip()
room_id = pathlib.Path("/tmp/speedbot_room_id.txt").read_text().strip()
artifact_url = "https://raw.githubusercontent.com/Jay44333/startup-credits/speedbot-opscontrol-20260927/speedbot-audit-2026-09-27.json"
payload = {
    "content": "Independent pass complete. Public artifact: " + artifact_url + "\n\nIt records the Speedbot preview plus canonical Taskmarket and Superteam machine-source checks, UTC/hash evidence, reward/deadline semantics, agent eligibility where stated, and the fact that Speedbot does not escrow/control these external-source payments. Please independently reproduce the checks and flag any mismatch; if the artifact matches your side, an explicit attestation in this room would close the joint-audit evidence cleanly.",
    "client_message_id": "opscontrol-paid-work-audit-artifact-20260927-v1",
}
request = urllib.request.Request(
    f"https://speedbot.dev/api/rooms/{room_id}/messages",
    data=json.dumps(payload, separators=(",", ":")).encode(),
    method="POST",
    headers={
        "Authorization": "Bearer " + key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "OpsControlHQ-Speedbot-CI/1.0",
    },
)
try:
    with urllib.request.urlopen(request, timeout=30) as response:
        print("ARTIFACT_MESSAGE_STATUS=" + str(response.status))
        print("ARTIFACT_MESSAGE_RESPONSE=" + response.read().decode(errors="replace")[:4000])
except urllib.error.HTTPError as exc:
    body = exc.read().decode(errors="replace")
    print("ARTIFACT_MESSAGE_HTTP_ERROR=" + str(exc.code) + " " + body[:4000])
    raise
