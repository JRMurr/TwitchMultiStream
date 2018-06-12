(function() {
    var STREAM_TABS, MULTI_RES, LIVE_STREAMS, CLOSE_TABS=true, AUTO_INCLUDE = true,
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
        const streamsInMulti = MULTI_RES.streamsInMulti.slice();
        const streamTabs = STREAM_TABS.slice();
        const liveStreams = LIVE_STREAMS ? LIVE_STREAMS.slice() : [];
        function filterArr(arr) {
            return arr.filter(function (stream) {
                return stream.include;
            }).map(stream => stream.streamName);
        }
        const includedTabs = filterArr(streamTabs);
        const includedMutlti = filterArr(streamsInMulti);
        const includedFollows = filterArr(liveStreams);
        return _.uniq(includedTabs.concat(includedMutlti).concat(includedFollows));
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

        const url = getMultiUrl(included);
        if (MULTI_RES.isMulti) {
            chrome.tabs.update(MULTI_RES.currentTab.id, {
                url: url
            });
        }
        else {
            if (url) {
                chrome.tabs.create({
                    url: url
                });
            }
        }

        if (CLOSE_TABS) {
            included.tabs.forEach(element => {
                chrome.tabs.remove(element.id);
            });
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
            var alert = `<div class="alert alert-secondary alert-dismissible fade show w-100 text-center" role="alert" id=${alertId}>
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

        const allStreams = included;
        var listHtml;
        if (allStreams.length) {
            listHtml = getHtmlElement('h5', 'Included Streams') + getHtmlElement('h6', 'Select 6 Streams') +
                       allStreams.map(stream => makeAlert(`alert-${stream}`, stream, '#includedStreams')).join('');
        } else {
            listHtml = getHtmlElement('h6', ' No Streams Included');
        }

        if (allStreams.length > 6) {
            $('#makeStream').prop('disabled', true);
        } else {
            $('#makeStream').prop('disabled', false);
        }

        $('#includedStreams').html(listHtml);
    }

    
    function getHtmlElement(elementType, text, end) {
        end = end || elementType;
        return `<${elementType}>${text}</${end}>`;
    }

    function setButtonUi(buttonId, setActive) {
        const elm = $(buttonId);
        elm.prop('checked', setActive);
        if(setActive && !elm.hasClass('active')) {
            elm.addClass('active');
        } else if(!setActive && elm.hasClass('active')) {
            elm.removeClass('active');
        }
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
                setButtonUi(labelId, boolToSet);
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
                // since async could take a while make sure response is there before doing anything
                if (LIVE_STREAMS) {
                    LIVE_STREAMS = setInclude(LIVE_STREAMS);
                }
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
            listIncluded();
        }
    }

    function addButton(buttonId, streamName, parent, source, include) {
        if (include === undefined) {
            include = AUTO_INCLUDE;
        }
        streamName = streamName || buttonId;
        if (source){
            $(parent).on('click',`#label-${buttonId}`, function () {
                setStreamIncluded(streamName, source, true);
            });
        }
        return `<label class="btn btn-outline-info ${include ? 'active' : ''}" id=label-${buttonId}>
                <input type=checkbox ${include ? 'checked' : ''} autocomplete="off" id=${buttonId}>${streamName}</input></label>`;
    }

    function displayButtons(buttonArr) {
        const chunkedButtons = _.chunk(buttonArr, 3);
        const buttonGroups = chunkedButtons.map(function (chunk, index) {
            return getHtmlElement('div class="btn-group-toggle btn-group streamButtons" data-toggle="buttons"', chunk.join(''), 'div');
        });
        return buttonGroups.join('');
    }

    function updatePopUp(multiRes, streamTabs) {
        var popUpHtml;

        if (multiRes.isMulti) {
            $('#pills-multi-tab').trigger('click');
            const streamMultiButtons = multiRes.streamsInMulti.map(stream => 
                addButton(`${ID_PREFIX.MULTI}-${stream.streamName}`, stream.streamName, '#multiStream', STREAM_SOURCE.MULTI, stream.include)
            );
            popUpHtml = displayButtons(streamMultiButtons);

            $('#multiStream').html(popUpHtml);
        } else {
            $('#pills-multi-tab').remove();
        }

        if (streamTabs.length <= 0){
            popUpHtml = getHtmlElement('h6', 'No Stream tabs Opened');
            $('#label-closeTab').remove();

        } else {
            const streamTabButtons = streamTabs.map(stream => 
                addButton(`${ID_PREFIX.TAB}-${stream.streamName}`, stream.streamName, '#checkedStreams', STREAM_SOURCE.TAB, stream.include)
            );
            popUpHtml = displayButtons(streamTabButtons);
            $('#label-closeTab').bind('click', function name() {
                CLOSE_TABS = !CLOSE_TABS;
            });
        }
        $('#checkedStreams').html(popUpHtml);
        listIncluded();
    }

    // Returns object with game name as key, and arrays of live channels as values
    function getFollowedStreams(twitch_id, twitch_token) {
        function flattenResponse(respArr) {
            return _.flatten(respArr.map(arr => arr.data));
        }
        if (!twitch_id){
            throw ERRORS.ID;
        }
        var liveStreams;
        return twitchGetAll('users/follows', {from_id: twitch_id}, twitch_token).then(function (res) {
            const followIds = _.chunk(res.map(elm => elm.to_id), 100);
            return streamPromise = Promise.all(followIds.map(function (chunk) {
                return twitchGetAjax('streams', {first: 100, user_id: chunk}, twitch_token);
            }));
        }).then(function (streamsResp) {
            liveStreams = flattenResponse(streamsResp);
            const channelIds = _.chunk(liveStreams.map(channel => channel.user_id), 100);
            const keys = _.chunk(liveStreams.map(channel => channel.game_id), 100);

            var gamePromise = Promise.all(keys.map(function (keyChunk) {
                return twitchGetAjax('games', {id: keyChunk}, twitch_token);
            }));

            var channelPromise = Promise.all(channelIds.map(function (chunk) {
                return twitchGetAjax('users', {first: 100, id: chunk}, twitch_token);
            }));

            return Promise.join(gamePromise, channelPromise, function (gameResp, channelResp) {
                const channels = flattenResponse(channelResp);
                const games = flattenResponse(gameResp);       
                return liveStreams.map(function (stream) {
                    const channelInfo = channels.find(function (channel) {
                        return channel.id === stream.user_id;
                    });
                    const gameInfo = games.find(function (game) {
                        return game.id === stream.game_id;
                    });
                    return {
                        streamName: channelInfo.login,
                        gameName: gameInfo.name,
                        viewers: stream.viewer_count,
                        include: false
                    };
                });
            });
        });

    }

    function setFollowedHtml() {
        if (!TWITCH_ID) {
            $('#followedStreams').html(getHtmlElement('h6', 'Twitch username not set, add it in the options page'));
            return Promise.resolve();
        }
        
        return getFollowedStreams(TWITCH_ID, TWITCH_TOKEN).then(function (followedStreams) {
            const currentIncluded = getIncluded();
            followedStreams = followedStreams.map(function (stream) {
                var foundStream = currentIncluded.find(function (included) {
                    return included === stream.streamName;
                });
                if (foundStream) {
                    stream.include = true;
                }
                return stream;
            });
            LIVE_STREAMS = followedStreams;
            const groupedStreams = _.groupBy(followedStreams, 'gameName');
            const games = _.sortBy(_.keys(groupedStreams));
            var followedHtml = games.map(function (gameName) {
                const gameStreams = groupedStreams[gameName];
                const streamButtons = gameStreams.map(stream => 
                    addButton(`${ID_PREFIX.FOLLOW}-${stream.streamName}`, stream.streamName, '#followedStreams', STREAM_SOURCE.FOLLOW, stream.include)
                );
                const header = getHtmlElement('h6', gameName);
                return header + displayButtons(streamButtons);
            }).join('');
            $('#followedStreams').html(followedHtml);
        }).catch(function (err) {
            if (err.status == 429) {
                const errHtml = getHtmlElement('h4', 'Twitch API Rate Limited') + getHtmlElement('h6', 'Try again later or do a full login with twitch in the options page');
                $('#followedStreams').html(errHtml);
            } else{
                throw err;
            }
        });
       
    }
    
    $(document).ready(function() {
        function chromeStreams() {
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
        function setUpTwitch() {
            return twitchAuth(false).then(function (token) {
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
            }).finally(function () {
                return setFollowedHtml();
            });
        }
        function main() {
            return Promise.join(chromeStreams(), setUpTwitch(), function () {
                
            });
        }

        main().then(function () {
            $('#refeshStreams').bind('click', main);
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