# requests made by the m.weibo.cn client




## 1. Search for a term

    http://m.weibo.cn/searchs/weibo?key=611102&page=1&&_=1347434959416

Params:

 - key: The term to be searched.
 - page: Results are paginated. This one specifies page number.
 - _: Not sure. It's timestamp relevant. Probably used to disable cache.

Response:

 - ok, total_number, previous_cursor, next_cursor: Same old stuff.
 - maxPage: Total number of pages.
 - saveCache: an application level directive telling the client to cache resutls. Irrelevent.
 - mblogList: The actual results. A dict of tweets, tweet id being the key.
 - tweet content: 
     - info: [username, publish-time, publish-agent, number of retweets, number of comments]
     - distance, LBS, location: sort of geo infomation.
     - cont: content of the tweet.
     - uid: user id.
     - img: user avartar.
     - fans: number of fans of the user.
     - gender: gender.
     - bid: ?
     - pic: picture in the tweet. may contain uris refering to images in different resolutions. 
     - pos: page that initiated the search request.
     - vip: if the user is vip.
     - attitudes: ?. e.g., ['total': 0, 'maxoid': 0].
     - vote: ? string.
     - faved: ? number.
     - hiddenBlockSource: ? number.

## 2. Retweets of a given tweet
   
    http://m.weibo.cn/comment/getRepostMblog?st=b54a&page=1&id=3487784952404543&maxId=0&

Params:
    
 - st: ?, this is not changed across sessions.
 - page: page number.
 - id: id of the tweet.
 - maxId: ? seems just set it to 0 is ok.

Response:
 - ok, total_number, previous_cursor, maxPage, next_cursor: same old.
 - msg: a human readable status response.
 - data: actual retweets. a dict of tweets, ids being tweet id, and tweet info being the values. For each tweet, the value is an array:
     - 0: user id
     - 1: user name
     - 2: ? number
     - 3: user avatar
     - 4: tweet content
     - 5: publish time - format(mm月dd日 HH:MM)
     - 6: user agent
     - 7: ? string, some sort of key

## 3. Comments of a given tweet

    http://m.weibo.cn/comment/getCmt?st=b54a&page=1&id=3487784952404543&maxId=0&

Params:

Same as the retweets request params.

Response:

Same as the retweets response. Differnce is in data, where values are comments. Comment structure is an array:
 
 - 0: user id
 - 1: user name
 - 2: a list of uris refering to status images, e.g., 微博达人
 - 3: user avatar
 - 4: comment content
 - 5: publish time - format(mm月dd日 HH:MM)
 - 6: user agent

