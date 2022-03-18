'use strict';
exports.__esModule = true;
var sqlite3 = require("sqlite3");
if (!process.env.PATH_TO_DB) {
    console.error('PATH_TO_DB is required');
    process.exit(1);
}
console.log('PATH_TO_DB: ' + process.env.PATH_TO_DB);
var db = new sqlite3.Database(process.env.PATH_TO_DB);
module.exports = { db: db };
