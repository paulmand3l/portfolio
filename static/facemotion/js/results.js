paper.install(window);

$(function() {
    var chart = new Chart();
    $('select').change(function() {
        var newLabels = [];
        $('select').each(function() {
            newLabels.push($(this).val());
        });

        d3.selectAll('.axis text.label').data(newLabels).text(function(d) { return d; });
        chart.redraw();
    });

    paper.setup('face');

    $('#face').attr({
        width: $('#face').width(),
        height: $('#face').height()
    });

    face = new Face(me);
    face.showMuscles = 0;

    $('input.face-version').val(face.version);

    view.draw();

    view.onFrame = function(event) {
        face.loop(event);
    };

});

var gotoEmotions = function(target) {
    var emotions = {};
    $.each(face.recipes, function(emotion, muscles) {
        emotions[emotion] = 0;
    });

    for (var emotion in target) {
        emotions[emotion] = target[emotion];
    }

    musclePulls = face.recalculateMusclesFromEmotions(emotions);

    $.each(musclePulls, function(muscle, pull) {
        face.muscles[muscle] = pull;
    });
};


Chart = (function() {
    var ChartConstructor;

    //Width and height
    var margin = {top: 20, right: 50, bottom: 50, left: 50};

    var width = $('svg.xy').width() - margin.right - margin.left;
    var height = $('svg.xy').height() - margin.top - margin.bottom;

    //Create scale functions
    var x = d3.scale.linear()
        .range([0, width])
        .domain([0.3, 1]);

    //Define X axis
    var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom")
        .ticks(10);

    var y = d3.scale.linear()
        .range([height, 0])
        .domain([0.3, 1]);

    //Define Y axis
    var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left")
        .ticks(10);

    var fill = d3.scale.category10();
    var groupFill = function(d, i) { return fill(i); };


    ChartConstructor = function() {
        if (false === (this instanceof Chart)) {
            return new Chart();
        }

        var that = this;

        this.makeChart();
        this.getData();

        this.svg.on('mousemove', function(d, i) {
            var position = d3.mouse(this);
            var target = {};
            target[that.emotionX] = x.invert(position[0]);
            target[that.emotionY] = y.invert(position[1]);
            gotoEmotions(target);
        });
    };

    ChartConstructor.prototype.makeChart = function() {
        this.svg = d3.select("svg.xy")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        this.createXAxis($('select.emotionX').val());
        this.createYAxis($('select.emotionY').val());
    };

    ChartConstructor.prototype.createXAxis = function(label) {
        this.svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + height + ")")
            .call(xAxis)
            .append("text")
                .attr('class', 'label')
                .attr('x', x(1))
                .attr('dy', '4em')
                .style("text-anchor", 'end')
                .style('font-weight', 'bold')
                .text(label);
    };

    ChartConstructor.prototype.createYAxis = function(label) {
        //Create Y axis
        this.svg.append("g")
            .attr("class", "axis")
            .call(yAxis)
            .append("text")
                .attr('class', 'label')
                .attr("transform", "rotate(-90)")
                .attr("y", 6)
                .attr("dy", "-4em")
                .text(label);
    };

    ChartConstructor.prototype.showLoading = function() {
        $('img.loading').css({
            top: $('svg.xy').position().top + $('svg.xy').height() / 2 - 50,
            left: $('#main').width() / 2,
        }).show();
    };

    ChartConstructor.prototype.hideLoading = function() {
        $('img.loading').hide();
    };

    ChartConstructor.prototype.getData = function() {
        this.showLoading();

        var that = this;
        d3.csv('/facemotion/results.csv', function(error, data) {
            that.hideLoading();

            that.data = data;
            that.data.forEach(function(d) {
                d[d.emotion0] = parseFloat(d.value0, 10);
                if (d.emotion1 !== '') {
                    d[d.emotion1] = parseFloat(d.value1, 10);
                }

                d.response = $.trim(d.response);

                switch (d.response) {
                    case 'sad':
                    case 'Sad':
                        d.response = 'sadness';
                        break;
                    case 'angry':
                    case 'Angry':
                        d.response = 'anger';
                        break;
                    case 'disgusted':
                    case 'Disgusted':
                        d.response = 'disgust';
                        break;
                    case 'surprised':
                    case 'Surprised':
                        d.response = 'surprise';
                        break;
                    case 'shocked':
                    case 'Shocked':
                        d.response = 'shock';
                        break;
                    case 'worried':
                    case 'Worried':
                        d.response = 'worry';
                        break;
                    case 'happy':
                    case 'Happy':
                        d.response = 'happiness';
                        break;
                    case 'concerned':
                    case 'Concerned':
                        d.response = 'concern';
                        break;
                }
            });

            that.redraw();
        });
    };

    ChartConstructor.prototype.redraw = function() {
        this.emotionX = $('select.emotionX').val();
        this.emotionY = $('select.emotionY').val();

        var emotionX = this.emotionX;
        var emotionY = this.emotionY;

        var data = this.data.filter(function(d) {
            return ((emotionX in d) && (emotionY in d) && !(emotionX == emotionY));
        });

        var groups = d3.nest().key(function(d) { return d.response.toLowerCase(); }).entries(data)
            .filter(function(d) { return d.values.length > 3; });
            // Filter for coherence

        var groupPath = function(d) {
            return 'M' +
                d3.geom.hull(d.values.map(function(i) { return [x(i[emotionX]), y(i[emotionY])]; })).join('L')
            + 'Z';
        };

        var colorMap = {};

        var hull = this.svg.selectAll('path.hull').data(groups);

        hull.enter().append("path")
            .attr('class', 'hull')
            .style('opacity', '.2');

        hull.transition().duration(500)
            .attr("d", function(d) {
                console.log(groupPath(d));
                return groupPath(d);
            })
            .style("fill", function(d, i) {
                var color = groupFill(d, i);
                colorMap[d.key] = color;
                return color;
            });

        hull.exit().remove();

        var response = this.svg.selectAll('text.response')
            .data(data);

        response.enter().append('text')
            .attr('class', 'response');

        response
            .transition().duration(500)
            .attr('x', function(d) { return x(d[emotionX]); })
            .attr('y', function(d) { return y(d[emotionY]); })
            .style('fill', function(d) { return d.response.toLowerCase() in colorMap ? colorMap[d.response.toLowerCase()] : 'Black'; })
            .style('font-weight', function(d) { return d.response.toLowerCase() in colorMap ? 'bold' : 'normal'; })
            .text(function(d) { return d.response; });

        response.exit()
            .transition()
            .style('opacity', 0)
            .remove();

    };

    return ChartConstructor;

}());
