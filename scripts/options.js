(function() {
 
    "use strict";
 
    var twitchUsernameInput;
    var saveButton;
    var favStreams;
 
    function save() {
        //chrome.storage.local.set({'accountName':twitchUsernameInput.value}) 
        //localStorage["accountName"] = twitchUsernameInput.value;
        var tempFavArray = favStreams.value.replace(/\s+/g, '').split(","); //removes spaces then makes array of each stream
      
        for (var i = tempFavArray.length - 1; i >= 0; i--) {
        	tempFavArray[i] = getStreamName(tempFavArray[i]); //trims url if there is one
        }
        localStorage["favStreams"] =  tempFavArray.join(","); //converts array back to string with ',' between each elm
        console.log("saved");
    }
 


    function getStreamName(url) {
    var temp = url;
    temp = temp.replace("http://www.twitch.tv/", '');
    temp = temp.replace("https://www.twitch.tv/", '');
    temp = temp.replace("www.twitch.tv/", '');
    var extraIndex = temp.indexOf("#");
    if (extraIndex !== -1)
        temp = temp.substring(0, extraIndex);
    var popoutIndex = temp.indexOf("/popout")
    if (popoutIndex !== -1)
        temp = temp.substring(0, popoutIndex);
    return temp.trim(); 
	}

    function initiate() {
        //var accountName = localStorage['accountName']; //accountname stored in memory
        var savedFavStreams = localStorage['favStreams']; //fav streams saved in memory
        // chrome.storage.local.get('accountName',function(accountName){
 
        //  twitchUsernameInput = document.getElementById("TwitchUsername");
 
        //  if (accountName) {
        //     twitchUsernameInput.value = accountName;
        // }
        // });
 
        //twitchUsernameInput = document.getElementById("TwitchUsername");
        favStreams = document.getElementById("Fav");
 
        //if (accountName) {
        //  twitchUsernameInput.value = accountName;
        //}
        if (savedFavStreams) {
            favStreams.value = savedFavStreams;
        }
    }

    $(document)
        .ready(function() {
            initiate();
            $('#savebutton')
                .bind("click", save);
        });
 
}());