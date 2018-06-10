(function() {

    function save() {
        var twitchName = $('#twitchUsername').val().trim();
        var autoIncludeVal = $('#autoInclude').prop('checked');
        var toSave = {autoInclude: autoIncludeVal};
        var twitchPromise = Promise.resolve();
        if (twitchName.length) {
            twitchPromise = twitchGetAjax('users', {login: twitchName});
        }
        return twitchPromise.then(function (twitchResp) {
            if (twitchResp && twitchResp.data.length > 0) {
                const respData = twitchResp.data[0];
                toSave.twitchName = respData.login;
                toSave.twitchId = respData.id;
            } else {
                alert('Twitch name passed does not exits');
            }
            return chromeStorageSet(toSave);
        }).catch(function (err) {
            alert('Error connecting to twitch api');
            return chromeStorageSet(toSave);
        });
        
    }

    function twitchLogin() {
        return twitchAuth(true)
            .then(saveAuthInfo)
            .then(function (info) {
                $('#twitchUsername').val(info.twitchName);
            });
    }


    function init() {
        chromeStorageGet(['twitchName','autoInclude']).then(function (ret) {
            $('#twitchUsername').val(ret.twitchName);
            $('#autoInclude').prop('checked', ret.autoInclude);
        });
    }

    $(document)
        .ready(function() {
            init();
            $('#saveButton').bind('click', save);
            $('#twitchLogin').bind('click', twitchLogin);
        });
 
}());