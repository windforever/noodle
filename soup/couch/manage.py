#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Copyright © 2012 blurrcat <blurrcat@gmail.com>

"""
A manage script for couchDB. Functions are:

 - Create new jobs;
 - Reset job status;

"""
from couchdb import Server, Session

dbname = 'soup'
session = Session()
session.username = 'blurrcat'
session.password = '880830'
server = Server(session=session)
db = server[dbname]

def job(key, action):
    return {
        '_id': action[0]+key,
        'key': key,
        'type': 'Job',
        'action': action,
        'status': 'idle',
        'next_page': 1,
        'max_page': None
    }



def save_jobs(jobs):
    results = db.update(jobs)
    print results

def create_jobs(keys):

    action = u'Search'
    jobs = [job(key, action,) for key in keys]
    save_jobs(jobs)

def reset_status(status):
    results = db.view('soup/by_type', reduce=False, include_docs=True, key='Job')
    jobs = [row['doc'] for row in results.rows]
    for job in jobs:
        job['status'] = status
        job['start_date'] = ''
        job['end_date'] = ''
    print db.update(jobs)

def reset_db():
    del server[dbname]
    global db
    db = server.create(dbname)

if __name__ == "__main__":
#    reset_db()
#    create_jobs(keys = [u'3000' + unicode(i) for i in xrange(28)])
    reset_status('idle')
