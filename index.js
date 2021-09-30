// e

import express, { request } from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
const aleph = require('aleph-js')

const expressSession = require('express-session')({
    secret: 'vit',
    resave: false,
    saveUninitialized: false
})

import passport from 'passport';
import passportLocalMongoose from 'passport-local-mongoose';
import connectEnsureLogin from 'connect-ensure-login';

const app = express();
const port = 4567;

app.use(express.static(__dirname))

app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(expressSession)

app.use(passport.initialize())
app.use(passport.session())

app.set('view engine', 'ejs')

mongoose.connect('mongodb://localhost/Chat')

const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    private_key: String,
    public_key: String,
    mnemonics: String,
    address: String
});

userSchema.plugin(passportLocalMongoose)

const User = mongoose.model('User', userSchema);
passport.use(User.createStrategy())

passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

// User.create({ username: 'Dev', password: 'devpassword'})
// User.create({ username: 'Adith', password: 'adithpassword'})
// User.create({ username: 'Vishesh', password: 'visheshpassword'})

// User.register({ username: 'someone', active: false }, 'password')

app.get('/', connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    let room = 'hall'
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'
    aleph.posts.get_posts('chat', { 'refs': [room], 'api_server': api_server }).then((result) => {
        res.render('index', { posts: result.posts, user: req.user })
    })
})
    
app.get("/login", (req, res) => {
    res.sendFile('views/login.html', { root: __dirname })
})

app.get("/register", (req, res) => {
    res.sendFile('views/register.html', { root: __dirname })
})

app.post("/register", (req, res) => {
    const user = User.register({ username: req.body.username, active: false }, req.body.password, (err, user) => {
        aleph.ethereum.new_account().then((eth_account) => {
            user.private_key = eth_account.private_key
            user.public_key = eth_account.public_key
            user.mnemonics = eth_account.mnemonics
            user.address = eth_account.address
            user.save()
            passport.authenticate('local')(req, res, () => {
                res.redirect("/")
            })
        })
    })
})



app.post("/login", passport.authenticate('local'), (req, res) => {
    res.redirect("/")
})

app.post("/messages", connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    var message = req.body.message
    aleph.ethereum.import_account({ mnemonics: req.user.mnemonics }).then((account) => {
        let room = 'hall'
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'TEST'

        aleph.posts.submit(account.address, 'chat', { 'body': message }, {
            ref: room,
            api_server: api_server,
            account: account,
            channel: channel
        })
    })
})

app.get('/users/:username', connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    // look up the user later
    User.findOne({ username: req.params.username }, (err, user) => {
        if (err) {
            res.send({ error: err })
        } else {
            res.send({ user: user })
        }
    })
})

app.listen(port, () => {
    console.log(`Server running on port ${port}...`)
})

