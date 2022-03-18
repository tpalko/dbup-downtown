const { db } = require('./Database');
const fs = require('fs');

const MIGRATIONS_FOLDER = process.env.MIGRATIONS_FOLDER || './migrations';

class Migration {
  name: string;
  description: string;
  up: string;
  down: string;
  executed: boolean;
}

var getMigration = (file) => {
  const migrationExtension = file.split('.')[1];
  if (migrationExtension != "json") {
    return;
  }
  
  return new Promise( (resolve, reject) => {
    const migrationName = file.split('.')[0];
    console.log(`Found migration ${file}`);
    db.get('SELECT name FROM migrations WHERE name = $name', { $name: migrationName }, (err, row) => {
      if (err) {
        console.error(err);
      } else {
        const inTable = row !== undefined;
        const migrationFile = `${MIGRATIONS_FOLDER}/${file}`;
        // console.log('Opening ' + migrationFile);
        fs.readFile(migrationFile, 'utf-8', (readErr, data) => {
          if (!data) {
            resolve(null);
          } else {
            // console.log('Parsing data..');
            // console.log(data);
            const migration = JSON.parse(data);
            resolve({ 
              name: migrationName, 
              description: migration.name, 
              up: migration.up, 
              down: migration.down, 
              executed: inTable 
            });  
          }          
        });          
      }
    });       
  });  
}

function executeMigration(statement, action) {
  return new Promise((resolve, reject) => {
    console.log(` --> ${statement}`)
    if (action == "fake") {
      resolve(true);
    } else {
      db.exec(statement, (dbRunErr) => {
        if (dbRunErr) {
          reject(dbRunErr);
        } else {
          resolve(true);
        }
      });  
    }    
  });
}

function logMigration(name, direction) {
  return new Promise((resolve, reject) => {
    const logSql = direction === 'up' ? 'INSERT INTO migrations (name) values($name)' : 'DELETE FROM migrations where name = $name';
    console.log(` --> ${logSql} (${name})`);
    db.run(logSql, { $name: name }, (dbLogErr) => {
      if (dbLogErr) {
        reject(dbLogErr);
      } else {
        resolve(true);
      }
    });
  })  
}

function applyAndLogMigration(migration: Migration, action: string, direction: string) {
  
  return new Promise((resolve, reject) => {
    
    executeMigration(migration[direction], action)
      .then(() => {
    
        console.log(`Migration ${migration.name} applied!`);
        
        logMigration(migration.name, direction)
        .then(() => {
          console.log(`Migration ${migration.name} accounted`);
          resolve(migration);
        })
        .catch((err) => {
          console.error(`An error occurred logging ${migration.name}`);
          console.error(err.message);
          console.error(`Attempting to rollback..`)
          const rollbackDirection = direction === 'up' ? 'down' : 'up';
          
          executeMigration(migration[rollbackDirection], action)
          .then(() => {
            console.log(`Migration ${migration.name} rolled back!`);
            reject(err);
          })
          .catch((dbRollbackErr) => {
            console.error(`An error occurred running ${migration.name} ${rollbackDirection}`);
            console.error(dbRollbackErr.message);
            reject(dbRollbackErr);
          })
        })
      })
      .catch((err) => {
        console.error(`An error occurred running ${migration.name} ${direction}`);
        console.error(err.message);
        reject(err);
      });
  })
}

function applyAndLogMigrations(migrations, action, direction, count) {
  if (count > 0 && migrations.length > 0) {
    applyAndLogMigration(migrations[0], action, direction)
      .then((migration) => {
        applyAndLogMigrations(migrations.slice(1), action, direction, --count);
      })
      .catch((err) => {
        console.error(err);
      });
  } else {
    console.log('The end of migrations')
  }
}

function sortMigrations(migrations, direction){
  const migrationsByName = {};
  migrations.forEach((migration: Migration) => {
    migrationsByName[migration.name] = { ...migration };
  });
  const migrationQueueKeys = Object.keys(migrationsByName);
  if (direction === 'up') {
    migrationQueueKeys.sort();
  } else {
    migrationQueueKeys.reverse();
  }
  return migrationQueueKeys.map(migrationName => { return migrationsByName[migrationName]; });
}

