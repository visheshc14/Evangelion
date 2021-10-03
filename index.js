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
import { data } from 'autoprefixer';

const app = express();
const port = 8000;

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

app.get('/', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    let room = 'hall'
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let memberships = await aleph.posts.get_posts('vit.channel_memberships', { 'addresses': [req.user.address], 'api_server':
    api_server })

    let channel_refs = memberships.posts.map((membership) => {
        if (membership.ref) {
            return membership.ref
        }
    })

    channel_refs = channel_refs.filter(ref => ref != undefined)

    let channels = await aleph.posts.get_posts('vit.channels', { 'hashes': channel_refs, 'api_server': api_server })

    res.render('index', {
        channels: channels.posts,
        user: req.user,
        room: room
    })
})

app.get('/channels/new', connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    res.render('channels/new')
})

app.get('/channels', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {   // New channels route
    let room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    let channels = await aleph.posts.get_posts('vit.channels', { 'api_server': api_server })

    res.render('channels/index', {
        channels: channels.posts
    })
})

app.get('/channels/:item_hash/join', connectEnsureLogin.ensureLoggedIn(), (req, res) => {
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'

    aleph.ethereum.import_account({ mnemonics: req.user.mnemonics }).then(async (account) => {

        let result = await aleph.posts.get_posts('vit.channels', { 'api_server': api_server, hashes: [req.params.item_hash] })

        let post = result.posts[0]
        if (post) {
            let data;
            let post_content = JSON.parse(post.item_content) 
            if (post_content.content.type == 'private') {   
                data = { status: 'pending' }
            } else {
                data = { status: 'active' }
            }
            await aleph.posts.submit(account.address, 'vit.channel_memberships', data, {
                ref: req.params.item_hash,
                api_server: api_server,
                account: account,
                channel: channel
            })
            res.redirect(`/rooms/${req.params.item_hash}`)
        } else {
            // handle the error condition
        }
    })
})

app.post("/channels", connectEnsureLogin.ensureLoggedIn(), (req, res) => {

    var channel_name = req.body.name
    var channel_type = req.body.type

    aleph.ethereum.import_account({ mnemonics: req.user.mnemonics }).then(async (account) => {
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'VIT_CHAT'
        
        let data = {
            'body': channel_name,
            'type': channel_type,
            'approved_addresses': [account.address]
        }

        let response = await aleph.posts.submit(account.address, 'vit.channels', data,{
            api_server: api_server,
            account: account,
            channel: channel
        })

        await aleph.posts.submit(account.address, 'channel_memberships', {}, {
            ref: response.item_hash,
            api_server: api_server,
            account: account,
            channel: channel
        })

        console.log(response)
        res.redirect("/")
    })
})

app.get("/channels/:channel_hash/approve/:user_address", connectEnsureLogin.ensureLoggedIn(), (req, res) => {

    var channel_hash = req.params.channel_hash
    var user_address = req.params.user_address

    aleph.ethereum.import_account({ mnemonics: req.user.mnemonics }).then(async (account) => {
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'VIT_CHAT'

        let result = await aleph.posts.get_posts('vit.channels', { hashes: [channel_hash] })
        let channel_record = result.posts[0]

        let data = channel_record.content
        data.approved_addresses.push(user_address)

        let response = await aleph.posts.submit(account.address, 'amend', data,{
            api_server: api_server,
            account: account,
            channel: channel,
            ref: channel_hash
        })

        result = await aleph.posts.get_posts('vit.channels', { hashes: [channel_hash] })
        channel_record = result.posts[0]

        console.log(channel_record)

        // await aleph.posts.submit(account.address, 'channel_memberships', {}, {
        //     ref: response.item_hash,
        //     api_server: api_server,
        //     account: account,
        //     channel: channel
        // })

        // console.log(response)
        // res.redirect("/")
    })
})

app.get('/rooms/:room/members', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    let room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261

    // let channel = await aleph.posts.get_posts('vit.channels', { 'hashes': [room], 'api_server': api_server })
    
    let memberships = await aleph.posts.get_posts('vit.channel_memberships', { 'refs': [room], 'api_server':
    api_server })

    res.render('members/index', {
        user: req.user,
        memberships: memberships.posts,
        room: room
    })
})


app.get('/rooms/:room', connectEnsureLogin.ensureLoggedIn(), async (req, res) => {
    let room = req.params.room
    var api_server = 'https://api2.aleph.im'
    var network_id = 261
    var channel = 'TEST'
 

    let memberships = await aleph.posts.get_posts('vit.channel_memberships', { 'addresses': [req.user.address], 'api_server':
    api_server })

    let channel_refs = memberships.posts.map((membership) => {
        if (membership.ref) {
            return membership.ref
        }
    })

    console.log(channel_refs)

    let result = await aleph.posts.get_posts('vit.channels', { 'api_server': api_server, hashes: [room] })

    console.log(result)

    let post = result.posts[0]
    let post_content = JSON.parse(post.item_content) 
    let channel_details = post_content.content 

    console.log(channel_details)


    channel_refs = channel_refs.filter(ref => ref != undefined)

    let channels = await aleph.posts.get_posts('vit.channels', { 'hashes': channel_refs, 'api_server': api_server })

    result = await aleph.posts.get_posts('vit.messages', { 'refs': [room], 'api_server': api_server })

    res.render('channels/show', {
        channels: channels.posts,
        posts: result.posts,
        user: req.user,
        room: room,
        channel_details: channel_details
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

app.post("/messages/:room", connectEnsureLogin.ensureLoggedIn(), (req, res) => {

    var message = req.body.message
    const room = req.params.room
    
    aleph.ethereum.import_account({ mnemonics: req.user.mnemonics }).then((account) => {
        let room = req.params.room
        var api_server = 'https://api2.aleph.im'
        var network_id = 261
        var channel = 'TEST'

        aleph.posts.submit(account.address, 'vit.messages', { 'body': message }, {
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
