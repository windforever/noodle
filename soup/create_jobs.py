#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Copyright © 2012 blurrcat <blurrcat@gmail.com>

"""
Create a set of jobs in couchDB.
"""
from datetime import datetime
from couchdb import Server, Session


def job(key, action, start_date, end_date):
    return {
        '_id': action[0]+key,
        'key': key,
        'type': 'Job',
        'action': action,
        'start_date': start_date,
        'end_date': end_date,
        'status': u'idle'
    }



def save_jobs(jobs, dbname):
    session = Session()
    session.username = 'blurrcat'
    session.password = '880830'
    db = Server(session=session)[dbname]
    results = db.update(jobs)
    print results


if __name__ == "__main__":
    keys = [u'3000' + unicode(i) for i in xrange(28)]
    action = u'Search'
    start_date = unicode(datetime(2012, 1, 1))
    end_date = unicode(datetime(2012, 9, 1))
    jobs = [job(key, action, start_date, end_date) for key in keys]
    save_jobs(jobs, u'soup')

