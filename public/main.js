const socket = io('http://localhost:5000/', {
    autoConnect: false
});                                     //socket connection

//global variable
const ChatBody = document.querySelector('.chat-body');
const chatNav = document.querySelector('.chatNav');
const userTitle = document.getElementById('user-title');
const loginContainer = document.querySelector('.login-container');
let userTable = document.querySelector('.users');
const userTagline = document.querySelector('#users-tagline');
const title = document.querySelector('#active-user');
const messages = document.querySelector('.messages');
const msgDiv = document.querySelector('.msg-form');

//global methods
const methods = {
    socketConnect: async (username, userID) => {
        socket.auth = { username, userID } //we use this for connect new user
        await socket.connect();
    },
    createSession: async (username) => {
        const data = {
            username
        }

        let options = {
            method: 'POST',
            headers: { 'content-Type': 'application/json' },
            body: JSON.stringify(data)
        }

        await fetch('./session', options)
            .then(res => res.json())
            .then(data => {
                // console.log(data);
                methods.socketConnect(data.username, data.userID)//we use this for connect new user

                //set localstorage for session
                localStorage.setItem('session-username', data.username);
                localStorage.setItem('session-userID', data.userID);

                loginContainer.classList.add('d-none');   //thats hide the login form
                ChatBody.classList.remove('d-none');   //thats show chat box
                chatNav.classList.remove('d-none');   //thats show chat box
                userTitle.innerHTML = data.username; //thats for name saving
            })
            .catch(err => console.log(err)) //catch the error
    },
    setActiveUser: (username, userID) => {
        title.innerHTML = username;


        title.setAttribute('userID', userID);

        //user list active and inactive class event handler
        const list = document.getElementsByClassName('socket-users');
        // console.log(list);
        for (let i = 0; i < list.length; i++) {
            list[i].classList.remove('table-active');
        }
        event.currentTarget.classList.add('table-active');

        //display message area after selecting user
        msgDiv.classList.remove('d-none');
        messages.innerHTML = '';
        socket.emit('fetch-messages', { receiver: userID });
        const notify = document.getElementById(userID);
        notify.classList.add('d-none');
    },
    appendMessage: ({ message, time, background, position }) => {
        let div = document.createElement('div');
        div.classList.add('message', 'bg-opacity-25', 'rounded', 'm-2', 'px-2', 'py-1', background, position);
        div.innerHTML = `<span class="msg-text">${message}</span><span class="msg-time">${time}</span>`;
        messages.append(div);
        messages.scrollTo(0, messages.scrollHeight);
    }
}

//session variable
const sessUsername = localStorage.getItem('session-username'); //save username
const sessUserID = localStorage.getItem('session-userID'); //save userid

if (sessUserID && sessUsername) {
    methods.socketConnect(sessUsername, sessUserID); //we use this for cnnect new user


    loginContainer.classList.add('d-none');   //thats hide the login form
    ChatBody.classList.remove('d-none');   //thats show chat box
    chatNav.classList.remove('d-none');   //thats show chat box
    userTitle.innerHTML = sessUsername;
}
//login form handler
const loginForm = document.querySelector('.user-login');

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();  //if user login without username then it will dont work
    const username = document.getElementById('username'); //username me value li
    methods.createSession(username.value.toLowerCase());
    username.value = '';
});

//user list table
socket.on('users', ({ users }) => {
    // console.log(users);

    //removing self user
    const index = users.findIndex(user => user.userID == socket.id);
    if (index > -1) {
        users.splice(index, 1);
    }

    //generating user table list
    userTable.innerHTML = '';
    let ul = `<table class="table table-hover">`;
    for (const user of users) {
        ul += `<tr class="socket-users" onclick="methods.setActiveUser('${user.username}','${user.userID}')"><td>${user.username}<span class="text-danger ps-1 d-none" id="${user.userID}">!</span></td></tr>`;
    }
    ul += `</table>`;
    if (users.length > 0) {
        userTable.innerHTML = ul;
        userTagline.innerHTML = "Online Users";
        userTagline.classList.add('text-success');
        userTagline.classList.remove('text-danger');
    }
    else {
        userTagline.innerHTML = "No active user";
        userTagline.classList.remove('text-success');
        userTagline.classList.add('text-danger');
    }
});

//chat form handler
const msgForm = document.querySelector('.msgForm');
const message = document.getElementById('message');

msgForm.addEventListener('submit', e => {
    e.preventDefault();
    const to = title.getAttribute('userID');
    let time = new Date().toLocaleString('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });

    //set new message payload
    let payload = {
        from: socket.id,
        to,
        message: message.value,
        time
    }

    //emit message to server
    socket.emit('message-to-server', payload);

    methods.appendMessage({ ...payload, background: '#4285F4', position: 'right' });
    message.value = '';
    message.focus();

});

//receive private message
socket.on('message-to-user', ({ from, message, time }) => {
    const receiver = title.getAttribute('userID');
    const notify = document.getElementById(from);
    if (receiver == null) {
        notify.classList.remove('d-none');
    }
    else if (receiver == from) {
        methods.appendMessage({
            message,
            time,
            background: 'bg-secondary',
            position: 'left'
        });
    } else {
        notify.classList.remove('d-none');
    }
});

//get stored messages from MongoDB
socket.on('stored-messages', ({ messages }) => {
    if (messages.length > 0) {
        messages.forEach(msg => {
            let payload = {
                message: msg.message,
                time: msg.time
            }
            if (msg.from == socket.id) {
                methods.appendMessage({
                    ...payload,
                    background: '#4285F4',
                    position: 'right'
                });
            }
            else {
                methods.appendMessage({
                    ...payload,
                    background: 'bg-secondary',
                    position: 'left'
                });
            }
        });
    }
});

socket.on('user-away', userID => {
    const to = title.getAttribute('userID');
    if (to == userID) {
        title.innerHTML = '&nbsp;';
        msgDiv.classList.add('d-none');
        messages.classList.add('d-none');
    }
});


