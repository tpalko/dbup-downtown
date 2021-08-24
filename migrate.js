var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var db = require('./Database').db;
var fs = require('fs');
var MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER || './migrations';
var Migration = /** @class */ (function () {
    function Migration() {
    }
    return Migration;
}());
var getMigration = function (file) {
    var migrationExtension = file.split('.')[1];
    if (migrationExtension != "json") {
        return;
    }
    return new Promise(function (resolve, reject) {
        var migrationName = file.split('.')[0];
        console.log("Found migration " + file);
        db.get('SELECT name FROM migrations WHERE name = $name', { $name: migrationName }, function (err, row) {
            if (err) {
                console.error(err);
            }
            else {
                var inTable_1 = row !== undefined;
                var migrationFile = MIGRATIONS_FOLDER + "/" + file;
                fs.readFile(migrationFile, function (readErr, data) {
                    var migration = JSON.parse(data);
                    resolve({ name: migrationName, up: migration.up, down: migration.down, executed: inTable_1 });
                });
            }
        });
    });
};
function applyAndLogMigration(migration, direction) {
    var notDirection = direction === 'up' ? 'down' : 'up';
    return new Promise(function (resolve, reject) {
        console.log(" --> " + migration[direction]);
        db.exec(migration[direction], function (dbRunErr) {
            if (dbRunErr) {
                console.error("An error occurred running " + migration.name + " " + direction);
                console.error(dbRunErr);
                reject(dbRunErr);
            }
            else {
                console.log("Migration " + migration.name + " applied!");
                var logSql = direction === 'up' ? 'INSERT INTO migrations (name) values($name)' : 'DELETE FROM migrations where name = $name';
                console.log(" --> " + logSql + " (" + migration.name + ")");
                db.run(logSql, { $name: migration.name }, function (dbLogErr) {
                    if (dbLogErr) {
                        console.error("An error occurred logging " + migration.name);
                        console.error(dbLogErr);
                        db.exec(migration[notDirection], function (dbRollbackErr) {
                            if (dbRollbackErr) {
                                console.error("An error occurred running " + migration.name + " " + notDirection);
                                console.error(dbRollbackErr);
                            }
                            else {
                                console.log("Migration " + migration.name + " rolled back!");
                            }
                            reject(dbRollbackErr || dbLogErr);
                        });
                    }
                    else {
                        console.log("Migration " + migration.name + " accounted");
                        resolve(migration);
                    }
                });
            }
        });
    });
}
function applyAndLogMigrations(migrations, direction, count) {
    if (count > 0 && migrations.length > 0) {
        applyAndLogMigration(migrations[0], direction)
            .then(function (migration) {
            applyAndLogMigrations(migrations.slice(1), direction, --count);
        })["catch"](function (err) {
            console.error(err);
        });
    }
    else {
        console.log('The end of migrations');
    }
}
function sortMigrations(migrations, direction) {
    var migrationQueue = {};
    migrations.forEach(function (migration) {
        migrationQueue[migration.name] = __assign({}, migration);
    });
    var migrationQueueKeys = Object.keys(migrationQueue);
    if (direction === 'up') {
        migrationQueueKeys.sort();
    }
    else {
        migrationQueueKeys.reverse();
    }
    return migrationQueueKeys.map(function (migrationName) { return migrationQueue[migrationName]; });
}
function migrate(direction, count) {
    fs.readdir(MIGRATIONS_FOLDER, function (err, files) {
        if (err) {
            throw err;
        }
        console.log("Reading " + MIGRATIONS_FOLDER + ", found " + files.length + " files");
        Promise.all(files.map(getMigration))
            .then(function (migrations) {
            console.log("Have " + migrations.length + " migrations");
            var filteredMigrations = migrations.filter(function (migration) { return migration && ((direction === 'up' && !migration.executed) || (direction === 'down' && migration.executed)); });
            console.log("Found " + filteredMigrations.length + " applicable migrations");
            return filteredMigrations;
        })
            .then(function (filteredMigrations) {
            return sortMigrations(filteredMigrations, direction);
        })
            .then(function (sortedMigrations) {
            applyAndLogMigrations(sortedMigrations, direction, count);
        })["catch"](function (something) {
            console.error(something);
        });
    });
}
function run(direction, count) {
    console.log("Migrating " + count + " " + direction);
    db.get('SELECT 1 from migrations', function (err, row) {
        var tableCheck;
        if (err) {
            console.error(err);
            tableCheck = new Promise(function (resolve) {
                console.log('Creating migrations table');
                db.run('CREATE TABLE migrations (name TEXT, executed_at DATE)', function (err) {
                    resolve(true);
                });
            });
        }
        else {
            tableCheck = new Promise(function (resolve) { return resolve(true); });
        }
        tableCheck.then(function () {
            migrate(direction, count);
        });
    });
}
if (process.argv.length > 1) {
    var op = process.argv[2];
    switch (op) {
        case 'help':
            console.log("Help is on the way (not really)");
            break;
        case 'test':
            console.log('Do you smell smoke?');
            break;
        case 'migrate':
            var count = 1;
            var direction = 'up';
            if (process.argv.length > 3) {
                var migrateVector = process.argv[3];
                var parsedVector = parseInt(migrateVector);
                count = parsedVector || 1;
                direction = parsedVector ? (parsedVector > 0 ? 'up' : 'down') : migrateVector;
            }
            if (process.argv.length > 4) {
                count = parseInt(process.argv[4]);
            }
            run(direction, count);
            break;
    }
}
