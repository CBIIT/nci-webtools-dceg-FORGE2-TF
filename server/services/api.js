const express = require('express');
const compression = require('compression');
const config = require('../config');
const logger = require('./logger');

const apiRouter = express.Router();

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
    response.json(true)
});

module.exports = { apiRouter };
