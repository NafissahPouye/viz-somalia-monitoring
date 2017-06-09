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

function checkIntData(d){
    return (isNaN(parseInt(d)) || parseInt(d)<0) ? 0 : parseInt(d);
}

var date_sort = function (d1, d2) {
    if (d1['#date'] > d2['#date']) return 1;
    if (d1['#date'] < d2['#date']) return -1;
    return 0;
}

var target_date_sort = function (d1, d2) {
    if (d1['#date+start'] > d2['#date+start']) return 1;
    if (d1['#date+start'] < d2['#date+start']) return -1;
    return 0;
}

function monthDiff(d1, d2) {
    return d2.getMonth() - d1.getMonth() + 1;
}

var formatComma = d3.format('.2s');
var targetcf, 
    progresscf,
    targetIndicatorDim,
    progressIndicatorDim,
    targetGroupByIndicator,
    progressGroupByIndicator;

function generateCharts(targetData, progressData){
    targetcf = crossfilter(targetData);
    progresscf = crossfilter(progressData);

    targetData.forEach(function(d){
        d['#targeted'] = checkIntData(d['#targeted']);
    });

    progressData.forEach(function(d){
        d['#value'] = checkIntData(d['#value']);
    });

    //get target and progress dimensions by indicator
    targetIndicatorDim = targetcf.dimension(function(d) { return d['#sector']+'|'+d['#indicator']; });
    progressIndicatorDim = progresscf.dimension(function(d) { return d['#indicator']; });

    //get target and progress data values for key stats
    targetGroupByIndicator = targetIndicatorDim.group().reduceSum(function(d){return d['#targeted']; }).all();
    progressGroupByIndicator = progressIndicatorDim.group().reduceSum(function(d){return d['#value']; }).all();

    for (var i=0; i<targetGroupByIndicator.length; i++) {
        //create data structure for target line
        var currentSector = targetGroupByIndicator[i].key.split('|')[0];
        var currentIndicator = targetGroupByIndicator[i].key.split('|')[1];
        var targetArr = targetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity).sort(target_date_sort);
        var startDate = new Date(targetArr[0]['#date+start']);
        var endDate = new Date(targetArr[0]['#date+end']);
        var mthDiff = monthDiff(startDate, endDate);
        var spanType = targetArr[0]['#meta+cumulative'];
        var targetSpan = (spanType.toLowerCase()=='per month') ? '' : '(over ' + mthDiff + ' mths)';

        //get target values
        var valueTargetArray = ['Target'];
        var targetVal = 0;
        if (spanType.toLowerCase()=='per month') {
            var lastDate = new Date();
            var total = 0;
            var first = true;
            targetArr.forEach(function(value, index) {
                if (first) {
                    lastDate = value['#date+start'];
                    first = false;
                }
                if (value['#date+start'].getTime() != lastDate.getTime()) {
                    lastDate = value['#date+start'];
                    valueTargetArray.push(total);
                    targetVal += Number(total);
                    total = 0;
                }
                total += value['#targeted'];
            });
            //add last total to array
            valueTargetArray.push(total);
            targetVal += Number(total);
        }
        else {
            for (var j=0; j<mthDiff; j++) {
                valueTargetArray.push(targetGroupByIndicator[i].value);
                targetVal += Number(targetGroupByIndicator[i].value);
            }
        }

        //get progress values
        var indicatorArr = progressIndicatorDim.filter(currentIndicator).top(Infinity).sort(date_sort);
        var dateArray = ['x'];
        var valueReachedArray = ['Reached'];
        var lastDate = new Date();
        var total = 0;
        var first = true;
        var reachedVal = 0;
        indicatorArr.forEach(function(value, index) {
            if (first) {
                lastDate = value['#date'];
                dateArray.push(lastDate);
                first = false;
            }
            if (value['#date'].getTime() != lastDate.getTime()) {
                lastDate = value['#date'];
                valueReachedArray.push(total);
                reachedVal += Number(total);
                dateArray.push(lastDate);
                total = 0;
            }
            total += value['#value'];
        });
        //add last total to array
        valueReachedArray.push(total);
        reachedVal += Number(total);

        //create key stats
        $('.graphs').append('<div class="col-md-4" id="indicator' + i + '"><div class="header"><h4>' + currentSector + '</h4><h3>'+  currentIndicator +'</h3></div><span class="num targetNum">' + formatComma(targetVal) + '</span> targeted <span class="small">' + targetSpan + '</span><br><span class="num reachedNum">' + formatComma(reachedVal) + '</span> reached<div class="timespan text-center small">(' + spanType + ')</div><div id="chart' + i + '" class="chart"></div></div>');

        //create bar charts
        var chartType = 'line';
        var chart = c3.generate({
            bindto: '#chart'+i,
            size: { height: 200 },
            data: {
                x: 'x',
                type: chartType,
                columns: [ dateArray, valueReachedArray, valueTargetArray ],
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
                    padding: { bottom : 0 }
                }
            },
            padding: { right: 20 }
        });

        //store reference to chart
        $('#chart'+i).data('chartObj', chart);
    }
}

