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
    //create date object with month and year data and store obj in year column for now
    data.forEach(function(d){
        var date = new Date(Date.parse(d[tag1] + ' 1, ' + d[tag2]));
        d[tag2] = date;
    });
    return data;
}

function parseTargetDates(tag1,tag2,data){
    //create date object with start and end data
    data.forEach(function(d){
        var start = d[tag1].split('-');
        var end = d[tag2].split('-');
        var startDate = new Date(start[2],start[1]-1,start[0]);
        var endDate = new Date(end[2],end[1]-1,end[0]);
        d[tag1] = startDate;
        d[tag2] = endDate;
    });
    return data;
}

function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}

var date_sort = function (d1, d2) {
    if (d1['#date+year'] > d2['#date+year']) return 1;
    if (d1['#date+year'] < d2['#date+year']) return -1;
    return 0;
}

function monthDiff(d1, d2) {
    return d2.getMonth() - d1.getMonth() + 1;
}

var formatComma = d3.format(',');


function generateCharts(targetData, progressData){
    var targetcf = crossfilter(targetData);
    var progresscf = crossfilter(progressData);

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
        //create data structure for target line
        var targetArr = targetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity);
        var startDate = new Date(targetArr[0]['#date+start+year']);
        var endDate = new Date(targetArr[0]['#date+end+year']);
        var targetSpan = monthDiff(startDate, endDate);
        var monthly = targetArr[0]['#meta+monthly'];
        var spanType = (monthly == 'TRUE') ? 'Monthly' : 'Cumulative';

        //create data structure for bar charts
        var indicatorArr = progressIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity).sort(date_sort);
        var dateArray = ['x'];
        var valueReachedArray = ['Reached'];
        var valueTargetArray = ['Target'];
        var lastDate = new Date();
        var total = 0;
        var first = true;
        var sector = '';
        indicatorArr.forEach(function(value, index) {
            if (first) {
                lastDate = value['#date+year'];
                dateArray.push(lastDate);
                first = false;
            }
            if (value['#date+year'].getTime() != lastDate.getTime()) {
                sector = value['#sector'],value['#indicator'];
                lastDate = value['#date+year'];
                valueReachedArray.push(total);
                valueTargetArray.push(targetGroupByIndicator[i].value/targetSpan);
                dateArray.push(lastDate);
                total = 0;
            }
            total += value['#value'];
        });
        //add last total to array
        valueReachedArray.push(total);
        valueTargetArray.push(targetGroupByIndicator[i].value/targetSpan);

        //create key stats
        var reached = 0;
        //match progress values with targeted values -- there is probably a better way to do this
        for (var j=0; j<progressGroupByIndicator.length; j++) {
            if (targetGroupByIndicator[i].key == progressGroupByIndicator[j].key) {
                reached = progressGroupByIndicator[j].value;
                break;
            }
        }
        $('.graphs').append('<div class="col-md-4"><div class="header"><h4>' + sector + '</h4><h3>'+  targetGroupByIndicator[i].key +'</h3></div><span class="num">'+ formatComma(targetGroupByIndicator[i].value) +'</span> targeted <span class="small">(over ' + targetSpan + ' mths)</span><br><span class="num">'+ formatComma(reached) +'</span> reached<div class="timespan text-center small">(' + spanType + ')</div><div id="chart' + i + '" class="chart"></div></div>');

        //create bar charts
        var chartType = (monthly == 'TRUE') ? 'bar' : 'line';
        var chart = c3.generate({
            bindto: '#chart'+i,
            size: { height: 200 },
            data: {
                x: 'x',
                columns: [ dateArray, valueReachedArray, valueTargetArray ],
                type: chartType,
                types: {
                    Target: 'line'
                },
                colors: {
                    Target: '#F2645A',
                    Reached: '#007CE0'
                }
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
                    },
                    min: 0,
                    padding : {
                        bottom : 0
                    }
                }
            },
            padding: {
                right: 20
            }
        });
    }
}

var mapsvg,
    centered;
function generateMap(adm1){
    //remove loader and show map
    $('.sp-circle').remove();
    $('#map').fadeIn();

    var width = $('#map').width();
    var height = 400;
    //map.zoom = d3.behavior.zoom().scaleExtent([1, 8]).on('zoom', map.zoomMap);
    mapsvg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height)
        //.call(map.zoom);

    var mapprojection = d3.geo.mercator()
        .center([50, 5])
        .scale(width*1.8)
        .translate([width / 2, height / 2]);    

    // var g = map.svg.append('g');

    // g.selectAll('path')
    //     .data(countries.features).enter()
    //     .append('path')
    //     .attr('d', d3.geo.path().projection(map.projection))
    //     .attr('class','country')
    //     .attr('fill', '#ffffff')
    //     .attr('stroke-width',2)
    //     .attr('stroke','#cccccc')
    //     .attr('id',function(d){
    //         return d.properties.NAME;
    //     });

    var g = mapsvg.append('g').attr('id','adm1layer');
    var path = g.selectAll('path')
        .data(adm1.features).enter()
        .append('path')
        .attr('d', d3.geo.path().projection(mapprojection))
        .attr('class','adm1')
        .attr('fill', '#ffffff')
        .attr('stroke-width',2)
        .attr('stroke','#aaaaaa')
        .attr('id',function(d){
            return d.properties.admin1Name;
        });

    //map tooltips
    var maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');
    path
        .on('mousemove', function(d,i) {
            var mouse = d3.mouse(mapsvg.node()).map( function(d) { return parseInt(d); } );
            maptip
                .classed('hidden', false)
                .attr('style', 'left:'+(mouse[0]+20)+'px;top:'+(mouse[1]+20)+'px')
                .html(d.properties.admin1Name)
        })
        .on('mouseout',  function(d,i) {
            maptip.classed('hidden', true)
        })
        .on('click', function(d,i){
            $(this).siblings().attr('fill', '#FFFFFF');
            $(this).attr('fill', '#F2645A');
            //centerMap(d);
        }); 
}

function centerMap(d) {
  var x = 0,
      y = 0;

  // If the click was on the centered state or the background, re-center.
  // Otherwise, center the clicked-on state.
  if (!d || centered === d) {
    centered = null;
  } else {
    var centroid = path.centroid(d);
    x = width / 2 - centroid[0];
    y = height / 2 - centroid[1];
    centered = d;
  }

  // Transition to the new transform.
  g.transition()
      .duration(750)
      .attr("transform", "translate(" + x + "," + y + ")");
}

var adm1Call = $.ajax({ 
    type: 'GET', 
    url: 'data/som_adm1.json',
    dataType: 'json',
});

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
    var targetData = parseTargetDates(['#date+start+year'],['#date+end+year'], (hxlProxyToJSON(targetArgs[0])));
    var progressData = parseDates(['#date+month'],['#date+year'],(hxlProxyToJSON(progressArgs[0])));
    generateCharts(targetData, progressData);
});

$.when(targetCall, progressCall, adm1Call).then(function(targetArgs, progressArgs, adm1Args){
    var adm1 = topojson.feature(adm1Args[0],adm1Args[0].objects.som_adm1);
    generateMap(adm1);
});