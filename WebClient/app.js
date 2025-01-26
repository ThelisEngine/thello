token = null;
testIndex = 1;
connection = null;
tenant = null;

$(document).ready(function () {

    $("#app").hide();
    $("#loginModal").modal({
        backdrop: 'static'
    });


    // ****** For production purpose - uncomment lines 
    // >> FROM HERE
    $("#environmentSelect").val('stable');
    $("#loginModal").modal('show');
    // << TO HERE

    // ****** For test purpose - uncomment lines and specify valid username/password
    // >> FROM HERE
    // $("#usernameInput").val('<USERNAME>');
    // $("#passwordInput").val('<PASSWORD>');
    // $("#environmentSelect").val('<ENVIRONMENT');
    // login();
    // << TO HERE

});

// Decode JWT
function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

async function login() {

    const username = $("#usernameInput").val();
    const password = $("#passwordInput").val();

    const environment = $("#environmentSelect").val();
    let apiUrl = '';
    if (environment == 'debug') {
        apiUrl = "http://localhost:83/api"
    } else if (environment == 'stable') {
        apiUrl = "https://api.v3.thello.cloud/api";
    } else {
        apiUrl = "https://api."+environment+".v3.thello.cloud/api";
    }

    const response = await fetch(apiUrl + "/Authentication/Authenticate", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userName: username, password: password })
    });

    if (response.ok) {
        const data = await response.json();
        token = data.access_token;
        console.log('JWT Token:', token);
        
        // 
        const headers = { };
        const responseMine = await fetch(apiUrl + "/tenants/mine", {
            method: 'GET',
            headers: new Headers({
                'Authorization': 'Bearer ' + token 
            })
        })
        .then(response => response.json())
        .then(tenant =>  {
            console.log('SignalR url:', tenant.signalRUrl);
            connection = new signalR.HubConnectionBuilder()
                .withUrl(tenant.signalRUrl, {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .configureLogging(signalR.LogLevel.Debug)
                .build();

            connection.on("BlocEvent", (blocId, eventName, sipCallId, fromName, fromNumber, to, data, callContextId) => {
                console.log(sipCallId, eventName, "blocId = " + blocId + " fromName = " + fromName + " fromNumber = " + fromNumber + " to = " + to + " contextId = " + callContextId + " data = " + data);
                const li = document.createElement("li");
                li.classList.add("list-group-item");
                li.textContent = eventName + " / blocId=" + blocId + " fromName=" + fromName + " fromNumber=" + fromNumber + " to=" + to + " contextId=" + callContextId + " data=" + data;
                $("#bloc-updates").append(li);
                $("#callContextId").val(callContextId);
                scrollToBottom();
            });            
        });

        // Decode JWT token to get user identifier
        const jwt = parseJwt(token);
        console.log('UID = ', jwt["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]);
        $("#varValue").val(jwt["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"]);        

        $("#loginButton").prop("disabled", true);
        $("#logoutButton").prop("disabled", false);
        $("#pingButton").prop("disabled", false);
        $("#userLoginForm").hide();
        $("#userPasswordForm").hide();
        connection.start()
            .catch(err => console.error(err.toString()));
        $("#loginModal").modal('hide');
        $("#app").show();
    } else {
        console.error('Authentication failed');
        token = null;
        $("#loginButton").prop("disabled", false);
        $("#logoutButton").prop("disabled", true);
        $("#pingButton").prop("disabled", true);
    }
}

function logout() {
    token = null;
    connection.stop();
    $("#loginButton").prop("disabled", false);
    $("#logoutButton").prop("disabled", true);
    $("#userLoginForm").show();
    $("#userPasswordForm").show();
    $("#loginModal").modal('show');
    $("#usernameInput").val('');
    $("#passwordInput").val('');
    $("#app").hide();
}

function ping() {
    var res = connection.invoke('SRPing')
        .then((result) => {
            console.log("Ping result: ", result);
            const li = document.createElement("li");
            li.classList.add("list-group-item");
            li.textContent = result;
            $("#bloc-updates").append(li);
            scrollToBottom();
        }).catch((err) => {
            console.error("Ping fail: ", err);
        });
}

function subscribe() {
    const blocId = $("#blocId").val();
    connection.invoke('SubscribeBlocNotifications', blocId).catch(err => console.error(err.toString()));
}

function unsubscribe() {
    const blocId = $("#blocId").val();
    connection.invoke('UnsubscribeBlocNotifications', blocId).catch(err => console.error(err.toString()));
}

function set() {
    const callContextId = $("#callContextId").val();
    const varName = $("#varName").val();
    const varValue = $("#varValue").val();
    console.log('SetStringVariable', callContextId, varName, varValue);
    connection.invoke('SetStringVariable', callContextId, varName, varValue).catch(err => console.error(err.toString()));
}
function get() {
    const callContextId = $("#callContextId").val();
    const varName = $("#varName").val();
    var r = connection.invoke('GetVariable', callContextId, varName).catch(err => console.error(err.toString()));

    const li = document.createElement("li");
    li.classList.add("list-group-item");
    li.textContent = varName + " = " + r;
    $("#bloc-updates").append(li);
    scrollToBottom();
}

function setFlexHandset() {
    const userId = $("#flexUserId").val();
    const handsetId = $("#flexHandsetId").val();
    console.log('SetFlexHandset', userId, handsetId);
    connection.invoke('SetFlexHandset', userId, handsetId).catch(err => console.error(err.toString()));
}

function clearFlexHandset() {
    const userId = $("#flexUserId").val();
    console.log('ClearFlexHandset', userId);
    connection.invoke('SetFlexHandset', userId, null).catch(err => console.error(err.toString()));
}

async function getDbVariable() {
    const variableName = $("#dbVariableName").val();
    var r = await connection.invoke('GetDbVariable', variableName).catch(err => console.error(err.toString()));
    console.log('GetDbVariable', variableName, r);
    $("#dbVariableValue").val(r);
}

async function setDbVariable() {
    const variableName = $("#dbVariableName").val();
    const variableValue = $("#dbVariableValue").val();
    console.log('SetDbVariable', variableName, variableValue);
    var r = await connection.invoke('SetDbVariable', variableName, variableValue).catch(err => console.error(err.toString()));
    if (r==0)
        alert("Failed to set variable, it does not exists");
}

function convertShortGuid() {
    const variableValue = $("#dbGuidVariableValue").val();
    $("#dbVariableValue").val(shortguid(variableValue));
}

function guidToBytes(guid) {
    var bytes = [];
    guid.split('-').map((number, index) => {
        var bytesInChar = index < 3 ? number.match(/.{1,2}/g).reverse() :  number.match(/.{1,2}/g);
        bytesInChar.map((byte) => { bytes.push(parseInt(byte, 16));})
    });
    return bytes;
}

function shortguid(guid) {
    const byteArray = guidToBytes(guid);
    const base64String = btoa(String.fromCharCode(...byteArray))
        .replace(/\//g, '_')  // Replace '/' with '_'
        .replace(/\+/g, '-')  // Replace '+' with '-'
        .substring(0, 22);     // Take the first 22 characters
    
    return base64String;
}

const guid = "06e80f70-4f78-4104-976b-9e5c64f0a0f4";
const result = guidToBase64(guid);
console.log(result);

function scrollToBottom() {
    const container = $('.bloc-updates-container');
    container.scrollTop(container.prop('scrollHeight'));
}

function openPhone() {
    $("#webphoneModal").modal('show');
}

function closePhone() {
    $("#webphoneModal").modal('hide');    
}
