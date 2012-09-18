function(doc) {
   if (doc.type == 'Job') {
       emit([doc.status, doc.action], null);
   }
}