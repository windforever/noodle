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

(function($) {

    // couchDB config
    $.couch.urlPrefix = "http://localhost:5984";
    var dbname = 'soup',
        username = 'spoon',
        password = 'nice!';
    /*
     * Settings.
     */
    var weibo_url = 'http://m.weibo.cn/',
        search_url = 'http://m.weibo.cn/searchs/weibo',
        retweet_url = 'http://m.weibo.cn/comment/getRepostMblog?st=b54a&maxId=0&',
        comment_url = 'http://m.weibo.cn/comment/getCmt?st=b54a&maxId=0&',
        start_date = new Date(2012, 5, 1), // Jun 1, 2012
        end_date = new Date(2012, 8, 1), // Sep 1, 2012
        now = new Date();

    var utils = {
        init: function() {

        },
        checkDateRange: function(date, start, end) {
            start = typeof start !== "undefined" ? start: start_date;
            end = typeof end !== "undefined" ? end: end_date;
            if (date - end > 0) {
                return 1; // later than end
            } else if (start - date > 0) {
                return -1; // earlier than start
            } else {
                return 0; // within range
            }
        },
        createJob: function(key, action) {
            return {
                _id: action[0]+key,
                key: key,
                action: action,
                type: 'Job',
                status: 'idle',
                start_date: '',
                end_date: ''
            };
        },
        update_obj: function(obj, other) {
            var o = {};
            for (key in other) {
                obj[key] = other[key];
            }
            return obj;

        },
        now: function() {
            var now = new Date();
            return '['+[now.getHours(), now.getMinutes(), now.getSeconds()].join(':')+']'
        },
        log: function(name, info) {
            console.log(this.now() + name + " - " + info);
        },
        parseDate: function(dateString) {
            var match = [];
            switch (dateString.length) {
                case 19: // 'yyyy-mm-dd HH:MM:SS'(before 2012)
                    return Date.parse(dateString);
                case 12: // 'mm月dd日 HH:MM' (2012)
                    match = dateString.match(/^([01][0-9])月([0-3][0-9])日 ([012][0-9]):([0-5][0-9])$/);
                    return new Date(2012, match[1]-1, match[2], match[3], match[4]);
                case 8: // '今天 HH:MM'
                    match = dateString.match(/^今天 ([0-2][0-9]):([0-5][0-9])$/);
                    return new Date(now.getYear(), now.getMonth(), now.getDay(),match[1], match[2]);
                case 4: // 'M分钟前'
                case 5: // 'MM分钟前'
                    match = dateString.match(/^(\d+)分钟前$/);
                    return now - match[1] * 60000;
            }



            if (dateString.length > 12) { // standard format:
                return Date.parse(dateString);
            } else { // format: 'mm月dd日 HH:MM'
                var match = dateString.match(/^([01][0-9])月([0-3][0-9])日 ([012][0-9]):([0-5][0-9])$/);
                // for the `-1` part, month here is 0-indexed.
                return new Date(2012, match[1]-1, match[2], match[3], match[4]);
//                try {
//                    return new Date(2012, Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
//                } catch(ex) {
//                    console.log(ex.message);
//                    console.log(dateString);
//                    console.log(match);
//                }

            }
        },
        getAjaxSetting: function(name, other) {
            name = typeof name !== "undefined" ? name:'soup';
            var obj = {
                success: function(data) {
                    utils.log(name, "[Success]"+JSON.stringify(data).substring(0, 100));
                },
                error: function(status) {
                    utils.log(name, "[Error]" + JSON.stringify(status));
                }
            };
            return this.update_obj(obj, other);
        }
    };


    function JobManager() {

        var jobs = [],
            last_docid = '',
            total = undefined,
            couchDB = undefined,
            interval = 10000,
            self = this;

        JobManager.prototype.toString = function() {
            return "JobManager";
        };

        $.couch.login(utils.getAjaxSetting('JobManager', {
            name: username,
            password: password,
            success: function() {
                utils.log('JobManager', "CouchDB authenticated");
                couchDB = $.couch.db(dbname);
                self.dispatchSearchJob();
            }
        }));



//        this.dispatchSearchJob = function() {
//            if (jobs.length > 0) {
//                var job = jobs.pop();
//                new Searcher(couchDB, job, jobManager).run();
//            } else {
//                couchDB.view('soup/getJob', utils.getAjaxSetting(this, {
//                    key: ['idle', 'Search'],
//                    startkey_docid: last_docid,
//                    reduce: false,
//                    include_docs: true,
//                    limit: 11,
////                    async: false,
//                    success: function(data) {
//                        total = data.total_rows;
//                        if (data.rows.length > 0) {
//                            var newJobs = data.rows;
//                            last_docid = newJobs[newJobs.length-1].doc._id;
//                            for (var i=0; i<data.rows.length; i++) {
//                                jobs.push(data.rows[i].doc);
//                            }
//                            utils.log('JobManager', 'Got '+ total + ' jobs');
//                            var job = jobs.pop();
//                            new Searcher(couchDB, job, jobManager).run();
//                        } else {
//                            utils.log(this, 'No idle jobs');
//                        }
//                    }
//                }));
//            }
//        };

        this.dispatchSearchJob = function(startkey_docid) {
            startkey_docid = typeof startkey_docid !== "undefined" ? startkey_docid : "";
            couchDB.view('soup/getJob', utils.getAjaxSetting(this, {
                    key: ['idle', 'Search'],
                    reduce: false,
                    include_docs: true,
                    limit: 2,
                    cache: false,
                    startkey_docid: startkey_docid,
                    success: function(data) {
//                        if (data.rows.length > 0) {
//                            var job = data.rows[0].doc;
//                            utils.log(self, "Got job:" + JSON.stringify(job));
//                            new Searcher(couchDB, job, self, interval);
//                        } else {
//                            utils.log(self, 'No idle jobs');
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
                                utils.log(self, 'No idle jobs');
                                self.dispatchSearchJob();
                                return;
                        }
                        utils.log(self, "Got job:" + JSON.stringify(job));
                        new Searcher(couchDB, job, self, interval);
                    }
            }));
        };


        this.next = function(startkey_docid) {
            startkey_docid = typeof startkey_docid !== "undefined" ? startkey_docid : "";
            setTimeout(function() {
                self.dispatchSearchJob(startkey_docid);
            }, 10000);

        }



    }

    function Searcher(couchDB, job, jobManager, interval) {
        var tweets = [],
            new_jobs = [],
            stop = false,
            key = job.key,
            self = this;
        interval = typeof interval !== "undefined" ? interval : 10000;

        Searcher.prototype.toString = function() {
            return "Searcher[" + key + "]";
        };

        job.status = 'running';
        job.start_date = start_date;
        job.end_date = end_date;
        couchDB.saveDoc(job, utils.getAjaxSetting(self+".saveJobState", {
            success: function(data) {
                if (data.ok) {
                    job._rev = data.rev;
                    utils.log(self, 'Started job');
                    self.run();
                }
                else
                    utils.log(self, "[Error]Job state save failed.")
            }
        }));



        function getPage(page) {
            utils.log(self,  'Scrap page ' + page);
            $.getJSON(search_url, {
                key: key,
                page: page
            }, function(data) {
//                data = JSON.parse(data);
                if (data.ok == 1) {
                    if (job.max_page == null) {
                        // this is the first time we requested
                        job.max_page = data.maxPage;
                        utils.log(self, 'Total pages = ' + job.max_page);
                    }
                    var list = data.mblogList;
                    for (var tid in list) {
                        var tweet = list[tid],
                            publish_date = utils.parseDate(tweet.info[1]);

                        switch(utils.checkDateRange(publish_date)) {
                            case 0:
                                tweet._id = tid;
                                tweet.type = 'Tweet';
                                tweet.isoDate = publish_date.toISOString();
                                tweets.push(tweet);
                                if (tweet.info[3] > 0) {
                                    // create a job to scrap retweets
                                    new_jobs.push(utils.createJob(key, 'Retweet'));
                                }
                                if (tweet.info[4] > 0) {
                                    // create a job to scrap comments
                                    new_jobs.push(utils.createJob(key, 'Comment'));
                                }
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
                        saveResults();
                        couchDB.saveDoc(job, utils.getAjaxSetting(
                            self+".saveJobState", {
                                success: function(data) {
                                    if (data.ok) {
                                        util.log(self, "Job finished.");
                                        jobManager.next();
                                    }
                                    else
                                        utils.log(self, "[Error]Job state save failed.")
                                }
                            }
                        ));
                    } else { // next page
                        saveResults();
                        couchDB.saveDoc(job,
                            utils.getAjaxSetting(self+".saveJobState", {
                                success: function(data) {
                                    if (data.ok) {
                                        job._rev = data.rev;
                                        setTimeout(function() {
                                            getPage(page+1);
                                        }, interval);
                                    } else
                                        utils.log(self, "[Error]Job state save failed.")
                                }
                            }
                        ));
                    }
                } else { // interrupted by weibo server
                    utils.log(self, "[Interrupted]Not ok: " + data.msg);
                    job.status = "idle";
                    job.next_page = page;
                    saveResults();
                    couchDB.saveDoc(job,
                        utils.getAjaxSetting(self+".saveJobState", {
                                success: function(data) {
                                    if (data.ok) {
                                        job._rev = data.rev;
                                        jobManager.next(job._id);
                                    } else
                                        utils.log(self, "[Error]Job state save failed.")
                                }
                            }
                        )
                    );
                }
            });
        }

        function saveResults() {
            var docs = tweets.concat(new_jobs);
            couchDB.bulkSave({
                docs: docs
            }, utils.getAjaxSetting(self + '.saveState', {
                success: function(data) {
                    tweets = [];
                    new_jobs = [];
                }
            }));
        }

//        function saveJobState() {
//            couchDB.saveDoc(job, utils.getAjaxSetting(self+".saveJobState", {
//                success: function(data) {
//                    if (data.ok)
//                        job._rev = data.rev;
//                    else
//                        utils.log(self, "[Error]Job state save failed.")
//                }
//            }));
//        }

        this.run = function() {
            if ('next_page' in job) {
                getPage(job.next_page);
            } else {
                getPage(1);
            }
        }
    }





    $(document).ready(function() {
        // The iframe is used only to load the cookies. Nothing is done directly with it.
        $('<iframe width=400 height=400 id="context">').attr('src', weibo_url).appendTo('#container');

        var jm = new JobManager();




    });


}(jQuery)); 
