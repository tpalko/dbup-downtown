'use strict';
exports.__esModule = true;
var sqlite3 = require("sqlite3");
console.log('DB:' + process.env.PATH_TO_DB);
var db = new sqlite3.Database(process.env.PATH_TO_DB);
module.exports = { db: db };
