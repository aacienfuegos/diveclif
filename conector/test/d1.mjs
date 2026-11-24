// D1 de prueba sobre node:sqlite con las migraciones de conector/migrations. En JavaScript para no
// necesitar los tipos de Node: los tipos están en d1.d.ts.
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const MIGRACIONES = new URL('../migrations/', import.meta.url);

class Sentencia {
  constructor(db, sql, params = []) {
    this.db = db;
    this.sql = sql;
    this.params = params;
  }
  bind(...params) {
    return new Sentencia(this.db, this.sql, params);
  }
  filas() {
    return this.db.prepare(this.sql).all(...this.params).map((f) => ({ ...f }));
  }
  async first(columna) {
    const fila = this.filas()[0] ?? null;
    return columna === undefined || fila === null ? fila : fila[columna];
  }
  async all() {
    return { results: this.filas(), success: true, meta: {} };
  }
  async run() {
    const r = this.db.prepare(this.sql).run(...this.params);
    return { results: [], success: true, meta: { changes: Number(r.changes) } };
  }
  async raw() {
    return this.filas().map((f) => Object.values(f));
  }
}

export function crearD1() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync(MIGRACIONES).filter((n) => n.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL(f, MIGRACIONES), 'utf8'));
  }
  return {
    prepare: (sql) => new Sentencia(db, sql),
    batch: async (sentencias) => {
      db.exec('BEGIN');
      try {
        const r = [];
        for (const s of sentencias) r.push(await s.all());
        db.exec('COMMIT');
        return r;
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    exec: async (sql) => {
      db.exec(sql);
      return { count: 0, duration: 0 };
    },
    /** Para los tests: SQL directo. */
    sql: (sql, ...params) => db.prepare(sql).all(...params).map((f) => ({ ...f })),
  };
}
