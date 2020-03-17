const config = {
    development: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        authToken: 'auth token',

    },
    production: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        authToken: 'auth token',
    },
    test: {
        app: {
            port: 'Your port number',
            sessionSecret: 'SESSION_SECRET',
        },
        authToken: 'auth token',
    },
};
const env = process.env.NODE_ENV || 'development';
module.exports = config[env];
