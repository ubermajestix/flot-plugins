== Flot.js plugin for bubble charting

= To activate bubbles:

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