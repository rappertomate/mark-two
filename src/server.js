const path = require('path');

const bodyParser = require('body-parser');
const cron = require('cron');
const express = require('express');
const nunjucks = require('nunjucks');

const ether = require('./ethereum');
const dbModule = require('./db');
const cronl = require('./cronlogic');
const providers = require('./../secrets/providers.json');

const port = 3000 || process.env.PORT;
const app = express();
const dbPath = './mark_two_db.sqlt';

var db = new dbModule.DB(dbPath);
var eth = new ether.Eth(providers.ropsten);

//add nunjucks templating to application
nunjucks.configure(path.join(__dirname, 'views'), {
    express: app,
    watch: false,
    noCache: true
});

//parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

//parse application/json
app.use(bodyParser.json());


//make paths to static files available to requests
app.use('/img', express.static(path.join(__dirname, 'img')));
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/eth', express.static(path.join(__dirname, 'eth')));

app.get('/favicon.ico', function(req, res){
    res.sendFile(path.join(__dirname, 'img', 'favicon.ico'));
});

app.get('/', function(req, res){
    res.render('index.html');
});

app.get('/create', function(req, res){
    res.render('create.html');
});

/** post to this route to add new task on backend */
app.post('/create', function(req, res){
    //save transaction which will be picked up by cron job
    db.addTransaction(req.body.transaction)
    .then(function(){
        //show tasks of owner afterwards (new contract might not be visible yet)
        res.redirect('/tasks/owner/' + req.body.owner);
    });
});

/** post to this route to add new answer on backend */
app.post('/create/answer', function(req, res){
    //tell DB to store answer placeholder which will be picked up by cron job
    db.addBlankAnswer(req.body.contract, req.body.testee)
    .then(function(){
        res.sendStatus(200);
    });
});

/** post to this route to add new score on backend */
app.post('/update/score', function(req, res){
    //tell DB to unset confirmation of the current score
    db.updateUnconfirmedScore(req.body.contract, req.body.testee)
    .then(function(){
        res.sendStatus(200);
    });
});

/** post to this route to signalise that funds for a reward were increased or decreased */
app.post('/update/reward', function(req, res){
    //tell DB to unset confirmation of reward for this contract
    //could be either increase or decrease of funds
    db.setUnconfirmedReward(req.body.contract)
    .then(function(){
        res.sendStatus(200);
    });
});

app.get('/tasks/owner/:owner', function(req, res){
    db.getTasksByOwner(req.params.owner)
    .then(function(values){
        values = utcsShorts(values);
        var ownerShort = addressShort(req.params.owner);
        res.render(
            'tasksowner.html',
            {tasks: values, owner: req.params.owner, ownerShort: ownerShort
        });
    });
});

app.get('/tasks/keyword/:keyword', function(req, res){
    if (req.query.testee) {
        //look up tasks for this keyword plus answers and scores by given user
        db.getTasksByKeywordTestee(req.params.keyword, req.query.testee)
        .then(function(values){
            values = utcsShorts(values);
            res.render(
                'taskskeyword.html',
                {tasks: values, keyword: req.params.keyword, testee: req.query.testee});
        }); 
    }
    else{
        //just look up tasks for this keyword
        db.getTasksByKeyword(req.params.keyword)
        .then(function(values){
            values = utcsShorts(values);
            res.render('taskskeyword.html', {tasks: values, keyword: req.params.keyword});
        });
    }
});

app.get('/task/:address', function(req, res){
    p1 = db.getTaskDetails(req.params.address);
    p2 = db.getAnswersByTask(req.params.address);
    return Promise.all([p1, p2])
    .then(function(values) {
        if (values[0]) {  //if there is a task under this address
            var conShort = addressShort(values[0].contract);
            var ownShort = addressShort(values[0].owner);
            var corShort = addressShort(values[0].corrector);
            values[0].created_utc = values[0].created_utc.split(" ")[0];
            var marksMissing = true; //default true bc we assume that there are no answers

            for (let i = 0; i < values[1].length; i++) {
                marksMissing = false; //there's at least 1 answer...
                if (!values[1][i].score) {
                    marksMissing = true; //...but it has no score. Set true and break
                    break;
                }
            }

            res.render(
                'task.html',
                {
                    task: values[0],
                    conShort: conShort,
                    ownShort: ownShort,
                    corShort: corShort,
                    answers: values[1],
                    marksMissing: marksMissing
                }
            );
        }
        else{
            res.status(404).send('Not found');
        }
    });
});

//set port to listen to
app.listen(port, () => {
    console.log("Express Listening at http://localhost:" + port);
});

//set up cron jobs

new cron.CronJob('*/10 * * * * *', function() {
    cronl.observeTaskInit(db, eth);
  },
  null,
  true, //start job right now
  null
);

new cron.CronJob('*/10 * * * * *', function() {
    cronl.observeBlankAnswers(db, eth);
  },
  null,
  true,
  null
);

new cron.CronJob('*/10 * * * * *', function() {
    cronl.observeUnconfirmedScores(db, eth);
  },
  null,
  true,
  null
);

new cron.CronJob('*/10 * * * * *', function() {
    cronl.observeRewards(db, eth);
  },
  null,
  true,
  null
);

new cron.CronJob('*/10 * * * * *', function() {
    cronl.observePayouts(db, eth);
  },
  null,
  true,
  null
);

new cron.CronJob('0 */1 * * * *', function() {  //look up expired tasks only once per minute
    cronl.observeEndTime(db, eth);
  },
  null,
  true,
  null
);

/** helper to generated shortened address */
function addressShort(address) {
    return address.substring(0, 8) + '...';
}

/** helper to generate a date from datetime string */
function utcsShorts(values) {
    for (let i = 0; i < values.length; i++) {
        // YYYY-MM-DD HH:MM:SS -> YYYY-MM-DD
        values[i].created_utc = values[i].created_utc.split(" ")[0];
    }
    return values;
}