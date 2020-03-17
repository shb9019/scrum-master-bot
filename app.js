const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const cors = require('cors');

const app = express();
const server = require('http').createServer(app);
const cookieParser = require('cookie-parser');

const routes = require('./routes/index.js');
const config = require('./config/config.js');

const corsOptions = {
    origin: config.appBaseURL,
    methods: ['GET', 'PUT', 'POST', 'DELETE'],
    allowedHeaders: ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept'],
    credentials: true,
};
app.use(cors(corsOptions));

app.use(
    session({
        secret: config.app.sessionSecret,
        resave: false,
        saveUninitialized: true,
    }),
);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true,
}));
app.use(cookieParser());

app.use(routes);
server.listen(config.app.port);

module.exports = app;
