function hxlProxyToJSON(input){
    var output = [];
    var keys=[]
    input.forEach(function(e,i){
        if(i==0){
            e.forEach(function(e2,i2){
                var parts = e2.split('+');
                var key = parts[0]
                if(parts.length>1){
                    var atts = parts.splice(1,parts.length);
                    atts.sort();                    
                    atts.forEach(function(att){
                        key +='+'+att
                    });
                }
                keys.push(key);
            });
        } else {
            var row = {};
            e.forEach(function(e2,i2){
                row[keys[i2]] = e2;
            });
            output.push(row);
        }
    });
    return output;
}

function parseDates(tags,data){
    var parseDateFormat = d3.time.format("%d-%m-%Y").parse;
    data.forEach(function(d){
        tags.forEach(function(t){
            d[t] = parseDateFormat(d[t]);
        });
    });
    return data;
}

var date_sort = function (d1, d2) {
    if (d1.key > d2.key) return 1;
    if (d1.key < d2.key) return -1;
    return 0;
};

var formatComma = d3.format(",");

function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}

function generateCharts(targetData, progressData){
    var cf = crossfilter(targetData);
    var progresscf = crossfilter(progressData);

    //fix inconsistencies in data
    targetData.forEach(function(d){
        d['#indicator'] = d['#indicator'].toString().replace(/(\r\n|\n|\r)/gm,'');
        d['#indicator'] = d['#indicator'].replace(/^ /, '');
    });
    progressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });

    var indicatorDim = cf.dimension(function(d) { return d['#indicator']; });
    var groupByIndicator = indicatorDim.group().reduceSum(function(d){return d['#targeted']; }).all();

    var progressIndicatorDim = progresscf.dimension(function(d) { return d['#indicator']; });
    var progressGroupByIndicator = progressIndicatorDim.group().reduceSum(function(d){return d['#value']; }).all();

    for (var i=0; i<groupByIndicator.length; i++) {
        // var indicator = indicatorDim.filter(groupByIndicator[i].key).top(Infinity);
        // var progressIndicator = progressIndicatorDim.filter(groupByIndicator[i].key).top(Infinity);
        var reached = 0;
        //there is probably a better way to do this
        for (var j=0; j<progressGroupByIndicator.length; j++) {
            if (groupByIndicator[i].key == progressGroupByIndicator[j].key) {
                reached = progressGroupByIndicator[j].value;
                break;
            }
        }
        $('.graphs').append('<div class="col-md-4" id="graph'+ i +'"><h3>'+ groupByIndicator[i].key +'</h3><span class="num">'+ formatComma(groupByIndicator[i].value) +'</span> targeted<br><span class="num">'+ formatComma(reached) +'</span> reached</div>');
    }
}

function generateProgressCharts(progressData){
    var cf = crossfilter(progressData);

    progressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });

    var indicatorDim = cf.dimension(function(d) { return d['#indicator']; });
    var groupByIndicator = indicatorDim.group().reduceSum(function(d){return d['#value']; }).all();
    var indicatorArray = [];
    for (var i=0; i<groupByIndicator.length; i++) {
        var indicator = indicatorDim.filter(groupByIndicator[i].key).top(Infinity);
        indicatorArray.push(indicator);
        $('.graphs').append('<div class="col-md-4" id="graph'+ i +'"><h3>'+ groupByIndicator[i].key +'</h3><span class="num">'+ formatComma(groupByIndicator[i].value) +'</span> reached</div>');
    }
}

var targetCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?url=https%3A//docs.google.com/spreadsheets/d/1YmwfVaqZKKk2hTESkDfhi5RRlmXMAZ2j47PIS10Li_w/edit%23gid%3D935073182&strip-headers=on',
    dataType: 'json',
});

var progressCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?url=https%3A//docs.google.com/spreadsheets/d/1YmwfVaqZKKk2hTESkDfhi5RRlmXMAZ2j47PIS10Li_w/edit%23gid%3D0&strip-headers=on',
    dataType: 'json',
});

$.when(targetCall, progressCall).then(function(targetArgs, progressArgs){
    var targetData = parseDates(['#date+year'],(hxlProxyToJSON(targetArgs[0])));
    var progressData = parseDates(['#date+year'],(hxlProxyToJSON(progressArgs[0])));
    generateCharts(targetData, progressData);
});
