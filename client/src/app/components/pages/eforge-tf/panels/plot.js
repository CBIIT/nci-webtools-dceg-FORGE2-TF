import React from 'react';
import * as d3 from 'd3';
import * as AppConst from '../../../../appConstants';

class Plot extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      clientWidth: -1,
      clientHeight: -1,
      clientMargin: { top: 65, right: 55, bottom: 95, left: 55 },
      clientPadding: { top: 6, right: 10, bottom: 6, left: 6 },
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
    const probe = this.props.data.probe;
    const sample = probe.name;
    const padding = probe.padding;
    const smoothing = probe.smoothing;
    const signalType = probe.signal_type;
    const position =
      probe.position.chromosome +
      ':' +
      probe.position.start +
      '-' +
      probe.position.stop;

    const windowRangeChromosome = probe.window.range.chromosome;
    const windowRangeStart = probe.window.range.start;
    const windowRangeStop = probe.window.range.stop;
    const windowRangeStartAdjusted = probe.position.start - padding;
    const windowRangeStopAdjusted = probe.position.stop + padding - 1;
    const windowRange = [windowRangeStartAdjusted, windowRangeStopAdjusted];
    const windowRangeSequence = Array.from(Array(2 * padding + 1).keys()).map(
      function (i) {
        return parseInt(windowRangeStartAdjusted + i);
      }
    );

    const signalMidpointIndex = parseInt(probe.window.signal.length / 2);
    const signalStartIndex = 0;
    const signalStopIndex = probe.window.signal.length - 1;
    var signal = probe.window.signal;

    // post-process signal with smoothing parameter
    if (smoothing != 0) {
      const mean = (arr) => arr.reduce((p, c) => p + c, 0) / arr.length;
      var newSignal = signal.slice(); // clone
      for (var idx = signalStartIndex; idx < signalStopIndex; idx++) {
        var leftIdx = idx - smoothing;
        var rightIdx = idx + smoothing;
        leftIdx = leftIdx < signalStartIndex ? signalStartIndex : leftIdx;
        rightIdx = rightIdx >= signalStopIndex ? signalStopIndex : rightIdx;
        var signalSubarray = probe.window.signal.slice(leftIdx, rightIdx);
        newSignal[idx] = mean(signalSubarray);
      }
      signal = newSignal;
    }

    var signalMin = d3.min(signal);
    var signalMax = d3.max(signal);
    var signalAdjustment = 0.1 * parseFloat(signalMax - signalMin);

    signalMin -= signalAdjustment;
    signalMax += signalAdjustment;

    // console.log("signalAdjustment, signalMin, signalMax",signalAdjustment,signalMin,signalMax);

    const signalSlop =
      padding > 50 ? 0 : 0.23 * parseFloat(signalMax - signalMin);

    const sequenceMidpointIndex = signalMidpointIndex;
    const sequenceStartIndex = signalStartIndex;
    const sequenceStopIndex = signalStopIndex + 1;
    const sequence = probe.window.sequence.slice(
      sequenceStartIndex,
      sequenceStopIndex
    );

    // Footprint overlaps
    const fp_overlaps = probe.fp_overlaps;
    var fps = [];
    fp_overlaps.forEach(function (d, i) {
      var fpoRangeChromosome = d['chromosome'];
      var fpoRangeStart = parseInt(d['start']);
      var fpoRangeStop = parseInt(d['stop']);
      var fpoRangeSequence = Array.from(
        Array(fpoRangeStop - fpoRangeStart).keys()
      ).map(function (j) {
        return parseInt(fpoRangeStart + j);
      });
      var fpoRangeIndexStartOffset =
        windowRangeSequence[sequenceMidpointIndex] - fpoRangeStart;
      var fpoRangeIndexSequence = Array.from(
        Array(fpoRangeStop - fpoRangeStart).keys()
      ).map(function (j) {
        return parseInt(sequenceMidpointIndex - fpoRangeIndexStartOffset + j);
      });
      fps.push(fpoRangeIndexSequence);
    });

    // selected TF takes precedence over mouseover'ed TF
    var selectedTFRange = this.props.selectedTF
      ? this.props.selectedTF.original.position
      : this.props.mouseoveredTF
      ? this.props.mouseoveredTF.original.position
      : null;
    //    console.log("plot - updatePlot() - selectedTFRange", selectedTFRange);
    if (selectedTFRange) {
      var selectedTFRangeElements = selectedTFRange.split(':');
      var selectedTFRangeChromosome = selectedTFRangeElements[0];
      var selectedTFRangeStartStop = selectedTFRangeElements[1];
      var selectedTFRangeStrand = selectedTFRangeElements[2];
      var selectedTFRangeStartStopElements =
        selectedTFRangeStartStop.split('-');
      var selectedTFRangeStart = parseInt(selectedTFRangeStartStopElements[0]);
      var selectedTFRangeStop = parseInt(selectedTFRangeStartStopElements[1]);
      var selectedTFRangeSequence = Array.from(
        Array(selectedTFRangeStop - selectedTFRangeStart).keys()
      ).map(function (i) {
        return parseInt(selectedTFRangeStart + i);
      });
      var selectedTFRangeIndexStartOffset =
        windowRangeSequence[sequenceMidpointIndex] - selectedTFRangeStart;
      var selectedTFRangeIndexSequence = Array.from(
        Array(selectedTFRangeStop - selectedTFRangeStart).keys()
      ).map(function (i) {
        return parseInt(
          sequenceMidpointIndex - selectedTFRangeIndexStartOffset + i
        );
      });
      //      console.log("plot - updatePlot() - selectedTFRangeChromosome, selectedTFRangeStart, selectedTFRangeStop, selectedTFRangeIndexSequence", selectedTFRangeChromosome, selectedTFRangeStart, selectedTFRangeStop, selectedTFRangeIndexSequence);
    }

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
      .tickFormat(spaceFormat);
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
    xAxisBottomCall.selectAll('.tick').each(function (d, i) {
      var tick = d3.select(this);
      var transformation = getTransformAttributes(tick.attr('transform'));
      xAxisTickPositions.push(transformation.translateX);
      var label = tick.select('text');
      label.attr(
        'fill',
        selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.color.xAxisHighlightedTextFill
          : AppConst.settings.style.color.xAxisGenericTextFill
      );
      label.attr(
        'font-weight',
        selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.weight.xAxisHighlightedText
          : AppConst.settings.style.weight.xAxisGenericText
      );
      label.attr(
        'font-size',
        padding == 20
          ? AppConst.settings.style.size.tickLabelText.large
          : AppConst.settings.style.size.tickLabelText.small
      );
      if (padding > 50 && i % 20 != 0) {
        tick.attr('opacity', 0);
      }
    });
    const truePlotXMidpoint = xAxisTickPositions[padding];

    xAxisBottomCall
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (8 * this.state.clientMargin.bottom) / 10)
      .attr('dy', '0.48em')
      .attr('fill', '#000')
      .attr('font-size', '1.4em')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text(windowRangeChromosome);

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
    d3.select(node)
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (2.5 * this.state.clientMargin.top) / 10)
      .attr('dy', '0.64em')
      .attr('fill', '#000')
      .attr('font-size', 'larger')
      .attr('font-weight', 'bold')
      .attr('text-anchor', 'middle')
      .text(sample);
    d3.select(node)
      .append('text')
      .attr('x', truePlotXMidpoint)
      .attr('y', (5.5 * this.state.clientMargin.top) / 10)
      .attr('dy', '0.64em')
      .attr('fill', '#000')
      .attr('font-size', 'smaller')
      .attr('font-weight', 'normal')
      .attr('text-anchor', 'middle')
      .text(position);

    // Footprint highlight
    d3.select(node)
      .selectAll('.fp-highlight')
      .data(fps)
      .enter()
      .append('g')
      .each(function (d, i) {
        d3.select(this)
          .selectAll('.fp-highlight')
          .data(d)
          .enter()
          .append('rect')
          .attr('class', 'fp-highlight');
        d3.select(this).selectAll('.fp-highlight').data(d).exit().remove();
        d3.select(this)
          .selectAll('.fp-highlight')
          .data(d)
          .style(
            'fill',
            AppConst.settings.style.color.footprintHighlightRectFill
          )
          .style(
            'fill-opacity',
            AppConst.settings.style.color.footprintHighlightRectFillOpacity
          )
          .attr('x', function (datum, i) {
            if (datum == 0) {
              return xAxisTickPositions[0];
            } else if (datum == d.length - 1) {
              return (
                xAxisTickPositions[d.length - 1] - truePlotMarkerWidth / 2.0
              );
            } else {
              return xAxisTickPositions[datum] - truePlotMarkerWidth / 2.0;
            }
          })
          .attr(
            'y',
            (d) =>
              self.state.clientHeight -
              yScale(signalMax + signalSlop) -
              self.state.clientMargin.bottom +
              self.state.clientMargin.top -
              AppConst.settings.style.generic.footprintHighlightPadding
          )
          .attr(
            'height',
            (d) =>
              yScale(signalMax + signalSlop) -
              self.state.clientMargin.top +
              AppConst.settings.style.generic.footprintHighlightPadding
          )
          .attr('width', function (d, i) {
            return d > 0
              ? xAxisTickPositions[d] - xAxisTickPositions[d - 1]
              : xAxisTickPositions[d];
          });
      });

    // TF highlight
    if (selectedTFRange !== null) {
      d3.select(node)
        .selectAll('.tf-highlight')
        .data(selectedTFRangeIndexSequence)
        .enter()
        .append('rect')
        .attr('class', 'tf-highlight');
      d3.select(node)
        .selectAll('.tf-highlight')
        .data(selectedTFRangeIndexSequence)
        .exit()
        .remove();
      d3.select(node)
        .selectAll('.tf-highlight')
        .data(selectedTFRangeIndexSequence)
        .style('fill', AppConst.settings.style.color.signalHighlightRectFill)
        .style(
          'fill-opacity',
          AppConst.settings.style.color.signalHighlightRectFillOpacity
        )
        .attr('x', function (d, i) {
          return xAxisTickPositions[d] - truePlotMarkerWidth / 2.0;
        })
        .attr(
          'y',
          (d) =>
            this.state.clientHeight -
            yScale(signalMax + signalSlop) -
            this.state.clientMargin.bottom +
            this.state.clientMargin.top -
            AppConst.settings.style.generic.signalHighlightPadding
        )
        .attr(
          'height',
          (d) =>
            yScale(signalMax + signalSlop) -
            this.state.clientMargin.top +
            AppConst.settings.style.generic.signalHighlightPadding
        )
        .attr('width', function (d, i) {
          return d > 0
            ? xAxisTickPositions[d] - xAxisTickPositions[d - 1]
            : xAxisTickPositions[d];
        });
    }

    // probe position marker
    d3.select(node)
      .append('g')
      .append('line')
      .attr('class', 'line')
      .attr('x1', truePlotXMidpoint)
      .attr('y1', truePlotBottom)
      .attr('x2', truePlotXMidpoint)
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
      var reformatNumber = function (n, c) {
        if (n < 1000) {
          return n + '';
        } else {
          n += '';

          // Support fractions.
          let i = n.indexOf('.');
          let f = i == -1 ? '' : n.slice(i);
          if (f) n = n.slice(0, i);

          // Add commas.
          i = n.length;
          n = n.split('');
          while (i > 3) n.splice((i -= 3), 0, c);
          return n.join('') + f;
        }
      };
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
      //.curve(d3.curveStep);
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
          var posn =
            '[' +
            probe.position.chromosome +
            '] ' +
            reformatNumber(base, ' ') +
            ' ▶ ' +
            signalAtPosn;

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
        });
    }

    // sequence data
    var sequenceFontSize =
      AppConst.settings.style.size.sequenceGenericText.large;
    var ySequenceCrick = truePlotTop;
    var ySequenceWatson = truePlotTop + 16;
    if (padding == 20) {
      sequenceFontSize = AppConst.settings.style.size.sequenceGenericText.large;
    } else if (padding == 50) {
      sequenceFontSize =
        AppConst.settings.style.size.sequenceGenericText.medium;
    } else {
      sequenceFontSize = AppConst.settings.style.size.sequenceGenericText.small;
    }
    const complement = {
      A: 'T',
      C: 'G',
      G: 'C',
      T: 'A',
      M: 'K',
      K: 'M',
      Y: 'R',
      R: 'Y',
      V: 'B',
      B: 'V',
      H: 'D',
      D: 'H',
      a: 't',
      c: 'g',
      g: 'c',
      t: 'a',
      m: 'k',
      k: 'm',
      y: 'r',
      r: 'y',
      v: 'b',
      b: 'v',
      h: 'd',
      d: 'h',
    };
    d3.select(node)
      .selectAll('.sequence.crick')
      .data(sequence)
      .enter()
      .append('text')
      .attr('class', 'sequence crick');
    d3.select(node).selectAll('.sequence.crick').data(sequence).exit().remove();
    d3.select(node)
      .selectAll('.sequence.crick')
      .data(sequence)
      .attr('x', (d, i) => xAxisTickPositions[i])
      .attr('y', (d) => ySequenceCrick)
      .attr('dy', sequenceFontSize)
      .attr('fill', function (d, i) {
        return selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.color.sequenceHighlightedTextFill
          : AppConst.settings.style.color.sequenceGenericTextFill;
      })
      .attr('font-weight', function (d, i) {
        return selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.weight.sequenceHighlightedText
          : AppConst.settings.style.weight.sequenceGenericText;
      })
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .attr('font-size', sequenceFontSize)
      .text(function (d, i) {
        if (padding > 50) {
          return '';
        }
        if (i <= 2) {
          // print '','5','-' as lead-in for Crick strand
          switch (i) {
            case 0:
              return '';
            case 1:
              return '5';
            case 2:
              return '-';
          }
        } else if (i >= sequence.length - 3) {
          // print '-','3', '' as lead-out
          switch (i) {
            case sequence.length - 3:
              return '-';
            case sequence.length - 2:
              return '3';
            case sequence.length - 1:
              return '';
          }
        } else {
          // just print the complement base
          return d;
        }
      });
    d3.select(node)
      .selectAll('.sequence.watson')
      .data(sequence)
      .enter()
      .append('text')
      .attr('class', 'sequence watson');
    d3.select(node)
      .selectAll('.sequence.watson')
      .data(sequence)
      .exit()
      .remove();
    d3.select(node)
      .selectAll('.sequence.watson')
      .data(sequence)
      .attr('x', (d, i) => xAxisTickPositions[i])
      .attr('y', (d) => ySequenceWatson)
      .attr('dy', sequenceFontSize)
      .attr('fill', function (d, i) {
        return selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.color.sequenceHighlightedTextFill
          : AppConst.settings.style.color.sequenceGenericTextFill;
      })
      .attr('font-weight', function (d, i) {
        return selectedTFRange !== null &&
          windowRangeSequence[i] >= selectedTFRangeStart &&
          windowRangeSequence[i] < selectedTFRangeStop
          ? AppConst.settings.style.weight.sequenceHighlightedText
          : AppConst.settings.style.weight.sequenceGenericText;
      })
      .attr('text-anchor', 'middle')
      .attr('font-family', 'monospace')
      .attr('font-size', sequenceFontSize)
      .text(function (d, i) {
        if (padding > 50) {
          return '';
        }
        if (i <= 2) {
          // print '','3','-' as lead-in for Watson strand
          switch (i) {
            case 0:
              return '';
            case 1:
              return '3';
            case 2:
              return '-';
          }
        } else if (i >= sequence.length - 3) {
          // print '-','5','' as lead-out
          switch (i) {
            case sequence.length - 3:
              return '-';
            case sequence.length - 2:
              return '5';
            case sequence.length - 1:
              return '';
          }
        } else {
          // print the complement base on watson strand
          return complement[d];
        }
      });

    // focus
    var focus = d3
      .select(node)
      .append('g')
      .attr('class', 'focus')
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
  }

  render() {
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
  }
}

export default Plot;
