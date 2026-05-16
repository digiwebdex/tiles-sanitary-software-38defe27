import path from 'path';
import fs from 'fs';
import type { Knex } from 'knex';
import { loadBackendEnv } from '../config/loadEnv';

loadBackendEnv();

// Detect runtime: when running compiled JS from /app/dist, __filename ends with .js
// In that case we must point knex at the compiled .js migration files, not the .ts sources.
const isCompiled = __filename.endsWith('.js');
const extension = isCompiled ? 'js' : 'ts';
const migrationsDir = path.resolve(__dirname, 'migrations');
const seedsDir = path.resolve(__dirname, 'seeds');

class CompiledMigrationSource implements Knex.MigrationSource<string> {
  constructor(private readonly directory: string) {}

  async getMigrations(): Promise<string[]> {
    return fs
      .readdirSync(this.directory)
      .filter((file) => file.endsWith('.js'))
      .map((file) => file.replace(/\.js$/, '.ts'))
      .sort();
  }

  getMigrationName(migration: string): string {
    return migration;
  }

  async getMigration(migration: string): Promise<Knex.Migration> {
    const compiledFile = migration.replace(/\.ts$/, '.js');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(path.join(this.directory, compiledFile)) as Knex.Migration;
  }
}

const config: Knex.Config = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  pool: { min: 2, max: 10 },
  migrations: {
    directory: migrationsDir,
    tableName: 'knex_migrations',
    extension,
    loadExtensions: [`.${extension}`],
    ...(isCompiled ? { migrationSource: new CompiledMigrationSource(migrationsDir) } : {}),
  },
  seeds: {
    directory: seedsDir,
    extension,
    loadExtensions: [`.${extension}`],
  },
};

export default config;
