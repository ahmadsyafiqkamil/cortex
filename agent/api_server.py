"""Cortex Ingest API Server.

Provides HTTP endpoints for the frontend to trigger wiki page generation
from registered sources.

Endpoints:
    POST /api/ingest       – start ingest job for a blob_id
    GET  /api/ingest/<id>  – check job status + live log
    GET  /api/health       – health check
"""

from __future__ import annotations

import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

_AGENT_DIR = Path(__file__).parent
_jobs: dict[str, dict] = {}
_lock = threading.Lock()


def _check_contributor(address: str) -> tuple[bool, str]:
    try:
        sys.path.insert(0, str(_AGENT_DIR))
        from chain import ChainClient

        chain = ChainClient()
        has_cap = bool(chain.has_contributor_cap(address))
        revoked = chain.is_contributor_revoked(address)

        if not has_cap:
            return False, "Address has no ContributorCap"
        if revoked:
            return False, "Contributor has been revoked"
        return True, ""
    except Exception as exc:
        return False, f"Chain lookup failed: {exc}"


def _run_ingest(job_id: str, blob_id: str, title: str, address: str) -> None:
    with _lock:
        _jobs[job_id]["status"] = "running"
        _jobs[job_id]["log"] = []

    cmd = [
        sys.executable, "-m", "cortex_cli", "ingest",
        "--blob-id", blob_id,
        "--title", title,
        "--address", address,
    ]

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        cwd=str(_AGENT_DIR),
    )

    out_lines: list[str] = []
    try:
        for line in proc.stdout:
            stripped = line.rstrip("\n").rstrip("\r")
            out_lines.append(stripped)
            with _lock:
                _jobs[job_id]["log"] = out_lines[-200:]  # keep last 200 lines
    except Exception:
        pass

    try:
        proc.wait(timeout=600)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait()
        out_lines.append("[API] TIMEOUT — process killed after 10 min")
        with _lock:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"] = "Ingest timed out (10 min limit)"
            _jobs[job_id]["log"] = out_lines[-200:]
        return

    with _lock:
        _jobs[job_id]["log"] = out_lines[-200:]

        if proc.returncode == 0:
            pages = _extract_page_slugs(out_lines)
            _jobs[job_id]["status"] = "done"
            _jobs[job_id]["pages"] = pages
        else:
            _jobs[job_id]["status"] = "error"
            last = "\n".join(out_lines[-20:]) or "(no output)"
            _jobs[job_id]["error"] = (
                f"Exit code {proc.returncode}. Last 20 lines:\n{last}"[:2000]
            )


def _extract_page_slugs(lines: list[str]) -> list[str]:
    pages: list[str] = []
    for line in lines:
        s = line.strip()
        if s.startswith("[") and "]: " in s:
            slug = s.split("]: ")[0].strip(" [")
            if slug and not slug.startswith("_") and "blob_id" not in slug.lower():
                pages.append(slug)
    return pages


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/ingest", methods=["POST"])
def start_ingest():
    body = request.get_json(silent=True) or {}
    blob_id = (body.get("blob_id") or "").strip()
    title = (body.get("title") or "").strip()
    address = (body.get("address") or "").strip()

    if not blob_id:
        return jsonify({"error": "blob_id is required"}), 400
    if not address:
        return jsonify({"error": "address is required"}), 400

    ok, err = _check_contributor(address)
    if not ok:
        return jsonify({"error": err}), 403

    if not title:
        title = blob_id[:32]

    job_id = str(uuid.uuid4())[:8]
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "status": "started",
            "blob_id": blob_id,
            "title": title,
            "address": address,
            "created_at": time.time(),
            "log": [],
            "pages": [],
            "error": "",
        }

    thread = threading.Thread(
        target=_run_ingest,
        args=(job_id, blob_id, title, address),
        daemon=True,
    )
    thread.start()

    return jsonify({"job_id": job_id, "status": "started"})


@app.route("/api/ingest/<job_id>", methods=["GET"])
def get_ingest_status(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({
        "job_id": job["id"],
        "status": job["status"],
        "blob_id": job.get("blob_id", ""),
        "title": job.get("title", ""),
        "pages": job.get("pages", []),
        "error": job.get("error", ""),
        "log": job.get("log", []),
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
