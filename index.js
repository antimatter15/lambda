#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const {Strategy} = require('passport-saml');
const ws = require('uws');
const connection = require('./server/connection');
const index = path.resolve(__dirname, 'web', 'index.html');
const socket_port = 1947;
const dev = process.argv.length > 1;
const server_port = dev ? process.argv[2] : 443;

const children = {};

const app = express();
app.use(express.static(path.resolve(__dirname, 'web')));

if (dev) {
  app.get('/', (req, res) => res.sendFile(index));
  app.listen(server_port);
  console.log('http server listening on port', server_port);
} else {
  const key = fs.readFileSync(path.resolve(__dirname, 'certs', 'lambda-key.pem'));
  const cert = fs.readFileSync(path.resolve(__dirname, 'certs', 'lambda_mit_edu_cert.cer'));
  const credentials = {key, cert};

  const idpCert = fs.readFileSync(path.resolve(__dirname, 'certs', 'cert_idp.pem'), 'utf8');
  const spKey = fs.readFileSync(path.resolve(__dirname, 'certs', 'sp-key.pem') ,'utf8');
  const spCert = fs.readFileSync(path.resolve(__dirname, 'certs', 'sp-cert.pem'), 'utf8');

  const config = {
      entryPoint: 'https://idp.mit.edu/idp/profile/SAML2/Redirect/SSO',
      cert: idpCert,
      identifierFormat: null,
      issuer: 'https://lambda.mit.edu/shibboleth',
      callbackUrl: 'https://lambda.mit.edu/auth/callback',
      decryptionPvk: spKey,
      privateCert: spKey,
      acceptedClockSkewMs: 180000,
      disableRequestedAuthnContext: true,
      // passReqToCallback: true,
  };
  const strategy = new Strategy(config, (profile, done) => done(null, profile));
  const metadata = strategy.generateServiceProviderMetadata(spCert);

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
  passport.use(strategy);

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/', (req, res) => res.sendFile(index));

  const checkAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/auth');
  app.get('/u/:user', checkAuth, (req, res) => res.sendFile(index));

  const auth = passport.authenticate('saml', {failureRedirect: '/auth/fail'});
  app.get('/auth', auth, (req, res) => res.redirect('/'));
  app.post('/auth/callback', auth, (req, res) => res.redirect('/'));
  app.get('/auth/fail', (req, res) => res.status(401).send('Login failed'));
  app.get('/shibboleth', (req, res) => res.type('application/xml').status(200).send(metadata));

  https.createServer(credentials, app).listen(443);
}

// WebSocket Server
const socket = new ws.Server({port: socket_port});
socket.on('connection', socket => connection(socket, children));
if (dev) console.log('socket listening on port', socket_port);

process.on('SIGINT', e => process.exit()).on('SIGTERM', e => process.exit());
process.on('exit', function(signal, code) {
    if (dev) console.log('process exiting');
    Object.keys(children).forEach(pid => (dev && console.log('killing', pid)) || process.kill(pid, 'SIGTERM'));
    process.kill(process.pid, 'SIGKILL');
});
