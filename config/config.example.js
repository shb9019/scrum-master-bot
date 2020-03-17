const config = {
    development: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        appBaseURL: 'app base url',
    },
    production: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        appBaseURL: 'app base url',
    },
    test: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        appBaseURL: 'app base url',
    },
};
const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
