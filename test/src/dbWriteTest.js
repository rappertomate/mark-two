const spawn = require('child_process').spawn;

const assert = require('chai').assert;
const sqlite3 = require('sqlite3');

const dbTestPath = './test/src/test2_db.sqlt';
const dbModule = require('./../../src/db');

var db = new dbModule.DB(dbTestPath);

/** Tests for functions writing to db */
describe('dbWrite', function(){
    var dbTest;

    /** spin up new dummy DB with dummy data */
    before(function() {
        return new Promise(function (resolve) {
            //create new DB
            const sqlite3CMD = spawn('sqlite3', [dbTestPath]);

            sqlite3CMD.stdout.on('data', (data) => {
              console.log(`stdout: ${data}`);
            });

            sqlite3CMD.stderr.on('data', (data) => {
              console.log(`stderr: ${data}`);
            });

            dbTest = new sqlite3.Database(dbTestPath);

            task1 = {
                "contract": "0xfE1C5527AdCEc99d078Eb418B7B43d4e81713B83",
                "question": "What is 2+2?", 
                "owner": "0x7E271C47FFd7A52caCa98B4D0483448693c0b023",
                "corrector": "0xE807b266912cd9f117a42748A158328d677Ed789",
                "keyword": "testkeyword",
                "maxScore": 10,
                "endDatetime": "2018-09-13 00:00:00",
                "token": "0xbb8f8A408e562a4FA5A058E73D9B6d3EAC0e0E33"};

            task2 = {
                "contract": "0xc8CdEE3335EB037aAb43042177C3D6AA34FF64aF",
                "question": "What is 2+2?", 
                "owner": "0x7E271C47FFd7A52caCa98B4D0483448693c0b023",
                "corrector": "0xBEfDb4885A572BA3d3482E016A76311c0a58a026",
                "keyword": "testkeyword",
                "maxScore": 10,
                "endDatetime": "2018-09-13 00:00:00",
                "token": "0xbb8f8A408e562a4FA5A058E73D9B6d3EAC0e0E33"};

            //write to DB
            dbTest.serialize(function() {
                dbTest.run(
                    'CREATE TABLE Tasks ( ' +
                    'contract TEXT NOT NULL, ' +
                    'owner TEXT NOT NULL, ' +
                    'question TEXT NOT NULL, ' +
                    'corrector TEXT NOT NULL, ' +
                    'keyword TEXT NOT NULL, ' +
                    'maxscore INTEGER NOT NULL, ' +
                    'created_utc TEXT DEFAULT CURRENT_TIMESTAMP, ' +
                    'end_utc TEXT NOT NULL, ' +
                    'token_address TEXT NOT NULL, ' +
                    'token_amount INTEGER DEFAULT 0, ' +
                    'token_confirmed INTEGER DEFAULT 1, ' +
                    'state TEXT DEFAULT "o");', function(){
                    db.addTask(task1)
                    .then(function () {
                        db.addTask(task2)
                        .then(function () {
                            resolve();
                        });
                    });
                });
                //use dbTest.run() to insert more data
            });
        });
    });

    /** test if task was added properly correctly */
    it('addTask', function(done) {
        dbTest.all(
            "SELECT * FROM Tasks;", function(err, rows) {
            if (err) {
                console.error(err);
                process.exit(1);
            } else {
                assert.equal(rows.length, 2, 'It\'s not 2"');
                done();
            }
        });
    });

    /** tear down test db */
    after(function() {
        dbTest.close();

        //remove DB
        const rm = spawn('rm', [dbTestPath]);

        rm.stdout.on('data', (data) => {
          console.log(`stdout: ${data}`);
        });

        rm.stderr.on('data', (data) => {
          console.log(`stderr: ${data}`);
        });
    });
});