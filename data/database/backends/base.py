#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# Copyright © 2012 blurrcat <blurrcat@gmail.com>


import abc

class ResourceConflict(BaseException):
    """
    Raises when duplicate ids are found on save.
    """
    pass

class ResourceNotFound(BaseException):
    """
    Raises when look up for a resource is failed.
    """
    pass

class BaseDB(object):
    """
    Base class which defines database api.
    """

    __metaclass__ = abc.ABCMeta

    @abc.abstractmethod
    def save(self, doc, id=None):
        """
        Save a new document to db.

        :param doc: document to be saved.
        :type doc: :class:`dict`
        :param id: number or string, id of the document. If None, the backend is responsible for generating one.
        :returns: id of the saved document if succeeds; otherwise exception is thrown
        """
        return

    def update(self, doc, id):
        """
        Update a document in db.
        """
        return

    def get(self, id):
        """
        :returns: document identified by id; None if not found.
        """
        return

    def all(self):
        """
        :returns: iterator over all documents in db
        """
        return



