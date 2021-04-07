const express = require('express');
const compression = require('compression');
const config = require('../config');
const logger = require('./logger');
const { PythonShell } = require('python-shell');
// const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');

const apiRouter = express.Router();

const dataDir = path.resolve(config.data.folder);
const tmpDir = path.resolve(config.tmp.folder);
const awsInfo = config.aws;
const numProcesses = config.numProcesses || 8;

PythonShell.defaultOptions = { 
    mode: 'json',
    scriptPath: 'services/query_scripts/',
    // pythonOptions: ['-u'], // get print results in real-time
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
    response.status(200).json('true');
});

// query-probe-names route (query_probe_names.py)
apiRouter.post('/query-probe-names', ({ body }, response) => {
    logger.debug("Execute /query-probe-names");
    const pythonProcess = new PythonShell('query_probe_names.py');
    pythonProcess.send({...body, dataDir});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-probe-names", results);
            response.status(200).json(results);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

// // query route (query.py)
// apiRouter.post('/query', ({ body }, response) => {
//     logger.debug("Execute /query");
//     const pythonProcess = new PythonShell('query.py');
//     pythonProcess.send({...body, dataDir, awsInfo, numProcesses});
//     pythonProcess.on('message', results => {
//         if (results) {
//             logger.debug("/query", results);
//             response.status(200).json(results);
//         }
//     });
//     pythonProcess.end((err, code, signal) => {
//         if (err) {
//             logger.error(err);
//             response.status(400).json(err);
//         }
//     });
// });

// query-aggregate route (query_aggregate.py)
apiRouter.post('/query-aggregate', ({ body }, response) => {
    logger.debug("Execute /query-aggregate");
    const pythonProcess = new PythonShell('query_aggregate.py');
    pythonProcess.send({...body, dataDir, awsInfo, numProcesses});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-aggregate", results);
            response.status(200).json(results);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

// query-tf-summary route (query_tf_summary.py)
apiRouter.post('/query-tf-summary', ({ body }, response) => {
    logger.debug("Execute /query-tf-summary");
    const pythonProcess = new PythonShell('query_tf_summary.py');
    pythonProcess.send({...body, dataDir, tmpDir});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-tf-summary", results);
            response.status(200).json(results);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

// query-tf-summary-graph route (query_tf_summary_graph.py)
apiRouter.post('/query-tf-summary-graph', ({ body }, response) => {
    logger.debug("Execute /query-tf-summary-graph");
    const pythonProcess = new PythonShell('query_tf_summary_graph.py');
    pythonProcess.send({...body, tmpDir});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-tf-summary-graph", results);
            const file = fs.createReadStream(results.output);
            const stat = fs.statSync(results.output);
            response.setHeader('Content-Length', stat.size);
            response.setHeader('Content-Type', 'application/pdf');
            response.setHeader('Content-Disposition', 'attachment; filename=export.pdf');
            file.on('end', function() {
            fs.unlink(results.output, function() {
                // file deleted
            });
            });
            file.pipe(response);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

// query-tf-aggregate-summary route (query_tf_aggregate_summary.py)
apiRouter.post('/query-tf-aggregate-summary', ({ body }, response) => {
    logger.debug("Execute /query-tf-aggregate-summary");
    const pythonProcess = new PythonShell('query_tf_aggregate_summary.py');
    pythonProcess.send({...body, dataDir});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-tf-aggregate-summary", results);
            response.status(200).json(results);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

// query-tf-probe-overlap-summary route (query_tf_probe_overlap_summary.py)
apiRouter.post('/query-tf-probe-overlap-summary', ({ body }, response) => {
    logger.debug("Execute /query-tf-probe-overlap-summary");
    const pythonProcess = new PythonShell('query_tf_probe_overlap_summary.py');
    pythonProcess.send({...body, dataDir});
    pythonProcess.on('message', results => {
        if (results) {
            logger.debug("/query-tf-probe-overlap-summary", results);
            response.status(200).json(results);
        }
    });
    pythonProcess.end((err, code, signal) => {
        if (err) {
            logger.error(err);
            response.status(400).json(err);
        }
    });
});

module.exports = { apiRouter };
