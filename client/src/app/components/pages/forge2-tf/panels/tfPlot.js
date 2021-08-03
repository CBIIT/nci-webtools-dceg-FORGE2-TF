import React from 'react';
import * as d3 from 'd3';
import * as AppConst from '../../../../appConstants';

class Plot extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clientWidth: -1,
      clientHeight: -1,
      clientMargin: { top: 45, right: 55, bottom: 55, left: 55 },
      clientPadding: { top: 2, right: 10, bottom: 6, left: 6 },
    };
    this.updateDimensions = this.updateDimensions.bind(this);
    this.updatePlot = this.updatePlot.bind(this);
    this.timeStampInMs =
      window.performance &&
      window.performance.now &&
      window.performance.timing &&
      window.performance.timing.navigationStart
        ? window.performance.now() + window.performance.timing.navigationStart
        : Date.now();
  }

  updateDimensions() {
    if (this.refs && this.refs.plotContainer) {
      let { clientHeight, clientWidth } = this.refs.plotContainer;
      this.setState({
        clientWidth: parseFloat(
          clientWidth +
            this.state.clientMargin.left +
            this.state.clientMargin.right -
            this.state.clientPadding.left -
            this.state.clientPadding.right
        ),
        clientHeight: parseFloat(
          clientWidth / 4 +
            this.state.clientMargin.top +
            this.state.clientMargin.bottom
        ),
      });
    }
  }

  componentWillMount() {
    var self = this;
    setTimeout(function () {
      self.updateDimensions();
    }, 100);
  }

  componentDidMount() {
    window.addEventListener('resize', this.updateDimensions);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateDimensions);
  }

  componentWillUpdate() {
    //     console.log("plot - componentWillUpdate()", this.timeStampInMs);
  }

  componentDidUpdate() {
    //    console.log("plot - componentDidUpdate()", this.timeStampInMs);
    if (
      Object.keys(this.props.data).length === 0 &&
      this.props.data.constructor === Object
    ) {
      return;
    }
    //else
    //  console.log("plot - updatePlot() - this.props", this.props);
    this.updatePlot();
  }

  shouldComponentUpdate(nextProps, nextState) {
    //    console.log("plot - shouldComponentUpdate()", this.timeStampInMs, nextProps, nextState);
    return true;
  }

  updatePlot() {
    //    console.log("plot - updatePlot()", this.timeStampInMs);

    var self = this;

    const node = this.node;

    // set up translation function
    const getTransformAttributes = function (transform) {
      // Create a dummy g for calculation purposes only. This will never
      // be appended to the DOM and will be discarded once this function
      // returns.
      var g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

      // Set the transform attribute to the provided string value.
      g.setAttributeNS(null, 'transform', transform);

      // consolidate the SVGTransformList containing all transformations
      // to a single SVGTransform of type SVG_TRANSFORM_MATRIX and get
      // its SVGMatrix.
      var matrix = g.transform.baseVal.consolidate().matrix;

      // Below calculations are taken and adapted from the private function
      // transform/decompose.js of D3's module d3-interpolate.
      var { a, b, c, d, e, f } = matrix; // ES6, if this doesn't work, use below assignment
      // var a=matrix.a, b=matrix.b, c=matrix.c, d=matrix.d, e=matrix.e, f=matrix.f; // ES5
      var scaleX, scaleY, skewX;
      if ((scaleX = Math.sqrt(a * a + b * b))) (a /= scaleX), (b /= scaleX);
      if ((skewX = a * c + b * d)) (c -= a * skewX), (d -= b * skewX);
      if ((scaleY = Math.sqrt(c * c + d * d)))
        (c /= scaleY), (d /= scaleY), (skewX /= scaleY);
      if (a * d < b * c)
        (a = -a), (b = -b), (skewX = -skewX), (scaleX = -scaleX);
      return {
        translateX: e,
        translateY: f,
        rotate: (Math.atan2(b, a) * 180) / Math.PI,
        skewX: (Math.atan(skewX) * 180) / Math.PI,
        scaleX: scaleX,
        scaleY: scaleY,
      };
    };

    // clear plot
    var svg = d3.select(node);
    svg.selectAll('*').remove();

    // data
    const aggregate = this.props.data.aggregate;
    const sample = aggregate.samplePrefix;
    const samples = aggregate.samples;
    const tfModel = aggregate.tfModel;
    const padding = aggregate.padding;
    const smoothing = aggregate.smoothing;
    const signalType = aggregate.signalType;
    var signal = aggregate.signal;

    const queryProbeMatches = this.props.queryProbeMatches;

    const windowRangeStart = 0;
    const windowRangeStop = signal.length;
    const windowRangeStartAdjusted = 0;
    const windowRangeStopAdjusted = signal.length - 1;
    const windowRange = [windowRangeStartAdjusted, windowRangeStopAdjusted];
    const windowRangeSequence = Array.from(Array(2 * padding + 1).keys()).map(
      function (i) {
        return parseInt(windowRangeStartAdjusted + i);
      }
    );

    const leftTFEdge = padding;
    const rightTFEdge =
      parseInt(windowRangeStopAdjusted - windowRangeStartAdjusted) - padding;
    const leftDownstreamEdge = rightTFEdge + 1;

    const signalMidpointIndex = parseInt(signal.length / 2);
    const signalStartIndex = 0;
    const signalStopIndex = signal.length - 1;

    // post-process signal with smoothing parameter
    if (smoothing != 0) {
      const mean = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;
      var newSignal = signal.slice(); // clone
      for (var idx = signalStartIndex; idx < signalStopIndex; idx++) {
        var leftIdx = idx - smoothing;
        var rightIdx = idx + smoothing;
        leftIdx = leftIdx < signalStartIndex ? signalStartIndex : leftIdx;
        rightIdx = rightIdx >= signalStopIndex ? signalStopIndex : rightIdx;
        var signalSubarray = signal.slice(leftIdx, rightIdx);
        newSignal[idx] = mean(signalSubarray);
      }
      signal = newSignal;
    }

    var signalMin = d3.min(signal);
    var signalMax = d3.max(signal);
    const signalSlop =
      padding > 50 ? 0 : 0.23 * parseFloat(signalMax - signalMin);
    signalMin -= 0.05 * parseFloat(signalMax - signalMin);
    signalMax -= 0.15 * parseFloat(signalMax - signalMin);

    // plot attributes
    const truePlotWidth =
      this.state.clientWidth -
      this.state.clientMargin.left -
      this.state.clientMargin.right -
      2 * this.state.clientPadding.left -
      2 * this.state.clientPadding.right;
    const truePlotHeight =
      this.state.clientHeight -
      this.state.clientMargin.top -
      this.state.clientMargin.bottom;
    const truePlotMarkerWidth = parseFloat(
      (truePlotWidth -
        this.state.clientPadding.left -
        this.state.clientPadding.right -
        20) /
        (windowRangeStopAdjusted - windowRangeStartAdjusted + 1)
    );
    const truePlotBottom =
      this.state.clientHeight - this.state.clientMargin.bottom;
    const truePlotTop = this.state.clientMargin.top;
    const truePlotLeft =
      this.state.clientMargin.left - this.state.clientPadding.left;
    const truePlotRight =
      truePlotLeft + truePlotWidth - this.state.clientPadding.right;
    const truePlotLRDiff =
      truePlotRight - truePlotLeft - this.state.clientMargin.right;

    var yAxisLabel = 'Mean DNase I cuts';

    if (smoothing != 0) {
      yAxisLabel = 'Smoothed mean DNase I cuts';
    }

    // background
    d3.select(node)
      .append('rect')
      .attr('class', 'background')
      .style('fill', AppConst.settings.style.color.backgroundRectFill)
      .style(
        'fill-opacity',
        AppConst.settings.style.color.backgroundRectFillOpacity
      )
      .attr('x', truePlotLeft)
      .attr(
        'y',
        parseFloat(truePlotTop) - AppConst.settings.style.generic.axisTopPadding
      )
      .attr(
        'height',
        truePlotHeight + AppConst.settings.style.generic.axisTopPadding
      )
      .attr(
        'width',
        truePlotWidth -
          this.state.clientPadding.left -
          this.state.clientMargin.left -
          2.0
      );

    const yScale = d3
      .scaleLinear()
      .domain([signalMin, signalMax + signalSlop])
      .range([
        this.state.clientMargin.top,
        this.state.clientHeight - this.state.clientMargin.bottom,
      ]);

    // y-scale
    const yTickSteps = 8;
    const yAxisScale = d3
      .scaleLinear()
      .range([
        this.state.clientHeight - this.state.clientMargin.bottom,
        this.state.clientMargin.top -
          AppConst.settings.style.generic.axisTopPadding,
      ])
      .domain([signalMin, signalMax + signalSlop]);
    const yAxisLeft = d3.axisLeft(yAxisScale).ticks(yTickSteps);
    const yAxisLeftCall = d3
      .select(node)
      .append('g')
      .attr('class', 'axis yAxis yAxisLeft')
      .attr('transform', 'translate(' + truePlotLeft + ',0)')
      .call(yAxisLeft);
    yAxisLeftCall.selectAll('.tick').each(function (d, i) {
      var label = d3.select(this).select('text');
      label.attr(
        'font-weight',
        AppConst.settings.style.weight.yAxisGenericText
      );
    });
    yAxisLeftCall
      .append('text')
      .attr('transform', 'rotate(-90)')
      .attr(
        'x',
        0 -
          parseFloat(this.state.clientHeight - this.state.clientMargin.top) / 2
      )
      .attr('y', 8 - truePlotLeft)
      .attr('dy', '0.48em')
      .attr('fill', '#000')
      .attr('font-size', '1.2em')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text(yAxisLabel);
    const yAxisRight = d3.axisRight(yAxisScale).ticks(yTickSteps);
    const yAxisRightCall = d3
      .select(node)
      .append('g')
      .attr('class', 'axis yAxis yAxisRight')
      .attr(
        'transform',
        'translate(' +
          (truePlotWidth -
            this.state.clientPadding.right -
            this.state.clientPadding.left) +
          ',0)'
      )
      .call(yAxisRight);
    yAxisRightCall.selectAll('.tick').each(function (d, i) {
      var label = d3.select(this).select('text');
      label.attr(
        'font-weight',
        AppConst.settings.style.weight.yAxisGenericText
      );
    });
    yAxisRightCall
      .append('text')
      .attr('transform', 'rotate(90)')
      .attr('x', (this.state.clientHeight - this.state.clientMargin.top) / 2.0)
      .attr(
        'y',
        -12 -
          2 * this.state.clientPadding.right -
          2 * this.state.clientPadding.left
      )
      .attr('dy', '0.48em')
      .attr('fill', '#000')
      .attr('font-size', '1.2em')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text(yAxisLabel);

    // x-scale
    const commaFormat = d3.format(',');
    const spaceFormat = function (d, i) {
      return padding > 50
        ? i % 20 == 0
          ? commaFormat(d).replace(/,/g, ' ')
          : ''
        : commaFormat(d).replace(/,/g, ' ');
    };
    const xAxisScale = d3
      .scaleLinear()
      .range([
        truePlotLeft,
        truePlotWidth -
          this.state.clientPadding.right -
          this.state.clientPadding.left,
      ])
      .domain(windowRange);
    const xAxisBottom = d3
      .axisBottom(xAxisScale)
      .ticks(parseInt(windowRangeStopAdjusted - windowRangeStartAdjusted) - 1)
      .tickFormat(function (d, i) {
        var reformat = spaceFormat(d, i);
        if (reformat < leftTFEdge) {
          reformat -= padding;
        } else if (reformat < leftDownstreamEdge) {
          reformat -= padding - 1;
        } else {
          reformat -=
            parseInt(windowRangeStopAdjusted - windowRangeStartAdjusted) -
            padding;
          reformat = '+' + reformat.toString();
        }
        return reformat;
      });
    const xAxisTop = d3.axisTop(xAxisScale).tickValues([]);

    const xAxisBottomCall = d3
      .select(node)
      .append('g')
      .attr('class', 'axis xAxis xAxisBottom')
      .attr('transform', 'translate(0, ' + truePlotBottom + ')')
      .call(xAxisBottom);
    xAxisBottomCall
      .selectAll('text')
      .attr('y', 0)
      .attr('x', -9)
      .attr('dy', '0.32em')
      .attr('fill', '#000')
      .attr('transform', 'rotate(-90)')
      .style('text-anchor', 'end');

    // get x-positions of tick marks for truest alignment of signal and sequence to ticks
    // reformat
    var xAxisTickPositions = new Array();
    var xAxisTickLabels = new Array();
    xAxisBottomCall.selectAll('.tick').each(function (d, i) {
      var tick = d3.select(this);
      var transformation = getTransformAttributes(tick.attr('transform'));
      xAxisTickPositions.push(transformation.translateX);
      var label = tick.select('text');
      label.attr('fill', function (d) {
        if (d < leftTFEdge) {
          return AppConst.settings.style.color.xAxisMoreGenericTextFill;
        } else if (d < leftDownstreamEdge) {
          return AppConst.settings.style.color.xAxisGenericTextFill;
        } else {
          return AppConst.settings.style.color.xAxisMoreGenericTextFill;
        }
      });
      label.attr('font-weight', function (d) {
        if (d < leftTFEdge) {
          return AppConst.settings.style.weight.xAxisGenericText;
        } else if (d < leftDownstreamEdge) {
          return AppConst.settings.style.weight.xAxisHighlightedText;
        } else {
          return AppConst.settings.style.weight.xAxisGenericText;
        }
      });
      label.attr(
        'font-size',
        padding == 20
          ? AppConst.settings.style.size.tickLabelText.large
          : AppConst.settings.style.size.tickLabelText.small
      );
      if (padding > 50 && i % 20 != 0) {
        tick.attr('opacity', 0);
      }
      xAxisTickLabels.push(label.text());
    });
    const truePlotXMidpoint =
      10 +
      xAxisTickPositions[padding] +
      parseFloat(
        (xAxisTickPositions[xAxisTickPositions.length - 1] -
          2 * xAxisTickPositions[padding - 1]) /
          2.0
      );

    xAxisBottomCall
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (7 * this.state.clientMargin.bottom) / 10)
      .attr('dy', '0.48em')
      .attr('fill', '#000')
      .attr('font-size', '1.4em')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text('Relative position');

    // padding rects
    d3.select(node)
      .append('rect')
      .attr('class', 'background')
      .style('fill', '#fff')
      .style('fill-opacity', '0.9')
      .attr('x', xAxisTickPositions[leftTFEdge])
      .attr(
        'y',
        parseFloat(truePlotTop) - AppConst.settings.style.generic.axisTopPadding
      )
      .attr(
        'height',
        truePlotHeight + AppConst.settings.style.generic.axisTopPadding
      )
      .attr(
        'width',
        xAxisTickPositions[rightTFEdge] - xAxisTickPositions[leftTFEdge]
      );

    const xAxisTopCall = d3
      .select(node)
      .append('g')
      .attr('class', 'axis xAxis xAxisTop')
      .attr(
        'transform',
        'translate(0, ' +
          (parseFloat(truePlotTop) -
            AppConst.settings.style.generic.axisTopPadding) +
          ')'
      )
      .call(xAxisTop);

    // title
    var subtitle = sample + ' (' + samples.length + ' experiments)';
    d3.select(node)
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (0.5 * this.state.clientMargin.top) / 10)
      .attr('dy', '0.64em')
      .attr('fill', '#000')
      .attr('font-size', 'larger')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text(tfModel);
    d3.select(node)
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (5.0 * this.state.clientMargin.top) / 10)
      .attr('dy', '0.64em')
      .attr('fill', '#000')
      .attr('font-size', 'smaller')
      .attr('font-weight', 'normal')
      .attr('text-anchor', 'middle')
      .text(subtitle);

    // signal
    if (signalType == 'Bar') {
      d3.select(node)
        .selectAll('.signal')
        .data(signal)
        .enter()
        .append('rect')
        .attr('class', 'signal');
      d3.select(node).selectAll('.signal').data(signal).exit().remove();
      d3.select(node)
        .selectAll('.signal')
        .data(signal)
        .style('fill', AppConst.settings.style.color.signalPrimaryRectFill)
        .attr('x', function (d, i) {
          if (i == 0) {
            return xAxisTickPositions[0];
          } else if (i == signal.length - 1) {
            return (
              xAxisTickPositions[signal.length - 1] - truePlotMarkerWidth / 2.0
            );
          } else {
            return xAxisTickPositions[i] - truePlotMarkerWidth / 2.0;
          }
        })
        .attr(
          'y',
          (d) =>
            this.state.clientHeight -
            yScale(d) -
            this.state.clientMargin.bottom +
            this.state.clientMargin.top
        )
        .attr('height', (d) => yScale(d) - this.state.clientMargin.top)
        .attr('width', function (d, i) {
          return i > 0 && i < signal.length - 1
            ? xAxisTickPositions[i] - xAxisTickPositions[i - 1]
            : i == 0
            ? (xAxisTickPositions[i + 1] - xAxisTickPositions[i]) / 2.0
            : (xAxisTickPositions[i] - xAxisTickPositions[i - 1]) / 2.0;
        });
    } else if (signalType == 'Line') {
      var line = d3
        .line()
        .x(function (d, i) {
          return xAxisTickPositions[i];
        })
        .y(function (d) {
          return (
            self.state.clientHeight -
            yScale(d) -
            self.state.clientMargin.bottom +
            self.state.clientMargin.top
          );
        });
      d3.select(node)
        .append('path')
        .datum(signal)
        .attr('class', 'signal-line')
        .style('fill', AppConst.settings.style.color.signalPrimaryLineFill)
        .style('stroke', AppConst.settings.style.color.signalPrimaryLineStroke)
        .style(
          'stroke-width',
          AppConst.settings.style.size.signal.primaryLineStrokeWidth
        )
        .attr('d', line)
        .on('mouseenter', function (d) {
          var mouse = d3.mouse(this);
          var offsetIdx = Math.floor(
            ((mouse[0] - truePlotLeft) / truePlotLRDiff) * signal.length
          );
          var base = windowRangeStartAdjusted + parseInt(offsetIdx);
          var signalAtPosn = parseFloat(
            Math.round(signal[offsetIdx] * 100) / 100
          ).toFixed(2);
          var posn = '[' + xAxisTickLabels[offsetIdx] + '] ▶ ' + signalAtPosn;

          focus.style('display', null);
          focus.select('text').text(posn);
          if (offsetIdx <= signal.length / 10) {
            focusText.attr('text-anchor', 'start');
          } else if (offsetIdx <= (9 * signal.length) / 10) {
            focusText.attr('text-anchor', 'middle');
          } else {
            focusText.attr('text-anchor', 'end');
          }
          focusCircle.attr('transform', 'translate(0,30)');
          focus.attr(
            'transform',
            'translate(' + mouse[0] + ',' + (mouse[1] - 30) + ')'
          );
          var bbox = focusText._groups[0][0].getBBox();
          var ctm = focusText._groups[0][0].getCTM();
          focus.selectAll('rect').remove();
          var rect = focus
            .insert('rect', 'text')
            .attr('x', bbox.x - 5)
            .attr('y', bbox.y - 5)
            .attr('fill', AppConst.settings.style.color.signalPrimaryFocusFill)
            .attr(
              'stroke',
              AppConst.settings.style.color.signalPrimaryFocusStroke
            )
            .attr('stroke-width', '1px')
            .attr('width', bbox.width + 10)
            .attr('height', bbox.height + 10);
        })
        .on('mouseleave', function (d) {
          focus.style('display', 'none');
          focus.select('text').html(null);
        });
    }

    // motif model edge markers
    d3.select(node)
      .append('g')
      .append('line')
      .attr('class', 'line')
      .attr('x1', xAxisTickPositions[leftTFEdge])
      .attr('y1', truePlotBottom)
      .attr('x2', xAxisTickPositions[leftTFEdge])
      .attr(
        'y2',
        parseFloat(truePlotTop) -
          AppConst.settings.style.generic.probePositionMarkerPadding
      )
      .attr(
        'stroke',
        AppConst.settings.style.color.probePositionMarkerLineStroke
      )
      .attr('stroke-dasharray', '4, 4');
    d3.select(node)
      .append('g')
      .append('line')
      .attr('class', 'line')
      .attr('x1', xAxisTickPositions[rightTFEdge])
      .attr('y1', truePlotBottom)
      .attr('x2', xAxisTickPositions[rightTFEdge])
      .attr(
        'y2',
        parseFloat(truePlotTop) -
          AppConst.settings.style.generic.probePositionMarkerPadding
      )
      .attr(
        'stroke',
        AppConst.settings.style.color.probePositionMarkerLineStroke
      )
      .attr('stroke-dasharray', '4, 4');

    // focus
    var focus = d3
      .select(node)
      .append('g')
      .attr('class', 'focus')
      .style('display', 'none');
    var focusInnerCircle = focus
      .append('circle')
      .attr(
        'fill',
        AppConst.settings.style.color.signalHighlightFocusCircleFill
      )
      .attr('r', 10)
      .style('display', 'none');
    var focusCircle = focus
      .append('circle')
      .attr('fill', AppConst.settings.style.color.signalPrimaryFocusCircleFill)
      .attr(
        'stroke',
        AppConst.settings.style.color.signalPrimaryFocusCircleStroke
      )
      .attr('stroke-width', '2px')
      .attr('r', 7.5);
    var focusText = focus
      .append('text')
      .attr('x', 0)
      .attr('dy', '.31em')
      .attr('fill', AppConst.settings.style.color.signalPrimaryFocusTextFill)
      .attr('font-size', 'smaller')
      .attr('font-weight', 'normal');

    // query probe match markers
    var queryProbeMatchNode = d3
      .select(node)
      .append('g')
      .attr('class', 'probeMatch');

    var queryProbeMatchMarkers = queryProbeMatchNode
      .selectAll('probeMatch')
      .data(queryProbeMatches)
      .enter()
      .append('circle')
      .attr('cx', (d) => {
        var xPosn = xAxisTickPositions[d.position];
        return xPosn;
      })
      .attr('cy', (d) => {
        var yPosn =
          this.state.clientHeight -
          yScale(signal[d.position]) -
          this.state.clientMargin.bottom +
          this.state.clientMargin.top -
          1;
        return yPosn;
      })
      .attr('r', 8)
      .attr(
        'fill',
        AppConst.settings.style.color.signalPrimaryProbeMarkerCircleFill
      )
      .on('mouseenter', (d) => {
        var xPosn = xAxisTickPositions[d.position];
        var yPosn =
          this.state.clientHeight -
          yScale(signal[d.position]) -
          this.state.clientMargin.bottom +
          this.state.clientMargin.top -
          1;
        var offsetIdx = Math.floor(
          ((xPosn - truePlotLeft) / truePlotLRDiff) * signal.length
        );
        var base = windowRangeStartAdjusted + parseInt(offsetIdx);
        var signalAtPosn = parseFloat(
          Math.round(signal[offsetIdx] * 100) / 100
        ).toFixed(2);
        var posn = '[' + xAxisTickLabels[offsetIdx] + '] ▶ ' + signalAtPosn;

        focus.style('display', null);

        focus
          .select('text')
          .attr('text-align', 'left')
          .append('tspan')
          .attr('x', '0')
          .attr('dx', '0')
          .attr('dy', '0')
          .text(posn);
        focus
          .select('text')
          .append('tspan')
          .attr('x', '0')
          .attr('dx', '0')
          .attr('dy', '1.3em')
          .attr('font-weight', 'bold')
          .text(d.probe);

        if (offsetIdx <= signal.length / 10) {
          focusText.attr('text-anchor', 'start');
        } else if (offsetIdx <= (9 * signal.length) / 10) {
          focusText.attr('text-anchor', 'middle');
        } else {
          focusText.attr('text-anchor', 'end');
        }
        focusCircle.style('display', 'none');
        focusInnerCircle.style('display', null);
        focus.attr(
          'transform',
          'translate(' + xPosn + ',' + (yPosn + 45) + ')'
        );
        var bbox = focusText._groups[0][0].getBBox();
        var ctm = focusText._groups[0][0].getCTM();
        focus.selectAll('rect').remove();
        var rect = focus
          .insert('rect', 'text')
          .attr('x', bbox.x - 5)
          .attr('y', bbox.y - 5)
          .attr('fill', AppConst.settings.style.color.signalPrimaryFocusFill)
          .attr(
            'stroke',
            AppConst.settings.style.color.signalPrimaryFocusStroke
          )
          .attr('stroke-width', '1px')
          .attr('width', bbox.width + 10)
          .attr('height', bbox.height + 10);
      })
      .on('mouseleave', (d) => {
        focus.style('display', 'none');
        focus.select('text').html(null);
        focusCircle.style('display', null);
        focusInnerCircle.style('display', 'none');
      });
  }

  render() {
    if (this.props.data.aggregate) {
      return (
        <div className="plot-container" ref="plotContainer" id={this.props.id}>
          <svg
            className="plot-svg"
            shapeRendering="crispEdges"
            ref={(node) => (this.node = node)}
            width={parseFloat(
              this.state.clientWidth -
                this.state.clientMargin.left -
                this.state.clientMargin.right
            )}
            height={parseFloat(this.state.clientHeight)}
          />
        </div>
      );
    } else {
      return (
        <div
          className="plot-container"
          ref="plotContainer"
          id={this.props.id}
        ></div>
      );
    }
  }
}

export default Plot;
