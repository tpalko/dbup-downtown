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
                // console.log('Opening ' + migrationFile);
                fs.readFile(migrationFile, 'utf-8', function (readErr, data) {
                    if (!data) {
                        resolve(null);
                    }
                    else {
                        // console.log('Parsing data..');
                        // console.log(data);
                        var migration = JSON.parse(data);
                        resolve({
                            name: migrationName,
                            description: migration.name,
                            up: migration.up,
                            down: migration.down,
                            executed: inTable_1
                        });
                    }
                });
            }
        });
    });
};
function executeMigration(statement, action) {
    return new Promise(function (resolve, reject) {
        console.log(" --> " + statement);
        if (action == "fake") {
            resolve(true);
        }
        else {
            db.exec(statement, function (dbRunErr) {
                if (dbRunErr) {
                    reject(dbRunErr);
                }
                else {
                    resolve(true);
                }
            });
        }
    });
}
function logMigration(name, direction) {
    return new Promise(function (resolve, reject) {
        var logSql = direction === 'up' ? 'INSERT INTO migrations (name) values($name)' : 'DELETE FROM migrations where name = $name';
        console.log(" --> " + logSql + " (" + name + ")");
        db.run(logSql, { $name: name }, function (dbLogErr) {
            if (dbLogErr) {
                reject(dbLogErr);
            }
            else {
                resolve(true);
            }
        });
    });
}
function applyAndLogMigration(migration, action, direction) {
    return new Promise(function (resolve, reject) {
        executeMigration(migration[direction], action)
            .then(function () {
            console.log("Migration " + migration.name + " applied!");
            logMigration(migration.name, direction)
                .then(function () {
                console.log("Migration " + migration.name + " accounted");
                resolve(migration);
            })["catch"](function (err) {
                console.error("An error occurred logging " + migration.name);
                console.error(err.message);
                console.error("Attempting to rollback..");
                var rollbackDirection = direction === 'up' ? 'down' : 'up';
                executeMigration(migration[rollbackDirection], action)
                    .then(function () {
                    console.log("Migration " + migration.name + " rolled back!");
                    reject(err);
                })["catch"](function (dbRollbackErr) {
                    console.error("An error occurred running " + migration.name + " " + rollbackDirection);
                    console.error(dbRollbackErr.message);
                    reject(dbRollbackErr);
                });
            });
        })["catch"](function (err) {
            console.error("An error occurred running " + migration.name + " " + direction);
            console.error(err.message);
            reject(err);
        });
    });
}
function applyAndLogMigrations(migrations, action, direction, count) {
    if (count > 0 && migrations.length > 0) {
        applyAndLogMigration(migrations[0], action, direction)
            .then(function (migration) {
            applyAndLogMigrations(migrations.slice(1), action, direction, --count);
        })["catch"](function (err) {
            console.error(err);
        });
    }
    else {
        console.log('The end of migrations');
    }
}
function sortMigrations(migrations, direction) {
    var migrationsByName = {};
    migrations.forEach(function (migration) {
        migrationsByName[migration.name] = __assign({}, migration);
    });
    var migrationQueueKeys = Object.keys(migrationsByName);
    if (direction === 'up') {
        migrationQueueKeys.sort();
    }
    else {
        migrationQueueKeys.reverse();
    }
    return migrationQueueKeys.map(function (migrationName) { return migrationsByName[migrationName]; });
}
function getAllMigrations() {
    return new Promise(function (resolve, reject) {
        fs.readdir(MIGRATIONS_FOLDER, function (err, files) {
            if (err) {
                throw err;
            }
            console.log("Reading " + MIGRATIONS_FOLDER + ", found " + files.length + " files");
            Promise.all(files.map(getMigration))
                .then(function (migrations) {
                console.log("\n\n");
                resolve(migrations);
            });
        });
    });
}
function migrate(action, direction, count) {
    getAllMigrations()
        .then(function (migrations) {
        console.log("Have " + migrations.length + " migrations");
        var filteredMigrations = migrations.filter(function (migration) {
            return migration && ((direction === 'up' && !migration.executed) || (direction === 'down' && migration.executed));
        });
        console.log("Found " + filteredMigrations.length + " applicable migrations");
        return filteredMigrations;
    }).then(function (filteredMigrations) {
        return sortMigrations(filteredMigrations, direction);
    })
        .then(function (sortedMigrations) {
        applyAndLogMigrations(sortedMigrations, action, direction, count);
    })["catch"](function (something) {
        console.error(something);
    });
    ;
    // fs.readdir(MIGRATIONS_FOLDER, (err, files) => {  
    //   if (err) {
    //     throw err;
    //   }        
    //   console.log(`Reading ${MIGRATIONS_FOLDER}, found ${files.length} files`);
    //   Promise.all(files.map(getMigration))
    //     .then((migrations) => {
    // 
    //     })
    //     .then((filteredMigrations) => {
    //       return sortMigrations(filteredMigrations, direction);
    //     })
    //     .then((sortedMigrations) => {
    //       applyAndLogMigrations(sortedMigrations, action, direction, count);
    //     })
    //     .catch((something) => {
    //       console.error(something);
    //     });  
    // });
}
function list() {
    getAllMigrations()
        .then(function (migrations) {
        if (migrations.length > 0) {
            var youAreHered = false;
            migrations.forEach(function (migration) {
                if (!migration.executed && !youAreHered) {
                    console.log(" --- you are here --- ");
                    youAreHered = true;
                }
                console.log(migration.name + " : " + (migration.executed ? "applied" : "       ") + ": " + migration.description + " : " + migration.up);
            });
            if (!youAreHered) {
                console.log(" --- you are here --- ");
            }
            console.log("\n\n");
        }
    });
}
function create(name, description) {
    console.log("Creating " + description + " as " + name);
    var emptyMigration = {
        name: description,
        up: "",
        down: ""
    };
    fs.writeFile(MIGRATIONS_FOLDER + "/" + name + ".json", JSON.stringify(emptyMigration), { encoding: 'utf-8' }, function (err, bytes) {
        if (err) {
            console.error(err.message);
        }
    });
}
function tableCheck() {
    return new Promise(function (resolve, reject) {
        db.get('SELECT 1 from migrations', function (err, row) {
            if (err) {
                console.log('Creating migrations table');
                db.run('CREATE TABLE migrations (name TEXT, executed_at DATE)', function (err) {
                    if (err) {
                        reject(err);
                    }
                    resolve(true);
                });
            }
            else {
                resolve(true);
            }
        });
    });
}
function print_help() {
    print();
}
if (process.argv.length > 2) {
    var action_1 = process.argv[2];
    console.log("Processing " + action_1);
    var migrateActions = ["migrate", "fake"];
    if (action_1 == "list") {
        list();
    }
    else if (action_1 == "new") {
        var migrationDate = new Date();
        var month = migrationDate.getUTCMonth() + 1;
        month = month < 10 ? month + 10 : month;
        var migrationName = "" + migrationDate.getUTCFullYear() + month + migrationDate.getUTCDate() + migrationDate.getUTCHours() + migrationDate.getUTCMinutes();
        var migrationDescription = migrationName;
        if (process.argv.length > 3) {
            migrationDescription = process.argv[3];
        }
        create(migrationName, migrationDescription);
    }
    else if (action_1 == "migrate" || action_1 == "fake") {
        var count_1 = 1;
        var direction_1 = 'up';
        if (process.argv.length > 3) {
            var migrateVector = process.argv[3];
            // this argument could be direction or count 
            var parsedVector = parseInt(migrateVector);
            // count is set if it parses as int or 1 if not 
            count_1 = parsedVector || 1;
            // direction is set by count positivity if this was in fact count
            // or this was direction 
            direction_1 = parsedVector ? (parsedVector > 0 ? 'up' : 'down') : migrateVector;
        }
        if (process.argv.length > 4) {
            // oh, ok. that was direction.. this is count.
            count_1 = parseInt(process.argv[4]);
        }
        console.log("Migrating " + (action_1 == "fake" ? "(fake)" : "") + " " + count_1 + " " + direction_1);
        tableCheck().then(function () {
            migrate(action_1, direction_1, count_1);
        })["catch"](function (err) {
            console.error(err.message);
        });
    }
}
