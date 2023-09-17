const express = require('express');
const cors = require('cors'); //we use cors for sending mssgs to servers
const dotenv = require('dotenv');
dotenv.config({ path: './config.env' });

const port = 3000 || process.env.PORT;

//connect mongoDB
require('./dbConnect');
const tokenModel = require('./schema');

const app = express();

//init socket server
//we use this to joining of my express app with server
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
//end joining of server to app (express)

//middleware for css static file
//agar middle ware use nhi karenge to css load nhi hogi or error aaega
app.use(express.static('public'));
//use for data in form of json to client side to server side
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.js');
});

const { v4: uuidv4 } = require('uuid'); //thats create unique userid
const { env } = require('process');
//take user data from site make data object having username and user id  and send data  to index.js
app.post('/session', (req, res) => {
    let data = {
        username: req.body.username,
        userID: uuidv4()
    }
    res.send(data);
})

//socket.io middleware or connections
io.use((socket, next) => {
    const username = socket.handshake.auth.username;  //new auth make in main.js
    const userID = socket.handshake.auth.userID;
    if (!username) {                               
        return next(new error('Invalid username'));
    }

    //create new session
    socket.username = username;
    socket.id = userID;
    next();
});

//socket events
let users = [];
io.on('connection', async (socket) => {

    //socket methods
    const methods = {
        getToken: (sender, receiver) => {
            let key = [sender, receiver].sort().join("_");
            return key;
        },
        fetchMessages: async (sender, receiver) => {
            let token = methods.getToken(sender, receiver);
            const findToken = await tokenModel.findOne
                ({ userToken: token });
            if (findToken) {
                io.to(sender).emit('stored-messages',
                    { messages: findToken.messages });
            }
            else {
                let data = {
                    userToken: token,
                    messages: []
                }
                const saveToken = new tokenModel(data);
                const createToken = await saveToken.save();
                if (createToken) {
                    console.log('Token created!');
                }
                else {
                    console.log('error in created token');
                }
            }
        },
        saveMessages: async (payload) => {
            console.log(payload);
            let token = methods.getToken(payload.from, payload.to);
            // console.log(token);
            let data = {
                from: payload.from,
                message: payload.message,
                time: payload.time
            }
            let updatedata = await tokenModel.updateOne({ userToken: token }, {
                $push: { messages: data }}
            , {}, (err, res) => {
                if (err)
                    throw err;
                
            }

            );
            console.log(updatedata);
        }
    }

    //get all users
    let userData = {
        username: socket.username,
        userID: socket.id
    }
    users.push(userData);
    io.emit('users', { users });

    //for disconnection and this disconnect is inbuild in socket
    socket.on('disconnect', () => {
        users = users.filter(user => user.userID !== socket.id);
        io.emit('users', { users });
        io.emit('user-away', socket.id);
    });

    //get message from client
    socket.on('message-to-server', payload => {
        // console.log(payload);
        io.to(payload.to).emit('message-to-user', payload);
        methods.saveMessages(payload);
    });

    //fetch previous messages
    socket.on('fetch-messages', ({ receiver }) => {
        // console.log(receiver);
        methods.fetchMessages(socket.id, receiver);
    });
});

server.listen(port, () => {
    console.log(`server is running on port ${port}`);
});