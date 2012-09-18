function(doc) {
    if (doc.type == 'Job') {
        emit(doc.status);
    }
}