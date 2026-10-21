import aiosqlite
import json
import time
from typing import Dict, Any, List, Optional
from app.engine.models import Finding, ScanEvent

DB_PATH = "apiguard.db"

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scans (
                id TEXT PRIMARY KEY,
                target_url TEXT,
                status TEXT,
                started_at REAL,
                completed_at REAL,
                summary TEXT
            );
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS scan_events (
                id TEXT PRIMARY KEY,
                scan_id TEXT,
                timestamp REAL,
                event_type TEXT,
                phase TEXT,
                message TEXT,
                data TEXT
            );
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS findings (
                id TEXT PRIMARY KEY,
                scan_id TEXT,
                endpoint TEXT,
                method TEXT,
                resource_type TEXT,
                status TEXT,
                severity TEXT,
                confidence REAL,
                diff_fields TEXT,
                repro_curl TEXT,
                data TEXT
            );
        """)
        await db.commit()

async def save_scan(scan_id: str, target_url: str, status: str = "running"):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO scans (id, target_url, status, started_at) VALUES (?, ?, ?, ?)",
            (scan_id, target_url, status, time.time())
        )
        await db.commit()

async def save_scan_event(event: ScanEvent):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO scan_events (id, scan_id, timestamp, event_type, phase, message, data) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (event.event_id, event.scan_id, event.timestamp, event.event_type, event.phase, event.message, json.dumps(event.data or {}))
        )
        await db.commit()

async def save_finding(scan_id: str, finding: Finding):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """INSERT OR REPLACE INTO findings 
               (id, scan_id, endpoint, method, resource_type, status, severity, confidence, diff_fields, repro_curl, data)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                finding.id, scan_id, finding.endpoint, finding.method, finding.resource_type,
                finding.status.value, finding.severity, finding.confidence,
                json.dumps(finding.diff_fields), finding.repro_curl, json.dumps(finding.model_dump())
            )
        )
        await db.commit()

async def clear_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM findings")
        await db.execute("DELETE FROM scan_events")
        await db.execute("DELETE FROM scans")
        await db.commit()

async def get_findings(scan_id: Optional[str] = None) -> List[Dict[str, Any]]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if scan_id:
            cursor = await db.execute("SELECT data FROM findings WHERE scan_id = ?", (scan_id,))
        else:
            cursor = await db.execute("SELECT data FROM findings")
        rows = await cursor.fetchall()
        return [json.loads(row["data"]) for row in rows]
