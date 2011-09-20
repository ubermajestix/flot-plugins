/*
Flot plugin for bubble charting

To activate bubbles:

plot = $.plot($("#placeholder"), [
  // data needs to be in the form [x,y,z] where z is the radius of the point
  { data: [[1,2,10],[4,6,8],[3,1,4]], color: '#A1FDFF', label: 'boom' }
  ],
  {
    series: {
      bubble: true, // set this to true to activate bubbles, otherwise your data will be plotted as points
      points: { show: true }, // bubbles will only work with point charts, the plugin will NOT attempt to bubble a bar chart
      lines:  { show: true } // the bubble plugin supports connecting bubbles in a series with lines
    },
  }
);

*/

(function ($) {
  var options = {
    series: {bubble: null}
  };

  function init(plot) {

    function log(){
      if(window.console) {
        console.log.apply(console, arguments);
      }
    }

      function drawSeriesBubblePoints(series, ctx) {
            function plotPoints(datapoints, radius, fillStyle, offset, circumference, axisx, axisy, rawData) {
                var points = datapoints.points, ps = datapoints.pointsize;
                for (var i = 0; i < points.length; i += ps) {
                    var x = points[i], y = points[i + 1];
                    if (x == null || x < axisx.min || x > axisx.max || y < axisy.min || y > axisy.max)
                        continue;
                    var radius_index = i/2,
                        radius = rawData[radius_index][2]
                    ctx.beginPath();

                    var options = plot.getOptions();
                    if (options.series.bubble_options && options.series.bubble_options.occupancy){
                        ctx.arc(axisx.p2c(x), axisy.p2c(y) + (options.series.bubble_options.radius_offset - radius), radius, 0, circumference, false);
                    } else {
                        ctx.arc(axisx.p2c(x), axisy.p2c(y) + offset, radius, 0, circumference, false);
                    }

                    if (fillStyle) {
                        ctx.fillStyle = fillStyle;
                        ctx.fill();
                    }
                    ctx.stroke();
                }
            }
            ctx.save();
            var plotOffset = plot.getPlotOffset()
            ctx.translate(plotOffset.left, plotOffset.top);

            var lw = series.lines.lineWidth,
                sw = series.shadowSize,
                radius = series.points.radius;
            if (lw > 0 && sw > 0) {
                // draw shadow in two steps
                var w = sw / 2;
                ctx.lineWidth = w;
                ctx.strokeStyle = "rgba(0,0,0,0.1)";
                plotPoints(series.datapoints, radius, null, w + w/2, Math.PI,
                           series.xaxis, series.yaxis, series.data);

                ctx.strokeStyle = "rgba(0,0,0,0.2)";
                plotPoints(series.datapoints, radius, null, w/2, Math.PI,
                           series.xaxis, series.yaxis, series.data);
            }

            ctx.lineWidth = lw;
            ctx.strokeStyle = series.color;
            plotPoints(series.datapoints, radius,
                       getFillStyle(series.points, series.color), 0, 2 * Math.PI,
                       series.xaxis, series.yaxis, series.data);
            ctx.restore();
        }
        //duped function from flot
        function getFillStyle(filloptions, seriesColor, bottom, top) {
            var fill = filloptions.fill;
            if (!fill)
                return null;
            if (filloptions.fillColor)
            //fill color is same as series
            // TODO allow to specify fillColor?
                return getColorOrGradient(seriesColor, bottom, top, seriesColor);

            var c = $.color.parse(seriesColor);
            c.a = typeof fill == "number" ? fill : 0.4;
            c.normalize();
            return c.toString();
        }
       //duped function from flot
       function getColorOrGradient(spec, bottom, top, defaultColor) {
            if (typeof spec == "string")
                return spec;
            else {
                // assume this is a gradient spec; IE currently only
                // supports a simple vertical gradient properly, so that's
                // what we support too
                var gradient = ctx.createLinearGradient(0, top, 0, bottom);

                for (var i = 0, l = spec.colors.length; i < l; ++i) {
                    var c = spec.colors[i];
                    if (typeof c != "string") {
                        var co = $.color.parse(defaultColor);
                        if (c.brightness != null)
                            co = co.scale('rgb', c.brightness)
                        if (c.opacity != null)
                            co.a *= c.opacity;
                        c = co.toString();
                    }
                    gradient.addColorStop(i / (l - 1), c);
                }

                return gradient;
            }
        }

    var highlights = []
    function onMouseMove(e) {
            triggerClickHoverEvent("plothover", e,
                                   function (s) { return s["hoverable"] != false; });
    }

    function onClick(e) {
        triggerClickHoverEvent("plotclick", e,
                               function (s) { return s["clickable"] != false; });
    }
    function triggerClickHoverEvent(eventname, event, seriesFilter) {

        var offset = plot.bubble.eventHolder.offset(),
            canvasX = event.pageX - offset.left - plot.getPlotOffset().left,
            canvasY = event.pageY - offset.top - plot.getPlotOffset().top,
            pos = plot.c2p({ left: canvasX, top: canvasY });

        pos.pageX = event.pageX;
        pos.pageY = event.pageY;

        var item = findNearbyItem(canvasX, canvasY, seriesFilter);

        if (item) {
            // fill in mouse pos for any listeners out there
            item.pageX = parseInt(item.series.xaxis.p2c(item.datapoint[0]) + offset.left + plot.getPlotOffset().left);
            item.pageY = parseInt(item.series.yaxis.p2c(item.datapoint[1]) + offset.top + plot.getPlotOffset().top);
        }

        if (plot.getOptions().grid.autoHighlight) {
            // clear auto-highlights
            for (var i = 0; i < highlights.length; ++i) {
                var h = highlights[i];
                if (h.auto == eventname &&
                    !(item && h.series == item.series && h.point == item.datapoint))
                    unhighlight(h.series, h.point);
            }

            if (item)
                highlight(item.series, item.datapoint, eventname);
        }
        plot.getPlaceholder().trigger(eventname, [ pos, item ]);
    }

    // returns the data item the mouse is over, or null if none is found
    function findNearbyItem(mouseX, mouseY, seriesFilter) {

        var maxDistance = plot.getOptions().grid.mouseActiveRadius,
            smallestDistance = maxDistance * maxDistance + 1,
            item = null, foundPoint = false, i, j;
        // log("nearby. smallDis: ", smallestDistance)
        var series = plot.getData();
        for (i = series.length - 1; i >= 0; --i) {
            if (!seriesFilter(series[i]))
                continue;

            var s = series[i],
                axisx = s.xaxis,
                axisy = s.yaxis,
                points = s.datapoints.points,
                ps = s.datapoints.pointsize,
                mx = axisx.c2p(mouseX), // precompute some stuff to make the loop faster
                my = axisy.c2p(mouseY);
                // maxx = maxDistance / axisx.scale,
                //maxy = maxDistance / axisy.scale;

            if(s.lines.show || s.points.show) {
                for (j = 0; j < points.length; j += ps) {

                    var x = points[j], y = points[j + 1];

                    if (x == null)
                        continue;
                    // TODO this is really slow b/c its doing array traversal to get the radius
                    // then sets the distances for every point on every hover
                    var newmaxDistance = radiusAtPoint(s, [x,y]),
                    // log("new max", newmaxDistance * newmaxDistance + 1)
                        newSmallDist = newmaxDistance * newmaxDistance + 1,
                    // For points and lines, the cursor must be within a
                    // certain distance to the data point
                        maxx = newmaxDistance / axisx.scale,
                        maxy = newmaxDistance / axisy.scale;


                    if (x - mx > maxx || x - mx < -maxx ||
                        y - my > maxy || y - my < -maxy)
                        continue;

                    // We have to calculate distances in pixels, not in
                    // data units, because the scales of the axes may be different
                    var dx = Math.abs(axisx.p2c(x) - mouseX),
                        dy = Math.abs(axisy.p2c(y) - mouseY),
                        dist = dx * dx + dy * dy; // we save the sqrt

                    // use <= to ensure last point takes precedence
                    // (last generally means on top of)


                    // log('dist: ', dist < newSmallDist)
                    // if (dist < smallestDistance) {
                    //     smallestDistance = dist;
                   if (dist < newSmallDist) {
                        newSmallDist = dist;
                        item = [i, j / ps];
                    }
                }
            }

            if (s.bars.show && !item) { // no other point can be nearby
                var barLeft = s.bars.align == "left" ? 0 : -s.bars.barWidth/2,
                    barRight = barLeft + s.bars.barWidth;

                for (j = 0; j < points.length; j += ps) {
                    var x = points[j], y = points[j + 1], b = points[j + 2];
                    if (x == null)
                        continue;

                    // for a bar graph, the cursor must be inside the bar
                    if (series[i].bars.horizontal ?
                        (mx <= Math.max(b, x) && mx >= Math.min(b, x) &&
                         my >= y + barLeft && my <= y + barRight) :
                        (mx >= x + barLeft && mx <= x + barRight &&
                         my >= Math.min(b, y) && my <= Math.max(b, y)))
                            item = [i, j / ps];
                }
            }
        }

        if (item) {
            i = item[0];
            j = item[1];
            var ps = series[i].datapoints.pointsize;

            return { datapoint: series[i].datapoints.points.slice(j * ps, (j + 1) * ps),
                     dataIndex: j,
                     series: series[i],
                     seriesIndex: i };
        }

        return null;
    }



    function highlight(s, point, auto) {
        if (typeof s == "number")
            s = series[s];

        if (typeof point == "number")
            point = s.data[point];

        var i = indexOfHighlight(s, point);
        if (i == -1) {
            highlights.push({ series: s, point: point, auto: auto });

            plot.triggerRedrawOverlay();
        }
        else if (!auto)
            highlights[i].auto = false;
    }

    function unhighlight(s, point) {
        if (s == null && point == null) {
            highlights = [];
            triggerRedrawOverlay();
        }

        if (typeof s == "number")
            s = series[s];

        if (typeof point == "number")
            point = s.data[point];

        var i = indexOfHighlight(s, point);
        if (i != -1) {
            highlights.splice(i, 1);

            plot.triggerRedrawOverlay();
        }
    }

    function indexOfHighlight(s, p) {
        for (var i = 0; i < highlights.length; ++i) {
            var h = highlights[i];
            if (h.series == s && h.point[0] == p[0]
                && h.point[1] == p[1])
                return i;
        }
        return -1;
    }

    function drawPointHighlight(series, point) {
        var x = point[0], y = point[1], axisx = series.xaxis, axisy = series.yaxis;
        if (x < axisx.min || x > axisx.max || y < axisy.min || y > axisy.max)
            return;
        var octx = plot.bubble.octx,
            bubble_radius = radiusAtPoint(series, point),
            radius = bubble_radius + series.points.lineWidth / 2,
            plotOffset = plot.getPlotOffset();

        octx.lineWidth = series.points.lineWidth *5.5 ;
        octx.strokeStyle = $.color.parse(series.color).scale('a', 0.4).toString();
        octx.beginPath();
        octx.arc(axisx.p2c(x) + plotOffset.left, axisy.p2c(y) + plotOffset.top, radius, 0, 2 * Math.PI, false)
        octx.stroke();
    }

    function axisSpecToRealAxis(obj, attr) {
        var a = obj[attr];
        if (!a || a == 1)
            return axes[attr];
        if (typeof a == "number")
            return axes[attr.charAt(0) + a + attr.slice(1)];
        return a; // assume it's OK
    }

    //given a series and a point returns the radius defined in the dataset
    function radiusAtPoint(series, point){
      var points = series.datapoints.points, ps = series.datapoints.pointsize;

      for (var i = points.length; i > 1; i -= ps) { // walk back to return the last (top) hit
        var x = points[i - 2], y = points[i - 1];

        // if(i > 0)
        //    radius_index = i/2
        if(point[0] == x && point[1] == y) {
          var radius_index = (i - 2) / 2;
          return series.data[radius_index][2];
        }
        // log(radius_array, radius_array[radius_index])
        // log(i,[x,y], radius_index)
      }
      // log("point: ", point, " radius: ", bubble_radius)
      return 0;
    }

    // bind hoverable events
		function bindEvents(plot, eventHolder)
		{
            plot.bubble.eventHolder = eventHolder;
			var options = plot.getOptions();
			if (weShouldBubble() && options.grid.hoverable)
				eventHolder.unbind('mousemove').mousemove(onMouseMove);

      if (options.series.bubble && options.grid.clickable)
       eventHolder.unbind('click').click(onClick);
		}

function weShouldBubble() {
    // log('should we bubble? ', !!plot.getOptions().series.bubble && !!plot.getOptions().series.points.show)
    return !! plot.getOptions().series.bubble && !!plot.getOptions().series.points.show
}

function blowBubbles(plot, ctx) {
    if (!weShouldBubble())
    return;
    var series = plot.getData()
    $.each(series, function(index, s) {
      drawSeriesBubblePoints(s, ctx)
    })
}

function blowHighlights(plot, octx) {
  plot.bubble.octx = octx
  if (!weShouldBubble())
  return;
  $.each(highlights, function(index, hi){
    drawPointHighlight(hi.series, hi.point);
  });

}
    plot.bubble = {
      eventHolder: null,
      octx: null
    }

    plot.hooks.bindEvents.push(bindEvents);
    plot.hooks.draw.push(blowBubbles);
    plot.hooks.drawOverlay.push(blowHighlights);
  }

  $.plot.plugins.push({
      init: init,
      options: options,
      name: 'bubble',
      version: '0.1'
  });

})(jQuery);