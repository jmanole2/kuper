import * as migration_20261120_180937_initial from './20261120_180937_initial';

export const migrations = [
  {
    up: migration_20261120_180937_initial.up,
    down: migration_20261120_180937_initial.down,
    name: '20261120_180937_initial'
  },
];
