(function() {
    var STREAM_TABS, MULTI_RES, CLOSE_TABS=true;
    var STREAM_SOURCE = {
        TAB: 'TAB',
        MULTI: 'MULTI',
        FOLLOW: 'FOLLOW'
    };
    var ID_PREFIX = {
        TAB: 'tab',
        MULTI: 'multi',
        FOLLOW: 'follow'
    }

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

    function twitchGetAjax(apiPath) {
        apiPath = apiPath.startsWith('/') ? apiPath.substr(1) : apiPath;
        return $.ajax({
            type: "GET",
            url: `https://api.twitch.tv/kraken/${apiPath}`,
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
        // If the request worked then the channel exists
        return twitchGetAjax(`channels/${stream}`).then(function () {
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

    function getIncluded() {
        //clone globals, it should not matter but doing it just to have minimal modifications to globals
        var streamsInMulti = MULTI_RES.streamsInMulti.slice();
        var streamTabs = STREAM_TABS.slice();
        function filterArr(arr, idPrefix) {
            return arr.filter(function (stream) {
                return stream.include;
            });
        }
        var includedTabs = filterArr(streamTabs, ID_PREFIX.TAB);

        var includedMutlti = filterArr(streamsInMulti, ID_PREFIX.MULTI);

        return {
            tabs: includedTabs,
            multi: includedMutlti
        }
    }

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

    function makeMultiStream() {
        function getMultiUrl(streamNameArr) {
            if (streamNameArr.length <= 6 && streamNameArr.length > 0) {
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

        var included = getIncluded();

        if (CLOSE_TABS) {
            included.tabs.forEach(element => {
                chrome.tabs.remove(element.id)
            });
        }

        var streamNames = included.tabs.map(elm => elm.streamName);
        if (MULTI_RES.isMulti) {
            var allStreams = arrayUnique(included.multi.concat(streamNames));
            var url = getMultiUrl(allStreams)
            chrome.tabs.update(MULTI_RES.currentTab.id, {
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

    function listIncluded() {
        function makeAlert(alertId, alertText, parent) {
            if (parent){
                $(parent).on('close.bs.alert',`#${alertId}`, function () {
                    console.log(`close!!!!`);
                });
            }
            var alert = `<div class="alert alert-secondary alert-dismissible fade show " role="alert" id=${alertId}>
            ${alertText}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close" id=${alertId}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>`
          return `<div class="row">${alert}</div>`;
        }
        function getNames(arr) {
            return arr.map(elm => elm.streamName);
        }
        var included = getIncluded();
        var allStreams = arrayUnique(getNames(included.multi).concat(getNames(included.tabs)));
        var listHtml
        if (allStreams.length) {
            listHtml = getHtmlElement('h5', 'Included Streams') + 
                       allStreams.map(stream => makeAlert(`alert-${stream}`, stream, '#includedStreams')).join('');
        } else {
            listHtml = getHtmlElement('h6', ' No Streams Included')
        }

        $('#includedStreams').html(listHtml);
    }

    
    function getHtmlElement(elementType, text, end) {
        end = end || elementType;
        return `<${elementType}>${text}</${elementType}>`;
    }

    // sets the stream to be included or not in one or all of the possible stream source arrays
    function setStreamIncluded(streamName, source, checkAll, boolToSet) {
        console.log(`${streamName}\t${source}\t${checkAll}\t${boolToSet}`);
        function setInclude(arr) {
            var index = arr.findIndex(obj => obj.streamName === streamName);
            if (index < 0){
                // throw `${streamName} not found in the array`;
                return arr;
            }
            if (boolToSet === undefined) {
                // toggle the include bool when a value is not passed
                boolToSet = !arr[index].include;
            }
            arr[index].include = boolToSet;

            // update button to make apperance match include value
            if (!checkAll) {
                // when checkall is set this was fired with a clikc on the button so no need to change
                var labelId = `#label-${ID_PREFIX[source]}-${streamName}`
                if (boolToSet) {
                    $(labelId).addClass('active');
                } else {
                    $(labelId).removeClass('active');
                }
                $(`#${ID_PREFIX[source]}-${streamName}`).prop('checked', boolToSet)
            }
            
            return arr;
        }

        switch (source) {
            case STREAM_SOURCE.TAB: {
                STREAM_TABS= setInclude(STREAM_TABS);
            } break;
            case STREAM_SOURCE.MULTI: {
                MULTI_RES.streamsInMulti = setInclude(MULTI_RES.streamsInMulti)
            } break;
            case STREAM_SOURCE.FOLLOW:{
                // throw `NOT supported yet`
                console.log('good stuff')
            } break;
            default: {
                throw `${source} is not valid`;
            } break;
        }

        if (checkAll) {
            for (var prop in STREAM_SOURCE) {
                if (STREAM_SOURCE[prop] !== source) {
                    setStreamIncluded(streamName, STREAM_SOURCE[prop], null, boolToSet);
                }
            }
        }
    }

    function updatePopUp(multiRes, streamTabs) {
        var popUpHtml;
        function addButton(buttonId, streamName, parent, source) {
            streamName = streamName || buttonId;
            if (source){
                $(parent).on('click',`#label-${buttonId}`, function () {
                    setStreamIncluded(streamName, source, true)
                    listIncluded();
                });
            } else {
                console.log(`dddddd`);
                //when source not passed it is the close tabs button
                $(parent).on('click',`#label-${buttonId}`, function () {
                    CLOSE_TABS = !CLOSE_TABS;
                    console.log(`BOIS: ${CLOSE_TABS}`);
                });
            }
            return `<label class="btn btn-outline-primary active" id=label-${buttonId}>
                    <input type=checkbox checked autocomplete="off" id=${buttonId}>${streamName}</input></label>`;
        }

        if (multiRes.isMulti) {
            $("#pills-multi-tab").trigger("click");
            popUpHtml = multiRes.streamsInMulti.map(stream => 
                addButton(`${ID_PREFIX.MULTI}-${stream.streamName}`, stream.streamName, '#multiStream', STREAM_SOURCE.MULTI)
            ).join('');

            $('#multiStream').html(popUpHtml);
        } else {
            $('#pills-multi-tab').remove();
        }
        if (streamTabs.length <= 0)
            popUpHtml = getHtmlElement('h6', 'No Stream tabs Opened');
        else if (streamTabs.length <= 6) {
            popUpHtml = streamTabs.map(stream => 
                addButton(`${ID_PREFIX.TAB}-${stream.streamName}`, stream.streamName, '#checkedStreams', STREAM_SOURCE.TAB)
            ).join('');
            popUpHtml += addButton('closeTab', 'Close streams?', '#checkedStreams');
        }
        $('#checkedStreams').html(popUpHtml);
        listIncluded();
    }
 
    $(document).ready(function() {
        function main() {
            return Promise.join(checkIfMulti(), getTwitchStreams(), function (multiRes, streamTabs) {
                streamTabs = streamTabs.map(function (stream) {
                    return {
                        streamName: getStreamName(stream.url),
                        id: stream.id,
                        include: true
                    };
                });
                multiRes.streamsInMulti = multiRes.streamsInMulti.map(function (stream) {
                    return {
                        streamName: stream,
                        include: true
                    }
                })
                STREAM_TABS = streamTabs;
                MULTI_RES = multiRes;
                updatePopUp(multiRes, streamTabs);
                $('#makeStream').bind("click", makeMultiStream);
            });
        }
        $('#refeshStreams').bind("click", main);
        main();
    });

}());