(function() {
    var streams = [],
        checkedStreams = [],
        streamsInMulti = [],
        favStream = [],
        favShown = false,
        lastMulti = [],
        multistreamLink,
        currentTab,
        isCurrentMulti,
        WAIT_TIME = 1000;

    //trims the url to the channel name
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

    //ajax request to check if channel name exsits
    function twitchAjaxRequest(stream, index) {
        window.console.log("starting ajax for " + stream)
        ajaxRequest = $.ajax({
            type: "GET",
            url: "https://api.twitch.tv/kraken/channels/" + stream,
            // beforeSend: function (xhr) {
            //     xhr.setRequestHeader("Accept", "application/vnd.twitchtv.v2+json");
            // },
            dataType: "jsonp",
        });
        ajaxRequest.done(function(data, textStatus, jqXHR) {
            if (data['status'] === 404) {
                window.console.log(stream + ": Does not exsit")
                streams[index] = '';
            } else {
                window.console.log(stream + ": exsits")
            }
        });
        ajaxRequest.fail(function(jqXHR, textStatus, errorThrown) {
            window.console.log('Error:' + textStatus + " ; " + errorThrown);
        });

    }
    //gets the tabs with twitch open, adds streams to streams array and makes an ajax request for each stream;
    function getTwitchStreams() {
        chrome.tabs.query({
            url: "*://www.twitch.tv/*"
        }, function(tabs) {
            streams = [];
            for (var i = 0; i < tabs.length; i++) {
                if (tabs[i].url != null) {
                    var streamName = getStreamName(tabs[i].url);
                    if (streamName !== '')
                        streams.push(streamName);
                }
            }
            for (var i = 0; i < streams.length; i++) {
                twitchAjaxRequest(streams[i], i);
            };
        });

    }
    //adds verifyed streams to checkedStreams array
    function checkStreams() {
        window.console.log("checking streams");
        checkedStreams = [];
        for (var i = 0; i < streams.length; i++) {
            if (streams[i] != '')
                checkedStreams.push(streams[i]);
        };
        window.console.log("done checking");
    }

    //makes multiStream 
    function makeMultiStream() {
        removeStreams();
        closeTabs();
        if (isCurrentMulti)
        //updating multi
        {
            //Checks to make sure updated multi is still less then 6 by combinf current streams and new into one array
            var allStreams = arrayUnique(streamsInMulti.concat(checkedStreams));
            if(favStream){
                allStreams = arrayUnique(allStreams.concat(favStream));
            }
            if (allStreams.length <= 6) {
                var layoutNumber = 0;
                multistreamLink = "http://multistre.am/";
                for (var i = 0; i < allStreams.length; i++) {
                    multistreamLink = multistreamLink + allStreams[i] + "/";
                    layoutNumber += 3;
                };
                multistreamLink = multistreamLink + "layout" + layoutNumber;
                chrome.tabs.update(currentTab.id, {
                    url: multistreamLink
                });
            } else if (checkedStreams.length > 6)
                alert("Cant have more then 6 streams in a multistream, uncheck some streams");
        }
        //If makeing new multi
        else {
            window.console.log("Makeing multistream")
              if(favStream){
                checkedStreams = arrayUnique(checkedStreams.concat(favStream));
            }
            if (checkedStreams.length > 0 && checkedStreams.length <= 6) {
                var layoutNumber = 0;
                multistreamLink = "http://multistre.am/"
                for (var i = 0; i < checkedStreams.length; i++) {
                    multistreamLink = multistreamLink + checkedStreams[i] + "/";
                    layoutNumber += 3;
                };
                multistreamLink = multistreamLink + "layout" + layoutNumber;
                chrome.tabs.create({
                    url: multistreamLink
                });
            } else if (checkedStreams.length > 6)
                alert("Cant have more then 6 streams in a multistream, uncheck some streams");
        }
    }

    //used to combine 2 arrays and remove duplicates
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

    //removes unchecked streams from being added to multistream
    function removeStreams() {
        for (var i = checkedStreams.length - 1; i >= 0; i--) {
            checkedStreamName = checkedStreams[i];
            if ($('#' + checkedStreamName).prop("checked") == false) {
                window.console.log(checkedStreamName + " is unchecked");
                checkedStreams.splice(i, 1);
            }
        };
        for (var i = streamsInMulti.length - 1; i >= 0; i--) {
            multiStreamName = streamsInMulti[i];
            if ($('#' + multiStreamName).prop("checked") == false) {
                window.console.log(multiStreamName + " is unchecked");
                streamsInMulti.splice(i, 1); //,1 means remove only 1
            }
        };
        if(favShown){
            //Favs
            for (var i = favStream.length - 1; i >= 0; i--) {
            StreamName = favStream[i];
            if ($('#FAV' + StreamName).prop("checked") == false) {
                window.console.log(StreamName + " is unchecked");
                favStream.splice(i, 1); //,1 means remove only 1
                }
            };
        }
    }



    function closeTabs() {
        if ($("#CloseTab").prop("checked"))
            for (var i = 0; i < checkedStreams.length; i++) {
                var urlPattern = "*://www.twitch.tv/*" + checkedStreams[i] + "*";
                chrome.tabs.query({
                    url: urlPattern
                }, function(tabs) {
                    chrome.tabs.remove(tabs[0].id);
                });
            };
    }
    //checks if current tab is a multistream and updates iscurrntmulti to true if is multi and updtes current tab to current tab if multi
    function checkIfMulti() {
        chrome.tabs.query({
            url: "http://multistre.am/*"
        }, function(tabs) {
            chrome.tabs.getSelected(null, function(tab) {
                for (var i = tabs.length - 1; i >= 0; i--) {
                    if (tabs[i].id === tab.id) {
                        isCurrentMulti = true;
                        currentTab = tab;
                    }
                };
            });
        });
        if (isCurrentMulti === true) {
            getStreamsinMulti();
        } else {
            isCurrentMulti = false;
        }
    }

    function getStreamsinMulti() {
        var temp = currentTab.url;
        //clean up url
        temp = temp.replace("http://multistre.am/", '');
        var index = temp.indexOf("layout");
        //get num of streams
        var layout = temp.substring(index);
        layout = layout.replace("layout", '');
        layout = layout.replace("/", '');
        var layoutNumber = parseInt(layout);
        var numStreams = 1;
        while (layoutNumber != 0) {
            numStreams++;
            layoutNumber -= 3;
        }
        window.console.log("numStreams= " + numStreams);
        //adds streams to streamsInMulti
        temp = temp.substring(0, index);
        //temp = temp.replace("?s0=", "");

        //var startIndex = 0;
        // for (var i = 1; i < numStreams; i++) {
        //     var identifier = "&s" + i + "=";
        //     //window.console.log("identifier is " + identifier)
        //     var iIndex = temp.indexOf(identifier);
        //     stream = temp.substring(startIndex, iIndex)
        //     stream = stream.trim();
        //     streamsInMulti.push(stream);
        //     startIndex = iIndex + 4;
        // };s

        while (temp.indexOf("/") != -1) //while there are still streams since each stream name should have a '/' after it
        {
            stream = temp.substring(0, temp.indexOf("/")); //substring from beginning to end of the streamname (should just be stream name nothing else)
            stream = stream.trim();
            streamsInMulti.push(stream);
            temp = temp.substring(temp.indexOf("/") + 1); //set temp to string without the stream just added the array
        }

        //var lastStream = temp.substring(startIndex);
        //lastStream = lastStream.trim();
        //window.console.log("Last stream is " + lastStream)
        //streamsInMulti.push(lastStream);

        window.console.log("Streams in multi ");
        for (var i = 0; i < streamsInMulti.length; i++) {
            window.console.log(streamsInMulti[i]);
        };
    }

    //populates the favStreamArray and populates the checkboxes in the popup
    function showFavStreams() {
        favStream = localStorage['favStreams'].split(",");
        if (favStream) { //if its populated
            var popUpHtml = "";
            favShown = true;
            popUpHtml += "<h4>Favorite Streams</h4><ul>";
            for (var i = 0; i < favStream.length; i++) {
                var stream = favStream[i];
                popUpHtml += "<a href=#><li><input type=checkbox checked id=FAV" + stream + "></input>" + stream + "</a></li>";
            }
            popUpHtml += "</ul>";
            $('#favStreams').html(popUpHtml);
        }
    }


    //updates streams and lists them in popup.html
    //Ty to k9 for the great grammar tips
    function updatePopUp() {
        checkIfMulti();
        getTwitchStreams();
        checkStreams();
        var popUpHtml = "";
        if (isCurrentMulti) {
            popUpHtml += "<h4>Streams In Multi Stream</h4><ul>";
            for (var i = 0; i < streamsInMulti.length; i++) {
                var stream = streamsInMulti[i];
                popUpHtml += "<a href=#><li><input type=checkbox checked id=" + stream + "></input>" + stream + "</a></li>";
            };
            popUpHtml += "</ul>";

            if (checkedStreams.length <= 6 && checkedStreams.length > 0) {
                popUpHtml += "<h4>Opened Stream Tabs</h4><ul>";
                var numNewStreams = 0;
                for (var i = 0; i < checkedStreams.length; i++) {
                    window.console.log("line 231");
                    checkedStreamName = checkedStreams[i];
                    var streamInMulti = false;
                    for (var j = 0; j < streamsInMulti.length; j++) {
                        if (checkedStreamName === streamsInMulti[j])
                            streamInMulti = true;
                    };
                    if (!streamInMulti) {
                        popUpHtml += "<a href=#><li><input type=checkbox checked id=" + checkedStreamName + "></input>" + checkedStreamName + "</a></li>";
                        numNewStreams++;
                    }
                };
                if (numNewStreams > 0) {
                    popUpHtml += "<a href=#><li><input type=checkbox checked id=CloseTab></input>Close streams?</a></li></ul>";
                } else {
                    window.console.log("removing other html stuff");
                    popUpHtml = popUpHtml.substring(0, popUpHtml.length - 33);
                }
            }
        } else {
            if (checkedStreams.length <= 0)
                popUpHtml += "<h4>No Stream tabs Opened</h4>";
            else if (checkedStreams.length <= 6) {
                popUpHtml += "<h4>Opened Stream Tabs</h4><ul>";
                for (var i = 0; i < checkedStreams.length; i++) {
                    checkedStreamName = checkedStreams[i];
                    popUpHtml += "<a href=#><li><input type=checkbox checked id=" + checkedStreamName + "></input>" + checkedStreamName + "</a></li>";
                };
                popUpHtml += "<a href=#><li><input type=checkbox checked id=CloseTab></input>Close streams?</a></li></ul>";
            }
        }
        window.console.log("adding html");
        $('#checkedStreams').html(popUpHtml);
    }

    //open tab with featured stream list
    function goToKbmodSite() {
        window.console.log("Going to kbmod");
        chrome.tabs.create({
            url: "http://multistre.am/#featured"
        })
    }
    $(document).ready(function() {
        checkIfMulti();
        getTwitchStreams();
        window.setTimeout(updatePopUp, WAIT_TIME);
        $('#makeStream').bind("click", makeMultiStream);
        $('#refeshStreams').bind("click", updatePopUp);
        $('#GoToKbmod').bind("click", goToKbmodSite);
        $('#ShowFav').bind("click", showFavStreams);
    });

}());