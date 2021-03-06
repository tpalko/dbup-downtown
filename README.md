# dbup-downtown

Lightweight database migration command-line tool.

## Hold your horses

Currently, this project only supports Sqlite3 database files, however the actual migration code doesn't care, and if you'd like 
to contribute and write a MySQL or PostgreSQL provider, we are open for business.

## Quick start

Provided your project has a `migrations` folder with at least one migration file in it and a valid Sqlite3 database file:

```
npm install
npm run build
MIGRATIONS_FOLDER=../relative/path/to/migrations/folder/in/your/project PATH_TO_DB=../relative/path/to/sqlite/database/file npm start migrate
```

## Impact to your project 

This script will make real changes to your database, however none that you don't explicitly code into your migration files. There is no custom query
language or any other DSL to imply changes or be interpreted otherwise. WYSIWYG.

The script creates a single table `migrations` in which it keeps its state. Not the migration files and indeed no other file in your project or anywhere
else are modified by this script.

## Environment 

**MIGRATIONS_FOLDER**

A folder, reasonably within your project, that holds migration files, or files that describe intended alterations to your database. The script
will consume these files, ignoring any without a `.json` file extension.

**PATH_TO_DB**

A path to the (for now, only) Sqlite database file. 

## Usage

```
node migrate.js <migrate|fake [up|down|NUM] [NUM] | list | new [description]>
```

To perform migrations or fakes, the first token after `npm start` or `node migrate.js` is either `migrate` or `fake`.

If no other tokens, the assumption is `migrate up by one`.

The next token after `migrate` can be `up` or `down` to control the direction, 
_or any integer_ to control the number of migrations performed. 
If a direction, the number of migrations remains assumed at one. If an integer, 
the direction remains assumed at up.

If yet another token is included, it _must be an integer_ and it will override 
whatever `count` determination was made from the previous token. Any determinations
made about direction from the previous token remain in effect.

| command | result |
|---|---|
| `migrate` | migrate up by one |
| `migrate up` | migrate up by one |
| `migrate 2` | migrate up by two |
| `migrate -1` | migrate down by one |
| `migrate down` | migrate down by one |
| `migrate up 3`| migrate up by three |
| `migrate down -1` | migrate down by one |
| `migrate 1 -1` | nonsensical, but will attempt migrate "up" by "minus one" |
| `migrate 1 down` | error (parsing non-numerical string as integer) |

Similarly, `fake` will accept the same positional arguments.

`list` will show all migration files found and their status with respect to history found in the `migrations` folder.

`new` will create a blank migration in the `migrations` folder with an appropriate UTC timestamp name.


## Migration files

A migration file must follow the timestamp naming pattern `YYYYMMDDHHMM.json` and be placed within MIGRATIONS_FOLDER.

The format is as follows:

```
{
  "name": "some description for the human",
  "up": "some SQL statement to alter the database, likely in accordance with the migration name",
  "down": "some SQL statement to reverse the SQL statement for 'up'"
}
```

This is a real-world example:

```
{
  "name": "add column filename to archives",
  "up": "alter table archives add column filename char(255)",
  "down": "BEGIN; CREATE TABLE archives_temp as select id, target_id, created_at, size_kb, is_remote, remote_push_at from archives; DROP TABLE archives; ALTER TABLE archives_temp RENAME TO archives; END TRANSACTION;"
}
```

The following are command templates for common operations. (syntax seen here is for Sqlite3)

**Add column**

* up: `alter table orig add column;`
* down: `BEGIN; alter table orig rename to temp; create table orig (leave, out, removed, column); insert into orig(leave, out, removed, column) select (leave, out, removed, column) from temp; END TRANSACTION;`

**Remove column**

* up/down: reverse of `add column`

**Rename column**

* up: `BEGIN; alter table orig rename to temp; create table orig (a2, b2); insert (a2, b2) into origin select (a, b) from temp; END TRANSACTION;`
* down: reverse values from `up`

## Future development 

* support databases other than sqlite
* some better installation (node-wrapper script in /usr/local/bin)
* better input validation
* maybe some non-action reporting/status commands
* -h for help
