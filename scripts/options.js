(function() {

    function chromeStorageSet(storageObj) {
        return new Promise(function(resolve, reject){
            chrome.storage.sync.set(storageObj);
        })
    }

    function chromeStorageGet(keys) {
        return new Promise(function(resolve, reject){
            chrome.storage.sync.get(keys, resolve);
        })
    }

    function save() {
        var twitchName = $('#twitchUsername').val().trim();
        var autoIncludeVal = $('#autoInclude').prop('checked');
        return chromeStorageSet({twitchName: twitchName, autoInclude: autoIncludeVal});
    }


    function init() {
        chromeStorageGet(['twitchName','autoInclude']).then(function (ret) {
            $('#twitchUsername').val(ret.twitchName);
            $('#autoInclude').prop('checked', ret.autoInclude);
        })
    }

    $(document)
        .ready(function() {
            init();
            $('#saveButton').bind("click", save);
        });
 
}());