# Reservation API internal routing

Scope: Reservation API only. Public Traefik, Appwrite vendor compose, browser
configuration, Notification, Reminder, business policies and schemas stay intact.

Deploy this directory to `/home/john/srv/appwrite-internal-proxy`. The independent
compose project reuses external `runtimes` and `appwrite` networks. It publishes
no host ports and opts out of Traefik discovery. The only upstream is
`http://appwrite`, with Host `appwrite` (avoids Appwrite 1.8.1 HTTPS redirect).
The internal URL is `http://appwrite-internal-proxy/v1`. Dynamic API key and JWT
headers are forwarded unchanged. HTTP is confined to existing Docker bridges;
runtime containers sharing that bridge can reach the API but still require
Appwrite authorization. Proxy logs do not record request bodies or headers.

The endpoint resolver uses `APPWRITE_INTERNAL_API_ENDPOINT` when configured.
An invalid value fails closed. An absent variable preserves the injected public
endpoint. There is no automatic failover or retry, including for writes.

## Preflight and deployment

Record current active IDs, artifact source hashes, Function settings and variable
fingerprints before mutation. Never include secret values in the evidence.
`manage.py` reads the existing server env file in memory. Management calls use
the existing loopback Traefik HTTP listener with Host `appwrite`; production
Function gate requests use the public endpoint as customers do.

Run the isolated Docker transport test before starting the production proxy:
`python3 tests/internal-proxy-transport.py`. Its synthetic POST verifies body,
query and auth header preservation, lack of caching, and no retry on HTTP 503.

From the installed directory:

```sh
python3 manage.py snapshot
docker compose -f compose.yaml config --quiet
docker compose -f compose.yaml up -d --wait
python3 sdk-preflight.py <existing-runtimes-only-container>
python3 manage.py configure
python3 manage.py deploy --phase checkpoint
python3 manage.py wait --phase checkpoint
python3 manage.py activate --phase checkpoint
python3 manage.py gate --phase checkpoint
python3 manage.py deploy --phase full
python3 manage.py wait --phase full
python3 manage.py activate --phase full
python3 manage.py gate --phase full
```

The supplied `reservation-api.tar.gz` must contain only package.json,
package-lock.json and src from the audited candidate. Both phases deploy the
same source archive: this is routing-only, so currently enabled Chocolate,
Cake, S'more and Custom Cake policies must not be toggled. The existing Chocolate
rollout helper is deliberately not used because its checkpoint disables
Chocolate writes and its deploy command updates unrelated Function settings.

Each gate makes exactly 30 sequential health and 30 sequential capability calls.
Any failure stops the gate and prevents full deployment. Investigate and roll
back; do not repeat a failed gate until an identified cause is resolved.
`/healthz` is only container liveness; authenticated SDK preflight and Function
gates are mandatory. A healthy container alone never authorizes rollout.

## Rollback

```sh
cd /home/john/srv/appwrite-internal-proxy
python3 manage.py rollback
docker compose -f compose.yaml stop appwrite-internal-proxy
# Optional removal after confirming the original deployment is active:
docker compose -f compose.yaml down
```

The rollback restores `6aba25d85d117e8969b2`, confirms its active ID, then removes
only the newly added endpoint variable. No other settings/variables are touched.
That deployment understands existing Chocolate and Custom Cake stored records.
The proxy can remain running during rollback. Stopping it while a deployment
still uses it would interrupt service; switch the Function first. External
networks and vendor containers are never removed by this compose project.

`state/` contains sanitized immutable baseline and append-only mutation intents,
deployment IDs, per-request latency and gate results. Preserve it for operations,
but do not commit it or the archive. A timed-out mutation is ambiguous: inspect
actual state rather than repeat a deployment, activation or variable write.
