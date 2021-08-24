'use strict';

import * as sqlite3 from 'sqlite3';

console.log('DB:' + process.env.PATH_TO_DB);
const db = new sqlite3.Database(process.env.PATH_TO_DB);

module.exports = { db };