function updateCharts(region) {
    for (var i=0; i<targetGroupByIndicator.length; i++) {
        //create data structure for target line
        var currentIndicator = targetGroupByIndicator[i].key.split('|')[1];
        var targetArr = targetIndicatorDim.filter(targetGroupByIndicator[i].key).top(Infinity);
        var targetedVal = 0, 
            startDate,
            endDate;
        targetArr.forEach(function(value, index) {
            if (value['#adm1+name'] == region || region == '') {
                targetedVal += Number(value['#targeted']);
                startDate = new Date(value['#date+start']);
                endDate = new Date(value['#date+end']);
            }
        });
        //var targetSpan = monthDiff(startDate, endDate);

        //get target values
        var valueTargetArray = ['Target'];
        var targetVal = 0;
        if (targetArr[0]['#meta+cumulative'].toLowerCase()=='per month') {
            var lastDate = new Date();
            var total = 0;
            var first = true;
            targetArr.forEach(function(value, index) {
                if (targetArr[index]['#adm1+name'] == region || region == '') {
                    if (first) {
                        lastDate = value['#date+start'];
                        first = false;
                    }
                    if (value['#date+start'].getTime() != lastDate.getTime()) {
                        lastDate = value['#date+start'];
                        valueTargetArray.push(total);
                        targetVal += Number(total);
                        total = 0;
                    }
                    total += value['#targeted'];
                }
            });
            //add last total to array
            valueTargetArray.push(total);
            targetVal += Number(total);
        }
        else {
            for (var j=0; j<mthDiff; j++) {
                valueTargetArray.push(targetGroupByIndicator[i].value);
                targetVal += Number(targetGroupByIndicator[i].value);
            }
        }

        //get progress data
        var indicatorArr = progressIndicatorDim.filter(currentIndicator).top(Infinity).sort(date_sort);
        var dateArray = ['x'];
        var valueReachedArray = ['Reached'];
        var lastDate = new Date();
        var total = 0;
        var first = true;
        var reachedVal = 0;
        indicatorArr.forEach(function(value, index) {
            if (indicatorArr[index]['#adm1+name'] == region || region == '') {
                if (first) {
                    lastDate = value['#date'];
                    dateArray.push(lastDate);
                    first = false;
                }
                if (value['#date'].getTime() != lastDate.getTime()) {
                    lastDate = value['#date'];
                    valueReachedArray.push(total);
                    reachedVal += Number(total);
                    dateArray.push(lastDate);
                    total = 0;
                }
                total += value['#value'];
            }
        });
        //add last total to array
        valueReachedArray.push(total);
        reachedVal += Number(total);

        //update key stats
        $('#indicator'+i).find('.targetNum').html(formatComma(targetedVal));
        $('#indicator'+i).find('.reachedNum').html(formatComma(reachedVal));

        //update bar charts
        var currentChart = $('#chart'+i).data('chartObj');
        currentChart.load({
            columns: [ dateArray, valueReachedArray, valueTargetArray ]
        });
    }
}


var mapsvg,
    centered;
function generateMap(adm1){
    //remove loader and show map
    $('.sp-circle').remove();
    $('.map-container').fadeIn();

    var width = $('#map').width();
    var height = 400;

    mapsvg = d3.select('#map').append('svg')
        .attr('width', width)
        .attr('height', height);

    var mapprojection = d3.geo.mercator()
        .center([48, 5])
        .scale(width*2)
        .translate([width / 2, height / 2]);    

    var g = mapsvg.append('g').attr('id','adm1layer');
    var path = g.selectAll('path')
        .data(adm1.features).enter()
        .append('path')
        .attr('d', d3.geo.path().projection(mapprojection))
        .attr('class','adm1')
        .attr('fill', '#FFFFFF')
        .attr('stroke-width', 2)
        .attr('stroke','#AAAAAA')
        .attr('id',function(d){
            return d.properties.admin1Name;
        });

    //map tooltips
    var maptip = d3.select('#map').append('div').attr('class', 'd3-tip map-tip hidden');
    path
        .on('mousemove', function(d,i) {
            $(this).attr('fill', '#F2645A');
            var mouse = d3.mouse(mapsvg.node()).map( function(d) { return parseInt(d); } );
            maptip
                .classed('hidden', false)
                .attr('style', 'left:'+(mouse[0]+20)+'px; top:'+(mouse[1]+20)+'px')
                .html(d.properties.admin1Name)
        })
        .on('mouseout',  function(d,i) {
            if (!$(this).data('selected'))
                $(this).attr('fill', '#FFFFFF');
            maptip.classed('hidden', true)
        })
        .on('click', function(d,i){
            selectRegion($(this), d.properties.admin1Name);
        }); 

    $('.reset-btn').on('click', reset);
}

function selectRegion(region, name) {
    region.siblings().data('selected', false);
    region.siblings().attr('fill', '#FFFFFF');
    region.attr('fill', '#F2645A');
    region.data('selected', true);
    $('.regionLabel > div > strong').html(name);
    updateCharts(name);
}

function reset() {
    $('#adm1layer').children().attr('fill', '#FFFFFF');
    $('.regionLabel > div > strong').html('All Regions');
    updateCharts('');
    return false;
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
    var targetData = parseDates([['#date+start'],['#date+end']], (hxlProxyToJSON(targetArgs[0])));
    var progressData = parseDates(['#date'],(hxlProxyToJSON(progressArgs[0])));
    generateCharts(targetData, progressData);
});

$.when(targetCall, progressCall, adm1Call).then(function(targetArgs, progressArgs, adm1Args){
    var adm1 = topojson.feature(adm1Args[0],adm1Args[0].objects.som_adm1);
    generateMap(adm1);
});