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
    function makeMultiStream(event) {
        function getMultiUrl(streamNameArr) {
            if (streamNameArr.length <= 6) {
                var layoutNumber = streamNameArr.length * 3;
                var multistreamLink = "http://multistre.am/"
                multistreamLink += streamNameArr.join('/');
                multistreamLink += "/layout" + layoutNumber;
                return multistreamLink
            } else if (streamNameArr.length > 6){
                alert("Cant have more then 6 streams in a multistream, uncheck some streams");
                return;
            }
        };

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

        var multiRes = event.data.multiRes;
        var includedStreams = event.data.streams.filter(function (stream) {
            var elm = $('#' + stream.streamName);
            return elm && elm.prop("checked");
        });

        var includedMutlti = multiRes.streamsInMulti.filter(function (stream) {
            var elm = $('#multi-' + stream);
            return elm && elm.prop("checked");
        });

        if ($("#closeTab").prop("checked")) {
            includedStreams.forEach(element => {
                chrome.tabs.remove(element.id)
            });
        }

        var streamNames = includedStreams.map(elm => elm.streamName);
        if (multiRes.isMulti) {
            var allStreams = arrayUnique(includedMutlti.concat(streamNames));
            var url = getMultiUrl(allStreams)
            chrome.tabs.update(multiRes.currentTab.id, {
                url: url
            });
        }
        else {
            var url = getMultiUrl(streamNames)
            console.log(`url: ${url}`);
            if (url) {
                chrome.tabs.create({
                    url: url
                });
            }
        }
    }

    //checks if current tab is a multistream and updates iscurrntmulti to true if is multi and updtes current tab to current tab if multi
    function checkIfMulti() {
        return new Promise(function(resolve, reject){
            chrome.tabs.getSelected(null, function(currTab) {
                var parser = document.createElement('a');
                parser.href = currTab.url;
                var ret = {isMulti: parser.hostname === 'multistre.am', currentTab: currTab, streamsInMulti:[]};
                if (ret.isMulti) {
                    var urlPath = parser.pathname.substring(1);
                    ret.streamsInMulti = urlPath.split('/').filter(function (elm) {
                        return !(elm === '' || elm.startsWith('layout'));
                    });
                }
                resolve(ret);
            });
        });
    }

    //updates streams and lists them in popup.html
    function updatePopUp(multiRes, streams) {
        var popUpHtml = "";
        function addButton(buttonId, buttonText) {
            buttonText = buttonText ? buttonText : buttonId;
            return `
            <label class="btn btn-info active">
                <input type=checkbox checked autocomplete="off" id=${buttonId}> ${buttonText} </input>
            </label>
            `;
        }
        function addElement(elementType, text) {
            return `<${elementType}>${text}</${elementType}>`;
        }
        if (multiRes.isMulti) {
            popUpHtml += addElement('h6', 'Streams In Multi Stream');
            var tmp = multiRes.streamsInMulti.map(stream => addButton(`multi-${stream}`, stream)).join('');
            popUpHtml += tmp;

            if (streams.length <= 6 && streams.length > 0) {
                var newPopUp = '';
                streams.forEach(function (stream) {
                    if (!multiRes.streamsInMulti.includes(stream.streamName)) {
                        newPopUp += addButton(stream.streamName);
                    }
                });
                if (newPopUp != '') {
                    popUpHtml = popUpHtml + addElement('h6', 'Opened Stream Tabs') + newPopUp + addButton('closeTab', 'Close streams?');
                } 
            }
        } else {
            if (streams.length <= 0)
                popUpHtml += addElement('h6', 'No Stream tabs Opened');
            else if (streams.length <= 6) {
                popUpHtml += addElement('h6', 'Opened Stream Tabs');
                popUpHtml += streams.map(stream => addButton(stream.streamName)).join('');
                popUpHtml += addButton('closeTab', 'Close streams?');
            }
        }
        $('#checkedStreams').html(popUpHtml);
    }

    $(document).ready(function() {
        function main() {
            return Promise.join(checkIfMulti(), getTwitchStreams(), function (multiRes, streams) {
                streams = streams.map(function (stream) {
                    stream.streamName = getStreamName(stream.url);
                    return stream;
                });
                var event_data = {multiRes: multiRes, streams: streams};
                updatePopUp(multiRes, streams);
                $('#makeStream').bind("click", event_data, makeMultiStream);
            });
        }
        $('#refeshStreams').bind("click", main);
        main();
    });

}());