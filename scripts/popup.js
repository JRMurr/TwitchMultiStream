(function() {
    var STREAM_TABS, MULTI_RES, CLOSE_TABS=true, AUTO_INCLUDE = true,
        TWITCH_TOKEN, TWITCH_ID, TWITCH_NAME;
    
    const STREAM_SOURCE = {
        TAB: 'TAB',
        MULTI: 'MULTI',
        FOLLOW: 'FOLLOW'
    };
    const ID_PREFIX = {
        TAB: 'tab',
        MULTI: 'multi',
        FOLLOW: 'follow'
    };

    const INVALID_NAMES = ['directory'];

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

        var query = parseQuery(tmp.search);
        return query.channel ? query.channel : tmp.pathname.substring(1);
    }

    function getTwitchTabs() {
        return chromeTabsQuery({
            url: ['*://www.twitch.tv/*', '*://player.twitch.tv/*']
        }).then(tabs => {
            return tabs.map(function (tab) {
                return {
                    streamName: getStreamName(tab.url),
                    id: tab.id,
                    include: AUTO_INCLUDE
                };
            }).filter(function (tab) {
                // if parsed name has slashes it is not a live stream
                const name = tab.streamName;
                return name.length >0 && name.indexOf('/') === -1 && INVALID_NAMES.indexOf(name) === -1;
            });
        });
    }

    function getIncluded() {
        //clone globals, it should not matter but doing it just to have minimal modifications to globals
        var streamsInMulti = MULTI_RES.streamsInMulti.slice();
        var streamTabs = STREAM_TABS.slice();
        function filterArr(arr) {
            return arr.filter(function (stream) {
                return stream.include;
            });
        }
        var includedTabs = filterArr(streamTabs);
        var includedMutlti = filterArr(streamsInMulti);
        return {
            tabs: includedTabs,
            multi: includedMutlti
        };
    }

    function makeMultiStream() {
        function getMultiUrl(streamNameArr) {
            if (streamNameArr.length <= 6 && streamNameArr.length > 0) {
                var layoutNumber = streamNameArr.length * 3;
                var multistreamLink = 'http://multistre.am/';
                multistreamLink += streamNameArr.join('/');
                multistreamLink += '/layout' + layoutNumber;
                return multistreamLink;
            } else if (streamNameArr.length > 6){
                alert('Cant have more then 6 streams in a multistream, uncheck some streams');
                return;
            }
        }

        var included = getIncluded();

        if (CLOSE_TABS) {
            included.tabs.forEach(element => {
                chrome.tabs.remove(element.id);
            });
        }
        var url;
        var streamNames = included.tabs.map(elm => elm.streamName);
        if (MULTI_RES.isMulti) {
            var allStreams = arrayUnique(included.multi.concat(streamNames));
            url = getMultiUrl(allStreams);
            chrome.tabs.update(MULTI_RES.currentTab.id, {
                url: url
            });
        }
        else {
            url = getMultiUrl(streamNames);
            if (url) {
                chrome.tabs.create({
                    url: url
                });
            }
        }
    }

    function checkIfMulti() {
        return new Promise(function(resolve){
            chrome.tabs.getSelected(null, function(currTab) {
                var parser = document.createElement('a');
                parser.href = currTab.url;
                var ret = {isMulti: parser.hostname === 'multistre.am', currentTab: currTab, streamsInMulti:[]};
                if (ret.isMulti) {
                    var urlPath = parser.pathname.substring(1);
                    ret.streamsInMulti = urlPath.split('/').filter(function (elm) {
                        return !(elm === '' || elm.startsWith('layout'));
                    }).map(function (stream) {
                        return {
                            streamName: stream,
                            include: AUTO_INCLUDE
                        };
                    });
                }
                resolve(ret);
            });
        });
    }

    function listIncluded() {
        function makeAlert(alertId, streamName, parent) {
            if (parent){
                $(parent).on('close.bs.alert',`#${alertId}`, function () {
                    setStreamIncluded(streamName, STREAM_SOURCE.TAB, true, false, true);
                });
            }
            var alert = `<div class="alert alert-secondary alert-dismissible fade show " role="alert" id=${alertId}>
            ${streamName}
            <button type="button" class="close" data-dismiss="alert" aria-label="Close" id=${alertId}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>`;
            return `<div class="row">${alert}</div>`;
        }
        function getNames(arr) {
            return arr.map(elm => elm.streamName);
        }
        var included = getIncluded();
        var allStreams = arrayUnique(getNames(included.multi).concat(getNames(included.tabs)));
        var listHtml;
        if (allStreams.length) {
            listHtml = getHtmlElement('h5', 'Included Streams') + 
                       allStreams.map(stream => makeAlert(`alert-${stream}`, stream, '#includedStreams')).join('');
        } else {
            listHtml = getHtmlElement('h6', ' No Streams Included');
        }

        $('#includedStreams').html(listHtml);
    }

    
    function getHtmlElement(elementType, text, end) {
        end = end || elementType;
        return `<${elementType}>${text}</${end}>`;
    }

    // sets the stream to be included or not in one or all of the possible stream source arrays
    function setStreamIncluded(streamName, source, checkAll, boolToSet, updateButton) {
        function setInclude(arr) {
            var index = arr.findIndex(obj => obj.streamName === streamName);
            if (index < 0){
                return arr;
            }
            if (boolToSet === undefined || boolToSet === null) {
                // toggle the include bool when a value is not passed
                boolToSet = !arr[index].include;
            }
            arr[index].include = boolToSet;

            // update button to make apperance match include value
            if (updateButton || !checkAll) {
                var labelId = `#label-${ID_PREFIX[source]}-${streamName}`;
                if (boolToSet) {
                    $(labelId).addClass('active');
                } else {
                    $(labelId).removeClass('active');
                }
                $(`#${ID_PREFIX[source]}-${streamName}`).prop('checked', boolToSet);
            }
            
            return arr;
        }

        switch (source) {
            case STREAM_SOURCE.TAB: {
                STREAM_TABS = setInclude(STREAM_TABS);
            } break;
            case STREAM_SOURCE.MULTI: {
                MULTI_RES.streamsInMulti = setInclude(MULTI_RES.streamsInMulti);
            } break;
            case STREAM_SOURCE.FOLLOW:{
                // throw `NOT supported yet`
            } break;
            default: {
                throw `${source} is not valid`;
            }
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
        function addButton(buttonId, streamName, parent, source, include) {
            if (include === undefined) {
                include = AUTO_INCLUDE;
            }
            streamName = streamName || buttonId;
            if (source){
                $(parent).on('click',`#label-${buttonId}`, function () {
                    setStreamIncluded(streamName, source, true);
                    listIncluded();
                });
            } else {
                //when source not passed it is the close tabs button
                $(parent).on('click',`#label-${buttonId}`, function () {
                    CLOSE_TABS = !CLOSE_TABS;
                });
            }
            return `<label class="btn btn-outline-primary ${include ? 'active' : ''}" id=label-${buttonId}>
                    <input type=checkbox ${include ? 'checked' : ''} autocomplete="off" id=${buttonId}>${streamName}</input></label>`;
        }
        if (multiRes.isMulti) {
            $('#pills-multi-tab').trigger('click');
            popUpHtml = multiRes.streamsInMulti.map(stream => 
                addButton(`${ID_PREFIX.MULTI}-${stream.streamName}`, stream.streamName, '#multiStream', STREAM_SOURCE.MULTI, stream.include)
            ).join('');

            $('#multiStream').html(popUpHtml);
        } else {
            $('#pills-multi-tab').remove();
        }
        if (streamTabs.length <= 0)
            popUpHtml = getHtmlElement('h6', 'No Stream tabs Opened');
        else if (streamTabs.length <= 6) {
            popUpHtml = streamTabs.map(stream => 
                addButton(`${ID_PREFIX.TAB}-${stream.streamName}`, stream.streamName, '#checkedStreams', STREAM_SOURCE.TAB, stream.include)
            ).join('');
            popUpHtml += addButton('closeTab', 'Close streams?', '#checkedStreams');
        }
        $('#checkedStreams').html(popUpHtml);
        listIncluded();
    }
    
    $(document).ready(function() {
        function main() {
            return chromeStorageGet(['autoInclude']).then(function (userConfig) {
                AUTO_INCLUDE = userConfig.autoInclude !== undefined ? userConfig.autoInclude : true;
                return Promise.join(checkIfMulti(), getTwitchTabs(), function (multiRes, streamTabs) {
                    STREAM_TABS = streamTabs;
                    MULTI_RES = multiRes;
                    updatePopUp(multiRes, streamTabs);
                    $('#makeStream').bind('click', makeMultiStream);
                });
            });
        }
        $('#refeshStreams').bind('click', main);
        main().then(function () {
            return twitchAuth(false);
        }).then(function (token) {
            TWITCH_TOKEN = token;
            return saveAuthInfo(token);
        }).then(function (info) {
            TWITCH_ID = info.twitchId;
            TWITCH_NAME = info.TWITCH_NAME;
        }).catch(function (err) {
            // Error getting auth token from twitch so fall back to manually enterted info
            return chromeStorageGet(['twitchId', 'twitchName']).then(function (userConfig) {
                TWITCH_ID = userConfig.twitchId;
                TWITCH_NAME = userConfig.twitchName;
            });
        });

    });

}());

// google-analytics
(function() {
    var ga = document.createElement('script');
    ga.type = 'text/javascript';
    ga.async = true;
    ga.src = 'https://ssl.google-analytics.com/ga.js';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(ga, s);
})();
var _gaq = _gaq || [];
_gaq.push(['_setAccount', config.GOOGLE_ID]);
_gaq.push(['_trackPageview']);
var buttons = document.querySelectorAll('button');
for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener('click', trackButtonClick);
}
// eslint-disable-next-line no-unused-vars
function trackButton(e) {
    _gaq.push(['_trackEvent', e.target.id, 'clicked']);
}