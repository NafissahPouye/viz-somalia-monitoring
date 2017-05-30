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

function parseDates(tag1,tag2,data){
    //create date object with month and year data and store obj in month column for now
    data.forEach(function(d){
        var date = new Date(Date.parse(d[tag1] + ' 1, ' + d[tag2]));
        d[tag1] = date;
    });
    return data;
}

function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}

var date_sort = function (d1, d2) {
    if (d1['#date+month'] > d2['#date+month']) return 1;
    if (d1['#date+month'] < d2['#date+month']) return -1;
    return 0;
};

var formatComma = d3.format(',');


function generateCharts(targetData, progressData){
    var targetcf = crossfilter(targetData);
    var progresscf = crossfilter(progressData);

    //fix inconsistencies in data (remove newlines and spaces)
    targetData.forEach(function(d){
        d['#indicator'] = d['#indicator'].toString().replace(/(\r\n|\n|\r)/gm,'').replace(/^ /, '');
    });
    progressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });

    //get target and progress dimensions by indicator
    var targetIndicatorDim = targetcf.dimension(function(d) { return d['#indicator']; }); 
    var progressIndicatorDim = progresscf.dimension(function(d) { return d['#indicator']; });

    //get target and progress data values for key stats
    var targetGroupByIndicator = targetIndicatorDim.group().reduceSum(function(d){return d['#targeted']; }).top(Infinity);
    var progressGroupByIndicator = progressIndicatorDim.group().reduceSum(function(d){return d['#value']; }).top(Infinity);

    for (var i=0; i<targetGroupByIndicator.length; i++) {
        //create data structure for bar charts
        var indicatorArr = progressIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity).sort(date_sort);
        var dateArray = ['x'];
        var valueArray = ['Reached'];
        var lastDate = new Date();
        var total = 0;
        var first = true;
        var sector = '';
        indicatorArr.forEach(function(value, index) {
            if (first) {
                lastDate = value['#date+month'];
                dateArray.push(lastDate);
                first = false;
            }
            if (value['#date+month'].getTime() != lastDate.getTime()) {
                sector = value['#sector'],value['#indicator'];
                lastDate = value['#date+month'];
                valueArray.push(total);
                dateArray.push(lastDate);
                total = 0;
            }
            total += value['#value'];
        });
        //add last total to array
        valueArray.push(total);

        //create key stats
        var reached = 0;
        //match progress values with targeted values -- there is probably a better way to do this
        for (var j=0; j<progressGroupByIndicator.length; j++) {
            if (targetGroupByIndicator[i].key == progressGroupByIndicator[j].key) {
                reached = progressGroupByIndicator[j].value;
                break;
            }
        }
        $('.graphs').append('<div class="col-md-4"><div class="header"><h4>' + sector + '</h4><h3>'+  targetGroupByIndicator[i].key +'</h3></div><span class="num">'+ formatComma(targetGroupByIndicator[i].value) +'</span> targeted<br><span class="num">'+ formatComma(reached) +'</span> reached<div id="chart' + i + '" class="chart"></div></div>');

        //create bar charts
        if (dateArray.length>1) {
            var chart = c3.generate({
                bindto: '#chart'+i,
                size: { height: 200 },
                data: {
                    x: 'x',
                    columns: [ dateArray, valueArray ],
                    type: 'bar'
                },
                axis: {
                    x: {
                        type: 'timeseries',
                        localtime: false,
                        tick: {
                            centered: true,
                            format: '%b %Y',
                            outer: false
                        }
                    },
                    y: {
                        tick: {
                            count: 5,
                            format: d3.format('.2s')
                        }
                    }
                }
            });
        }
    }
}

var targetCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?url=https%3A//docs.google.com/spreadsheets/d/1YmwfVaqZKKk2hTESkDfhi5RRlmXMAZ2j47PIS10Li_w/edit%23gid%3D935073182&strip-headers=on&force=on',
    dataType: 'json',
});

var progressCall = $.ajax({ 
    type: 'GET', 
    url: 'https://proxy.hxlstandard.org/data.json?url=https%3A//docs.google.com/spreadsheets/d/1YmwfVaqZKKk2hTESkDfhi5RRlmXMAZ2j47PIS10Li_w/edit%23gid%3D0&strip-headers=on&force=on',
    dataType: 'json',
});

$.when(targetCall, progressCall).then(function(targetArgs, progressArgs){
    var targetData = hxlProxyToJSON(targetArgs[0]);
    var progressData = parseDates(['#date+month'],['#date+year'],(hxlProxyToJSON(progressArgs[0])));
    generateCharts(targetData, progressData);
});
