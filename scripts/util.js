function arrayUnique(array) {
    var a = array.concat();
    for (var i = 0; i < a.length; ++i) {
        for (var j = i + 1; j < a.length; ++j) {
            if (a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
};

function chromeTabsQuery(params) {
    return new Promise(function(resolve, reject){
        chrome.tabs.query(params,resolve);
    })
}

function chromeStorageGet(keys) {
    return new Promise(function(resolve, reject){
        chrome.storage.sync.get(keys, resolve);
    })
}

function twitchGetAjax(apiPath, data, useKraken) {
    apiPath = apiPath.startsWith('/') ? apiPath.substr(1) : apiPath;
    var apiType = useKraken ? 'kraken' : 'helix';
    data = data || {};
    return $.ajax({
        type: "GET",
        url: `https://api.twitch.tv/${apiType}/${apiPath}`,
        headers: {'Client-ID': config.CLIENT_ID},
        data: data,
        dataType: "json",
    });
}


function checkIfChannel(stream) {
    // If the request worked then the channel exists
    // return twitchGetAjax(`channels/${stream}`).then(function () {
    //     return true;
    // }).catch(function () {
    //     return false;
    // });

    return twitchGetAjax(`users`, {login: stream}).then(function () {
        return true;
    }).catch(function () {
        return false;
    });
}
