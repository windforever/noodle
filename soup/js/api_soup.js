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
    var db = 'soup';

    /*
     * Settings.
     */
    var weibo_url = 'http://m.weibo.cn/',
        search_url = 'http://m.weibo.cn/searchs/weibo'
        retweet_url = 'http://m.weibo.cn/comment/getRepostMblog?st=b54a&maxId=0&',
        comment_url = 'http://m.weibo.cn/comment/getCmt?st=b54a&maxId=0&';

    function JobManager() {

    }

    function Searcher() {
        
        function getTerm() {
            
        }
    }


    function search(key, page) {
        var tweets = [];
        $.get(search_url, {
            'key': key,
            'page': page
        }, function(data) {
            if (data.ok == 1) {
                tweets = data.mblogList;
            } else {
                console.log("Search for key <" + key + "> failed. Reason: " + data.msg);
            }
        });
        return tweets;
    }


    $(document).ready(function() {
        // The iframe is used only to load the cookies. Nothing is done directly with it.
        $('<iframe width=400 height=400 id="context">').attr('src', weibo_url).appendTo('#container');
        console.log(search('611102', 1));

    });


}(jQuery)); 
