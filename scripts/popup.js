(function() {
    function getStreamName(url) {
        function parseQuery(queryString) {
            var query = {};
            var pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split('=');
                query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
            }
            return query;
        }
        var tmp = document.createElement('a');
        tmp.href = url.replace('#','');

        var query = parseQuery(tmp.search)
        return query.channel ? query.channel : tmp.pathname.substring(1);
    }

    function twitchGetAjax(url) {
        return $.ajax({
            type: "GET",
            url: url,
            headers: {'Client-ID': config.CLIENT_ID},
            dataType: "json",
        });
    }

    function chromeTabsQuery(params) {
        return new Promise(function(resolve, reject){
            chrome.tabs.query(params,resolve);
        })
    }

    function checkIfChannel(stream) {
        return twitchGetAjax(`https://api.twitch.tv/kraken/channels/${stream}`).then(function () {
            return true;
        }).catch(function () {
            return false;
        });
    }

    function getTwitchStreams() {
        return chromeTabsQuery({
            url: ['*://www.twitch.tv/*', '*://player.twitch.tv/*']
        }).then(tabs => {
            return Promise.filter(tabs, function (tab) {
                return checkIfChannel(getStreamName(tab.url)).then(function (res) {
                    return res;
                })
            })
        });
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
                checkedStreams.splice(i, 1);
            }
        };
        for (var i = streamsInMulti.length - 1; i >= 0; i--) {
            multiStreamName = streamsInMulti[i];
            if ($('#' + multiStreamName).prop("checked") == false) {
                streamsInMulti.splice(i, 1); //,1 means remove only 1
            }
        };
    }



    function closeTabs() {
        if ($("#CloseTab").prop("checked")) {
            var urls = checkedStreams.map(stream => `*://www.twitch.tv/*${stream}*`)
            // for (var stream in checkedStreams) {
            //     var urlPattern = "*://www.twitch.tv/*" + stream + "*";
            //     chrome.tabs.query({
            //         url: urlPattern
            //     }, function(tabs) {
            //         chrome.tabs.remove(tabs[0].id);
            //     });
            // };
        }
    }
    //checks if current tab is a multistream and updates iscurrntmulti to true if is multi and updtes current tab to current tab if multi
    function checkIfMulti() {
        return new Promise(function(resolve, reject){
            chrome.tabs.getSelected(null, function(currTab) {
                var parser = document.createElement('a');
                parser.href = currTab.url;
                resolve({isMulti: parser.hostname === 'multistre.am', currentTab: currTab});
            });
        });
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
        //adds streams to streamsInMulti
        temp = temp.substring(0, index);

        while (temp.indexOf("/") != -1) //while there are still streams since each stream name should have a '/' after it
        {
            stream = temp.substring(0, temp.indexOf("/")); //substring from beginning to end of the streamname (should just be stream name nothing else)
            stream = stream.trim();
            streamsInMulti.push(stream);
            temp = temp.substring(temp.indexOf("/") + 1); //set temp to string without the stream just added the array
        }
    }



    //updates streams and lists them in popup.html
    //Ty to k9 for the great grammar tips
    function updatePopUp(multiRes, streams) {
        var popUpHtml = "";
        function addButton(buttonId, buttonText) {
            buttonText = buttonText ? buttonText : buttonId;
            return `
                <label class="btn btn-info">
                    <input type=checkbox checked active autocomplete="off" id=${buttonId}> ${buttonText} </input>
                </label>
            `;
        }
        function addElement(elementType, text) {
            return `<${elementType}>${text}</${elementType}>`;
        }
        if (multiRes.isMulti) {
            popUpHtml += addElement('h4', 'Streams In Multi Stream');
            for (var i = 0; i < streamsInMulti.length; i++) {
                var stream = streamsInMulti[i];
                popUpHtml += addButton(stream);
            };

            if (checkedStreams.length <= 6 && checkedStreams.length > 0) {
                popUpHtml += addElement('h4', 'Opened Stream Tabs');
                var numNewStreams = 0;
                for (var checkedStreamName in checkedStreams) {
                    var streamInMulti = false;
                    for (var stream in streamsInMulti) {
                        if (checkedStreamName === stream) {
                            streamInMulti = true;
                            break;
                        }
                    };
                    if (!streamInMulti) {
                        popUpHtml += addButton(checkedStreamName);
                        numNewStreams++;
                    }
                };
                if (numNewStreams > 0) {
                    popUpHtml += addButton('closeTab', 'Close streams?');
                } else {
                    popUpHtml = popUpHtml.substring(0, popUpHtml.length - 33);
                }
            }
        } else {
            if (streams.length <= 0)
                popUpHtml += addElement('h4', 'No Stream tabs Opened');
            else if (streams.length <= 6) {
                popUpHtml += addElement('h5', 'Opened Stream Tabs');
                // for (var i = 0; i < checkedStreams.length; i++) {
                //     popUpHtml += addButton(checkedStreams[i])
                // };
                popUpHtml += streams.map(stream => addButton(getStreamName(stream.url))).join('')
                popUpHtml += addButton('closeTab', 'Close streams?');
            }
        }
        $('#checkedStreams').html(popUpHtml);
    }

    $(document).ready(function() {
        $('#makeStream').bind("click", makeMultiStream);
        $('#refeshStreams').bind("click", updatePopUp);
        // checkIfMulti();
        // getTwitchStreams();
        // window.setTimeout(updatePopUp, WAIT_TIME);

        Promise.join(checkIfMulti(), getTwitchStreams(), function (multiRes, streams) {
            updatePopUp(multiRes, streams)
        })
    });

}());