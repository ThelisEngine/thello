# Thello API

- [Introduction](#intro)
- [Management API](#mgm_api)
- [SignalR API](#signalr_api)

## <a id="intro">Introduction</a>

API (Application Programming Interface) allow external (third-parties) software to access and control Thello behavior.

Depending on usage, different APIs are available

- Management API: is intended for back-office tools to configure Thello, i.e. create & manage tenants from an administrative point of view: creating new tenants, managing licensing and extracting billing information. This API is typically used by ERP to configure subscriptions and create invoices
- SignalR API: this API is intended to control in real-time the flow of calls. SignalR is a technology that allows bidirectional communication between clients such as web-clients and Thello

## <a id="mgm_api">Management API</a>

This API is reachable on following url: https://api.v3.thello.cloud

### Click to call feature

```
https://api.v3.thello.cloud/api/Calls/click_to_call?to=<NUMBER_TO_DIAL>&tenantId=<GUID_TENANT_ID>&apiKey=<USER_API_KEY>[&handsetId=<OPTIONAL_GUID_HANDSET_ID_>]
```
When calling this web service, all active phone for user corresponding to the ApiKey will ring. When one of them is answered, the NUMBER_TO_DIAL will be dialed

GUID_HANDSET_ID is an optional handset to specify only one handset that should ring before calling

Alternatively:
* ApiKey is optional if a previous login is performed by the user on API
* ApiKey can be passed as a header


## <a id="signalr_api">Signal-R API</a>

### Initializing the SignalR connection

Signal-R API directly connects to Thello’s core service. Therefore the connection url depends on the Tiergroup executing the tenant’s call-flow.

Before accessing the API, the client must get authentication credentials through a JWT token or use a valid user API key in calls headers.

#### JWT Bearer authentication

Authentication can be done on the Thello management API by calling Authenticate URL with JSON data ```{"username": "john_smith", "password": "secret_password" }```

Example of javascript code:
```{lang=javascript} 
async function login() {
    const username = $("#usernameInput").val();
    const password = $("#passwordInput").val();
    console.log('Current JWT Token:', token);
    const response = await fetch('https://api.v3.thello.cloud/api/Authentication/Authenticate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: username, password: password })
    });

    if (response.ok) {
        const data = await response.json();
        token = data.access_token;
        console.log('JWT Token:', token);
        connection.start().catch(err => console.error(err.toString()));
    } else {
        console.error('Authentication failed');
        token = null;
    }
}
```

Once the JWTToken is received it can be used to establish authenticated requests to the management API or Signal-R hub.

The SignalR service is not located on the same url as the management API and is tenant specific. The signal-R service base url can be obtained through the Management API, using “/api/Tenant/mine” request and the SignalRUrl field of the returned structure

Example:

```{lang=javascript} 
 const responseMine = await fetch(baseUrl + "/tenants/mine", {
        headers: { Authorization: 'Bearer '+token }
    });
    if (responseMine.ok) {
        document.tenant = await responseMine.json();
        console.log('SignalR url:', document.tenant.SignalRUrl);
    }
```


The Signal-R connection can be created using:

```{lang=javascript} 
connection = new signalR.HubConnectionBuilder()
    .withUrl(document.tenant.signalRUrl, {
        accessTokenFactory: () => token
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Debug)
    .build();
```

Where signalRUrl is the url obtained earlier and saved into document.tenant (in this example)
token is the JwtToken

### API Key authentication

Each Thello user can have one or more API keys to run calls on services and signalR. In the user profile screen in control panel, open the “API Keys” tab. The list of current key is displayed. A button “+ New” is also available to generate a new key.

Once key is known, it can be used in HTTP headers of SignalR calls.

```{lang=javascript} 
connection = new signalR.HubConnectionBuilder()
    .withUrl(thelloSignalRUrl, {
        headers: { "X-API-KEY": "<user_api_key>" }
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Debug)
    .build();
```

### SignalR client API

```public async Task SubscribeBlocNotifications(string blocId)```\
\
Subscribes for event sent by a specific bloc\
Notifications are received by the signal-r client on the following callback:

- ```Task BlocEvent(string blocId, string eventName, string callId, string fromName, string fromNumber, string to, string data, string callContextId);```\
\
Where: 
    - ```blocId```: the bloc ID as specified in SubscribeBlocNotifications, this allows a single callback to receive notifications from different blocs
    - ```eventName```: the notification event
    - ```callId```: SipCallId for the current channel
    - ```fromName```: CallerID name
    - ```fromNumber```: CallerID number
    - ```to```: Called number or extension
    - ```data```: optional data dependent of the bloc type sending the notification
    - ```callContextId```: A contextId that can be used with SetVariable or GetVariable

```public async Task UnsubscribeBlocNotifications(string blocId)```

Unsubscribes callback notification of event bloc that would have been previously subscribed using SubscribeBlocNotifications()

```public async Task BlocNotify(string blocId, string eventName, string sipCallId, string fromName, string fromNumber, string to, string data, Guid contextId)``` 

This function may be used to simulate a BlocNotification.
Use it for test purpose of your interface

```public Task SetVariable(Guid callContextId, string name, object value)```

Set specified KSL variable into the specified callContext. callContextId is received by bloc notifications and is constant throughout the call.

Setting a variable will set it for the stack of all blocs executed during the call, this means that new bloc will have the variable set and previous bloc (if they return from the stack) will also have the variable set. Take care to not set variables that would affect the normal behaviour of the blocs and respect the bloc documentation as described below

```public Task<object> GetVariable(Guid callContextId, string name)``` 

Read the specified variable from the call context stack. Only the latest value in the stack will be returned, therefore the returned value may depend on the exact time the GetVariable is executed

```public async Task<int> SetDbVariable(string name, string value)```

Set specified db variable. This allows storage of key/value pairs that can be used by blocks
The variable must exists to be updated
Result is the number of updated records (1 if variable exists, 0 otherwise)
Available variables depend on the dialplan and blocks used

```public async Task<string?> GetDbVariable(string name)``` 

Read the specified variable from the database.
Available variables depend on the dialplan and blocks used

```public async Task SetFlexHandset(Guid? userId, guid? handsetId)``` 

Login or logout a flex user on specified handset.
Note: a user can only be flex on a single handset, therefore if you log to another handset, the previous handset will be logged-out
to logout the user from any handset, just specify a null handsetId

if userId is null, the currently logged user (into signalR API) will be used.

userId and handsetId can be read from the web portal. The "ID" columns are not visible by default, so right click on the column header in the user's list or the handset's list and choose "Column chooser", then select the "ID" column
Just copy/paste the correct Id into your own database or code.


### Thello functional blocs compatibles with SignalR API</a>

#### GroupCall bloc

Notifications sent by "Group call" blocs

- GROUP_ENTER
- GROUP_ANSWER
- GROUP_TIMEOUT
- GROUP_HANGUP

for GROUP_ANSWER, the optional data field contains the UserID who answered the call
GROUP_HANGUP is triggered after an answered call has been hangup

Possible flows:

GROUP_ENTER -> GROUP_TIMEOUT
GROUP_ENTER -> GROUP_ANSWER(UserID) -> GROUP_HANGUP


#### Queue bloc

Notifications sent by “Queues” blocs

- QUEUE_ENTER
- QUEUE_FIRST
- QUEUE_ANSWERED
- QUEUE_FALLBACK
- QUEUE_HANGUP

Variables that may affect the Queue flow:

If you want to control which operator will receive queued calls, you may configure the queue as follow:

- Do not assign operators
- Clear the checkbox “fallback if no operator”

Monitor the queue notifications and save the callContextId

If you decide to send a queued call to an operator, set the variable PICKUP_OPERATOR to the operator’s UID (pass the string guid), the specified operator will be added to the list of assigned and available operators (if this list is empty, it will be the only one). It will be ringed and then bridged with the pending call

Example:

```SetVariable(callContextId, "PICKUP_OPERATOR", "f17618f7-56b1-4a2f-8e7f-ea97f0a995e0")```

#### Profiles bloc

Profiles bloc uses a db Variable to keep the currently selected profile output.
The variable name is the bloc's ID

Possible values are from -1 to n, which is the profile index to be selected.
-1 corresponds to the default output, while 0 is the first output

Example:
```
Profile bloc ID = 638c87c1-37ac-432b-8779-d1e4b8246099

Select output #2:

var r = await connection.invoke('SetDbVariable', blocId, 1).catch(err => console.error(err.toString()));
if (r==0)
    alert("Failed to set profile output, it does not exists");
```

Note: the BLF mechanism used to show currently connected profile output uses a different mechanism and will not
be updated by changing the db variable as described here. So using db modification will
correctly affect the behaviour but may provide inconsistent display on phones
shortcut BLF

## Utilities

### Guid to shortguid conversion:

C#
```{lang=c#}
Convert.ToBase64String(guid.ToByteArray()).Replace("/", "_").Replace("+", "-").Substring(0, 22)
```

Javascript
```{lang=javascript}
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
```

