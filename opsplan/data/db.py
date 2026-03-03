"""
Database connection and initialization for OpsPlan.
Uses SQLite with aiosqlite for async access.
"""
import sqlite3
import aiosqlite
from pathlib import Path
import structlog

from config.settings import settings

logger = structlog.get_logger()

SCHEMA_PATH = Path(__file__).parent / "schema.sql"


def init_db() -> None:
    """Initialize the database synchronously (for setup scripts)."""
    db_path = settings.database.path
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path)
    schema_sql = SCHEMA_PATH.read_text()
    conn.executescript(schema_sql)
    conn.close()
    logger.info("database.initialized", path=db_path)


async def get_db() -> aiosqlite.Connection:
    """Get an async database connection."""
    db = await aiosqlite.connect(settings.database.path)
    db.row_factory = aiosqlite.Row
    return db


async def query(sql: str, params: tuple = ()) -> list[dict]:
    """Execute a query and return results as list of dicts."""
    db = await get_db()
    try:
        cursor = await db.execute(sql, params)
        rows = await cursor.fetchall()
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
        return [dict(zip(columns, row)) for row in rows]
    finally:
        await db.close()


async def execute(sql: str, params: tuple = ()) -> int:
    """Execute a write operation and return rows affected."""
    db = await get_db()
    try:
        cursor = await db.execute(sql, params)
        await db.commit()
        return cursor.rowcount
    finally:
        await db.close()