function getAllMigrations() {
  return new Promise<Migration[]>((resolve, reject) => {
    fs.readdir(MIGRATIONS_FOLDER, (err, files) => {  
      if (err) {
        throw err;
      }        
      console.log(`Reading ${MIGRATIONS_FOLDER}, found ${files.length} files`);
      Promise.all<Migration>(files.map(getMigration))
      .then((migrations: Migration[]) => {
        console.log("\n\n");
        resolve(migrations);
      })
    });
  })  
}

function migrate(action, direction, count) {
  getAllMigrations()
  .then((migrations: Array<Migration>) => {
    console.log(`Have ${migrations.length} migrations`);
    const filteredMigrations = migrations.filter((migration: Migration) => {
      return migration && ((direction === 'up' && ! migration.executed) || (direction === 'down' && migration.executed))
    });
    console.log(`Found ${filteredMigrations.length} applicable migrations`);
    return filteredMigrations;
  }).then((filteredMigrations) => {
    return sortMigrations(filteredMigrations, direction);
  })
  .then((sortedMigrations) => {
    applyAndLogMigrations(sortedMigrations, action, direction, count);
  })
  .catch((something) => {
    console.error(something);
  });  ;
  
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
  .then((migrations: Migration[]) => {

    if(migrations.length > 0) {
      var youAreHered = false;
      migrations.forEach((migration) => {
        if (!migration.executed && !youAreHered) {
          console.log(` --- you are here --- `);
          youAreHered = true;
        }
        console.log(`${migration.name} : ${migration.executed ? "applied" : "       "}: ${migration.description} : ${migration.up}`)
      });
      if (!youAreHered) {
        console.log(` --- you are here --- `);
      }
      console.log("\n\n")
    }
    
  });
}

function create(name, description) {
  console.log(`Creating ${description} as ${name}`);
  const emptyMigration = {
    name: description,
    up: "",
    down: ""
  };
  fs.writeFile(`${MIGRATIONS_FOLDER}/${name}.json`, JSON.stringify(emptyMigration), { encoding: 'utf-8'}, (err, bytes) => {
    if (err) {
      console.error(err.message);
    }
  })
}

function tableCheck() {
  return new Promise((resolve, reject) => {
    db.get('SELECT 1 from migrations', (err, row) => {
      if (err) {
        console.log('Creating migrations table');
        db.run('CREATE TABLE migrations (name TEXT, executed_at DATE)', (err) => {
          if (err) {
            reject(err);
          }
          resolve(true);
        });        
      } else {
        resolve(true);
      }
    });
  })
}

function print_help() {
  print()
}

if (process.argv.length > 2) {
  
  const action = process.argv[2];
  console.log(`Processing ${action}`)
  
  const migrateActions = ["migrate", "fake"];
  
  if (action == "list") {
      list();
  } else if (action == "new") {
    const migrationDate = new Date();
    var month = migrationDate.getUTCMonth() + 1;
    month = month < 10 ? month + 10 : month;
    const migrationName = `${migrationDate.getUTCFullYear()}${month}${migrationDate.getUTCDate()}${migrationDate.getUTCHours()}${migrationDate.getUTCMinutes()}`;
    var migrationDescription = migrationName;
    if (process.argv.length > 3) {
      migrationDescription = process.argv[3];
    }
    create(migrationName, migrationDescription);
  } else if (action == "migrate" || action == "fake") {
    
    let count = 1;
    let direction = 'up';    
    
    if (process.argv.length > 3) {
      const migrateVector = process.argv[3];
      // this argument could be direction or count 
      const parsedVector = parseInt(migrateVector);
      // count is set if it parses as int or 1 if not 
      count = parsedVector || 1;
      // direction is set by count positivity if this was in fact count
      // or this was direction 
      direction = parsedVector ? (parsedVector > 0 ? 'up' : 'down') : migrateVector;
    }
    
    if (process.argv.length > 4) {
      // oh, ok. that was direction.. this is count.
      count = parseInt(process.argv[4]);
    }
    
    console.log(`Migrating ${action == "fake" ? "(fake)" : ""} ${count} ${direction}`);
    tableCheck().then(() => {
      migrate(action, direction, count);
    }).catch((err) => {
      console.error(err.message);
    })
  }  
}
