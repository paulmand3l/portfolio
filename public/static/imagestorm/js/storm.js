var stormy = namespace('stormy');

stormy.Home = (function() {
    var hs = this,
        perPage = 10,
        HomeConstructor,
        getResults,
        makeURL,
        currentPage,
        processResults,
        spawnResult,
        doFall,
        logHit,
        destroyResult,
        allResults = [],
        lastHundred = [],
        spawnTimeout,
        submitTimeout;

    makeURL = function(image) {
        var base_url = 'https://farm' + image.farm + '.staticflickr.com/' + image.server + '/' + image.id + '_' + image.secret,
            full_url = base_url + '_z.jpg',
            thumb_url = base_url + '_m.jpg';

        return [full_url, thumb_url];
    };

    getResults = function(page) {
        // Get search results from Flickr

        if (typeof page === "undefined") {
            page = 0;
            allResults = [];
            $('#dunno').hide();
        }
        currentPage = page;

        if ($('input#query').val() === '') {
            clearTimeout(spawnTimeout);
            return;
        }

        var serviceURI = 'https://api.flickr.com/services/rest/',
            FLICKR_API_KEY="7210a6546c39556ad10ad21882a74d20",
            data = {
                'method': 'flickr.photos.search',
                'api_key': FLICKR_API_KEY,
                'content_type': 1,
                'media': 'photos',
                'format': 'json',
                'nojsoncallback': 1,
                'sort': 'relevance',
                'text': $('input#query').val(),
                'per_page': perPage,
                'page': page,
            };

        $.getJSON(serviceURI, data, function(data, textStatus, jqXHR) {
            allResults = allResults.concat(data.photos.photo.sort(function(a, b) { return Math.round(2*Math.random() - 1); }));
            clearTimeout(spawnTimeout);
            if (allResults.length === 0) {
                $('#dunno').show();
            } else {
                spawnResult();
            }
        });
    };

    spawnResult = function() {
        // Create a single result instance on screen, bind relevant events and start the falling animation\
        if (allResults.length < 10) {
            getResults(currentPage + 1);
            return;
        }
        var image = allResults.pop();

        if (lastHundred.indexOf('' + image.id + image.secret) != -1) {
            // Seen in the last hundred; skip it.
            spawnTimeout = setTimeout("storm.spawnResult()", 1);
            return;
        } else {
            lastHundred.push('' + image.id + image.secret);
            if (lastHundred.length > 100) {
                lastHundred.shift();
            }
        }

        var full_url = makeURL(image)[0],
            thumb_url = makeURL(image)[1],
            randLeft = Math.floor(Math.random()*($(window).width() - 250));

        template = $('<a class="result" href="' + full_url + '"><img src="' + thumb_url + '"></a>');
        template.data('left', randLeft);
        template.css({
            'top': 0,
            'left': 0,
            'transform': 'translate(' + randLeft + 'px, -250px)',
            'transition': '20s linear'
        });
        template.appendTo('#results');
        doFall(template);

        spawnTimeout = setTimeout("storm.spawnResult()", 500);
    };

    doFall = function(elem) {
        // Execute falling animation
        elem.css('transform', 'translate(' + elem.data('left') + 'px, ' + $(window).height() * 2 + 'px)');
        setTimeout(function(elem) {
            return function() {
                elem.remove();
            };
        }(elem), 20000);
    };

    logHit = function(elem) {
        // Callback for when the user clicks on a falling element.
    };

    HomeConstructor = function() {
        if (false === (this instanceof stormy.Home)) {
            return new stormy.Home();
        }

        // Allow linking to previous searches.
        var urlParams = {};
        (function () {
            var e,
                a = /\+/g,  // Regex for replacing addition symbol with a space
                r = /([^&=]+)=?([^&]*)/g,
                d = function (s) { return decodeURIComponent(s.replace(a, " ")); },
                q = window.location.search.substring(1);

            while (e = r.exec(q))
               urlParams[d(e[1])] = d(e[2]);
        })();

        if (urlParams['q'] !== undefined) {
            $('input#query').val(urlParams['q']).keyup();
        }

        if (urlParams['mode'] !== undefined) {
            $('input#' + urlParams['mode'] + '-mode').attr('checked', 'checked');
        }

        // Optimize page load to allow immediate typing
        $('input#query').focus();

        // Perform new search when input has paused and update the url query
        $('input#query').keyup(function() {
            clearTimeout(submitTimeout);
            submitTimeout = setTimeout('storm.getResults()', 200);
            if (window.history.pushState) {
                window.history.pushState('', '', '?' + $('form#seed').serialize());
            }
            return false;
        });

        // Disable form submissions
        $('form#seed').submit(function(data) {
            return false;
        });

        // Start the timeout chain
        $('input#query').keyup();

    };

    HomeConstructor.prototype.getResults = getResults;
    HomeConstructor.prototype.spawnResult = spawnResult;
    HomeConstructor.prototype.processResults = processResults;

    return HomeConstructor;
})();

