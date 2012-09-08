#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Copyright © 2012 blurrcat <blurrcat@gmail.com>
from uuid import uuid4
from couchdb import Session, Server, ResourceNotFound, ResourceConflict

from data.database.backends.base import BaseDB




class CouchBackend(BaseDB):
    """
    CouchDB Backend.
    """

    def __init__(self, name, host="localhost", port="5984", username=None, password=None):
        """
        :param string name: database name
        :param string host, port: url of the database
        :param string username, password: authentication if necessary
        """
        session = Session()
        if username and password:
            session.name = username
            session.password = password
        url = 'http://%s:%s' % (host, port)
        server = Server(url, session)
        self.db = None
        try:
            self.db = server[name]
        except ResourceNotFound:
            self.db = server.create(name)



    def get(self, id):
        try:
            return self.db[id]
        except ResourceNotFound:
            return None

    def save(self, doc, id=None):
        if id:
            try:
                self.db[id] = doc
                return id
            except ResourceConflict:
                return None
        else: # generate uuid at client side
            id = uuid4().hex
            self.db[id] = doc
            return id

    def all(self):
        class Itr(object):
            def __init__(self, 




