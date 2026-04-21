from datetime import datetime

from sqlalchemy import inspect, text

from database.db import Base, engine
from utils.timezone import utc_naive_to_local_naive


def _table_columns(table_name):
    inspector = inspect(engine)
    if not inspector.has_table(table_name):
        return set()
    return {column["name"] for column in inspector.get_columns(table_name)}


def _add_column_if_missing(table_name, column_name, definition):
    if column_name in _table_columns(table_name):
        return
    with engine.begin() as connection:
        connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}"))


def _ensure_app_meta_table():
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_meta (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
                """
            )
        )


def _meta_value(key):
    _ensure_app_meta_table()
    with engine.begin() as connection:
        result = connection.execute(text("SELECT value FROM app_meta WHERE key = :key"), {"key": key}).fetchone()
        return result[0] if result else None


def _set_meta_value(key, value):
    _ensure_app_meta_table()
    with engine.begin() as connection:
        connection.execute(
            text(
                """
                INSERT INTO app_meta (key, value)
                VALUES (:key, :value)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value
                """
            ),
            {"key": key, "value": value},
        )


def _shift_table_datetimes_to_local(table_name, columns):
    inspector = inspect(engine)
    if not inspector.has_table(table_name):
        return

    available = {column["name"] for column in inspector.get_columns(table_name)}
    target_columns = [column for column in columns if column in available]
    if not target_columns:
        return

    with engine.begin() as connection:
        rows = connection.execute(text(f"SELECT rowid AS _rowid, {', '.join(target_columns)} FROM {table_name}")).mappings().all()
        for row in rows:
            updates = {}
            for column in target_columns:
                value = row[column]
                if value is None:
                    continue
                if isinstance(value, str):
                    try:
                        value = datetime.fromisoformat(value)
                    except ValueError:
                        continue
                updates[column] = utc_naive_to_local_naive(value).isoformat(sep=" ")
            if not updates:
                continue
            assignments = ", ".join(f"{column} = :{column}" for column in updates.keys())
            params = {"rowid": row["_rowid"], **updates}
            connection.execute(text(f"UPDATE {table_name} SET {assignments} WHERE rowid = :rowid"), params)


def migrate_existing_utc_timestamps():
    if _meta_value("timezone_migration_applied") == "1":
        return

    _shift_table_datetimes_to_local("entregas", ["data_recebimento", "data_entrega", "created_at", "updated_at"])
    _shift_table_datetimes_to_local("moradores", ["created_at", "updated_at"])
    _shift_table_datetimes_to_local("visitantes", ["autorizado_em", "entrada_em", "saida_em", "created_at", "updated_at"])
    _shift_table_datetimes_to_local("veiculos", ["created_at", "updated_at"])
    _shift_table_datetimes_to_local("ocorrencias", ["created_at", "updated_at"])
    _shift_table_datetimes_to_local("reservas_areas", ["created_at", "updated_at"])

    _set_meta_value("timezone_migration_applied", "1")


def bootstrap_database():
    Base.metadata.create_all(bind=engine)

    # Compatibilidade com bases SQLite já existentes do CRUD antigo de entregas.
    _add_column_if_missing("entregas", "morador_nome", "VARCHAR(120) NOT NULL DEFAULT 'Nao informado'")
    _add_column_if_missing("entregas", "recebedor_nome", "VARCHAR(120) NOT NULL DEFAULT 'Portaria'")
    _add_column_if_missing("entregas", "qr_code", "VARCHAR(255)")
    _add_column_if_missing("entregas", "codigo_barras", "VARCHAR(255)")
    _add_column_if_missing("entregas", "foto_url", "TEXT")
    _add_column_if_missing("entregas", "observacao", "TEXT")
    _add_column_if_missing("entregas", "data_recebimento", "DATETIME")
    _add_column_if_missing("entregas", "data_entrega", "DATETIME")
    _add_column_if_missing("entregas", "created_at", "DATETIME")
    _add_column_if_missing("entregas", "updated_at", "DATETIME")
    migrate_existing_utc_timestamps()
