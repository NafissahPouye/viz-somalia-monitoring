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


function generateCharts(targetData){
    var cf = crossfilter(targetData);
    var indicatorDim = cf.dimension(function(d) { return d['#indicator']; });
    var groupByIndicator = indicatorDim.group().reduceSum(function(d){return d['#targeted']; }).all();
    var indicatorArray = [];
    for (var i=0; i<groupByIndicator.length; i++) {
        var indicator = indicatorDim.filter(groupByIndicator[i].key).top(Infinity);
        indicatorArray.push(indicator);
        $('.graphs').append('<div class="col-md-4" id="graph'+ i +'"><h3>'+ groupByIndicator[i].key +'</h3><span class="num">'+ formatComma(groupByIndicator[i].value) +'</span> targeted</div>');
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

$.when(targetCall).then(function(targetArgs){
    var targetData = parseDates(['#date+year'],(hxlProxyToJSON(targetArgs)));
    generateCharts(targetData);
});

$.when(progressCall).then(function(progressArgs){
    var progressData = parseDates(['#date+year'],(hxlProxyToJSON(progressArgs)));
    //generateProgressChart(progressData);
});
