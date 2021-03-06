'use strict';

define([
    'underscore',
    'backbone-custom',
    'lib/gettext',
    'moment'
], function(_, Backbone, gt, moment) {

    var buildMap = {},
        loadDate = function() {
            // moment doesn't have the right language codes ISO 3166 vs ISO 639-1
            //      at least for Serbian `rs` is the internet code and `sr` is the language code
            //      see the [Serbian Language](http://en.wikipedia.org/wiki/Serbian_language) vs
            //              [Serbia](http://en.wikipedia.org/wiki/Serbia)
            //   we keep a mapper with the language codes to moment lanugage codes.
            var mapperLang = {
                    sr: 'rs'
                },
                // if there isn't a mapped language use the one given.
                momentLang = mapperLang[liveblog.language] ? mapperLang[liveblog.language] : liveblog.language,
                // we keep here witch moment properties we need to overried from gettext into moment.
                properties = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'],
                customize = {};
            // set moment global language with the one given.
            moment.lang(momentLang);
            // iterate the properties and if there is something set,
            //   other then default add those properties to moment customize object.
            //   names should be separated by underscore _ as in all moment language libs.
            _.each(properties, function(property) {
                if (gt.gettext('moment:' + property) !== 'moment:' + property) {
                    customize[property] = gt.gettext('moment:' + property).split('_');
                }
            });
            moment.lang(momentLang, customize);
            // set default post-date for moment if one isn't set.
            if (gt.gettext('moment:post-date') === 'moment:post-date') {
                gt.loadMessages({'moment:post-date':  ['', 'llll', '']});
            }
            // the same for closed-date.
            if (gt.gettext('moment:closed-date') === 'moment:closed-date') {
                gt.loadMessages({'moment:closed-date': ['', 'llll', '']});
            }
        };
    //API
    return {
        pluginBuilder: 'lib/require/i18n-builder',
        load: function(name, req, onLoad, config) {
            // Append '.json' if no filename given:
            if (!liveblog.language) {
                liveblog.language = liveblog.fallback.language;
            }
            var urlPreCached = liveblog.servers.rest + '/content/cache/locale/plugin-' + name + '-' + liveblog.language + '.json',
                urlPre = liveblog.servers.rest + '/resources/Admin/Plugin/' + name + '/JSONLocale/' + liveblog.language,
                urlCached = req.toUrl(urlPreCached),
                url = req.toUrl(urlPre);

            // Use the same options for the internationalization ajax request
            //     url key need to be supplied in options
            //     error key need to be supplied in options
            var options = {
                    url: urlCached,
                    dataType: 'json',
                    //timeout : 2500,
                    cached: true,
                    processTime: 400,
                    tryCount: 0,
                    retryLimit: 2,
                    success: function(data) {
                        if (config.isBuild) {
                            buildMap[name] = data;
                            onLoad(data);
                        } else {
                            gt.loadMessages(data.livedesk_embed);
                            loadDate();
                            onLoad(data);
                        }
                        onLoad(data);
                    },
                    // provide url and option for the main request
                    // call errorTimout from the error handler to request again ajax if timeout
                    // if is not a timeout status then maybe a redirect issue is in ie or other browser
                    // so in this case call the urlCached of the internationalization
                    error: function(xhr, textStatus, errorThrown) {
                        if (!this.errorTimeout(xhr, textStatus, errorThrown)) {

                            // provide url option in the form of the urlCached
                            // also apply timeout retries for the urlCached
                            options.url = url;
                            options.cached = false;
                            options.error =  this.errorTimeout;
                            Backbone.ajax(options);
                        }
                    },
                    errorTimeout: function(xhr, textStatus, errorThrown) {
                        if (textStatus === 'timeout') {
                            this.tryCount++;
                            if (this.tryCount <= this.retryLimit) {
                                //try again
                                Backbone.ajax(this);
                                return true;
                            }
                            if (console) {
                                console.log('We have tried ' + this.retryLimit + ' times and it is still not working. We give in. Sorry.');
                            }
                            return false;
                        } else if (!this.cached) {
                            // if the request has faild still load requirejs module but with empty data.
                            onLoad({});
                            return true;
                        }
                        return false;
                    }
                };
            Backbone.ajax(options);
        },
        write: function(pluginName, moduleName, write) {
            if (moduleName in buildMap){
                var content = buildMap[moduleName];
                write('define("' + pluginName + '!' + moduleName + '", function(){ return ' + content + ';});\n');
            }
        }

    };
});
