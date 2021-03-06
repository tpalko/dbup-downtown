'use strict';

import * as sqlite3 from 'sqlite3';

if (!process.env.PATH_TO_DB) {
  console.error('PATH_TO_DB is required'); 
  process.exit(1);
} 

console.log('PATH_TO_DB: ' + process.env.PATH_TO_DB);
const db = new sqlite3.Database(process.env.PATH_TO_DB);

module.exports = { db };
