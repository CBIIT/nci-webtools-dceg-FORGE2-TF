const express = require('express');
const compression = require('compression');
const config = require('../config');
const logger = require('./logger');
const { PythonShell } = require('python-shell');

const apiRouter = express.Router();

const pythonOptions = {
    scriptPath: 'services/query_scripts/'
};

// parse json requests
apiRouter.use(express.json());

// compress all responses
apiRouter.use(compression());

// add cache-control headers to GET requests
apiRouter.use((request, response, next) => {
    if (request.method === 'GET')
        response.set(`Cache-Control', 'public, max-age=${60 * 60}`);
    next();
});

// healthcheck route
apiRouter.get('/ping', (request, response) => {
    response.json('monkeys');
});

// query-probe-names route (query_probe_names.py)
apiRouter.post('/query-probe-names', ({ body }, response) => {
    console.log("HIT QUERY-PROBE-NAMES");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

// query route (query.py)
apiRouter.post('/query', ({ body }, response) => {
    console.log("HIT QUERY");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

// query-aggregate route (query_aggregate.py)
apiRouter.post('/query-aggregate', ({ body }, response) => {
    console.log("HIT QUERY-AGGREGATE");
    console.log("POST BODY", body);
    PythonShell.run('my_script.py', pythonOptions, function (err, results) {
        if (err) throw err;
        // results is an array consisting of messages collected during execution
        console.log('results: %j', results);
    });
    // // temporarily return error code 500
    // response.status(500);
    // response.json('monkeys');
});

// query-tf-summary route (query_tf_summary.py)
apiRouter.post('/query-tf-summary', ({ body }, response) => {
    console.log("HIT QUERY-TF-SUMMARY");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

// query-tf-summary-graph route (query_tf_summary_graph.py)
apiRouter.post('/query-tf-summary-graph', ({ body }, response) => {
    console.log("HIT QUERY-TF-SUMMARY-GRAPH");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

// query-tf-aggregate-summary route (query_tf_aggregate_summary.py)
apiRouter.post('/query-tf-aggregate-summary', ({ body }, response) => {
    console.log("HIT QUERY-TF-AGGREGATE-SUMMARY");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

// query-tf-probe-overlap-summary route (query_tf_probe_overlap_summary.py)
apiRouter.post('/query-tf-probe-overlap-summary', ({ body }, response) => {
    console.log("HIT QUERY-TF-PROBE-OVERLAP-SUMMARY");
    console.log("POST BODY", body);
    // temporarily return error code 500
    response.status(500);
    response.json('monkeys');
});

module.exports = { apiRouter };
