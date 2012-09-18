function(doc) {
    if (typeof doc.type !== "undefined") {
        if (typeof doc.isoDate !== "undefined") {
            var d = new Date(doc.isoDate);
            emit([doc.type, d.getYear(), d.getMonth(), d.getDay()])
        } else {
            emit([doc.type, {}, {}, {}]);
        }

    }
}