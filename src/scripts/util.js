const ERRORS = {
    'AUTH': 'Twitch auth error',
    'ID': 'Twitch ID not set'
};

function chromeTabsQuery(params) {
    return new Promise(function (resolve, reject) {
        chrome.tabs.query(params, resolve);
    });
}

function chromeStorageGet(keys) {
    return new Promise(function (resolve, reject) {
        chrome.storage.sync.get(keys, resolve);
    });
}

function chromeStorageSet(storageObj) {
    return new Promise(function (resolve) {
        chrome.storage.sync.set(storageObj, resolve);
    });
}

function chromeOuathWeb(url, interactive) {
    return new Promise(function (resolve) {
        chrome.identity.launchWebAuthFlow({ 'url': url, 'interactive': interactive }, resolve);
    });
}

function twitchGetAjax(apiPath, data, token) {
    apiPath = apiPath.startsWith('/') ? apiPath.substr(1) : apiPath;
    data = data || {};
    headers = { 'Client-ID': config.CLIENT_ID };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return Promise.resolve($.ajax({
        type: 'GET',
        url: `https://api.twitch.tv/helix/${apiPath}`,
        headers: headers,
        data: data,
        dataType: 'json',
    }));
}

//handles pagnation of twitch api
function twitchGetAll(apiPath, data, token) {
    function recursiveCall(callData, arr, total) {
        if (!total || arr.length < total) {
            return twitchGetAjax(apiPath, callData, token).then(function (res) {
                arr = arr.concat(res.data);
                callData.after = res.pagination.cursor;
                total = res.total;
                return recursiveCall(callData, arr, total);
            });
        } else {
            return Promise.resolve(arr);
        }
    }
    data = data || {};
    return recursiveCall(data, []);
}

function twitchAuth(interactive) {
    // TODO: look into optional paramas for auth url
    const redirect = chrome.identity.getRedirectURL('oauth2');
    const respType = 'token';
    const scopes = '';
    const url = `https://id.twitch.tv/oauth2/authorize?client_id=${config.CLIENT_ID}` +
        `&redirect_uri=${redirect}&response_type=${respType}`;
    var token;
    return chromeOuathWeb(url, interactive).then(function (resp) {
        if (!resp) {
            throw ERRORS.AUTH;
        }
        token = resp.split('#')[1].replace('access_token=', '').replace('&scope=', '').replace('&token_type=bearer', '');
        return token;
    });
}

function saveAuthInfo(token) {
    var info;
    return twitchGetAjax('users', null, token).then(function (twitchResp) {
        const respData = twitchResp.data[0];
        info = {
            twitchName: respData.login,
            twitchId: respData.id
        };
        return chromeStorageSet(info);
    }).then(function () {
        return info;
    });
}
