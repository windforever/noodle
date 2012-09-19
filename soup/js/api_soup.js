/*
 * api_soup.js
 * Copyright (C) 2012 blurrcat <blurrcat@gmail.com>
 *
 * Scrap tweets from m.weibo.cn.
 *
 * Main things done here:
 *    - Load an iframe of m.weibo.cn into index.html to take use of the cookies;
 *    - Make requests in this context to get searches/comments/retweets;
 *    - Save those output in a couchDB;
 *
 * A lightweight job manager driven by couchDB is also included. The scrap job
 * is meant to be fault tolerant(jobs and results are persisted in couchDB)
 * and it's possible to resume the jobs where they might have stopped.
 *
 *
 * The module should be run in a browser without the same origin policy or
 * with it disabled, so that cross-domain requests can be easily made.
 * Regarding Chrome, run it with:
 *
 *     google-chrome --disable-web-security
 */

(function ($) {

    // couchDB config
    $.couch.urlPrefix = "http://localhost:5984";
    var dbname = 'soup',
        username = 'spoon',
        password = 'nice!';
    /*
     * Settings.
     */
    var weibo_url = 'http://m.weibo.cn/',
        start_date = new Date(2012, 5, 1), // Jun 1, 2012
        end_date = new Date(2012, 8, 1), // Sep 1, 2012
        now = new Date();

    var utils = {
        checkDateRange:function (date, start, end) {
            start = typeof start !== "undefined" ? start : start_date;
            end = typeof end !== "undefined" ? end : end_date;
            if (date - end > 0) {
                return 1; // later than end
            } else if (start - date > 0) {
                return -1; // earlier than start
            } else {
                return 0; // within range
            }
        },
        createJob:function (key, action) {
            return {
                _id:action[0] + key,
                key:key,
                action:action,
                type:'Job',
                status:'idle',
                start_date:'',
                end_date:''
            };
        },
        update_obj:function (obj, other) {
            var o = {};
            for (key in other) {
                obj[key] = other[key];
            }
            return obj;

        },
        now:function () {
            var now = new Date();
            return '[' + [now.getHours(), now.getMinutes(), now.getSeconds()].join(':') + ']'
        },
        parseDate: function (dateString) {
            var match = [];
            switch (dateString.length) {
                case 19: // 'yyyy-mm-dd HH:MM:SS'(before 2012)
                    return new Date(dateString);
                case 12: // 'mm月dd日 HH:MM' (2012)
                    match = dateString.match(/^([01][0-9])月([0-3][0-9])日 ([012][0-9]):([0-5][0-9])$/);
                    return new Date(2012, match[1] - 1, match[2], match[3], match[4]);
                case 8: // '今天 HH:MM'
                    match = dateString.match(/^今天 ([0-2][0-9]):([0-5][0-9])$/);
                    return new Date(now.getYear(), now.getMonth(), now.getDay(), match[1], match[2]);
                case 4: // 'M分钟前'
                case 5: // 'MM分钟前'
                    match = dateString.match(/^(\d+)分钟前$/);
                    return new Date(now - match[1] * 60000);
                default:
                    return undefined;
            }
        },
        getAjaxSetting:function (name, other) {
            name = typeof name !== "undefined" ? name : 'soup';
            var obj = {
                success:function (data) {
                    logger.log(name, "[Success]" + JSON.stringify(data).substring(0, 100));
                },
                error:function (status) {
                    logger.log(name, "[Error]" + JSON.stringify(status));
                }
            };
            return this.update_obj(obj, other);
        }
    };




    var logger = {
        $logger: null,
        log: function (name, info) {
            var content = utils.now() + " " + name + " - " + info;
            console.log(content);
            $("<p class='log'>" + content + "</p>").appendTo(logger.$logger);
        }
    };


    var Interval = function (min, max) {
        // this class manages the wait time between requests.

        max = typeof max !== "undefined" ? max: 600000; // wait 10min at maximum
        min = typeof min !== "undefined" ? min: 10000; // wait 10sec at minimum

        var wait = min;

        this.get = function(ok_last) {
            if (ok_last) { // last request is successful;
                wait -= 200000;
                wait = min > wait ? min : wait;
            } else {
                wait *= 2;
                wait = max < wait ? max : wait;
            }
            return wait;
        }
    };

    function JobManager() {

        var jobs = [],
            last_docid = '',
            total = undefined,
            couchDB = undefined,
            scrapper = undefined,
            interval = new Interval(),
            cur_job = null,
            self = this;

        JobManager.prototype.toString = function () {
            return "JobManager";
        };

        $.couch.login(utils.getAjaxSetting('JobManager', {
            name:username,
            password:password,
            success:function () {
                logger.log('JobManager', "CouchDB authenticated");
                couchDB = $.couch.db(dbname);
                self.dispatchSearchJob();
            }
        }));

        this.dispatchSearchJob = function (startkey_docid) {
            startkey_docid = typeof startkey_docid !== "undefined" ? startkey_docid : "";
            couchDB.view('soup/job_by_status', utils.getAjaxSetting(this, {
                reduce:false,
                key: 'idle',
                include_docs:true,
                limit:2,
                cache:false,
                startkey_docid: startkey_docid,
                success:function (data) {
//                        if (data.rows.length > 0) {
//                            var job = data.rows[0].doc;
//                            logger.log(self, "Got job:" + JSON.stringify(job));
//                            scrapper = new Scrapper(couchDB, job, self, interval);
//                        } else {
//                            if (startkey_docid !== "") {
//                                self.dispatchSearchJob();
//                            } else {
//                                logger.log(self, 'No idle jobs');
//                            }
//                        }
                    var job;
                    switch (data.rows.length) {
                        case 2:
                            job = data.rows[1].doc;
                            break;
                        case 1:
                            job = data.rows[0].doc;
                            break;
                        default:
                            if (startkey_docid !== "") {
                                cur_job = setTimeout(self.dispatchSearchJob(), 10000);
                            } else {
                                logger.log(self, 'No idle jobs');
                            }
                            return;
                    }
                    logger.log(self, "Got job:" + JSON.stringify(job));
                    scrapper = new Scrapper(couchDB, job, self, interval);
                }
            }));
        };


        this.next = function (interval, startkey_docid) {
            startkey_docid = typeof startkey_docid !== "undefined" ? startkey_docid : "";
            interval = typeof startkey_docid !== "undefined" ? interval: 10000;
            logger.log(self, "start new job in " + interval/1000.0 + "sec");
            cur_job = setTimeout(function () {
                self.dispatchSearchJob(startkey_docid);
            }, interval);
        };

        this.stop = function() {
            clearTimeout(cur_job);
            scrapper.stop();
        }
    }

    function SearchHandler() {

        this.url = 'http://m.weibo.cn/searchs/weibo';
        this.type = 'search';

        this.getRequestParams = function (key, page) {
            return {
                "key":key,
                "page":page
            }
        };

        this.getItemDict = function (data) {
            return data.mblogList;
        };

        this.getDate = function (tweet) {
            return utils.parseDate(tweet.info[1]);
        };

        this.itemHandler = function (item, id, date) {
            var results = [];
            if (item.info[3] > 0) {
                // create a job to scrap retweets
                results.push(utils.createJob(id, 'Retweet'));
            }
            if (item.info[4] > 0) {
                // create a job to scrap comments
                results.push(utils.createJob(id, 'Comment'));
            }
            item._id = id;
            item.type = 'Tweet';
            item.isoDate = date;
            results.push(item);
            return results;
        };
    }

    function RetweetHandler() {
        this.url = 'http://m.weibo.cn/comment/getRepostMblog';
        this.type = 'retweet';

        this.getRequestParams = function (key, page) {
            return {
                "id":key,
                "page":page,
                "st": "b54a",
                "maxId": 0
            }
        };

        this.getItemDict = function (data) {
            return data.data;
        };

        this.getDate = function (tweet) {
            return utils.parseDate(tweet[5]);
        };

        this.itemHandler = function (item, id, date) {
            var doc = {
                'uid': item[0],
                'username': item[1],
                'userImg': item[3],
                'cont': item[4],
                'isoDate': date.toISOString(),
                'userAgent': item[6],
                'unknown': {'2': item[2], '7': item[7]}
            };
            return [doc];
        };
    }

    function CommentHandler() {
        this.url = 'http://m.weibo.cn/comment/getCmt';
        this.type = 'comment';

        this.getRequestParams = function(key, page) {
            return {
                "page": page,
                "id": key,
                "st": "b54a",
                "maxId": 0
            };
        };

        this.getItemDict = function(data) {
            return data.data
        };

        this.getDate = function (tweet) {
            return utils.parseDate(tweet[5]);
        };

        this.itemHandler = function(item, id, date) {
            var doc = {
                'uid': item[0],
                'username': item[1],
                'statusImgs': item[2],
                'usrImg': item[3],
                'cont': item[4],
                'isoDate': date.toISOString(),
                'userAgent': item[6],
                'unknown': {'2': item[2]}
            };
            return [doc];
        }
    }


    function Scrapper(couchDB, job, jobManager, interval) {
        var results = [],
            stop = false,
            key = job.key,
            self = this,
            cur_page = null,
            handler = undefined;

        switch (job.action) {
            case "Search":
                handler = new SearchHandler();
                break;
            case "Retweet":
                handler = new RetweetHandler();
                break;
            case "Comment":
                handler = new CommentHandler();
                break;
        }


        Scrapper.prototype.toString = function () {
            return "&lt;Scrapper&gt;" + handler.type + key + "";
        };

        job.status = 'running';
        job.start_date = start_date;
        job.end_date = end_date;
        couchDB.saveDoc(job, utils.getAjaxSetting(self + ".saveJobState", {
            success:function (data) {
                if (data.ok) {
                    job._rev = data.rev;
                    logger.log(self, 'Started job');
                    self.run();
                }
                else
                    logger.log(self, "[Error]Job state save failed.")
            }
        }));


        function getPage(page) {
            logger.log(self, 'Scrap page ' + page);
            $.getJSON(handler.url,
                handler.getRequestParams(key, page),
                function (data) {
                    if (data.ok == 1) {
                        if (job.max_page == null) {
                            // this is the first time we requested
                            job.max_page = data.maxPage;
                            logger.log(self, 'Total pages = ' + job.max_page);
                        }
                        var list = handler.getItemDict(data);
                        for (var id in list) {
                            var item = list[id],
                                publish_date = handler.getDate(item);

                            switch (utils.checkDateRange(publish_date)) {
                                case 0:
                                    results = results.concat(
                                        handler.itemHandler(item, id, publish_date)
                                    );
                                    break;
                                case 1: // tweets are returned in reverse-chronological order; if this one is later than end_date, just move on
                                    break;
                                case -1:
                                    stop = true;
                                    break; // tweets are already earlier than start_date
                            }
                            if (stop) {
                                break;
                            }
                        }

                        if (stop || page == job.max_page) { // no more results to see
                            job.status = 'finished';
                            saveResults(true);
                            couchDB.saveDoc(job, utils.getAjaxSetting(
                                self + ".saveJobState", {
                                    success:function (data) {
                                        if (data.ok) {
                                            logger.log(self, "Job finished.");
                                            jobManager.next(interval.get(true), job._id);
                                        }
                                        else
                                            logger.log(self, "[Error]Job state save failed.")
                                    }
                                }
                            ));
                        } else { // next page
                            saveResults();
                            couchDB.saveDoc(job,
                                utils.getAjaxSetting(self + ".saveJobState", {
                                        success:function (data) {
                                            if (data.ok) {
                                                job._rev = data.rev;
                                                cur_page = setTimeout(function () {
                                                    getPage(page + 1);
                                                }, interval.get(true));
                                            } else
                                                logger.log(self, "[Error]Job state save failed.")
                                        }
                                    }
                                ));
                        }
                    } else { // interrupted by weibo server
                        logger.log(self, "[Interrupted]Not ok: " + data.msg);
                        job.status = "idle";
                        job.next_page = page;
                        if ('trials' in job) {
                            job.trials += 1;
                            if (job.trials > 20) {
                            // only try this many; the item maybe deleted by users
                                job.status = 'Abort'
                            }
                        } else {
                            job.trials = 1;
                        }
                        saveResults(true);
                        couchDB.saveDoc(job,
                            utils.getAjaxSetting(self + ".saveJobState", {
                                    success:function (data) {
                                        if (data.ok) {
                                            job._rev = data.rev;
                                            jobManager.next(interval.get(false), job._id);
                                        } else
                                            logger.log(self, "[Error]Job state save failed.")
                                    }
                                }
                            )
                        );
                    }
                });
        }

        function saveResults(commit) {
            commit = typeof commit !== "undefined" ? commit : false;
            var l = results.length;
            if ((commit || (l > 50)) && (l > 0)) {
                // batch upload if possible
                couchDB.bulkSave({
                    docs: results
                }, utils.getAjaxSetting(self + '.saveState', {
                    success:function (data) {
                        results = [];
                        logger.log(self, "commit " + l + "items to DB");
                    }
                }));
            }
        }

        this.run = function () {
            if ('next_page' in job) {
                cur_page = getPage(job.next_page);
            } else {
                cur_page = getPage(1);
            }
        };

        this.stop = function() {
            clearTimeout(cur_page);
            saveResults(true);
            job.status = "idle";
            couchDB.saveDoc(job, utils.getAjaxSetting(self + ".saveJobState", {
                success:function (data) {
                    if (data.ok) {
                        logger.log(self, 'Stopped job');
                    } else
                        logger.log(self, "[Error]Job state save failed.")
                }
            }));
        }
    }


    $(document).ready(function () {
        // The iframe is used only to load the cookies. Nothing is done directly with it.
        $('<iframe width=%100 height=10 id="context">')
            .attr('src', weibo_url)
            .appendTo('#container');



        $("<button id='stopBtn'>Stop</button>")
            .appendTo("#control")
            .on('click', function() {
                jm.stop();
                $(this).attr('disabled', 'disabled');
            });

        logger.$logger = $("#logger");

        var jm = new JobManager();

    });


}(jQuery)); 
